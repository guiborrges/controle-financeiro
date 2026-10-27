(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  function table(id, caption, columns, rows) {
    return `<details class="chart-data-table" id="${escape(id)}"><summary>Ver dados do gráfico</summary><div class="chart-data-scroll" tabindex="0" role="region" aria-label="${escape(caption)}"><table><caption>${escape(caption)}</caption><thead><tr>${columns.map(column => `<th scope="col">${escape(column)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length ? '' : '<p>Sem movimentações neste período.</p>'}</div></details>`;
  }
  function theme() {
    const style = root.getComputedStyle(root.document.documentElement);
    const dark = root.document.documentElement.getAttribute('data-theme') === 'dark';
    return { text:style.getPropertyValue('--text2').trim() || (dark ? '#d9dde5' : '#505867'),
      grid:dark ? '#414854' : '#d9dde5', background:style.getPropertyValue('--bg').trim() || (dark ? '#171a20' : '#ffffff') };
  }
  function canvas(canvas, width, height) {
    const ratio = Math.min(3, Math.max(1, Number(root.devicePixelRatio) || 1));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }
  function axis(value) {
    const number = Number(value || 0);
    const absolute = Math.abs(number);
    for (const [limit, suffix] of [[1e12,'T'], [1e9,'B'], [1e6,'M'], [1e3,'k']]) {
      if (absolute >= limit) return `${Number((number / limit).toFixed(1)).toLocaleString('pt-BR')}${suffix}`;
    }
    return number.toLocaleString('pt-BR', { maximumFractionDigits:2 });
  }
  const api = { table, theme, canvas, axis };
  root.ChartPresentation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
