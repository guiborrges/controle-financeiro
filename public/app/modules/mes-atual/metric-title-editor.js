(function initMonthMetricTitleEditor(globalScope) {
  'use strict';

  let monthMetricTitleEditKey = null;

  function getMonthMetricTitle(metricKey, fallback) {
    const storageKey = globalScope.getMonthMetricTitleStorageKey(metricKey);
    if (!storageKey) return fallback;
    return globalScope.sectionTitles?.[storageKey] || fallback;
  }

  function renderMonthMetricLabel(metricKey, fallback) {
    const text = getMonthMetricTitle(metricKey, fallback);
    if (monthMetricTitleEditKey === metricKey) {
      return `<div class="mc-label mc-label-editable"><input id="monthMetricTitleInlineEditor" value="${globalScope.escapeHtml(text)}" class="mc-label-input" onblur="commitMonthMetricTitleEdit(this.value)" onkeydown="handleMonthMetricTitleEditorKeydown(event)"></div>`;
    }
    return `<div class="mc-label mc-label-editable" ondblclick="event.stopPropagation(); startMonthMetricTitleEdit('${metricKey}')" title="Clique duas vezes para editar">${globalScope.escapeHtml(text)}</div>`;
  }

  function renderStaticMonthMetricLabel(text, helpText = '') {
    const helpAttr = String(helpText || '').trim()
      ? ` class="mc-label help-tooltip-target" data-help="${globalScope.escapeHtml(helpText)}"`
      : ' class="mc-label"';
    return `<div${helpAttr}>${globalScope.escapeHtml(text)}</div>`;
  }

  function startMonthMetricTitleEdit(metricKey) {
    monthMetricTitleEditKey = metricKey;
    globalScope.renderMes();
    requestAnimationFrame(() => {
      const editor = document.getElementById('monthMetricTitleInlineEditor');
      if (editor) {
        editor.focus();
        editor.select();
      }
    });
  }

  function commitMonthMetricTitleEdit(value) {
    if (!monthMetricTitleEditKey) return;
    const storageKey = globalScope.getMonthMetricTitleStorageKey(monthMetricTitleEditKey);
    const next = String(value || '').trim();
    if (!storageKey || !next) {
      cancelMonthMetricTitleEdit();
      return;
    }
    if ((globalScope.sectionTitles?.[storageKey] || '') !== next) {
      globalScope.recordHistoryState();
    }
    globalScope.sectionTitles[storageKey] = next;
    globalScope.Storage.setJSON(globalScope.STORAGE_KEYS.titles, globalScope.sectionTitles);
    globalScope.saveUIState();
    monthMetricTitleEditKey = null;
    globalScope.renderMes();
  }

  function cancelMonthMetricTitleEdit() {
    if (!monthMetricTitleEditKey) return;
    monthMetricTitleEditKey = null;
    globalScope.renderMes();
  }

  function handleMonthMetricTitleEditorKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitMonthMetricTitleEdit(event.target.value);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelMonthMetricTitleEdit();
    }
  }

  globalScope.getMonthMetricTitle = getMonthMetricTitle;
  globalScope.renderMonthMetricLabel = renderMonthMetricLabel;
  globalScope.renderStaticMonthMetricLabel = renderStaticMonthMetricLabel;
  globalScope.startMonthMetricTitleEdit = startMonthMetricTitleEdit;
  globalScope.commitMonthMetricTitleEdit = commitMonthMetricTitleEdit;
  globalScope.cancelMonthMetricTitleEdit = cancelMonthMetricTitleEdit;
  globalScope.handleMonthMetricTitleEditorKeydown = handleMonthMetricTitleEditorKeydown;
})(typeof window !== 'undefined' ? window : globalThis);
