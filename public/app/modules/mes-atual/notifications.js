(function initMesAtualNotifications(global) {
  'use strict';

  function getUserNotificationKeySuffix() {
    return String(global.__APP_BOOTSTRAP__?.session?.id || 'anonymous').trim() || 'anonymous';
  }

  function getSeenStorageKey() {
    return `fin_notifications_seen_day::${getUserNotificationKeySuffix()}`;
  }

  function getDismissedStorageKey() {
    return `fin_notifications_dismissed::${getUserNotificationKeySuffix()}`;
  }

  function getSeenDayKey() {
    try {
      const inMemory = typeof notificationsSeenDayKey === 'string' ? notificationsSeenDayKey : '';
      if (inMemory) return inMemory;
    } catch {}
    try {
      return String(localStorage.getItem(getSeenStorageKey()) || '');
    } catch {
      return '';
    }
  }

  function setSeenDayKey(value) {
    const next = String(value || '');
    try { notificationsSeenDayKey = next; } catch {}
    try { localStorage.setItem(getSeenStorageKey(), next); } catch {}
  }

  function loadDismissedMap() {
    try {
      const raw = localStorage.getItem(getDismissedStorageKey());
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveDismissedMap(map) {
    try {
      localStorage.setItem(getDismissedStorageKey(), JSON.stringify(map || {}));
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

  function parseIncomeReceiveDayKey(item, sourceMonth) {
    if (!item) return '';
    const recurring = item.recurringFixed !== false;
    const rawValue = String(item.dataRecebimento || '').trim();
    if (!rawValue) return '';
    if (recurring) {
      const hasExplicitMonthYear = /[/-]/.test(rawValue);
      if (hasExplicitMonthYear) return toDayKeyFromDateLabel(rawValue);
      if (typeof global.getRecurringIncomeReceiveDay !== 'function') return '';
      const dayRaw = global.getRecurringIncomeReceiveDay(rawValue);
      const day = Number(dayRaw || 0);
      if (!Number.isFinite(day) || day < 1) return '';
      const sourceDate = typeof global.getMonthDateFromMonthObject === 'function'
        ? global.getMonthDateFromMonthObject(sourceMonth)
        : null;
      if (!(sourceDate instanceof Date) || Number.isNaN(sourceDate.getTime())) return '';
      const receiveDate = new Date(sourceDate.getFullYear(), sourceDate.getMonth() + 1, Math.min(31, Math.max(1, day)));
      return `${receiveDate.getFullYear()}-${String(receiveDate.getMonth() + 1).padStart(2, '0')}-${String(receiveDate.getDate()).padStart(2, '0')}`;
    }
    return toDayKeyFromDateLabel(rawValue);
  }

  function getNotificationItemsForToday() {
    const todayKey = getTodayDayKey();
    const items = [];
    (global.data || []).forEach(month => {
      (month?.outflows || []).forEach(item => {
        const normalizedType = String(item?.type || '').toLowerCase();
        const isRelevant = ((normalizedType === 'expense' || normalizedType === 'fixed') || item?.recurringSpend === true) && item?.outputKind !== 'card';
        if (!isRelevant) return;
        if (item?.paid === true) return;
        const dueKey = toDayKeyFromDateLabel(item?.date || '');
        if (!dueKey || dueKey !== todayKey) return;
        items.push({
          id: `payment::${String(month?.id || '')}::${String(item?.id || '')}`,
          kind: 'payment',
          title: String(item?.description || 'Pagamento'),
          amount: Math.max(0, Number(item?.amount || 0) || 0),
          category: String(item?.category || ''),
          monthName: String(month?.nome || '')
        });
      });
      (month?.renda || []).forEach(item => {
        const receiveKey = parseIncomeReceiveDayKey(item, month);
        if (!receiveKey || receiveKey !== todayKey) return;
        if (item?.paid === true) return;
        items.push({
          id: `income::${String(month?.id || '')}::${String(item?.id || item?.fonte || '').trim()}`,
          kind: 'income',
          title: String(item?.fonte || 'Recebimento'),
          amount: Math.max(0, Number(item?.valor || 0) || 0),
          category: 'Renda',
          monthName: String(month?.nome || '')
        });
      });
    });
    const dismissed = loadDismissedMap();
    const visible = items.filter(item => dismissed[item.id] !== true);
    visible.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    return visible;
  }

  function dismissNotification(id) {
    const key = String(id || '').trim();
    if (!key) return;
    const dismissed = loadDismissedMap();
    dismissed[key] = true;
    saveDismissedMap(dismissed);
    renderNotificationBells();
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
    if (left + estimatedWidth > viewportWidth - 12) left = Math.max(12, viewportWidth - estimatedWidth - 12);
    if (top + estimatedHeight > viewportHeight - 12) top = Math.max(12, viewportHeight - estimatedHeight - 12);
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
          <button class="notification-dismiss-btn" type="button" onclick="dismissNotificationItem('${String(item.id || '').replace(/'/g, "\\'")}')" title="Remover notificação">×</button>
          <div class="notification-item-title">
            <span>${global.escapeHtml?.(item.title) || ''}</span>
            <span>${global.fmt?.(item.amount) || item.amount}</span>
          </div>
          <div class="notification-item-sub">${item.kind === 'income' ? 'Entrada' : 'Pagamento'} · ${global.escapeHtml?.(item.category || 'Sem categoria') || ''} · ${global.escapeHtml?.(item.monthName || '') || ''}</div>
        </div>
      `).join('')
      : '<div class="notification-empty">Nenhuma notificação para hoje.</div>';
    return `
      <div class="notification-popover-head">
        <div class="notification-popover-title">Pagamentos e entradas de hoje</div>
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
        if (wrapper.classList.contains('is-open')) positionNotificationsPopover(wrapper);
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

  global.dismissNotificationItem = dismissNotification;

  global.MesAtualNotifications = {
    getTodayDayKey,
    toDayKeyFromDateLabel,
    getNotificationItemsForToday,
    dismissNotification,
    closeNotificationsPopover,
    positionNotificationsPopover,
    repositionOpenNotificationsPopover,
    renderNotificationBells,
    toggleNotificationsPopover
  };
})(window);

