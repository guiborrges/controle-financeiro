function registerBillImportAiRoutes(app, deps) {
  let ociPdfQueue = Promise.resolve();
  const {
    noStore,
    requireAuth,
    requireCsrf,
    getAuthenticatedUser,
    readUserAppState,
    writeUserAppState,
    USERS_DATA_DIR
  } = deps;

  const provider = String(process.env.BILL_IMPORT_AI_PROVIDER || '').trim().toLowerCase();
  const oracleEndpoint = String(process.env.ORACLE_AI_ENDPOINT || '').trim();
  const oracleApiKey = String(process.env.ORACLE_AI_API_KEY || '').trim();
  const oracleTimeoutMs = Number(process.env.ORACLE_AI_TIMEOUT_MS || 45000);
  const modelName = String(process.env.ORACLE_AI_MODEL || 'oracle-ai').trim();
  const localOciRegion = String(process.env.ORACLE_AI_REGION || process.env.OCI_REGION || 'sa-saopaulo-1').trim();
  const muplugBaseUrl = String(process.env.MUPLUG_BASE_URL || '').trim().replace(/\/+$/, '');
  const muplugApiKey = String(process.env.MUPLUG_API_KEY || '').trim();
  const muplugParsePath = String(process.env.MUPLUG_PARSE_PATH || '/invoice/parse').trim();

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const crypto = require('crypto');
  const { execFileSync } = require('child_process');
  const userQueues = new Map();

  function buildDefaultInvoiceInstructions() {
    return [
      'VocÃª vai extrair lanÃ§amentos de faturas de cartÃ£o e devolver APENAS um JSON vÃ¡lido.',
      'Use obrigatoriamente o arquivo de contexto "finance_import_context.json" como regra de negÃ³cio.',
      'Regras obrigatÃ³rias:',
      '- output format: finance_import_v1',
      '- version: 1',
      '- nÃ£o criar categorias novas',
      '- usar somente categorias jÃ¡ existentes no contexto',
      '- NÃƒO preencher tag (tag deve ser null)',
      '- nÃ£o criar/sugerir tags',
      '- nÃ£o incluir total da fatura como compra',
      '- ignorar ressarcimentos/estornos/reembolsos do cartÃ£o',
      '- incluir apenas transaÃ§Ãµes',
      '- quando categoria for incerta: category = null, needs_review = true',
      '- pode usar suggested_categories com atÃ© 3 categorias existentes',
      'Campos por item:',
      '- date',
      '- description',
      '- amount',
      '- card_name (ou card_id)',
      '- category (string existente ou null)',
      '- suggested_categories (opcional)',
      '- confidence (0 a 1)',
      '- needs_review (boolean)',
      '- tag (sempre null)',
      '- warnings (opcional)',
      '- source_excerpt (opcional)',
      'Resposta final:',
      '- retornar somente JSON',
      '- sem texto adicional fora do JSON'
    ].join('\n');
  }

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
      throw new Error('A IA nÃ£o retornou JSON vÃ¡lido no formato esperado.');
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
    if (lines.length < 2) throw new Error('CSV sem conteÃºdo suficiente.');
    const header = lines.shift().split(';').map(entry => entry.trim().toLowerCase());
    const idxDate = header.findIndex(name => name === 'data');
    const idxDescription = header.findIndex(name => name.includes('estabelecimento') || name.includes('descri'));
    const idxAmount = header.findIndex(name => name === 'valor' || name.includes('valor'));

    if (idxDate < 0 || idxDescription < 0 || idxAmount < 0) {
      throw new Error('CSV nÃ£o reconhecido. Esperado: Data;Estabelecimento;...;Valor');
    }

    const items = lines.map(line => {
      const cols = line.split(';');
      const date = normalizeDate(cols[idxDate] || '');
      const description = String(cols[idxDescription] || '').trim() || 'Compra no cartÃ£o';
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
    const isLikelyNonTransactionLine = (line = '') => {
      const txt = String(line || '').toLowerCase();
      return txt.includes('fatura')
        || txt.includes('total')
        || txt.includes('pagamento')
        || txt.includes('saldo')
        || txt.includes('limite')
        || txt.includes('vencimento')
        || txt.includes('encargos')
        || txt.includes('juros')
        || txt.includes('multa')
        || txt.includes('anuidade')
        || txt.includes('iof')
        || txt.includes('parcelamento')
        || txt.includes('resumo');
    };

    const items = [];
    uniqueLines.forEach(line => {
      if (isLikelyNonTransactionLine(line)) return;
      const amounts = line.match(amountRegex);
      if (!amounts || !amounts.length) return;
      const amountRaw = amounts[amounts.length - 1];
      const amount = moneyToNumber(amountRaw);
      if (!(amount > 0)) return;
      const dateMatch = line.match(dateRegex);
      if (!dateMatch) return;
      const date = normalizeDateAny(dateMatch?.[0] || '');
      if (!date) return;
      let description = line
        .replace(amountRaw, '')
        .replace(dateRegex, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (!description || description.length < 3) return;
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
      throw new Error('PDF processado pela OCI, mas nenhum lancamento foi reconhecido automaticamente.');
    }
    return {
      format: 'finance_import_v1',
      version: '1',
      items: normalizedItems
    };
  }

  function parseItemsFromRawPdfContent(pdfBuffer, context = {}) {
    const cardList = Array.isArray(context?.cards?.list) ? context.cards.list : [];
    const fallbackCard = String(cardList[0]?.name || 'XP').trim() || 'XP';
    const rawText = String(pdfBuffer.toString('latin1') || '');
    const candidates = rawText
      .split(/[\r\n]+/)
      .map(s => s.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const dateRegex = /(\d{2}\/\d{2}\/(?:\d{2}|\d{4}))/;
    const amountRegex = /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/g;
    const items = [];
    for (const line of candidates) {
      const dateMatch = line.match(dateRegex);
      const amountMatches = line.match(amountRegex);
      if (!dateMatch || !amountMatches || !amountMatches.length) continue;
      const amountRaw = amountMatches[amountMatches.length - 1];
      const amount = moneyToNumber(amountRaw);
      if (!(amount > 0)) continue;
      const date = normalizeDateAny(dateMatch[1]);
      let description = line
        .replace(dateMatch[1], '')
        .replace(amountRaw, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (!description || description.length < 2) description = 'Compra no cartÃ£o';
      items.push({
        date,
        description: description.slice(0, 120),
        amount,
        card: fallbackCard,
        category: null,
        needs_review: true,
        warnings: ['fallback-local-pdf']
      });
    }
    const dedup = new Map();
    items.forEach(item => {
      const key = `${item.date}|${item.description.toUpperCase()}|${item.amount.toFixed(2)}`;
      if (!dedup.has(key)) dedup.set(key, item);
    });
    const normalizedItems = Array.from(dedup.values());
    if (!normalizedItems.length) return null;
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
        const fallbackPayload = parseItemsFromRawPdfContent(Buffer.from(contentBase64, 'base64'), context);
        if (fallbackPayload) return fallbackPayload;
        throw new Error('Oracle atingiu limite temporÃ¡rio de requisiÃ§Ãµes por segundo. Aguarde alguns segundos e tente novamente.');
      }
      throw new Error(`Falha ao processar PDF com OCI local: ${details || 'erro desconhecido'}`);
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
  }

  function enqueueOciPdfAnalysis(contentBase64, context = {}) {
    const run = async () => analyzePdfWithLocalOci(contentBase64, context);
    const next = ociPdfQueue.then(run, run);
    ociPdfQueue = next.catch(() => {});
    return next;
  }

  function safeId() {
    return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function sanitizeFileName(name = '') {
    const base = String(name || 'fatura').trim() || 'fatura';
    return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  }

  function getUserId(req) {
    const user = typeof getAuthenticatedUser === 'function' ? getAuthenticatedUser(req) : null;
    return String(user?.id || '').trim();
  }

  function ensureUserJobDir(userId) {
    const base = path.join(USERS_DATA_DIR, userId, 'invoice-jobs');
    const files = path.join(base, 'files');
    fs.mkdirSync(files, { recursive: true });
    return { base, files };
  }

  function getJobsFilePath(userId) {
    const dirs = ensureUserJobDir(userId);
    return path.join(dirs.base, 'jobs.json');
  }

  function readUserJobs(userId) {
    try {
      const file = getJobsFilePath(userId);
      if (!fs.existsSync(file)) return [];
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeUserJobs(userId, jobs) {
    const file = getJobsFilePath(userId);
    fs.writeFileSync(file, JSON.stringify(Array.isArray(jobs) ? jobs : [], null, 2), 'utf8');
  }

  function updateJob(userId, jobId, patch) {
    const jobs = readUserJobs(userId);
    const idx = jobs.findIndex(job => String(job?.id || '') === String(jobId || ''));
    if (idx < 0) return null;
    jobs[idx] = {
      ...jobs[idx],
      ...patch,
      updatedAt: nowIso()
    };
    writeUserJobs(userId, jobs);
    return jobs[idx];
  }

  function listJobsForClient(userId) {
    return readUserJobs(userId)
      .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
      .map(job => {
        const base = {
          id: job.id,
          fileName: job.fileName,
          uploadedAt: job.createdAt,
          status: job.status,
          progress: Number(job.progress || 0),
          importedAt: job.importedAt || null,
          errorMessage: job.errorMessage || '',
          hasResult: !!job.result
        };
        if (base.status === 'processing') {
          const startedAtMs = Date.parse(String(job.startedAt || job.updatedAt || job.createdAt || ''));
          const elapsed = Number.isFinite(startedAtMs) ? Math.max(0, Date.now() - startedAtMs) : 0;
          const simulated = Math.min(90, Math.max(base.progress, Math.floor(elapsed / 350)));
          base.progress = simulated;
        }
        return base;
      });
  }

  async function processJob(userId, jobId) {
    const jobs = readUserJobs(userId);
    const job = jobs.find(entry => String(entry?.id || '') === String(jobId || ''));
    if (!job) return;
    if (!job.filePath || !fs.existsSync(job.filePath)) {
      updateJob(userId, jobId, {
        status: 'error',
        progress: 100,
        errorMessage: 'Arquivo original nÃ£o encontrado para processamento.'
      });
      return;
    }
    try {
      updateJob(userId, jobId, { status: 'processing', progress: 8, startedAt: nowIso(), errorMessage: '' });
      const content = fs.readFileSync(job.filePath);
      const contentBase64 = content.toString('base64');
      const mimeType = String(job.mimeType || '');
      const fileName = String(job.fileName || '');
      const context = job.context && typeof job.context === 'object' ? job.context : {};
      const isCsvFile = /\.csv$/i.test(fileName) || mimeType.toLowerCase().includes('csv');
      const isPdfFile = /\.pdf$/i.test(fileName) || mimeType.toLowerCase().includes('pdf');
      updateJob(userId, jobId, { progress: 28 });
      let payload = null;
      let providerUsed = provider === 'muplug' ? 'muplug' : 'oracle';
      if (isCsvFile && !oracleEndpoint) {
        payload = parseCsvToFinanceImportV1(content.toString('utf8'));
        providerUsed = 'oracle-local-csv';
      } else if (provider === 'muplug') {
        payload = await callMuplugAi({
          fileName,
          mimeType,
          contentBase64,
          context
        });
        providerUsed = 'muplug';
      } else if (isPdfFile && !oracleEndpoint) {
        payload = await enqueueOciPdfAnalysis(contentBase64, context);
        providerUsed = 'oracle-local-oci-pdf';
      } else {
        payload = await callOracleAi({
          task: 'parse-credit-card-bill',
          outputFormat: 'finance_import_v1',
          file: { name: fileName, mimeType, contentBase64 },
          context,
          instructions: String(job.prompt || '').trim()
        });
      }
      updateJob(userId, jobId, {
        status: 'completed',
        progress: 100,
        result: payload,
        provider: providerUsed,
        completedAt: nowIso()
      });
    } catch (error) {
      updateJob(userId, jobId, {
        status: 'error',
        progress: 100,
        errorMessage: String(error?.message || 'Falha no processamento da fatura.')
      });
    }
  }

  function enqueueUserJob(userId, jobId) {
    const prev = userQueues.get(userId) || Promise.resolve();
    const next = prev.then(() => processJob(userId, jobId)).catch(() => processJob(userId, jobId));
    userQueues.set(userId, next.catch(() => {}));
    return next;
  }

  function normalizeImportDate(value) {
    const raw = String(value || '').trim();
    let m = raw.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (m) return `${m[1]}/${m[2]}/${m[3]}`;
    m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[1]}/${m[2]}/${String(m[3]).slice(-2)}`;
    return '';
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeDesc(value) {
    return normalizeText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function getMonthIdFromDateAndData(date, data) {
    const normalized = normalizeImportDate(date);
    if (!normalized) return '';
    const parts = normalized.split('/');
    const month = Number(parts[1] || 0);
    const year = 2000 + Number(parts[2] || 0);
    const list = Array.isArray(data) ? data : [];
    const found = list.find(entry => {
      const id = String(entry?.id || '');
      const yearMatch = id.match(/_(20\d{2})$/);
      if (!yearMatch) return false;
      if (Number(yearMatch[1] || 0) !== year) return false;
      const slug = id.split('_')[0];
      const monthMap = {
        janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
        julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
      };
      return monthMap[String(slug || '').toLowerCase()] === month;
    });
    return found?.id || '';
  }

  function buildDedupKey(item) {
    return [
      normalizeText(item.cardId || '').toLowerCase(),
      normalizeImportDate(item.date),
      Number(Number(item.amount || 0).toFixed(2)),
      normalizeDesc(item.description)
    ].join('|');
  }

  async function callOracleAi(payload) {
    if (!oracleEndpoint) {
      throw new Error('IntegraÃ§Ã£o Oracle AI nÃ£o configurada. Defina ORACLE_AI_ENDPOINT.');
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

  async function callMuplugAi({ fileName = '', mimeType = '', contentBase64 = '', context = {} }) {
    if (!muplugBaseUrl || !muplugApiKey) {
      throw new Error('IntegraÃ§Ã£o Muplug nÃ£o configurada. Defina MUPLUG_BASE_URL e MUPLUG_API_KEY.');
    }
    const endpoint = `${muplugBaseUrl}${muplugParsePath.startsWith('/') ? muplugParsePath : `/${muplugParsePath}`}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${muplugApiKey}`
      },
      body: JSON.stringify({ fileName, mimeType, contentBase64, context })
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Muplug retornou ${response.status}: ${raw.slice(0, 280)}`);
    let payload = null;
    try {
      payload = JSON.parse(raw || '{}');
    } catch {
      throw new Error('Muplug retornou JSON invÃ¡lido.');
    }
    if (Array.isArray(payload?.transactions)) {
      const items = payload.transactions.map((tx) => ({
        date: normalizeDateAny(tx?.date || ''),
        description: String(tx?.description || 'Compra no cartÃ£o').trim(),
        amount: moneyToNumber(tx?.amount || 0),
        card: String(tx?.cardName || '').trim() || 'CartÃ£o',
        category: String(tx?.category || '').trim() || null,
        needs_review: true,
        warnings: []
      })).filter(item => item.amount > 0 && item.description);
      return { format: 'finance_import_v1', version: '1', items };
    }
    if (Array.isArray(payload?.items)) {
      return { format: 'finance_import_v1', version: '1', items: payload.items };
    }
    throw new Error('Muplug nÃ£o retornou transaÃ§Ãµes vÃ¡lidas.');
  }

  async function checkMuplugConnection() {
    if (!muplugBaseUrl || !muplugApiKey) return false;
    const testPaths = ['/health', '/status', '/ping'];
    for (let i = 0; i < testPaths.length; i += 1) {
      try {
        const response = await fetch(`${muplugBaseUrl}${testPaths[i]}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${muplugApiKey}` }
        });
        if (response.ok || [401, 403, 404].includes(response.status)) return true;
      } catch (_) {}
    }
    return false;
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
      return res.status(400).json({ message: 'Arquivo invÃ¡lido para anÃ¡lise.' });
    }

    if (!['oracle', 'muplug'].includes(provider)) {
      return res.status(400).json({
        message: 'Provider de IA para fatura nÃ£o estÃ¡ habilitado. Defina BILL_IMPORT_AI_PROVIDER=oracle.'
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
        const payload = await enqueueOciPdfAnalysis(contentBase64, context);
        return res.json({
          ok: true,
          provider: 'oracle-local-oci-pdf',
          payload
        });
      }

      const effectiveInstructions = String(prompt || '').trim() || buildDefaultInvoiceInstructions();
      const payload = await callOracleAi({
        task: 'parse-credit-card-bill',
        outputFormat: 'finance_import_v1',
        file: {
          name: String(fileName || ''),
          mimeType: String(mimeType || ''),
          contentBase64
        },
        context: context && typeof context === 'object' ? context : {},
        instructions: effectiveInstructions
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

  app.post('/api/invoice/upload', noStore, requireAuth, requireCsrf, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    if (!['oracle', 'muplug'].includes(provider)) {
      return res.status(400).json({ message: 'Provider de IA para fatura nÃ£o estÃ¡ habilitado.' });
    }
    const {
      fileName = 'fatura',
      mimeType = '',
      contentBase64 = '',
      context = {},
      prompt = ''
    } = req.body || {};
    if (!contentBase64 || typeof contentBase64 !== 'string') {
      return res.status(400).json({ message: 'Arquivo invÃ¡lido para upload.' });
    }
    try {
      const id = safeId();
      const dirs = ensureUserJobDir(userId);
      const safeName = sanitizeFileName(fileName);
      const filePath = path.join(dirs.files, `${id}_${safeName}`);
      fs.writeFileSync(filePath, Buffer.from(contentBase64, 'base64'));
      const effectivePrompt = String(prompt || '').trim() || buildDefaultInvoiceInstructions();
      const job = {
        id,
        userId,
        fileName: safeName,
        mimeType: String(mimeType || ''),
        filePath,
        prompt: effectivePrompt,
        context: context && typeof context === 'object' ? context : {},
        status: 'uploaded',
        progress: 0,
        result: null,
        errorMessage: '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        importedAt: null
      };
      const jobs = readUserJobs(userId);
      jobs.push(job);
      writeUserJobs(userId, jobs);
      enqueueUserJob(userId, id);
      return res.json({ ok: true, jobId: id, status: job.status, progress: job.progress });
    } catch (error) {
      return res.status(500).json({ message: error?.message || 'Falha ao enviar fatura.' });
    }
  });

  app.get('/api/invoice/status', noStore, requireAuth, (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    return res.json({ ok: true, jobs: listJobsForClient(userId) });
  });

  app.get('/api/invoice/result/:jobId', noStore, requireAuth, (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    const jobId = String(req.params?.jobId || '');
    const job = readUserJobs(userId).find(entry => String(entry?.id || '') === jobId);
    if (!job) return res.status(404).json({ message: 'Fatura nÃ£o encontrada.' });
    return res.json({
      ok: true,
      id: job.id,
      status: job.status,
      progress: Number(job.progress || 0),
      result: job.result || null,
      errorMessage: job.errorMessage || ''
    });
  });

  app.post('/api/invoice/reprocess/:jobId', noStore, requireAuth, requireCsrf, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    const jobId = String(req.params?.jobId || '');
    const existing = readUserJobs(userId).find(entry => String(entry?.id || '') === jobId);
    if (!existing) return res.status(404).json({ message: 'Fatura nÃ£o encontrada.' });
    updateJob(userId, jobId, {
      status: 'uploaded',
      progress: 0,
      result: null,
      errorMessage: '',
      importedAt: null
    });
    enqueueUserJob(userId, jobId);
    return res.json({ ok: true });
  });

  app.post('/api/invoice/import', noStore, requireAuth, requireCsrf, (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    const jobId = String(req.body?.jobId || '');
    if (!jobId) return res.status(400).json({ message: 'jobId Ã© obrigatÃ³rio.' });
    const jobs = readUserJobs(userId);
    const job = jobs.find(entry => String(entry?.id || '') === jobId);
    if (!job) return res.status(404).json({ message: 'Fatura nÃ£o encontrada.' });
    if (job.status === 'imported') {
      return res.json({ ok: true, imported: 0, duplicates: 0, alreadyImported: true });
    }
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : (job.result || null);
    if (!payload || !Array.isArray(payload.items)) {
      return res.status(400).json({ message: 'Resultado da fatura nÃ£o disponÃ­vel para importaÃ§Ã£o.' });
    }
    try {
      const current = readUserAppState(userId, req.session?.dataEncryptionKey || '');
      const state = current?.state || {};
      const data = Array.isArray(state?.data) ? state.data : [];
      const selected = payload.items.filter(item => item && item.include !== false);
      const dedupSet = new Set();
      let imported = 0;
      let duplicates = 0;
      let skippedMonth = 0;
      selected.forEach(item => {
        const monthId = getMonthIdFromDateAndData(item.date, data);
        const month = data.find(entry => String(entry?.id || '') === String(monthId || ''));
        if (!month) {
          skippedMonth += 1;
          return;
        }
        const outflows = Array.isArray(month.outflows) ? month.outflows : [];
        const cardId = normalizeText(item.cardId || item.card || item.card_id || '');
        const next = {
          id: `bill_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          description: normalizeText(item.description),
          type: 'spend',
          category: normalizeText(item.category || ''),
          amount: Number(item.amount || 0),
          outputKind: 'card',
          outputRef: cardId,
          outputMethod: '',
          date: normalizeImportDate(item.date),
          tag: normalizeText(item.tag || ''),
          status: 'done',
          paid: false,
          countsInPrimaryTotals: false,
          recurringSpend: false,
          recurringGroupId: '',
          installmentsGroupId: '',
          installmentsTotal: 1,
          installmentIndex: 1,
          createdAt: nowIso()
        };
        const key = buildDedupKey({ ...next, cardId });
        if (!cardId || !next.date || !(next.amount > 0) || !next.description) {
          duplicates += 1;
          return;
        }
        if (dedupSet.has(`${month.id}|${key}`)) {
          duplicates += 1;
          return;
        }
        const exists = outflows.some(flow => {
          if (String(flow?.outputKind || '') !== 'card') return false;
          const flowKey = buildDedupKey({
            cardId: flow?.outputRef,
            date: flow?.date,
            amount: flow?.amount,
            description: flow?.description
          });
          return flowKey === key;
        });
        if (exists) {
          duplicates += 1;
          return;
        }
        dedupSet.add(`${month.id}|${key}`);
        outflows.push(next);
        month.outflows = outflows;
        imported += 1;
      });
      state.data = data;
      const written = writeUserAppState(userId, state, req.session?.dataEncryptionKey || '');
      updateJob(userId, jobId, {
        status: 'imported',
        importedAt: nowIso(),
        importedCount: imported,
        duplicateCount: duplicates,
        skippedMonthCount: skippedMonth,
        stateRevisionAfterImport: written?.updatedAt || ''
      });
      return res.json({ ok: true, imported, duplicates, skippedMonth, updatedAt: written?.updatedAt || '' });
    } catch (error) {
      return res.status(500).json({ message: error?.message || 'Falha ao importar fatura para o sistema.' });
    }
  });

  app.get('/api/muplug/connection', noStore, requireAuth, async (_req, res) => {
    const connected = await checkMuplugConnection();
    return res.json({ ok: true, connected, hasApiKey: !!muplugApiKey });
  });

  app.post('/api/muplug/upload', noStore, requireAuth, requireCsrf, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    if (!['oracle', 'muplug'].includes(provider)) {
      return res.status(400).json({ message: 'Provider de IA para fatura nÃ£o estÃ¡ habilitado.' });
    }
    const {
      fileName = 'fatura',
      mimeType = '',
      contentBase64 = '',
      context = {},
      prompt = ''
    } = req.body || {};
    if (!contentBase64 || typeof contentBase64 !== 'string') {
      return res.status(400).json({ message: 'Arquivo invÃ¡lido para upload.' });
    }
    try {
      const id = safeId();
      const dirs = ensureUserJobDir(userId);
      const safeName = sanitizeFileName(fileName);
      const filePath = path.join(dirs.files, `${id}_${safeName}`);
      fs.writeFileSync(filePath, Buffer.from(contentBase64, 'base64'));
      const effectivePrompt = String(prompt || '').trim() || buildDefaultInvoiceInstructions();
      const job = {
        id,
        userId,
        fileName: safeName,
        mimeType: String(mimeType || ''),
        filePath,
        prompt: effectivePrompt,
        context: context && typeof context === 'object' ? context : {},
        status: 'uploaded',
        progress: 0,
        result: null,
        errorMessage: '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        importedAt: null
      };
      const jobs = readUserJobs(userId);
      jobs.push(job);
      writeUserJobs(userId, jobs);
      enqueueUserJob(userId, id);
      return res.json({ ok: true, jobId: id, status: job.status, progress: job.progress });
    } catch (error) {
      return res.status(500).json({ message: error?.message || 'Falha ao enviar fatura.' });
    }
  });

  app.get('/api/muplug/jobs', noStore, requireAuth, (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    return res.json({ ok: true, jobs: listJobsForClient(userId) });
  });

  app.get('/api/muplug/status/:jobId', noStore, requireAuth, (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    const job = readUserJobs(userId).find(entry => String(entry?.id || '') === String(req.params?.jobId || ''));
    if (!job) return res.status(404).json({ message: 'Fatura nÃ£o encontrada.' });
    const item = listJobsForClient(userId).find(entry => entry.id === job.id) || null;
    return res.json({ ok: true, job: item });
  });

  app.get('/api/muplug/result/:jobId', noStore, requireAuth, (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    const job = readUserJobs(userId).find(entry => String(entry?.id || '') === String(req.params?.jobId || ''));
    if (!job) return res.status(404).json({ message: 'Fatura nÃ£o encontrada.' });
    return res.json({
      ok: true,
      id: job.id,
      status: job.status,
      progress: Number(job.progress || 0),
      result: job.result || null,
      errorMessage: job.errorMessage || ''
    });
  });

  app.post('/api/muplug/reprocess/:jobId', noStore, requireAuth, requireCsrf, (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    const jobId = String(req.params?.jobId || '');
    const existing = readUserJobs(userId).find(entry => String(entry?.id || '') === jobId);
    if (!existing) return res.status(404).json({ message: 'Fatura nÃ£o encontrada.' });
    updateJob(userId, jobId, {
      status: 'uploaded',
      progress: 0,
      result: null,
      errorMessage: '',
      importedAt: null
    });
    enqueueUserJob(userId, jobId);
    return res.json({ ok: true });
  });

  app.post('/api/muplug/import', noStore, requireAuth, requireCsrf, (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'SessÃ£o invÃ¡lida.' });
    const jobId = String(req.body?.jobId || '');
    if (!jobId) return res.status(400).json({ message: 'jobId Ã© obrigatÃ³rio.' });
    const jobs = readUserJobs(userId);
    const job = jobs.find(entry => String(entry?.id || '') === jobId);
    if (!job) return res.status(404).json({ message: 'Fatura nÃ£o encontrada.' });
    if (job.status === 'imported') {
      return res.json({ ok: true, imported: 0, duplicates: 0, alreadyImported: true });
    }
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : (job.result || null);
    if (!payload || !Array.isArray(payload.items)) {
      return res.status(400).json({ message: 'Resultado da fatura nÃ£o disponÃ­vel para importaÃ§Ã£o.' });
    }
    try {
      const current = readUserAppState(userId, req.session?.dataEncryptionKey || '');
      const state = current?.state || {};
      const data = Array.isArray(state?.data) ? state.data : [];
      const selected = payload.items.filter(item => item && item.include !== false);
      const dedupSet = new Set();
      let imported = 0;
      let duplicates = 0;
      let skippedMonth = 0;
      selected.forEach(item => {
        const monthId = getMonthIdFromDateAndData(item.date, data);
        const month = data.find(entry => String(entry?.id || '') === String(monthId || ''));
        if (!month) { skippedMonth += 1; return; }
        const outflows = Array.isArray(month.outflows) ? month.outflows : [];
        const cardId = normalizeText(item.cardId || item.card || item.card_id || '');
        const next = {
          id: `bill_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          description: normalizeText(item.description),
          type: 'spend',
          category: normalizeText(item.category || ''),
          amount: Number(item.amount || 0),
          outputKind: 'card',
          outputRef: cardId,
          outputMethod: '',
          date: normalizeImportDate(item.date),
          tag: normalizeText(item.tag || ''),
          status: 'done',
          paid: false,
          countsInPrimaryTotals: false,
          recurringSpend: false,
          recurringGroupId: '',
          installmentsGroupId: '',
          installmentsTotal: 1,
          installmentIndex: 1,
          createdAt: nowIso()
        };
        const key = buildDedupKey({ ...next, cardId });
        if (!cardId || !next.date || !(next.amount > 0) || !next.description) { duplicates += 1; return; }
        if (dedupSet.has(`${month.id}|${key}`)) { duplicates += 1; return; }
        const exists = outflows.some(flow => {
          if (String(flow?.outputKind || '') !== 'card') return false;
          const flowKey = buildDedupKey({
            cardId: flow?.outputRef,
            date: flow?.date,
            amount: flow?.amount,
            description: flow?.description
          });
          return flowKey === key;
        });
        if (exists) { duplicates += 1; return; }
        dedupSet.add(`${month.id}|${key}`);
        outflows.push(next);
        month.outflows = outflows;
        imported += 1;
      });
      state.data = data;
      const written = writeUserAppState(userId, state, req.session?.dataEncryptionKey || '');
      updateJob(userId, jobId, {
        status: 'imported',
        importedAt: nowIso(),
        importedCount: imported,
        duplicateCount: duplicates,
        skippedMonthCount: skippedMonth,
        stateRevisionAfterImport: written?.updatedAt || ''
      });
      return res.json({ ok: true, imported, duplicates, skippedMonth, updatedAt: written?.updatedAt || '' });
    } catch (error) {
      return res.status(500).json({ message: error?.message || 'Falha ao importar fatura para o sistema.' });
    }
  });
}

module.exports = { registerBillImportAiRoutes };



