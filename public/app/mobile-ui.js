(function initMobileUi(global) {
  'use strict';

  const MOBILE_BREAKPOINT = 900;
  let mobileUiState = false;

  function supportsTouch() {
    try {
      return (
        'ontouchstart' in global
        || navigator.maxTouchPoints > 0
        || global.matchMedia?.('(pointer: coarse)')?.matches === true
      );
    } catch {
      return false;
    }
  }

  function isMobileUiMode() {
    const width = Number(global.innerWidth || document.documentElement?.clientWidth || 0);
    return width > 0 && width <= MOBILE_BREAKPOINT && supportsTouch();
  }

  function updateViewportUnit() {
    const vh = (global.visualViewport?.height || global.innerHeight || 0) * 0.01;
    if (vh > 0) {
      document.documentElement.style.setProperty('--app-vh', `${vh}px`);
    }
  }

  function applyMobileUiState() {
    const enabled = isMobileUiMode();
    if (enabled === mobileUiState) {
      updateViewportUnit();
      return enabled;
    }
    mobileUiState = enabled;
    document.documentElement.classList.toggle('mobile-ui', enabled);
    document.body?.classList.toggle('mobile-ui', enabled);
    updateViewportUnit();
    return enabled;
  }

  global.isMobileUiMode = isMobileUiMode;
  global.applyMobileUiState = applyMobileUiState;
  global.updateMobileViewportUnit = updateViewportUnit;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMobileUiState, { once: true });
  } else {
    applyMobileUiState();
  }
  global.addEventListener('resize', applyMobileUiState, { passive: true });
  global.addEventListener('orientationchange', applyMobileUiState);
})(window);
