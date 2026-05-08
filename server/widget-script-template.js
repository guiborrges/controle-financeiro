const SCRIPT_VERSION = '2026.05.08.2';

function buildWidgetScript(token, baseUrl) {
  const safeToken = String(token || '').trim();
  const safeBaseUrl = String(baseUrl || '').replace(/\/+$/, '');
  return `// ============================================================
// Widget Financeiro — Diretório Online
// Gerado automaticamente. Não compartilhe este código.
// ============================================================

const SCRIPT_VERSION = "${SCRIPT_VERSION}";
const TOKEN = "${safeToken}";
const BASE_URL = "${safeBaseUrl}";
const UPDATE_URL = BASE_URL + "/api/widget/script/latest?token=" + TOKEN;

function formatBRL(value) {
  try {
    const absValue = Math.abs(Number(value || 0));
    const formatted = absValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (Number(value || 0) < 0 ? '-' : '') + 'R$ ' + formatted;
  } catch (_) {
    const sign = Number(value || 0) < 0 ? '-' : '';
    const abs = Math.abs(Number(value || 0)).toFixed(2);
    const parts = abs.split('.');
    const intPart = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
    return sign + 'R$ ' + intPart + ',' + parts[1];
  }
}

async function fetchData() {
  const req = new Request(BASE_URL + '/api/widget/finance-summary?token=' + TOKEN);
  req.timeoutInterval = 10;
  try {
    return await req.loadJSON();
  } catch (_) {
    return null;
  }
}

async function selfUpdateIfNeeded() {
  try {
    const req = new Request(UPDATE_URL);
    req.timeoutInterval = 10;
    const latestCode = await req.loadString();
    if (!latestCode || typeof latestCode !== 'string') return false;

    const fm = FileManager.iCloud();
    const scriptPath = fm.joinPath(fm.documentsDirectory(), Script.name() + '.js');
    if (!fm.fileExists(scriptPath)) return false;

    await fm.downloadFileFromiCloud(scriptPath);
    const currentCode = fm.readString(scriptPath);
    if (String(currentCode || '').trim() === String(latestCode || '').trim()) return false;

    fm.writeString(scriptPath, latestCode);
    return true;
  } catch (_) {
    return false;
  }
}

function addLabel(stack, text, size = 11, color = '#8A847C', weight = 'regular') {
  const label = stack.addText(String(text || ''));
  label.font = weight === 'bold' ? Font.boldSystemFont(size) : Font.systemFont(size);
  label.textColor = new Color(color);
  return label;
}

function progressColor(percentage) {
  if (percentage > 100) return '#BB4F43';
  if (percentage > 70) return '#B98A2F';
  return '#245A4A';
}

function renderProgressBar(container, percentage) {
  const normalized = Math.max(0, Math.min(100, Number(percentage || 0)));
  const width = 78;
  const bar = container.addStack();
  bar.size = new Size(width, 4);
  bar.backgroundColor = new Color('#E8E4DE');
  bar.cornerRadius = 3;
  bar.layoutHorizontally();
  const fill = bar.addStack();
  fill.size = new Size(Math.max(2, Math.round((normalized / 100) * width)), 4);
  fill.backgroundColor = new Color(progressColor(percentage));
  fill.cornerRadius = 3;
}

function buildErrorState(widget, message) {
  widget.addSpacer();
  const icon = widget.addText('⚠️');
  icon.font = Font.boldSystemFont(24);
  icon.centerAlignText();
  const msg = widget.addText(String(message || 'Sem conexão'));
  msg.font = Font.boldSystemFont(12);
  msg.textColor = new Color('#191814');
  msg.centerAlignText();
  const sub = widget.addText('Toque para abrir o app');
  sub.font = Font.systemFont(11);
  sub.textColor = new Color('#8A847C');
  sub.centerAlignText();
  widget.addSpacer();
}

function buildHeader(widget, data) {
  const top = widget.addStack();
  top.layoutHorizontally();
  top.centerAlignContent();

  const left = top.addStack();
  left.layoutVertically();
  addLabel(left, 'DESPESAS DO MÊS', 9, '#8A847C', 'bold');
  addLabel(left, formatBRL(data.monthlyExpenses), 22, '#BB4F43', 'bold');

  top.addSpacer(12);
  const divider = top.addStack();
  divider.size = new Size(1, 38);
  divider.backgroundColor = new Color('#E8E4DE');
  top.addSpacer(12);

  const right = top.addStack();
  right.layoutVertically();
  addLabel(right, 'RESULTADO', 9, '#8A847C', 'bold');
  const resultColor = Number(data.result || 0) >= 0 ? '#245A4A' : '#BB4F43';
  addLabel(right, formatBRL(data.result), 22, resultColor, 'bold');

  widget.addSpacer(10);
  const hLine = widget.addStack();
  hLine.size = new Size(0, 1);
  hLine.backgroundColor = new Color('#EAE6E0');
  widget.addSpacer(10);
}

function buildGoals(widget, data, limit) {
  const goals = Array.isArray(data.goals) ? data.goals.slice(0, limit) : [];
  if (!goals.length) {
    const empty = widget.addText('Nenhuma meta definida');
    empty.font = Font.systemFont(12);
    empty.textColor = new Color('#8A847C');
    return;
  }

  goals.forEach((goal, index) => {
    const row = widget.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    row.spacing = 8;
    const icon = row.addText(String(goal.icon || '•'));
    icon.font = Font.systemFont(14);
    icon.textColor = new Color('#191814');

    const category = row.addText(String(goal.category || 'Categoria'));
    category.font = Font.boldSystemFont(12);
    category.textColor = new Color('#191814');
    category.lineLimit = 1;
    row.addSpacer();

    const meter = row.addStack();
    meter.layoutVertically();
    renderProgressBar(meter, Number(goal.percentage || 0));
    row.addSpacer(8);
    const values = row.addText(\`\${formatBRL(goal.spent)} / \${formatBRL(goal.goal)}\`);
    values.font = Font.systemFont(10);
    values.textColor = new Color('#8A847C');

    if (index < goals.length - 1) widget.addSpacer(6);
  });
}

function buildSmallWidget(widget, data) {
  const block = widget.addStack();
  block.layoutVertically();
  addLabel(block, 'Despesas', 11, '#8A847C', 'bold');
  addLabel(block, formatBRL(data.monthlyExpenses), 28, '#BB4F43', 'bold');
  widget.addSpacer(6);
  addLabel(block, 'Resultado', 11, '#8A847C', 'bold');
  const resultColor = Number(data.result || 0) >= 0 ? '#245A4A' : '#BB4F43';
  addLabel(block, formatBRL(data.result), 22, resultColor, 'bold');
}

function buildMediumWidget(widget, data) {
  buildHeader(widget, data);
  buildGoals(widget, data, 3);
}

function buildLargeWidget(widget, data) {
  buildHeader(widget, data);
  buildGoals(widget, data, 7);
}

async function run() {
  await selfUpdateIfNeeded();
  const data = await fetchData();
  const widget = new ListWidget();
  widget.backgroundColor = new Color('#FAFAF8');
  widget.setPadding(16, 16, 16, 16);
  widget.spacing = 0;
  widget.url = BASE_URL + '/app';

  const size = config.widgetFamily || 'medium';
  if (!data || data.error) {
    buildErrorState(widget, data && data.error ? data.error : 'Sem conexão');
  } else if (size === 'small') {
    buildSmallWidget(widget, data);
  } else if (size === 'large') {
    buildLargeWidget(widget, data);
  } else {
    buildMediumWidget(widget, data);
  }

  widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  Script.setWidget(widget);
  if (!config.runsInWidget) {
    if (size === 'small') await widget.presentSmall();
    else if (size === 'large') await widget.presentLarge();
    else await widget.presentMedium();
  }
  Script.complete();
}

run();
`.trim();
}

module.exports = {
  SCRIPT_VERSION,
  buildWidgetScript
};

