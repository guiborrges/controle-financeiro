(function initFinancialDrilldown(global) {
  'use strict';
  const labels = { expenses: 'Saídas comprometidas', income: 'Entradas previstas', fixedIncome: 'Renda fixa', projects: 'Projetos e entradas extras', goals: 'Reservas de metas', result: 'Composição do resultado' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const money = value => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let pendingChart = null;
  function open(months, options = {}) {
    const origin = options.origin || document.activeElement;
    if (origin?.tagName === 'CANVAS') origin.tabIndex = 0;
    let report;
    try {
      report = global.FinancialExplanation.build(months, { ...options, queryMonth: global.getFinancialMonthQuery });
    } catch (error) {
      global.showAppStatus?.(error.message, 'Detalhamento indisponível', 'warn');
      return null;
    }
    let dialog = document.getElementById('financialDrilldown');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'financialDrilldown';
      dialog.className = 'financial-drilldown';
      dialog.setAttribute('aria-labelledby', 'financialDrilldownTitle');
      document.body.appendChild(dialog);
    }
    const title = options.title || (report.categories ? report.categories.join(', ') : labels[report.metric]);
    const period = report.months.length === 1 ? report.months[0].name : report.months.length
      ? `${report.months[0].name} a ${report.months[report.months.length - 1].name}` : 'Sem período';
    const basisLabel = report.basis === 'consumption' ? 'Consumo por categoria, sem somar as faturas novamente.'
      : report.basis === 'cash' ? 'Somente pagamentos e recebimentos confirmados.' : 'Compromissos pagos e pendentes; faturas contadas uma única vez.';
    dialog.innerHTML = `<header class="financial-drilldown-head"><div><h2 id="financialDrilldownTitle">${escape(title)}</h2><p>${escape(period)}</p></div><button type="button" class="btn" aria-label="Voltar ao indicador" autofocus>Voltar</button></header>
      <p class="financial-drilldown-basis">${escape(basisLabel)}${report.metric === 'result' ? ' Entradas menos saídas e reservas de metas.' : ''}</p>
      <div class="financial-drilldown-scroll"><table><thead><tr><th>Mês / data</th><th>Descrição</th><th>Categoria</th><th>Situação</th><th>Valor</th></tr></thead><tbody>${report.lines.map(line => `<tr><td>${escape(line.monthName)}<small>${escape(line.date)}</small></td><td>${escape(line.description)}${line.kind === 'goal' ? '<small>Reserva, não é uma compra</small>' : ''}</td><td>${escape(line.category)}</td><td>${line.kind === 'goal' ? 'Reservado' : line.paid ? (line.direction === 'income' ? 'Recebido' : 'Pago') : 'Previsto'}</td><td class="${line.signedCents < 0 ? 'financial-drilldown-negative' : ''}">${money(line.signedCents)}</td></tr>`).join('') || '<tr><td colspan="5" class="financial-drilldown-empty">Nenhum lançamento incluído nesta consulta.</td></tr>'}</tbody></table></div>
      <footer class="financial-drilldown-total"><span>${report.lines.length} lançamento(s)<small>Soma dos lançamentos = indicador</small></span><strong data-drilldown-total>${money(report.totalCents)}</strong></footer>`;
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.onclick = event => {
      if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close();
    };
    dialog.onclose = () => {
      if (dialog.open) return;
      dialog.replaceChildren();
      if (origin?.isConnected) origin.focus({ preventScroll: true });
    };
    if (!dialog.open) dialog.showModal();
    return report;
  }
  function chart(event, elements, instance, months, metric) {
    const point = elements?.[0];
    if (!point || !months[point.index]) return;
    const dataset = instance.data.datasets[point.datasetIndex];
    const selectedMetric = typeof metric === 'function' ? metric(dataset, point) : metric;
    if (!selectedMetric) return;
    open([months[point.index]], { metric: selectedMetric,
      expectedCents: Math.round(Number(dataset.data[point.index]) * 100), origin: instance.canvas });
  }
  function bindValue(element, months, options = {}) {
    if (!element) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'financial-detail-trigger';
    button.textContent = element.textContent;
    button.setAttribute('aria-label', `Detalhar ${options.title || labels[options.metric] || 'indicador'}`);
    button.onclick = () => open(months, { ...options, origin: button });
    element.replaceChildren(button);
  }
  function cancelChart() { clearTimeout(pendingChart); pendingChart = null; }
  function deferredChart(...args) {
    cancelChart();
    pendingChart = setTimeout(() => {
      if (args[2].canvas.isConnected) chart(...args);
    }, 260);
  }
  function bindChartKeyboard(canvas, months, options = {}) {
    if (!canvas) return;
    let index = null;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'button');
    const announce = () => canvas.setAttribute('aria-label', `Detalhar ${labels[options.metric || 'expenses']}: ${index === null ? 'período selecionado' : months[index].nome}`);
    announce();
    canvas.onkeydown = event => {
      if (['ArrowLeft', 'ArrowRight'].includes(event.key) && months.length) {
        event.preventDefault();
        index = index === null ? (event.key === 'ArrowRight' ? 0 : months.length - 1)
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + months.length) % months.length;
        announce();
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(index === null ? months : [months[index]], { ...options, origin: canvas });
      }
    };
  }
  global.FinancialDrilldown = { open, chart, bindValue, deferredChart, cancelChart, bindChartKeyboard };
})(window);
