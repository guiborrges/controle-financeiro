(function initAppEvents(global) {
  'use strict';
  if (global.AppEvents) return;

  global.AppEvents = {
    emit(type, detail = {}) {
      if (!global.document?.dispatchEvent || typeof global.CustomEvent !== 'function') return;
      global.document.dispatchEvent(new global.CustomEvent(type, { detail }));
    }
  };
})(window);
