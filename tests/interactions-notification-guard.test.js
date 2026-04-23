const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadInteractionsContext() {
  const filePath = path.resolve(__dirname, '../public/app/interactions.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const windowListeners = new Map();
  const documentListeners = new Map();

  const context = {
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => fn?.(),
    window: {
      innerWidth: 1280,
      innerHeight: 720,
      visualViewport: null,
      addEventListener(type, fn) {
        if (!windowListeners.has(type)) windowListeners.set(type, []);
        windowListeners.get(type).push(fn);
      }
    },
    document: {
      addEventListener(type, fn) {
        if (!documentListeners.has(type)) documentListeners.set(type, []);
        documentListeners.get(type).push(fn);
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      getElementById() {
        return null;
      }
    },
    monthMetricOrder: [],
    sanitizeMonthMetricOrder: (value) => value,
    saveMonthMetricOrder: () => {},
    saveUIState: () => {},
    flushServerStorage: () => {},
    renderMes: () => {},
    undoLastChange: () => {},
    redoLastChange: () => {},
    renderDashSeriesControls: () => {},
    closeDashSeriesColorPicker: () => {},
    closeCategoryColorPicker: () => {},
    closeMonthSectionColorPicker: () => {},
    closeNotificationsPopover: () => {},
    moveDashboardWidgetDrag: () => {},
    stopDashboardWidgetDrag: () => {},
    moveDashboardWidgetResize: () => {},
    stopDashboardWidgetResize: () => {},
    dashSeriesPickerOpen: false,
    dashSeriesColorPicker: { open: false },
    categoryColorPicker: { open: false },
    monthSectionColorPicker: { open: false },
    modalDragState: null
  };

  vm.createContext(context);
  vm.runInContext(code, context, { filename: filePath });
  return { context, windowListeners };
}

test('bindGlobalInteractions no longer depends on notificationsPopoverOpen global', () => {
  const { context, windowListeners } = loadInteractionsContext();
  assert.equal(typeof context.bindGlobalInteractions, 'function');

  assert.doesNotThrow(() => context.bindGlobalInteractions());

  const resizeHandlers = windowListeners.get('resize') || [];
  assert.ok(resizeHandlers.length > 0);
  resizeHandlers.forEach(handler => {
    assert.doesNotThrow(() => handler({}));
  });
});
