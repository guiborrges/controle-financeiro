const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appDir = path.join(__dirname, '..', 'public', 'app');
const hapticsPath = path.join(appDir, 'modules', 'mobile-v2', 'haptics.js');
const source = fs.readFileSync(hapticsPath, 'utf8');

function createDocument() {
  const elements = new Map();
  const document = {
    body: {
      append(...items) {
        items.forEach((item) => elements.set(item.id, item));
      }
    },
    createElement(tagName) {
      const listeners = {};
      return {
        tagName,
        id: '',
        className: '',
        style: {},
        attributes: {},
        clickCount: 0,
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name] ?? null; },
        hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
        addEventListener(name, handler) { listeners[name] = handler; },
        remove() { if (this.id) elements.delete(this.id); },
        click() {
          this.clickCount += 1;
          listeners.click?.({ isTrusted: true, currentTarget: this });
        }
      };
    },
    getElementById(id) { return elements.get(id) || null; }
  };
  return { document, elements };
}

function loadHaptics(navigator) {
  const { document, elements } = createDocument();
  const window = {
    document,
    navigator,
    requestAnimationFrame(callback) { callback(); },
    addEventListener() {},
    removeEventListener() {},
    MutationObserver: class {
      observe() {}
      disconnect() {}
    }
  };
  vm.runInNewContext(source, { window, console });
  return { window, elements };
}

test('haptics use navigator.vibrate when the browser accepts it', () => {
  const calls = [];
  const { window, elements } = loadHaptics({ vibrate(pattern) { calls.push(pattern); return true; } });
  assert.equal(window.triggerHapticFeedback('medium'), true);
  assert.deepEqual(calls, [15]);
  assert.equal(elements.size, 0);
});

test('semantic haptic patterns distinguish confirmation, strong success and error', () => {
  const calls = [];
  const { window } = loadHaptics({ vibrate(pattern) { calls.push(pattern); return true; } });
  window.HapticFeedback.confirm();
  window.HapticFeedback.successStrong();
  window.HapticFeedback.error();
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[10, 28, 10], [14, 32, 14, 32, 18], [20, 40, 20]]);
});

test('iOS fallback creates one hidden switch and clicks its label', () => {
  const vibrateCalls = [];
  const { window, elements } = loadHaptics({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    platform: 'iPhone',
    maxTouchPoints: 5,
    vibrate(pattern) { vibrateCalls.push(pattern); return true; }
  });
  assert.equal(elements.size, 2, 'the native switch must exist before the first user gesture');
  assert.equal(window.triggerHapticFeedback('selection'), true);
  assert.equal(window.triggerHapticFeedback('light'), true);
  assert.deepEqual(vibrateCalls, []);
  assert.equal(elements.size, 2);
  assert.equal(elements.get('ios-haptic-label').clickCount, 2);
  assert.equal(elements.get('ios-haptic-switch').attributes.switch, '');
  assert.equal(elements.get('ios-haptic-label').attributes.for, 'ios-haptic-switch');
  assert.equal(elements.get('ios-haptic-switch').style.left, '0');
  assert.equal(elements.get('ios-haptic-switch').style.clipPath, 'inset(50%)');
});

test('modern iOS can bind a directly tapped native switch over the FAB', () => {
  const { window, elements } = loadHaptics({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X)',
    platform: 'iPhone',
    maxTouchPoints: 5
  });
  let activations = 0;
  const target = {
    attributes: { 'aria-label': 'Adicionar lançamento' },
    classList: { contains(name) { return name === 'show'; } },
    getAttribute(name) { return this.attributes[name] || null; },
    hasAttribute() { return false; },
    getBoundingClientRect() { return { left: 100, top: 500, width: 56, height: 56 }; }
  };

  const binding = window.HapticFeedback.bindDirectTarget(target, () => { activations += 1; });
  const directInput = elements.get('ios-haptic-direct-target');
  assert.ok(binding);
  assert.equal(directInput.attributes.switch, '');
  assert.equal(directInput.style.pointerEvents, 'auto');
  assert.equal(directInput.style.clipPath, 'none');
  assert.equal(directInput.style.left, '100px');
  assert.equal(directInput.style.width, '56px');
  directInput.click();
  assert.equal(activations, 1);
});

test('no other app module calls navigator.vibrate directly', () => {
  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js') && full !== hapticsPath) files.push(full);
  });
  walk(appDir);
  files.forEach((file) => assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /navigator\.vibrate/));
});
