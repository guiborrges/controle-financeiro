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
  const localOciRegion = String(process.env.ORACLE_AI_REGION || process.env.OCI_REGION || 'sa-saopaulo-1').trim();

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { execFileSync } = require('child_process');

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
      version: '1',
      items
    };
  }

  function normalizeDateAny(value) {
    const raw = String(value || '').trim();
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
    if (!m) return '';
    const yy = m[3].length === 2 ? m[3] : m[3].slice(-2);
    return `${m[1]}/${m[2]}/${yy}`;
  }

  function extractTextCandidates(node, bucket) {
    if (!node) return;
    if (typeof node === 'string') {
      const txt = node.trim();
      if (txt) bucket.push(txt);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(entry => extractTextCandidates(entry, bucket));
      return;
    }
    if (typeof node === 'object') {
      Object.values(node).forEach(value => extractTextCandidates(value, bucket));
    }
  }

  function parseItemsFromOciDocumentJson(ociPayload, context = {}) {
    const cardList = Array.isArray(context?.cards?.list) ? context.cards.list : [];
    const fallbackCard = String(cardList[0]?.name || 'XP').trim() || 'XP';
    const rawTexts = [];
    extractTextCandidates(ociPayload, rawTexts);
    const uniqueLines = Array.from(new Set(rawTexts))
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const amountRegex = /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/g;
    const dateRegex = /\b\d{2}\/\d{2}\/(?:\d{2}|\d{4})\b/;

    const items = [];
    uniqueLines.forEach(line => {
      const amounts = line.match(amountRegex);
      if (!amounts || !amounts.length) return;
      const amountRaw = amounts[amounts.length - 1];
      const amount = moneyToNumber(amountRaw);
      if (!(amount > 0)) return;
      const dateMatch = line.match(dateRegex);
      const date = normalizeDateAny(dateMatch?.[0] || '');
      let description = line
        .replace(amountRaw, '')
        .replace(dateRegex, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (!description) description = 'Compra no cartão';
      items.push({
        date,
        description: description.slice(0, 120),
        amount,
        card: fallbackCard,
        category: null,
        needs_review: true,
        warnings: []
      });
    });

    const dedup = new Map();
    items.forEach(item => {
      const key = `${item.date}|${item.description.toUpperCase()}|${item.amount.toFixed(2)}`;
      if (!dedup.has(key)) dedup.set(key, item);
    });
    const normalizedItems = Array.from(dedup.values());
    if (!normalizedItems.length) {
      throw new Error('PDF processado pela OCI, mas nenhum lançamento foi reconhecido automaticamente.');
    }
    return {
      format: 'finance_import_v1',
      version: '1',
      items: normalizedItems
    };
  }

  function analyzePdfWithLocalOci(contentBase64, context = {}) {
    function sleepMs(ms) {
      const sab = new SharedArrayBuffer(4);
      const int32 = new Int32Array(sab);
      Atomics.wait(int32, 0, 0, ms);
    }

    function isRateLimitError(error) {
      const raw = String(error?.stderr || error?.stdout || error?.message || '').toLowerCase();
      return raw.includes('service limits') || raw.includes('sync-transactions-per-second-count');
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bill-oci-'));
    const featuresPath = path.join(tempDir, 'features.json');
    try {
      const features = [
        { featureType: 'KEY_VALUE_EXTRACTION' },
        { featureType: 'TABLE_EXTRACTION' }
      ];
      fs.writeFileSync(featuresPath, JSON.stringify(features), 'utf8');
      const args = [
        'ai-document',
        'analyze-document-result',
        'analyze-document-inline-document-details',
        '--document-data', contentBase64,
        '--features', `file://${featuresPath}`,
        '--document-type', 'INVOICE',
        '--auth', 'api_key',
        '--region', localOciRegion,
        '--output', 'json'
      ];
      let stdout = '';
      const retryDelaysMs = [0, 2000, 5000];
      let lastError = null;
      for (let i = 0; i < retryDelaysMs.length; i += 1) {
        if (retryDelaysMs[i] > 0) sleepMs(retryDelaysMs[i]);
        try {
          stdout = execFileSync('oci', args, {
            encoding: 'utf8',
            maxBuffer: 30 * 1024 * 1024
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (!isRateLimitError(error) || i === retryDelaysMs.length - 1) {
            throw error;
          }
        }
      }
      if (lastError) throw lastError;
      const parsed = JSON.parse(stdout || '{}');
      return parseItemsFromOciDocumentJson(parsed, context);
    } catch (error) {
      const details = String(error?.stderr || error?.stdout || error?.message || '').slice(0, 450);
      if (isRateLimitError(error)) {
        throw new Error('Oracle atingiu limite temporário de requisições por segundo. Aguarde alguns segundos e tente novamente.');
      }
      throw new Error(`Falha ao processar PDF com OCI local: ${details || 'erro desconhecido'}`);
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
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
      const isPdfFile = /\.pdf$/i.test(String(fileName || '')) || String(mimeType || '').toLowerCase().includes('pdf');
      if (isCsvFile && !oracleEndpoint) {
        const csvText = decoded.toString('utf8');
        const payload = parseCsvToFinanceImportV1(csvText);
        return res.json({
          ok: true,
          provider: 'oracle-local-csv',
          payload
        });
      }
      if (isPdfFile && !oracleEndpoint) {
        const payload = analyzePdfWithLocalOci(contentBase64, context);
        return res.json({
          ok: true,
          provider: 'oracle-local-oci-pdf',
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

