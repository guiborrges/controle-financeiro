(function initMesAtualNotifications(global) {
  'use strict';

  function getSeenDayKey() {
    try {
      return typeof notificationsSeenDayKey === 'string' ? notificationsSeenDayKey : '';
    } catch {
      return '';
    }
  }

  function setSeenDayKey(value) {
    try {
      notificationsSeenDayKey = String(value || '');
    } catch {}
  }

  function getTodayDayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function toDayKeyFromDateLabel(value) {
    const normalized = global.normalizeVarDate?.(String(value || '').trim()) || '';
    if (!normalized) return '';
    const [dayRaw, monthRaw, yearRaw] = normalized.split('/');
    const day = String(Number(dayRaw || 0)).padStart(2, '0');
    const month = String(Number(monthRaw || 0)).padStart(2, '0');
    const yearNum = Number(yearRaw || 0);
    if (!yearNum || !Number(day) || !Number(month)) return '';
    const year = yearNum < 100 ? String(2000 + yearNum) : String(yearNum);
    return `${year}-${month}-${day}`;
  }

  function getNotificationItemsForToday() {
    const todayKey = getTodayDayKey();
    const items = [];
    (global.data || []).forEach(month => {
      (month?.outflows || []).forEach(item => {
        const isRelevant = (item?.type === 'fixed' || item?.recurringSpend === true) && item?.outputKind !== 'card';
        if (!isRelevant) return;
        if (item?.paid === true) return;
        const dueKey = toDayKeyFromDateLabel(item?.date || '');
        if (!dueKey || dueKey !== todayKey) return;
        items.push({
          id: String(item?.id || ''),
          title: String(item?.description || 'Compromisso'),
          amount: Math.max(0, Number(item?.amount || 0) || 0),
          category: String(item?.category || ''),
          monthName: String(month?.nome || '')
        });
      });
    });
    items.sort((a, b) => b.amount - a.amount);
    return items;
  }

  let popoverOpen = false;

  function closeNotificationsPopover() {
    popoverOpen = false;
    document.querySelectorAll('.top-notifications').forEach(wrapper => wrapper.classList.remove('is-open'));
  }

  function positionNotificationsPopover(wrapper) {
    const button = wrapper?.querySelector('.top-bell-btn');
    const popover = wrapper?.querySelector('[data-notification-popover]');
    if (!button || !popover) return;
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const estimatedWidth = Math.min(360, Math.max(280, viewportWidth - 24));
    const estimatedHeight = Math.min(420, Math.max(180, viewportHeight - 24));
    let left = rect.right + 10;
    let top = rect.top;
    if (left + estimatedWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - estimatedWidth - 12);
    }
    if (top + estimatedHeight > viewportHeight - 12) {
      top = Math.max(12, viewportHeight - estimatedHeight - 12);
    }
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  function repositionOpenNotificationsPopover() {
    const wrapper = document.querySelector('.top-notifications.is-open');
    if (!wrapper) return;
    positionNotificationsPopover(wrapper);
  }

  function renderNotificationsPopoverHtml(items) {
    const today = new Date();
    const todayLabel = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const body = items.length
      ? items.map(item => `
        <div class="notification-item">
          <div class="notification-item-title">
            <span>${global.escapeHtml?.(item.title) || ''}</span>
            <span>${global.fmt?.(item.amount) || item.amount}</span>
          </div>
          <div class="notification-item-sub">${global.escapeHtml?.(item.category || 'Sem categoria') || ''} · ${global.escapeHtml?.(item.monthName || '') || ''}</div>
        </div>
      `).join('')
      : '<div class="notification-empty">Nenhum compromisso para pagar hoje.</div>';
    return `
      <div class="notification-popover-head">
        <div class="notification-popover-title">Contas de hoje</div>
        <div class="notification-popover-day">${global.escapeHtml?.(todayLabel) || todayLabel}</div>
      </div>
      ${body}
    `;
  }

  function renderNotificationBells() {
    const notifications = getNotificationItemsForToday();
    const todayKey = getTodayDayKey();
    const showBadge = notifications.length > 0 && getSeenDayKey() !== todayKey;
    document.querySelectorAll('.top-notifications').forEach(wrapper => {
      const badge = wrapper.querySelector('[data-notification-badge]');
      const popover = wrapper.querySelector('[data-notification-popover]');
      if (badge) {
        badge.textContent = String(notifications.length);
        badge.style.display = showBadge ? '' : 'none';
      }
      if (popover) {
        popover.innerHTML = renderNotificationsPopoverHtml(notifications);
        if (wrapper.classList.contains('is-open')) {
          positionNotificationsPopover(wrapper);
        }
      }
    });
    if (!popoverOpen) closeNotificationsPopover();
  }

  function toggleNotificationsPopover(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const wrapper = event?.currentTarget?.closest('.top-notifications');
    if (!wrapper) return;
    const shouldOpen = !wrapper.classList.contains('is-open');
    closeNotificationsPopover();
    if (!shouldOpen) return;
    wrapper.classList.add('is-open');
    popoverOpen = true;
    const todayKey = getTodayDayKey();
    if (getSeenDayKey() !== todayKey) {
      setSeenDayKey(todayKey);
      try { global.saveUIState?.(); } catch {}
    }
    positionNotificationsPopover(wrapper);
    renderNotificationBells();
  }

  global.MesAtualNotifications = {
    getTodayDayKey,
    toDayKeyFromDateLabel,
    getNotificationItemsForToday,
    closeNotificationsPopover,
    positionNotificationsPopover,
    repositionOpenNotificationsPopover,
    renderNotificationBells,
    toggleNotificationsPopover
  };
})(window);
