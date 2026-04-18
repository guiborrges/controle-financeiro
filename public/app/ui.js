
function openAddMeta() { openModal('modalMeta'); }

function saveMeta() {
  const cat = document.getElementById('metaCat').value;
  const val = parseFloat(document.getElementById('metaValor').value);
  if (isNaN(val) || val <= 0) { alert('Valor inválido'); return; }
  metas[cat] = val;
  saveMetas();
  closeModal('modalMeta');
  renderMetas();
}

function renderMetas() {
  const el = document.getElementById('metasBody');
  const m = getCurrentMonth();
  const cats = m.categorias || {};
  const keys = Object.keys(metas);
  if (keys.length === 0) {
    el.innerHTML = '<div class="empty"><span>🎯</span><p>Nenhuma meta definida. Adicione limites mensais por categoria.</p></div>';
    return;
  }
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px">' + keys.map(k => {
    const gasto = cats[k] || 0;
    const pct = Math.min((gasto / metas[k]) * 100, 100);
    const over = gasto > metas[k];
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg);border-radius:var(--radius-sm)">
        <div class="cat-dot" style="width:12px;height:12px;background:${CAT_COLORS[k]||'#95a5a6'}"></div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:13px;font-weight:500">${k}</span>
            <span style="font-size:13px;color:${over?'var(--red)':'var(--text2)'}">
              ${fmt(gasto)} / ${fmt(metas[k])}
              ${over ? '<span style="color:var(--red);font-size:11px;margin-left:6px">⚠ ultrapassado</span>' : ''}
            </span>
          </div>
          <div class="progress-wrap">
            <div class="progress-bar" style="width:${pct}%;background:${over?'var(--red)':CAT_COLORS[k]||'#27ae60'}"></div>
          </div>
        </div>
        <button class="btn-icon" onclick="deleteMeta('${k}')">✕</button>
      </div>`;
  }).join('') + '</div>';
}

function deleteMeta(cat) {
  if (!confirm(`Remover meta de ${cat}?`)) return;
  delete metas[cat];
  saveMetas();
  renderMetas();
}


