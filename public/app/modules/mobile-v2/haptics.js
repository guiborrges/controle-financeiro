(function initMobileV2Haptics(global) {
  'use strict';

  const IOS_INPUT_ID = 'ios-haptic-switch';
  const IOS_LABEL_ID = 'ios-haptic-label';
  const IOS_DIRECT_TARGET_ID = 'ios-haptic-direct-target';
  const PATTERNS = Object.freeze({
    light: 8,
    medium: 15,
    selection: 5,
    short: 7,
    confirm: [10, 28, 10],
    success: [10, 30, 10],
    successStrong: [14, 32, 14, 32, 18],
    firm: 24,
    error: [20, 40, 20],
  });
  let lastFeedbackAt = 0;
  let lastFeedbackType = '';

  function isIOSLikeBrowser() {
    const navigator = global.navigator || {};
    const userAgent = String(navigator.userAgent || '');
    const platform = String(navigator.platform || '');
    return /iPad|iPhone|iPod/i.test(userAgent)
      || (platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
  }

  function applyHiddenControlStyle(element, nativeSwitch = false) {
    Object.assign(element.style, {
      position: 'fixed',
      opacity: '0.0001',
      width: nativeSwitch ? '51px' : '1px',
      height: nativeSwitch ? '31px' : '1px',
      pointerEvents: 'none',
      left: '0',
      top: '0',
      margin: '0',
      clipPath: 'inset(50%)',
      overflow: 'hidden'
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
    applyHiddenControlStyle(input, true);

    label = global.document.createElement('label');
    label.id = IOS_LABEL_ID;
    label.htmlFor = IOS_INPUT_ID;
    label.setAttribute('for', IOS_INPUT_ID);
    label.setAttribute('aria-hidden', 'true');
    applyHiddenControlStyle(label);

    global.document.body.append(input, label);
    return label;
  }

  function triggerHapticFeedback(type = 'light') {
    try {
      const pattern = PATTERNS[type] || PATTERNS.light;
      const now = Date.now();
      if (type === lastFeedbackType && now - lastFeedbackAt < 90) return true;
      lastFeedbackAt = now;
      lastFeedbackType = type;
      if (!isIOSLikeBrowser() && typeof global.navigator?.vibrate === 'function') {
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

  function bindDirectHapticTarget(target, onActivate) {
    if (!isIOSLikeBrowser() || !target || typeof onActivate !== 'function' || !global.document?.body) {
      return null;
    }

    global.document.getElementById(IOS_DIRECT_TARGET_ID)?.remove();
    const input = global.document.createElement('input');
    input.id = IOS_DIRECT_TARGET_ID;
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.setAttribute('aria-label', target.getAttribute?.('aria-label') || 'Ação rápida');
    input.className = 'ios-haptic-direct-target';
    Object.assign(input.style, {
      position: 'fixed',
      opacity: '0.001',
      pointerEvents: 'auto',
      margin: '0',
      padding: '0',
      clipPath: 'none',
      overflow: 'visible',
      zIndex: '710'
    });
    global.document.body.append(input);

    const sync = () => {
      const rect = target.getBoundingClientRect?.();
      const isVisible = !!rect && rect.width > 0 && rect.height > 0
        && target.classList?.contains('show')
        && !target.hasAttribute?.('hidden');
      if (!isVisible) {
        input.style.display = 'none';
        return;
      }
      input.style.display = 'block';
      input.style.left = `${rect.left}px`;
      input.style.top = `${rect.top}px`;
      input.style.width = `${rect.width}px`;
      input.style.height = `${rect.height}px`;
    };

    input.addEventListener('click', (event) => {
      // A trusted tap directly on the native switch is what makes modern Safari emit haptics.
      onActivate(event);
      global.requestAnimationFrame?.(sync);
    });

    const observer = typeof global.MutationObserver === 'function'
      ? new global.MutationObserver(sync)
      : null;
    observer?.observe(target, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    observer?.observe(global.document.body, { attributes: true, attributeFilter: ['class'] });
    global.addEventListener?.('resize', sync, { passive: true });
    global.addEventListener?.('orientationchange', sync, { passive: true });
    global.requestAnimationFrame?.(sync);

    return Object.freeze({
      input,
      sync,
      destroy() {
        observer?.disconnect();
        global.removeEventListener?.('resize', sync);
        global.removeEventListener?.('orientationchange', sync);
        input.remove();
      }
    });
  }

  global.HapticFeedback = Object.freeze({
    trigger: triggerHapticFeedback,
    selection: () => triggerHapticFeedback('selection'),
    confirm: () => triggerHapticFeedback('confirm'),
    success: () => triggerHapticFeedback('success'),
    successStrong: () => triggerHapticFeedback('successStrong'),
    error: () => triggerHapticFeedback('error'),
    firm: () => triggerHapticFeedback('firm'),
    bindDirectTarget: bindDirectHapticTarget,
    isIOSLikeBrowser
  });
  global.triggerHapticFeedback = triggerHapticFeedback;

  if (isIOSLikeBrowser()) {
    if (global.document?.body) ensureIOSHapticSwitch();
    else global.document?.addEventListener?.('DOMContentLoaded', ensureIOSHapticSwitch, { once: true });
  }
})(window);
