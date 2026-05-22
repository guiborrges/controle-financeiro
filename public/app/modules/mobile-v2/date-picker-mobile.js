(function initMobileV2DatePicker(global) {
  'use strict';

  function pad2(value) {
    return String(value || '').padStart(2, '0');
  }

  function toDisplayDate(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    if (/^\d{2}\/\d{2}\/\d{2,4}$/.test(normalized)) return normalized;
    const parsed = new Date(normalized);
    if (!Number.isFinite(parsed.getTime())) return normalized;
    return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${String(parsed.getFullYear()).slice(-2)}`;
  }

  function closePicker() {
    const root = document.getElementById('mobileV2DatePickerSheet');
    if (!root) return;
    root.classList.remove('open');
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
  }

  function ensurePickerRoot() {
    let root = document.getElementById('mobileV2DatePickerSheet');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'mobileV2DatePickerSheet';
    root.className = 'bottom-sheet';
    root.innerHTML = `
      <button class="bottom-sheet-scrim" type="button" aria-label="Fechar"></button>
      <div class="bottom-sheet-panel form-sheet" role="dialog" aria-modal="true" aria-label="Selecionar data">
        <div class="bottom-sheet-grip"></div>
        <h3 class="form-title">Selecionar data</h3>
        <div class="form-row-2">
          <div class="form-field" style="margin:0">
            <label class="form-label" for="mobileV2DatePickerDay">Dia</label>
            <select id="mobileV2DatePickerDay" class="form-input"></select>
          </div>
          <div class="form-field" style="margin:0">
            <label class="form-label" for="mobileV2DatePickerMonth">Mês</label>
            <select id="mobileV2DatePickerMonth" class="form-input"></select>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label" for="mobileV2DatePickerYear">Ano</label>
          <select id="mobileV2DatePickerYear" class="form-input"></select>
        </div>
        <div class="form-actions">
          <button class="btn-cancel" type="button" id="mobileV2DatePickerCancel">Cancelar</button>
          <button class="btn-submit" type="button" id="mobileV2DatePickerConfirm">Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    root.querySelector('.bottom-sheet-scrim')?.addEventListener('click', closePicker);
    root.querySelector('#mobileV2DatePickerCancel')?.addEventListener('click', closePicker);
    root.setAttribute('hidden', 'hidden');
    root.style.display = 'none';
    return root;
  }

  function mountSelectOptions() {
    const daySelect = document.getElementById('mobileV2DatePickerDay');
    const monthSelect = document.getElementById('mobileV2DatePickerMonth');
    const yearSelect = document.getElementById('mobileV2DatePickerYear');
    if (!daySelect || !monthSelect || !yearSelect) return;

    if (!daySelect.options.length) {
      daySelect.innerHTML = Array.from({ length: 31 }, (_, index) => {
        const value = index + 1;
        return `<option value="${value}">${pad2(value)}</option>`;
      }).join('');
    }
    if (!monthSelect.options.length) {
      monthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
        const value = index + 1;
        return `<option value="${value}">${pad2(value)}</option>`;
      }).join('');
    }
    if (!yearSelect.options.length) {
      const baseYear = new Date().getFullYear();
      yearSelect.innerHTML = Array.from({ length: 14 }, (_, index) => {
        const value = baseYear - 6 + index;
        return `<option value="${value}">${value}</option>`;
      }).join('');
    }
  }

  function parseDisplayDate(rawValue) {
    const input = String(rawValue || '').trim();
    if (/^\d{2}\/\d{2}\/\d{2}$/.test(input)) {
      const [day, month, yy] = input.split('/').map(Number);
      return { day, month, year: 2000 + yy };
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
      const [day, month, year] = input.split('/').map(Number);
      return { day, month, year };
    }
    const date = new Date(input);
    if (Number.isFinite(date.getTime())) {
      return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
    }
    const now = new Date();
    return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
  }

  function bindMobileDatePickerToInput(inputId) {
    const input = document.getElementById(String(inputId || ''));
    if (!input || input.dataset.mobileDatePickerBound === '1') return;
    input.dataset.mobileDatePickerBound = '1';
    input.readOnly = true;
    input.addEventListener('click', () => {
      const root = ensurePickerRoot();
      mountSelectOptions();
      const parsed = parseDisplayDate(input.value);
      const daySelect = document.getElementById('mobileV2DatePickerDay');
      const monthSelect = document.getElementById('mobileV2DatePickerMonth');
      const yearSelect = document.getElementById('mobileV2DatePickerYear');
      if (!daySelect || !monthSelect || !yearSelect) return;
      daySelect.value = String(parsed.day);
      monthSelect.value = String(parsed.month);
      yearSelect.value = String(parsed.year);
      const confirm = root.querySelector('#mobileV2DatePickerConfirm');
      const nextConfirm = confirm?.cloneNode(true);
      if (confirm && nextConfirm) {
        confirm.parentNode.replaceChild(nextConfirm, confirm);
        nextConfirm.addEventListener('click', () => {
          const day = Number(daySelect.value || 1);
          const month = Number(monthSelect.value || 1);
          const year = Number(yearSelect.value || new Date().getFullYear());
          input.value = `${pad2(day)}/${pad2(month)}/${String(year).slice(-2)}`;
          try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          } catch {}
          closePicker();
        });
      }
      root.style.display = '';
      root.removeAttribute('hidden');
      root.classList.add('open');
    });
    input.value = toDisplayDate(input.value) || input.value;
  }

  global.bindMobileDatePickerToInput = bindMobileDatePickerToInput;
  global.MobileV2DatePicker = {
    bindToInput: bindMobileDatePickerToInput,
    close: closePicker
  };
})(window);

