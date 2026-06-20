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
      return {
        tagName,
        id: '',
        style: {},
        attributes: {},
        clickCount: 0,
        setAttribute(name, value) { this.attributes[name] = value; },
        remove() { if (this.id) elements.delete(this.id); },
        click() { this.clickCount += 1; }
      };
    },
    getElementById(id) { return elements.get(id) || null; }
  };
  return { document, elements };
}

function loadHaptics(navigator) {
  const { document, elements } = createDocument();
  const window = { document, navigator };
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
