(function initSharedDates(global) {
  function normalizeVarDate(txt) {
    const clean = String(txt || '').trim();
    if (!clean) return '';
    const match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const fullYear = parseInt(match[3], 10);
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(fullYear)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    const shortYear = String(fullYear).slice(-2).padStart(2, '0');
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${shortYear}`;
  }

  function parseData(txt) {
    if (!txt) return 0;
    const normalized = normalizeVarDate(txt);
    if (normalized) {
      const parts = normalized.split('/').map(p => parseInt(p, 10));
      if (parts.length === 3) {
        const year = 2000 + parts[2];
        return new Date(year, parts[1] - 1, parts[0]).getTime();
      }
    }
    return Date.parse(txt) || 0;
  }

  global.normalizeVarDate = normalizeVarDate;
  global.parseData = parseData;
})(window);
