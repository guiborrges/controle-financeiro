function registerBillImportAiRoutes(app, deps) {
  const {
    noStore,
    requireAuth,
    requireCsrf
  } = deps;

  const provider = String(process.env.BILL_IMPORT_AI_PROVIDER || '').trim().toLowerCase();
  const oracleEndpoint = String(process.env.ORACLE_AI_ENDPOINT || '').trim();
  const oracleApiKey = String(process.env.ORACLE_AI_API_KEY || '').trim();
  const oracleTimeoutMs = Number(process.env.ORACLE_AI_TIMEOUT_MS || 45000);
  const modelName = String(process.env.ORACLE_AI_MODEL || 'oracle-ai').trim();

  function normalizeJsonCandidate(rawText) {
    const text = String(rawText || '').trim();
    if (!text) throw new Error('Resposta vazia da IA.');
    const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) return fenced[1].trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) return text.slice(firstBrace, lastBrace + 1).trim();
    return text;
  }

  function parseJsonPayload(rawText) {
    const candidate = normalizeJsonCandidate(rawText);
    try {
      return JSON.parse(candidate);
    } catch {
      throw new Error('A IA não retornou JSON válido no formato esperado.');
    }
  }

  function moneyToNumber(value) {
    const txt = String(value || '')
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    const n = Number(txt);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeDate(value) {
    const m = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return '';
    return `${m[1]}/${m[2]}/${String(m[3]).slice(-2)}`;
  }

  function parseCsvToFinanceImportV1(csvText) {
    const lines = String(csvText || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length < 2) throw new Error('CSV sem conteúdo suficiente.');
    const header = lines.shift().split(';').map(entry => entry.trim().toLowerCase());
    const idxDate = header.findIndex(name => name === 'data');
    const idxDescription = header.findIndex(name => name.includes('estabelecimento') || name.includes('descri'));
    const idxAmount = header.findIndex(name => name === 'valor' || name.includes('valor'));

    if (idxDate < 0 || idxDescription < 0 || idxAmount < 0) {
      throw new Error('CSV não reconhecido. Esperado: Data;Estabelecimento;...;Valor');
    }

    const items = lines.map(line => {
      const cols = line.split(';');
      const date = normalizeDate(cols[idxDate] || '');
      const description = String(cols[idxDescription] || '').trim() || 'Compra no cartão';
      const amount = moneyToNumber(cols[idxAmount] || '');
      return {
        date,
        description,
        amount,
        card: 'XP',
        category: null,
        needs_review: true,
        warnings: []
      };
    }).filter(item => item.amount > 0 && item.description);

    return {
      format: 'finance_import_v1',
      items
    };
  }

  async function callOracleAi(payload) {
    if (!oracleEndpoint) {
      throw new Error('Integração Oracle AI não configurada. Defina ORACLE_AI_ENDPOINT.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(oracleTimeoutMs) ? oracleTimeoutMs : 45000);
    try {
      const response = await fetch(oracleEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(oracleApiKey ? { Authorization: `Bearer ${oracleApiKey}` } : {}),
          'X-Model': modelName
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const rawText = await response.text();
      if (!response.ok) {
        throw new Error(`Oracle AI retornou ${response.status}: ${rawText.slice(0, 280)}`);
      }
      return parseJsonPayload(rawText);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  app.post('/api/bill-import/parse', noStore, requireAuth, requireCsrf, async (req, res) => {
    const {
      fileName = '',
      mimeType = '',
      contentBase64 = '',
      context = {},
      prompt = ''
    } = req.body || {};

    if (!contentBase64 || typeof contentBase64 !== 'string') {
      return res.status(400).json({ message: 'Arquivo inválido para análise.' });
    }

    if (provider !== 'oracle') {
      return res.status(400).json({
        message: 'Provider de IA para fatura não está habilitado. Defina BILL_IMPORT_AI_PROVIDER=oracle.'
      });
    }

    try {
      const decoded = Buffer.from(contentBase64, 'base64');
      const isCsvFile = /\.csv$/i.test(String(fileName || '')) || String(mimeType || '').toLowerCase().includes('csv');
      if (isCsvFile && !oracleEndpoint) {
        const csvText = decoded.toString('utf8');
        const payload = parseCsvToFinanceImportV1(csvText);
        return res.json({
          ok: true,
          provider: 'oracle-local-csv',
          payload
        });
      }

      const payload = await callOracleAi({
        task: 'parse-credit-card-bill',
        outputFormat: 'finance_import_v1',
        file: {
          name: String(fileName || ''),
          mimeType: String(mimeType || ''),
          contentBase64
        },
        context: context && typeof context === 'object' ? context : {},
        instructions: String(prompt || '').trim()
      });

      return res.json({
        ok: true,
        provider: 'oracle',
        payload
      });
    } catch (error) {
      return res.status(422).json({
        message: error?.message || 'Falha ao interpretar fatura com Oracle AI.'
      });
    }
  });
}

module.exports = { registerBillImportAiRoutes };

