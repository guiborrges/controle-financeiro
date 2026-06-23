(function initMobileV2Onboarding(global) {
  'use strict';

  const VERSION = 1;
  const TASKS = Object.freeze([
    { key: 'account', label: 'Adicionar primeira conta patrimonial', action: 'Adicionar conta' },
    { key: 'card', label: 'Adicionar primeiro cartão', action: 'Adicionar cartão' },
    { key: 'income', label: 'Adicionar primeira renda', action: 'Adicionar renda' },
    { key: 'outflow', label: 'Adicionar primeiro lançamento', action: 'Adicionar lançamento' },
    { key: 'goals', label: 'Configurar metas de gastos', action: 'Configurar metas' },
    { key: 'banking', label: 'Conectar Internet Banking', action: 'Conectar banco' }
  ]);
  const TIPS = Object.freeze({
    card: 'Muitos usuários começam cadastrando seus cartões.',
    banking: 'Você pode conectar seu banco para evitar lançamentos manuais.',
    goals: 'As metas ajudam a controlar categorias como mercado e lazer.',
    account: 'Cadastre onde você guarda dinheiro para acompanhar seu patrimônio.',
    income: 'Comece pela sua renda para enxergar o resultado real do mês.',
    outflow: 'Seu primeiro lançamento já começa a dar forma ao mês.'
  });

  const runtime = {
    initialized: false,
    welcomeScheduled: false,
    lastSnapshot: null
  };

  function isEnabled() {
    return global.MobileV2?.isEnabled?.() === true
      || document.documentElement.classList.contains('mobile-v2');
  }

  function userKey() {
    const session = global.__APP_BOOTSTRAP__?.session || {};
    return String(session.id || session.email || session.username || 'anonymous').trim() || 'anonymous';
  }

  function storageKey() {
    const resetToken = String(
      global.__APP_BOOTSTRAP__?.appState?.finOnboardingResetToken || ''
    ).trim();
    return `meufin:onboarding:v${VERSION}:${userKey()}:${resetToken || 'default'}`;
  }

  function readState() {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem(storageKey()) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeState(next) {
    try { global.localStorage?.setItem(storageKey(), JSON.stringify(next)); } catch {}
    return next;
  }

  function getMonths() {
    if (global.MobileV2Data?.getMonths) return global.MobileV2Data.getMonths() || [];
    if (typeof global.getAllFinanceMonths === 'function') return global.getAllFinanceMonths() || [];
    return Array.isArray(global.data) ? global.data : [];
  }

  function hasPositiveGoal(month) {
    return Object.values(month?.dailyGoals || {}).some((value) => Number(value || 0) > 0);
  }

  function getCompletionSnapshot() {
    const months = getMonths();
    const accounts = Array.isArray(global.patrimonioAccounts)
      ? global.patrimonioAccounts
      : (global.MobileV2Data?.getPatrimonioData?.().accounts || []);
    const completed = {
      account: accounts.length > 0,
      card: months.some((month) => Array.isArray(month?.outflowCards) && month.outflowCards.length > 0),
      income: months.some((month) =>
        (Array.isArray(month?.renda) && month.renda.length > 0)
        || (Array.isArray(month?.projetos) && month.projetos.length > 0)
      ),
      outflow: months.some((month) => Array.isArray(month?.outflows) && month.outflows.length > 0),
      goals: months.some(hasPositiveGoal),
      banking: !!document.querySelector('.muplug-connection-badge.is-connected')
    };
    const count = TASKS.filter((task) => completed[task.key]).length;
    return { completed, count, total: TASKS.length, allDone: count === TASKS.length };
  }

  function ensureLayer() {
    let layer = document.getElementById('mobileV2OnboardingLayer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'mobileV2OnboardingLayer';
    layer.className = 'm2-onboarding-layer';
    layer.setAttribute('hidden', 'hidden');
    layer.innerHTML = '<button class="m2-onboarding-scrim" type="button" aria-label="Fechar"></button><section class="m2-onboarding-panel" role="dialog" aria-modal="true"></section>';
    document.body.appendChild(layer);
    layer.querySelector('.m2-onboarding-scrim')?.addEventListener('click', closeLayer);
    return layer;
  }

  function showLayer() {
    const layer = ensureLayer();
    layer.removeAttribute('hidden');
    requestAnimationFrame(() => layer.classList.add('open'));
    document.body.classList.add('mobile-v2-sheet-open');
    return layer;
  }

  function closeLayer() {
    const layer = document.getElementById('mobileV2OnboardingLayer');
    if (!layer) return;
    layer.classList.remove('open');
    global.setTimeout(() => layer.setAttribute('hidden', 'hidden'), 220);
    document.body.classList.remove('mobile-v2-sheet-open');
    global.MobileV2?.refresh?.();
  }

  function dismissOnboarding() {
    const state = readState();
    writeState({ ...state, welcomeSeen: true, suppressed: true, dismissedAt: Date.now() });
    global.triggerHapticFeedback?.('selection');
    closeLayer();
  }

  function openWelcome() {
    if (!isEnabled()) return;
    const layer = showLayer();
    const panel = layer.querySelector('.m2-onboarding-panel');
    panel.className = 'm2-onboarding-panel is-welcome';
    panel.innerHTML = `
      <button class="m2-onboarding-close" type="button" aria-label="Encerrar ajuda inicial">×</button>
      <div class="m2-onboarding-mark" aria-hidden="true">M</div>
      <span class="m2-onboarding-eyebrow">SEU CONTROLE COMEÇA AQUI</span>
      <h2>Bem-vindo ao Meufin</h2>
      <p>Vamos configurar seu sistema em poucos passos para que ele já comece a organizar suas finanças.</p>
      <div class="m2-onboarding-actions">
        <button class="m2-onboarding-primary" type="button" data-onboarding-start>Começar</button>
        <button class="m2-onboarding-secondary" type="button" data-onboarding-later>Fazer depois</button>
      </div>
    `;
    panel.querySelector('.m2-onboarding-close')?.addEventListener('click', dismissOnboarding);
    panel.querySelector('[data-onboarding-start]')?.addEventListener('click', () => {
      const state = readState();
      writeState({ ...state, welcomeSeen: true });
      global.triggerHapticFeedback?.('selection');
      openChecklist();
    });
    panel.querySelector('[data-onboarding-later]')?.addEventListener('click', () => {
      const state = readState();
      writeState({ ...state, welcomeSeen: true });
      closeLayer();
    });
  }

  function taskIcon(done) {
    return done
      ? '<span class="m2-onboarding-check is-done" aria-hidden="true">✓</span>'
      : '<span class="m2-onboarding-check" aria-hidden="true"></span>';
  }

  function openChecklist() {
    if (!isEnabled()) return;
    const snapshot = getCompletionSnapshot();
    const layer = showLayer();
    const panel = layer.querySelector('.m2-onboarding-panel');
    panel.className = 'm2-onboarding-panel is-checklist';
    panel.innerHTML = `
      <div class="m2-onboarding-panel-head">
        <div><span class="m2-onboarding-eyebrow">CONFIGURAÇÃO INICIAL</span><h2>${snapshot.count} de ${snapshot.total} etapas</h2></div>
        <button class="m2-onboarding-close" type="button" aria-label="Fechar">×</button>
      </div>
      <div class="m2-onboarding-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${snapshot.total}" aria-valuenow="${snapshot.count}">
        <span style="width:${Math.round((snapshot.count / snapshot.total) * 100)}%"></span>
      </div>
      <div class="m2-onboarding-tasks">
        ${TASKS.map((task) => {
          const done = snapshot.completed[task.key] === true;
          return `<button type="button" class="m2-onboarding-task ${done ? 'is-done' : ''}" data-onboarding-task="${task.key}" ${done ? 'disabled' : ''}>
            ${taskIcon(done)}
            <span><strong>${task.label}</strong><small>${done ? 'Concluído' : task.action}</small></span>
            ${done ? '' : '<span class="m2-onboarding-arrow" aria-hidden="true">›</span>'}
          </button>`;
        }).join('')}
      </div>
    `;
    panel.querySelector('.m2-onboarding-close')?.addEventListener('click', dismissOnboarding);
    panel.querySelectorAll('[data-onboarding-task]').forEach((button) => {
      button.addEventListener('click', () => runTaskAction(button.getAttribute('data-onboarding-task')));
    });
  }

  function runTaskAction(key) {
    closeLayer();
    global.triggerHapticFeedback?.('selection');
    global.setTimeout(() => {
      if (key === 'account') {
        global.MobileV2?.setTab?.('patrimonio');
        global.setTimeout(() => global.openPatrimonioAccountModal?.(), 120);
      } else if (key === 'card') {
        global.openUnifiedCardModal?.();
      } else if (key === 'income') {
        global.MobileV2OutflowForm?.openIncomePicker?.();
      } else if (key === 'outflow') {
        global.MobileV2AddSheet?.open?.();
      } else if (key === 'goals') {
        global.MobileV2?.setTab?.('mes');
        global.MobileV2MesAtual?.setSubtab?.('gastos-metas');
        global.MobileV2?.refresh?.();
      } else if (key === 'banking') {
        if (typeof global.openInternetBankingHub === 'function') global.openInternetBankingHub();
        else global.MobileV2?.openInternetBanking?.();
      }
    }, 230);
  }

  function celebrate(taskKey, allDone) {
    const host = document.createElement('div');
    host.className = `m2-onboarding-celebration ${allDone ? 'is-complete' : ''}`;
    host.innerHTML = `<span>✓</span><strong>${allDone ? 'Configuração concluída' : 'Etapa concluída'}</strong>`;
    document.body.appendChild(host);
    global.triggerHapticFeedback?.(allDone ? 'successStrong' : 'success');
    requestAnimationFrame(() => host.classList.add('show'));
    global.setTimeout(() => {
      host.classList.remove('show');
      global.setTimeout(() => host.remove(), 220);
    }, allDone ? 2200 : 1400);
  }

  function currentTip(snapshot, saved) {
    if (Date.now() - Number(saved.firstSeenAt || 0) > 14 * 24 * 60 * 60 * 1000) return null;
    const dismissed = saved.dismissedTips || {};
    const task = TASKS.find((entry) => !snapshot.completed[entry.key] && !dismissed[entry.key]);
    return task ? { key: task.key, text: TIPS[task.key] } : null;
  }

  function renderProgressCard(snapshot, saved) {
    const screen = document.getElementById('mobileV2Screen-mes');
    if (!screen) return;
    screen.querySelector('#mobileV2OnboardingProgress')?.remove();
    if (snapshot.allDone || saved.suppressed === true) return;
    const tip = currentTip(snapshot, saved);
    const card = document.createElement('section');
    card.id = 'mobileV2OnboardingProgress';
    card.className = 'm2-onboarding-progress-card';
    card.innerHTML = `
      <button class="m2-onboarding-progress-main" type="button">
        <span><strong>Configuração inicial</strong><small>${snapshot.count} de ${snapshot.total} etapas concluídas</small></span>
        <span class="m2-onboarding-progress-mini"><i style="width:${Math.round((snapshot.count / snapshot.total) * 100)}%"></i></span>
        <span aria-hidden="true">›</span>
      </button>
      ${tip ? `<div class="m2-onboarding-tip"><span>${tip.text}</span><button type="button" data-dismiss-tip="${tip.key}" aria-label="Fechar dica">×</button></div>` : ''}
    `;
    const header = screen.querySelector('.m2-page-header, .m2-header');
    if (header?.nextSibling) header.parentNode.insertBefore(card, header.nextSibling);
    else screen.prepend(card);
    card.querySelector('.m2-onboarding-progress-main')?.addEventListener('click', openChecklist);
    card.querySelector('[data-dismiss-tip]')?.addEventListener('click', (event) => {
      const key = event.currentTarget.getAttribute('data-dismiss-tip');
      const state = readState();
      const dismissedTips = { ...(state.dismissedTips || {}), [key]: true };
      writeState({ ...state, dismissedTips });
      global.triggerHapticFeedback?.('selection');
      sync();
    });
  }

  function sync(options = {}) {
    if (!isEnabled()) return;
    const snapshot = getCompletionSnapshot();
    let saved = readState();
    const hasSavedState = !!saved.firstSeenAt;

    if (!hasSavedState) {
      const established = snapshot.count >= 2;
      saved = writeState({
        firstSeenAt: Date.now(),
        welcomeSeen: established,
        suppressed: established,
        seenCompleted: { ...snapshot.completed }
      });
    } else {
      const seenCompleted = { ...(saved.seenCompleted || {}) };
      const newlyCompleted = TASKS.filter((task) => snapshot.completed[task.key] && !seenCompleted[task.key]);
      newlyCompleted.forEach((task) => { seenCompleted[task.key] = true; });
      if (newlyCompleted.length) {
        const completingAll = snapshot.allDone && saved.completedCelebrated !== true;
        saved = writeState({ ...saved, seenCompleted, completedCelebrated: saved.completedCelebrated || completingAll });
        celebrate(newlyCompleted[0].key, completingAll);
      }
    }

    runtime.lastSnapshot = snapshot;
    renderProgressCard(snapshot, saved);

    if (options.allowWelcome === false || saved.welcomeSeen || saved.suppressed || runtime.welcomeScheduled) return;
    runtime.welcomeScheduled = true;
    global.setTimeout(() => {
      runtime.welcomeScheduled = false;
      const latest = readState();
      if (!latest.welcomeSeen && isEnabled()) openWelcome();
    }, 420);
  }

  function init() {
    if (runtime.initialized) return;
    runtime.initialized = true;
    document.addEventListener('mobileDataChanged', () => sync({ allowWelcome: false }));
    document.addEventListener('dataLoaded', () => sync({ allowWelcome: false }));
    document.addEventListener('appReady', () => sync({ allowWelcome: true }));
    if (typeof global.MutationObserver === 'function') {
      const connectionObserver = new global.MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.target?.classList?.contains('muplug-connection-badge'))) {
          sync({ allowWelcome: false });
        }
      });
      connectionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
    }
    if (document.readyState !== 'loading') global.setTimeout(() => sync({ allowWelcome: true }), 0);
  }

  global.MobileV2Onboarding = {
    init,
    sync,
    openWelcome,
    openChecklist,
    getCompletionSnapshot
  };

  init();
})(window);
