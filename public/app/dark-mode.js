(function initDarkModeScope(global) {
  const THEME_STORAGE_KEY = 'theme';

  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  function applyTheme(theme, options) {
    const cfg = options || {};
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    const persist = cfg.persist !== false;
    const rerender = cfg.rerender === true;

    document.documentElement.setAttribute('data-theme', nextTheme);

    if (persist) {
      try { localStorage.setItem(THEME_STORAGE_KEY, nextTheme); } catch {}
    }

    if (global.Chart && global.Chart.defaults) {
      const isDark = nextTheme === 'dark';
      global.Chart.defaults.color = isDark ? '#d4d9e3' : '#505867';
      global.Chart.defaults.borderColor = isDark ? 'rgba(180,190,206,.2)' : 'rgba(112,100,84,.16)';
    }

    if (rerender && typeof global.renderAll === 'function') {
      try { global.renderAll(); } catch {}
    }
  }

  function syncThemeToggleUI() {
    const toggle = document.getElementById('preferencesDarkModeToggle');
    if (!toggle) return;
    toggle.checked = document.documentElement.getAttribute('data-theme') === 'dark';
  }

  global.toggleThemePreference = function toggleThemePreference(enabled) {
    applyTheme(enabled ? 'dark' : 'light', { persist: true, rerender: true });
    syncThemeToggleUI();
  };

  function patchOpenPreferences() {
    if (typeof global.openPreferences !== 'function') return;
    const original = global.openPreferences;
    global.openPreferences = function wrappedOpenPreferences() {
      syncThemeToggleUI();
      return original.apply(this, arguments);
    };
  }

  function init() {
    applyTheme(getSavedTheme(), { persist: false, rerender: false });
    syncThemeToggleUI();
    patchOpenPreferences();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window);
