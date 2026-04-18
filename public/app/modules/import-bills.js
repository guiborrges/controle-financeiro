(function (global) {
  'use strict';

  const state = {
    contextCache: null,
    statusHideTimer: null
  };

  function getCurrentContext() {
    const context = global.BillImportUtils.buildImportContext(global.data || [], global.currentSession || {});
    const cards = global.BillImportUtils.getAllCardsFromUserData(global.data || []);
    const categories = global.BillImportUtils.getAllCategoriesFromUserData(global.data || []);
    const tags = global.BillImportUtils.getAllTagsFromUserData(global.data || []);
    const currentMonth = typeof global.getCurrentMonth === 'function' ? global.getCurrentMonth() : null;
    const monthCards = Array.isArray(currentMonth?.outflowCards) ? currentMonth.outflowCards : [];
    const mergedCardsMap = new Map();
    (Array.isArray(cards?.list) ? cards.list : []).forEach(card => {
      const id = String(card?.id || '').trim();
      const name = String(card?.name || '').trim();
      if (!id || !name) return;
      mergedCardsMap.set(id, card);
    });
    monthCards.forEach(card => {
      const id = String(card?.id || '').trim();
      const name = String(card?.name || '').trim();
      if (!id || !name || mergedCardsMap.has(id)) return;
      mergedCardsMap.set(id, {
        id,
        name,
        institution: String(card?.institution || '').trim(),
        visualId: String(card?.visualId || '').trim(),
        closingDay: Number(card?.closingDay || 0) || null,
        paymentDay: Number(card?.paymentDay || 0) || null,
        description: String(card?.description || '').trim(),
        firstSeenMonthId: String(currentMonth?.id || '').trim()
      });
    });
    const mergedCards = {
      ...(cards || {}),
      list: Array.from(mergedCardsMap.values()).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'))
    };
    const runtimeTags = typeof global.getUnifiedOutflowTags === 'function' ? global.getUnifiedOutflowTags() : [];
    const mergedTags = Array.from(new Set([...(tags || []), ...(runtimeTags || [])].map(tag => String(tag || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    state.contextCache = {
      ...context,
      cards: mergedCards,
      categories,
      tags: mergedTags,
      cardIndex: mergedCards,
      categoryIndex: categories,
      data: global.data || []
    };
    return state.contextCache;
  }

  function getPromptText() {
    return global.BillImportUtils.buildExternalAiPrompt('finance_import_context.json');
  }

  function setPromptText() {
    const field = document.getElementById('billImportPrompt');
    if (field) field.value = getPromptText();
  }

  function showStatus(message, tone = 'ok', title = 'Importação por fatura', autoHideMs = null) {
    if (typeof global.showAppStatus === 'function') {
      global.showAppStatus(message, title, tone);
      if (state.statusHideTimer) {
        clearTimeout(state.statusHideTimer);
        state.statusHideTimer = null;
      }
      if (Number(autoHideMs || 0) > 0 && typeof global.hideAppStatus === 'function') {
        state.statusHideTimer = setTimeout(() => {
          state.statusHideTimer = null;
          global.hideAppStatus();
        }, Number(autoHideMs));
      }
      return;
    }
    if (tone === 'error') alert(message);
  }

  function copyPrompt() {
    const text = getPromptText();
    if (!navigator?.clipboard?.writeText) {
      showStatus('Não foi possível copiar automaticamente. Copie o texto manualmente.', 'error');
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => showStatus('Prompt copiado para a área de transferência.', 'ok', 'Prompt copiado', 2600))
      .catch(() => showStatus('Falha ao copiar prompt.', 'error'));
  }

  function downloadContext() {
    const context = getCurrentContext();
    global.BillImportUtils.downloadJsonFile(context, 'finance_import_context.json');
    showStatus('Arquivo de contexto gerado.', 'ok', 'Contexto pronto', 2600);
  }

  function triggerUpload() {
    const input = document.getElementById('billImportFileInput');
    if (!input) return;
    input.value = '';
    input.click();
  }

  function readJsonFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result || ''));
          resolve(payload);
        } catch (error) {
          reject(new Error('JSON inválido.'));
        }
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  function extractJsonText(rawText) {
    const text = String(rawText || '').trim();
    if (!text) throw new Error('Conteúdo vazio.');
    const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) return fenced[1].trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) return text.slice(firstBrace, lastBrace + 1).trim();
    return text;
  }

  function parseJsonPayload(rawText) {
    const extracted = extractJsonText(rawText);
    try {
      return JSON.parse(extracted);
    } catch (error) {
      throw new Error('Não foi possível identificar um JSON válido no conteúdo enviado.');
    }
  }

  function processPayload(payload, sourceFileName = 'conteudo-colado.json') {
    const context = getCurrentContext();
    const result = global.BillImportSchema.validatePayload(payload, context);
    global.BillImportReview.setReviewData({
      sourceFileName,
      context,
      rawPayload: payload,
      formatErrors: result.formatErrors,
      items: result.items
    });
    if (result.formatErrors.length) {
      showStatus('Arquivo carregado com erros de formato. Revise antes de importar.', 'error');
      return;
    }
    if (Number(result.ignoredCount || 0) > 0) {
      showStatus(`Arquivo carregado para revisão. ${result.ignoredCount} ressarcimento(s)/estorno(s) foram ignorados automaticamente.`, 'ok', 'Revisão pronta', 3000);
      return;
    }
    showStatus('Arquivo carregado para revisão.', 'ok', 'Revisão pronta', 2600);
  }

  async function handleUpload(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    try {
      const payload = await readJsonFromFile(file);
      processPayload(payload, file.name);
    } catch (error) {
      showStatus(`Falha ao carregar arquivo: ${error.message}`, 'error');
    }
  }

  function handlePastedText() {
    const field = document.getElementById('billImportRawText');
    const raw = String(field?.value || '').trim();
    if (!raw) {
      showStatus('Cole o conteúdo retornado pela IA antes de validar.', 'error');
      return;
    }
    try {
      const payload = parseJsonPayload(raw);
      processPayload(payload, 'conteudo-colado.json');
    } catch (error) {
      showStatus(error.message, 'error');
    }
  }

  function openImportModal() {
    getCurrentContext();
    setPromptText();
    if (typeof global.openModal === 'function') global.openModal('modalBillImport');
  }

  function closeImportModal() {
    if (typeof global.closeModal === 'function') global.closeModal('modalBillImport');
  }

  global.openBillImportModal = openImportModal;
  global.closeBillImportModal = closeImportModal;
  global.copyBillImportPrompt = copyPrompt;
  global.downloadBillImportContext = downloadContext;
  global.triggerBillImportUpload = triggerUpload;
  global.handleBillImportFileChange = handleUpload;
  global.handleBillImportPastedText = handlePastedText;
})(typeof window !== 'undefined' ? window : globalThis);
