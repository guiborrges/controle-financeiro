(function (global) {
  'use strict';

  const state = {
    jobs: [],
    pollingTimer: null,
    activeJobId: '',
    statusHideTimer: null,
    muplugConnection: {
      connected: false,
      apiKey: ''
    },
    bankPreview: {
      loading: false,
      error: '',
      connections: [],
      transactions: [],
      lastUpdatedAt: ''
    }
  };

  function showStatus(message, tone = 'ok', title = 'Importação por fatura', autoHideMs = null) {
    if (typeof global.showAppStatus === 'function') {
      global.showAppStatus(message, title, tone);
      if (state.statusHideTimer) clearTimeout(state.statusHideTimer);
      if (Number(autoHideMs || 0) > 0 && typeof global.hideAppStatus === 'function') {
        state.statusHideTimer = setTimeout(() => global.hideAppStatus(), Number(autoHideMs));
      }
      return;
    }
    if (tone === 'error') alert(message);
  }

  function getCsrfHeaders(extraHeaders = {}) {
    const token = global.__CSRF_TOKEN__ || '';
    return token ? { ...extraHeaders, 'X-CSRF-Token': token } : { ...extraHeaders };
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function fmtDateTime(value) {
    const ms = Date.parse(String(value || ''));
    if (!Number.isFinite(ms)) return '--';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms));
  }

  function escapeHtml(value) {
    const html = global.HtmlUtils?.escapeHtml;
    if (typeof html === 'function') return html(value);
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function statusLabel(status) {
    const map = {
      uploaded: 'uploaded',
      processing: 'processing',
      completed: 'completed',
      error: 'error',
      imported: 'imported'
    };
    return map[String(status || '').toLowerCase()] || 'uploaded';
  }

  function renderConnectionBadge() {
    const invoiceBadge = document.getElementById('muplugConnectionBadge');
    const bankBadge = document.getElementById('muplugConnectionHeaderBadge');
    const connected = state.muplugConnection.connected === true;
    [invoiceBadge, bankBadge].filter(Boolean).forEach(node => {
      node.classList.remove('is-connected', 'is-disconnected');
      node.classList.add(connected ? 'is-connected' : 'is-disconnected');
    });
    if (invoiceBadge) {
      invoiceBadge.title = connected ? 'Conectado à importação de faturas (IA)' : 'Importação de faturas (IA) indisponível';
    }
    if (bankBadge) {
      bankBadge.title = connected ? 'Conectado ao internet banking' : 'Desconectado do internet banking';
    }
  }

  function ensureInternetBankingModal() {
    if (document.getElementById('modalInternetBankingPreview')) return;
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.id = 'modalInternetBankingPreview';
    modal.innerHTML = `
      <div class="modal" style="max-width:880px" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>Internet banking (pré-visualização)</h3>
          <button class="btn-icon" type="button" onclick="BillImport.closeInternetBankingPreview()">✕</button>
        </div>
        <p class="modal-subcopy">
          Esses dados vieram do Pluggy e ainda não foram inseridos automaticamente no seu sistema financeiro.
        </p>
        <div id="internetBankingPreviewStatus" class="text-muted" style="margin-bottom:10px;font-size:12px"></div>
        <div id="internetBankingPreviewConnections" style="margin-bottom:12px"></div>
        <div id="internetBankingPreviewBody" style="max-height:420px;overflow:auto;border:1px solid var(--border-color);border-radius:12px;padding:12px"></div>
        <div class="form-actions" style="margin-top:16px">
          <button class="btn btn-ghost" type="button" onclick="BillImport.loadInternetBankingPreview()">Atualizar</button>
          <button class="btn btn-primary" type="button" onclick="BillImport.closeInternetBankingPreview()">Fechar</button>
        </div>
      </div>
    `;
    modal.addEventListener('click', event => {
      if (event.target && event.target.id === 'modalInternetBankingPreview') {
        closeInternetBankingPreview();
      }
    });
    document.body.appendChild(modal);
  }

  function fmtMoney(value) {
    const n = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n) ? n : 0);
  }

  function fmtShortDate(value) {
    const ms = Date.parse(String(value || ''));
    if (!Number.isFinite(ms)) return '--';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(ms));
  }

  function renderInternetBankingPreview() {
    ensureInternetBankingModal();
    const statusNode = document.getElementById('internetBankingPreviewStatus');
    const connectionsNode = document.getElementById('internetBankingPreviewConnections');
    const bodyNode = document.getElementById('internetBankingPreviewBody');
    if (!statusNode || !connectionsNode || !bodyNode) return;

    if (state.bankPreview.loading) {
      statusNode.textContent = 'Carregando dados do internet banking...';
      return;
    }
    if (state.bankPreview.error) {
      statusNode.textContent = state.bankPreview.error;
      bodyNode.innerHTML = '';
      connectionsNode.innerHTML = '';
      return;
    }

    statusNode.textContent = state.bankPreview.lastUpdatedAt
      ? `Ultima atualizacao: ${fmtDateTime(state.bankPreview.lastUpdatedAt)}`
      : 'Sem atualizacao registrada ainda.';

    const connections = Array.isArray(state.bankPreview.connections) ? state.bankPreview.connections : [];
    if (!connections.length) {
      connectionsNode.innerHTML = '<div class="text-muted" style="font-size:12px">Nenhuma conexao bancaria registrada para este usuario.</div>';
    } else {
      connectionsNode.innerHTML = connections.map(connection => `
        <span class="bill-import-job-badge is-${escapeHtml(String(connection.status || '').toLowerCase() || 'uploaded')}" style="margin-right:6px">
          ${escapeHtml(connection.providerName || connection.pluggyItemId || 'Conexao')} � ${escapeHtml(connection.status || 'unknown')}
        </span>
      `).join('');
    }

    const transactions = Array.isArray(state.bankPreview.transactions) ? state.bankPreview.transactions : [];
    if (!transactions.length) {
      bodyNode.innerHTML = '<div class="text-muted" style="padding:12px 16px">Nenhuma movimentacao disponivel para pre-visualizacao.</div>';
      return;
    }

    const groups = {
      CARTAO_CREDITO: new Map(),
      CONTA_CORRENTE: new Map(),
      OUTROS: new Map()
    };

    transactions.forEach(tx => {
      const rawType = String(tx.recordType || '').toUpperCase();
      const type = rawType === 'CARTAO_CREDITO'
        ? 'CARTAO_CREDITO'
        : rawType === 'CONTA_CORRENTE'
          ? 'CONTA_CORRENTE'
          : 'OUTROS';
      const key = String(tx.accountId || tx.accountName || tx.itemId || 'sem-conta');
      const name = String(tx.accountName || tx.accountId || tx.itemId || 'Conta sem nome');

      if (!groups[type].has(key)) groups[type].set(key, { name, rows: [] });
      groups[type].get(key).rows.push(tx);
    });

    function renderRows(rows) {
      return rows.map(tx => {
        const amount = Number(tx.amount || 0);
        const amountClass = amount < 0 ? 'amount-neg' : 'amount-pos';
        return `
          <tr>
            <td style="padding-left:16px">${escapeHtml(fmtShortDate(tx.date))}</td>
            <td>${escapeHtml(tx.description || '--')}</td>
            <td class="${amountClass}">${escapeHtml(fmtMoney(amount))}</td>
          </tr>
        `;
      }).join('');
    }

    function renderAccountBlock(account) {
      return `
        <div style="border:1px solid var(--border-color);border-radius:10px;overflow:hidden;margin-bottom:12px">
          <div style="padding:8px 12px;font-weight:700;background:var(--surface-2, var(--bg-card));border-bottom:1px solid var(--border-color)">
            ${escapeHtml(account.name)}
          </div>
          <table class="fin-table" style="margin:0">
            <thead>
              <tr>
                <th style="padding-left:16px">Data</th>
                <th>Descricao</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${renderRows(account.rows)}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderSection(title, map) {
      const accounts = Array.from(map.values());
      if (!accounts.length) return '';
      return `
        <section style="margin-bottom:12px">
          <h4 style="margin:0 0 8px 0;font-size:13px;letter-spacing:.02em">${escapeHtml(title)}</h4>
          ${accounts.map(renderAccountBlock).join('')}
        </section>
      `;
    }

    bodyNode.innerHTML = [
      renderSection('Cartoes de credito', groups.CARTAO_CREDITO),
      renderSection('Contas correntes', groups.CONTA_CORRENTE),
      renderSection('Outras movimentacoes', groups.OUTROS)
    ].join('');
  }

  function getCurrentContext() {
    const context = global.BillImportUtils.buildImportContext(global.data || [], global.currentSession || {});
    const cards = global.BillImportUtils.getAllCardsFromUserData(global.data || []);
    const categories = global.BillImportUtils.getAllCategoriesFromUserData(global.data || []);
    return {
      ...context,
      cards,
      categories,
      data: global.data || []
    };
  }

  function getDefaultAiPrompt() {
    if (typeof global.BillImportUtils?.buildExternalAiPrompt === 'function') {
      return global.BillImportUtils.buildExternalAiPrompt('finance_import_context.json');
    }
    return '';
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result || '');
        const base64 = raw.includes(',') ? raw.split(',').pop() : raw;
        if (!base64) return reject(new Error('Falha ao converter arquivo para base64.'));
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  function renderJobs() {
    const node = document.getElementById('billImportJobsList');
    if (!node) return;
    if (!state.jobs.length) {
      node.innerHTML = '<div class="text-muted" style="padding:10px 2px">Nenhuma fatura enviada ainda.</div>';
      return;
    }
    node.innerHTML = state.jobs.map(job => {
      const status = statusLabel(job.status);
      const progress = Math.max(0, Math.min(100, Number(job.progress || 0)));
      const canOpen = status === 'completed' || status === 'imported';
      const canRetry = status === 'error';
      return `
        <div class="bill-import-job-row">
          <div class="bill-import-job-main">
            <div class="bill-import-job-name">${escapeHtml(job.fileName || 'fatura')}</div>
            <div class="bill-import-job-meta">${escapeHtml(fmtDateTime(job.uploadedAt))}</div>
          </div>
          <div class="bill-import-job-side">
            <span class="bill-import-job-badge is-${escapeHtml(status)}">${escapeHtml(status)}</span>
            ${status === 'processing' || status === 'uploaded'
              ? `<div class="bill-import-progress"><div class="bill-import-progress-bar" style="width:${progress}%"></div></div>`
              : ''}
            <div class="bill-import-job-actions">
              ${canOpen ? `<button class="btn btn-ghost" type="button" onclick="BillImport.openJobPreview('${escapeHtml(job.id)}')">Revisar</button>` : ''}
              ${canRetry ? `<button class="btn btn-ghost" type="button" onclick="BillImport.reprocessJob('${escapeHtml(job.id)}')">Reprocessar</button>` : ''}
            </div>
            ${status === 'error' && job.errorMessage ? `<div class="bill-import-job-error">${escapeHtml(job.errorMessage)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async function refreshStatus() {
    const response = await fetch('/api/invoice/status', {
      method: 'GET',
      credentials: 'same-origin',
      headers: getCsrfHeaders({ Accept: 'application/json' })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || 'Falha ao consultar status das faturas.');
    state.jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
    renderJobs();
  }

  async function refreshConnection() {
    try {
      const response = await fetch('/api/pluggy/connection', {
        method: 'GET',
        credentials: 'same-origin',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Falha ao validar conexão do internet banking.');
      state.muplugConnection.connected = payload?.connected === true;
      state.muplugConnection.apiKey = '';
    } catch (_error) {
      state.muplugConnection.connected = false;
      state.muplugConnection.apiKey = '';
    }
    renderConnectionBadge();
  }

  async function loadInternetBankingPreview() {
    state.bankPreview.loading = true;
    state.bankPreview.error = '';
    renderInternetBankingPreview();
    try {
      const response = await fetch('/api/pluggy/preview?limit=300', {
        method: 'GET',
        credentials: 'same-origin',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Falha ao carregar pré-visualização do internet banking.');
      state.muplugConnection.connected = payload?.connected === true;
      state.bankPreview.connections = Array.isArray(payload?.connections) ? payload.connections : [];
      state.bankPreview.transactions = Array.isArray(payload?.transactions) ? payload.transactions : [];
      state.bankPreview.lastUpdatedAt = String(payload?.latestUpdatedAt || '');
      state.bankPreview.error = '';
    } catch (error) {
      state.bankPreview.error = error?.message || 'Falha ao carregar pré-visualização do internet banking.';
      state.bankPreview.connections = [];
      state.bankPreview.transactions = [];
      state.bankPreview.lastUpdatedAt = '';
    } finally {
      state.bankPreview.loading = false;
      renderConnectionBadge();
      renderInternetBankingPreview();
    }
  }

  function startPolling() {
    stopPolling();
    state.pollingTimer = setInterval(() => {
      refreshStatus().catch(() => {});
    }, 2500);
  }

  function stopPolling() {
    if (state.pollingTimer) clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }

  async function uploadInvoiceFile(file) {
    const contentBase64 = await readFileAsBase64(file);
    const response = await fetch('/api/invoice/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getCsrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify({
        fileName: String(file?.name || 'fatura'),
        mimeType: String(file?.type || ''),
        contentBase64,
        context: getCurrentContext(),
        prompt: getDefaultAiPrompt()
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || 'Falha ao enviar fatura para IA.');
    return payload;
  }

  async function triggerUploadFromInput(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    try {
      showStatus('Enviando fatura para processamento...', 'ok', 'Importação por fatura');
      await uploadInvoiceFile(file);
      await refreshStatus();
      showStatus('Fatura enviada. Acompanhe o processamento na lista.', 'ok', 'Upload concluído', 2400);
    } catch (error) {
      showStatus(`Falha ao enviar fatura: ${error.message}`, 'error');
    }
  }

  async function openJobPreview(jobId) {
    try {
      const response = await fetch(`/api/invoice/result/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: getCsrfHeaders({ Accept: 'application/json' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Falha ao carregar resultado da fatura.');
      if (!payload?.result || typeof payload.result !== 'object') {
        throw new Error('Resultado da fatura ainda não está disponível.');
      }
      const validation = global.BillImportSchema.validatePayload(payload.result, getCurrentContext());
      global.BillImportReview.setReviewData({
        sourceFileName: state.jobs.find(job => String(job.id) === String(jobId))?.fileName || 'fatura',
        context: getCurrentContext(),
        rawPayload: payload.result,
        formatErrors: validation.formatErrors,
        items: validation.items
      });
      state.activeJobId = String(jobId || '');
    } catch (error) {
      showStatus(error.message, 'error');
    }
  }

  async function runImportFromReview() {
    if (!state.activeJobId) {
      showStatus('Selecione uma fatura processada antes de importar.', 'error');
      return;
    }
    try {
      const payload = typeof global.BillImportReview?.exportPayload === 'function'
        ? global.BillImportReview.exportPayload()
        : null;
      const response = await fetch('/api/invoice/import', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getCsrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify({
          jobId: state.activeJobId,
          payload
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || 'Falha ao importar lançamentos.');
      if (typeof global.closeModal === 'function') global.closeModal('modalBillImportReview');
      await refreshStatus();
      if (typeof global.loadAppBootstrapData === 'function') await global.loadAppBootstrapData();
      if (typeof global.renderMes === 'function') global.renderMes();
      showStatus(`Importação concluída. ${Number(result.imported || 0)} lançamento(s) inserido(s).`, 'ok', 'Importação concluída', 3000);
    } catch (error) {
      showStatus(error.message, 'error');
    }
  }

  async function reprocessJob(jobId) {
    try {
      const response = await fetch(`/api/invoice/reprocess/${encodeURIComponent(jobId)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: getCsrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: '{}'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Falha ao reprocessar fatura.');
      await refreshStatus();
      showStatus('Reprocessamento iniciado.', 'ok', 'Importação por fatura', 2400);
    } catch (error) {
      showStatus(error.message, 'error');
    }
  }

  function triggerUpload() {
    const input = document.getElementById('billImportFileInput');
    if (!input) return;
    input.value = '';
    input.click();
  }

  async function openImportModal() {
    if (typeof global.openModal === 'function') global.openModal('modalBillImport');
    await refreshConnection().catch(() => {});
    await refreshStatus().catch(() => {});
    startPolling();
  }

  async function openProcessedJobs() {
    await openImportModal();
  }

  async function openInternetBankingHub() {
    ensureInternetBankingModal();
    if (typeof global.openModal === 'function') global.openModal('modalInternetBankingPreview');
    await refreshConnection();
    await loadInternetBankingPreview();
  }

  function closeInternetBankingPreview() {
    if (typeof global.closeModal === 'function') global.closeModal('modalInternetBankingPreview');
  }

  function closeImportModal() {
    stopPolling();
    if (typeof global.closeModal === 'function') global.closeModal('modalBillImport');
  }

  global.BillImport = {
    openJobPreview,
    runImportFromReview,
    reprocessJob,
    openProcessedJobs,
    openInternetBankingHub,
    closeInternetBankingPreview,
    loadInternetBankingPreview
  };
  global.openInternetBankingHub = openInternetBankingHub;
  global.openBillImportModal = openImportModal;
  global.closeBillImportModal = closeImportModal;
  global.triggerBillImportUpload = triggerUpload;
  global.handleBillImportFileChange = triggerUploadFromInput;
  refreshConnection().catch(() => {});
})(typeof window !== 'undefined' ? window : globalThis);


