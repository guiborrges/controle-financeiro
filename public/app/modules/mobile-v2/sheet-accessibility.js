(function initMobileSheetAccessibility(global) {
  'use strict';
  const selector = '.bottom-sheet.open:not([hidden]), .m2-onboarding-layer.open:not([hidden]), #mobileV2InternetBankingSheet:not([hidden]), .modal-bg.open, #modalUniversalSearch';
  const panelSelector = '.bottom-sheet-panel, .m2-onboarding-panel, .mib-shell-panel, .modal';
  const focusable = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])';
  const opened = new Map();
  const previousInert = new Map();
  let current = null;
  let scheduled = false;
  let lastOutsideFocus = document.activeElement;

  function controls(panel) {
    return Array.from(panel.querySelectorAll(focusable)).filter(el => el.getClientRects().length && !el.closest('[hidden], [inert]'));
  }

  function restoreBackground() {
    previousInert.forEach((value, el) => { el.inert = value; });
    previousInert.clear();
  }

  function resolveInvoker(node) {
    const available = candidate => candidate?.isConnected && candidate.getClientRects().length && !candidate.closest('[inert]');
    if (available(node)) return node;
    const byId = node?.id ? document.getElementById(node.id) : null;
    if (available(byId)) return byId;
    const label = node?.getAttribute?.('aria-label');
    return label ? Array.from(document.querySelectorAll('[aria-label]'))
      .find(candidate => candidate.getAttribute('aria-label') === label && available(candidate)) : null;
  }

  function sync() {
    scheduled = false;
    const layers = document.documentElement.classList.contains('mobile-v2')
      ? Array.from(document.querySelectorAll(selector)).filter(el => getComputedStyle(el).display !== 'none')
        .sort((a, b) => Number(a.matches('.modal-bg')) - Number(b.matches('.modal-bg'))) : [];
    let returnTo = null;
    opened.forEach((entry, layer) => {
      if (!layers.includes(layer)) { returnTo = entry.invoker; layer.style.zIndex = entry.zIndex; opened.delete(layer); }
    });
    layers.forEach(layer => {
      if (!opened.has(layer)) opened.set(layer, {
        invoker: layer.contains(document.activeElement) ? lastOutsideFocus : document.activeElement,
        zIndex: layer.style.zIndex
      });
    });
    Array.from(opened.keys()).forEach((layer, index) => {
      const zIndex = String(2000 + index * 10);
      if (layer.style.zIndex !== zIndex) layer.style.zIndex = zIndex;
    });
    const next = Array.from(opened.keys()).at(-1) || null;
    if (next !== current) {
      restoreBackground();
      current = next;
      if (current) {
        // Inert siblings at each ancestor keep nested sheets usable without disabling their parent.
        for (let node = current; node && node !== document.body; node = node.parentElement) {
          Array.from(node.parentElement?.children || []).forEach(sibling => {
            if (sibling !== node && !['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) {
              previousInert.set(sibling, sibling.inert); sibling.inert = true;
            }
          });
        }
      }
    }
    if (current) {
      const panel = current.querySelector(panelSelector);
      if (!panel) return;
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
      if (!panel.hasAttribute('aria-label') && !panel.hasAttribute('aria-labelledby')) {
        panel.setAttribute('aria-label', panel.querySelector('h2,h3')?.textContent || 'Detalhes');
      }
      if (!panel.contains(document.activeElement)) {
        panel.tabIndex = -1;
        (controls(panel)[0] || panel).focus({ preventScroll: true });
      }
      const status = document.getElementById('appStatus');
      let local = panel.querySelector('[data-mobile-dialog-status]');
      if (status?.classList.contains('open')) {
        const text = `${document.getElementById('appStatusTitle')?.textContent || ''}: ${document.getElementById('appStatusMessage')?.textContent || ''}`;
        if (!local) {
          local = document.createElement('div'); local.dataset.mobileDialogStatus = '';
          local.setAttribute('role', 'alert');
          const message = document.createElement('p'); local.appendChild(message);
          const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = 'Fechar aviso';
          dismiss.addEventListener('click', () => global.hideAppStatus()); local.appendChild(dismiss);
          panel.prepend(local);
        }
        if (local.firstElementChild.textContent !== text) local.firstElementChild.textContent = text;
      } else if (local) local.remove();
    } else {
      resolveInvoker(returnTo)?.focus({ preventScroll: true });
    }
    if (document.body.classList.contains('mobile-v2-sheet-open') !== (layers.length > 0)) {
      document.body.classList.toggle('mobile-v2-sheet-open', layers.length > 0);
    }
  }

  const observer = new MutationObserver(() => {
    if (!scheduled) { scheduled = true; global.requestAnimationFrame(sync); }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
  document.addEventListener('keydown', event => {
    sync();
    if (!current) return;
    const panel = current.querySelector('[role="dialog"]');
    if (!panel) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (current.id === 'mobileV2OutflowSheet') { global.MobileV2OutflowForm?.requestDismiss(); return; }
      if (current.id === 'modalUniversalSearch') { global.UniversalSearch?.close(); return; }
      if (current.matches('.modal-bg')) {
        const cancel = Array.from(current.querySelectorAll('button')).find(button => /^(cancelar|fechar|não|nao)$/i.test(button.textContent.trim()));
        if (cancel) cancel.click(); else global.closeModal(current.id);
        return;
      }
      const close = current.querySelector('[data-close-perfil], [data-mib-close], .m2-onboarding-close, #mobileV2DatePickerCancel, #mobileV2OutflowCancel, #mobileV2OutflowClose, .bottom-sheet-scrim');
      close?.click();
    } else if (event.key === 'Tab') {
      const items = controls(panel), first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (!panel.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    }
  }, true);
  document.addEventListener('focusin', event => {
    if (!current && !event.target.closest(selector)) lastOutsideFocus = event.target;
    const panel = current?.querySelector('[role="dialog"]');
    if (panel && !current.contains(event.target)) (controls(panel)[0] || panel).focus({ preventScroll: true });
  });
})(window);
