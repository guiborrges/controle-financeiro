(function initMobileV2Haptics(global) {
  'use strict';

  const IOS_INPUT_ID = 'ios-haptic-switch';
  const IOS_LABEL_ID = 'ios-haptic-label';
  const PATTERNS = Object.freeze({
    light: 8,
    medium: 15,
    success: [10, 30, 10],
    error: [20, 40, 20],
    selection: 5
  });

  function applyHiddenControlStyle(element) {
    Object.assign(element.style, {
      position: 'fixed',
      opacity: '0',
      width: '1px',
      height: '1px',
      pointerEvents: 'none',
      left: '-9999px',
      top: '-9999px'
    });
  }

  function ensureIOSHapticSwitch() {
    if (!global.document?.body) return null;
    let input = global.document.getElementById(IOS_INPUT_ID);
    let label = global.document.getElementById(IOS_LABEL_ID);
    if (input && label) return label;

    input?.remove();
    label?.remove();
    input = global.document.createElement('input');
    input.id = IOS_INPUT_ID;
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;
    applyHiddenControlStyle(input);

    label = global.document.createElement('label');
    label.id = IOS_LABEL_ID;
    label.htmlFor = IOS_INPUT_ID;
    label.setAttribute('aria-hidden', 'true');
    applyHiddenControlStyle(label);

    global.document.body.append(input, label);
    return label;
  }

  function triggerHapticFeedback(type = 'light') {
    try {
      const pattern = PATTERNS[type] || PATTERNS.light;
      if (typeof global.navigator?.vibrate === 'function') {
        const accepted = global.navigator.vibrate(pattern);
        if (accepted !== false) return true;
      }
      const label = ensureIOSHapticSwitch();
      if (!label) return false;
      label.click();
      return true;
    } catch (error) {
      console.warn('[haptics] feedback indisponivel:', error?.message || error);
      return false;
    }
  }

  global.HapticFeedback = Object.freeze({ trigger: triggerHapticFeedback });
  global.triggerHapticFeedback = triggerHapticFeedback;
})(window);
