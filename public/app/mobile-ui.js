(function initMobileUiCompat(global) {
  'use strict';
  if (global.MobileShell?.applyState) {
    global.applyMobileUiState = global.MobileShell.applyState;
    global.isMobileUiMode = global.MobileShell.isMobileUiMode;
    global.updateMobileViewportUnit = global.MobileShell.updateViewportUnit;
  }
})(window);
