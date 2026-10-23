(function initContinuousCalendar(global) {
  'use strict';

  const VERSION = 1;
  const RECURRENCE_REVISION = 2;
  const clone = value => JSON.parse(JSON.stringify(value));
  const stable = value => {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).filter(key => key !== '_calendarRule' && key !== 'createdAt').sort().map(key => [key, stable(value[key])]));
  };
  const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  const collections = ['renda', 'outflows', 'projetos'];
  const settingsKeys = ['outflowCards', 'selectionVisibility', 'dailyGoals', 'dailyGoalTarget', 'dailyGoalManualCats', 'dailyCategorySeeds'];
  const cleanName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

  function identity(collection, item) {
    if (collection === 'renda') return item.recurringGroupId || `income_${cleanName(item.fonte)}`;
    if (collection === 'projetos') return item.recurringGroupId || '';
    return item.installmentsGroupId || item.recurringGroupId || (isRecurring(collection, item)
      ? `calendar_rec_${encodeURIComponent([cleanName(item.description), item.outputKind || 'method', item.outputRef || item.outputMethod || 'boleto', cleanName(item.category)].join('|'))}`
      : '');
  }

  function isRecurring(collection, item) {
    if (collection === 'renda') return item.recurringFixed !== false && !!String(item.fonte || '').trim();
    if (collection === 'projetos') return item.recurringExtra === true;
    return item.expenseRecurring === true || item.recurringSpend === true || item.launchRecurring === true
      || !!String(item.recurringGroupId || '').trim() || Number(item.installmentsTotal) > 1
      || !!String(item.installmentsGroupId || '').trim() || item.type === 'fixed';
  }

  function template(collection, item) {
    const result = clone(item);
    delete result.id;
    delete result.createdAt;
    delete result._calendarRule;
    result.paid = false;
    result.patrimonioMovementId = '';
    if (collection === 'outflows') {
      result.status = 'planned';
      result.sharedParticipants = (result.sharedParticipants || []).map(person => ({ ...person, paid: false }));
    }
    return result;
  }

  function activeVersion(rule, ordinal) {
    return (rule.versions || []).filter(version => version.from <= ordinal)
      .sort((a, b) => b.from - a.from)[0] || null;
  }

  function settingsSource(settings, options) {
    return settings?.cardsSourceMonth ? options.month(settings.cardsSourceMonth) : options.monthAtOrdinal?.(settings?.from);
  }

  function putRule(model, collection, item, month, options) {
    const key = identity(collection, item);
    if (!key) return null;
    const id = `${collection}:${key}`;
    let rule = model.rules.find(entry => entry.id === id);
    if (!rule) {
      rule = { id, collection, key, versions: [] };
      model.rules.push(rule);
    }
    const from = options.sort(month);
    const payload = template(collection, item);
    if (collection === 'outflows' && !payload.recurringGroupId && !payload.installmentsGroupId) payload.recurringGroupId = key;
    const version = { from, sourceMonth: month.id, payload };
    const current = activeVersion(rule, from);
    // Monthly dates and installment positions are projected from their source month.
    const comparable = value => {
      if (!value) return value;
      const result = clone(value);
      if (collection === 'outflows') result.date = String(result.date || '').split('/')[0];
      delete result.installmentIndex;
      delete result.recurringInstallmentIndex;
      return result;
    };
    if (!current || current.stopped || !equal(comparable(current.payload), comparable(payload))) {
      rule.versions = rule.versions.filter(entry => entry.from !== from);
      rule.versions.push(version);
    }
    return rule;
  }

  function createModel(months, options) {
    const model = { version: VERSION, recurrenceRevision: RECURRENCE_REVISION, start: options.start, rules: [], settings: [] };
    const ordered = months.slice().sort((a, b) => options.sort(a) - options.sort(b));
    ordered.forEach(month => {
      collections.forEach(collection => (month[collection] || []).forEach(item => {
        if (isRecurring(collection, item)) putRule(model, collection, item, month, options);
      }));
      const payload = {};
      settingsKeys.forEach(key => { if (month[key] !== undefined) payload[key] = clone(month[key]); });
      const last = model.settings[model.settings.length - 1];
      if (!last || !equal(last.payload, payload)) model.settings.push({ from: options.sort(month), cardsSourceMonth: month.id, payload });
      (month.recurringSeriesStops || []).forEach(key => {
        const rule = model.rules.find(entry => entry.key === key && entry.collection === 'outflows');
        if (rule) {
          const from = options.sort(month);
          rule.versions = rule.versions.filter(version => version.from !== from);
          rule.versions.push({ from, stopped: true });
        }
      });
    });
    collections.forEach(collection => {
      const anchor = ordered.filter(month => options.sort(month) <= options.start && (month[collection] || []).some(item => isRecurring(collection, item))).pop();
      if (!anchor) return;
      const active = new Set((anchor[collection] || []).filter(item => isRecurring(collection, item)).map(item => identity(collection, item)));
      model.rules.filter(rule => rule.collection === collection).forEach(rule => {
        const last = activeVersion(rule, options.start);
        if (!last || last.stopped || active.has(rule.key)) return;
        if (rule.versions.some(version => version.from > options.start)) return;
        rule.versions.push({ from: options.start, stopped: true });
      });
    });
    return model;
  }

  function repairRecurringRules(model, months, options) {
    if (model.recurrenceRevision >= RECURRENCE_REVISION) return false;
    const ordered = months.slice().sort((a, b) => options.sort(a) - options.sort(b));
    const anchor = ordered.filter(month => options.sort(month) <= options.start && (month.outflows || []).some(item => isRecurring('outflows', item))).pop();
    const known = new Set(model.rules.map(rule => rule.id));
    if (anchor) ordered.filter(month => options.sort(month) >= options.sort(anchor)).forEach(month => {
      (month.outflows || []).forEach(item => {
        if (!isRecurring('outflows', item)) return;
        const key = identity('outflows', item);
        if (!known.has(`outflows:${key}`)) putRule(model, 'outflows', item, month, options);
      });
      (month.recurringSeriesStops || []).forEach(key => {
        if (known.has(`outflows:${key}`)) return;
        const rule = model.rules.find(entry => entry.id === `outflows:${key}`);
        if (!rule) return;
        const from = options.sort(month);
        rule.versions = rule.versions.filter(version => version.from !== from);
        rule.versions.push({ from, stopped: true });
      });
    });
    model.recurrenceRevision = RECURRENCE_REVISION;
    return true;
  }

  function repairLegacyCardOutputs(model, months, options) {
    if (model.cardOutputRevision >= 1) return false;
    const anchor = months.filter(month => options.sort(month) <= options.start)
      .sort((a, b) => options.sort(a) - options.sort(b)).pop();
    (anchor?.outflows || []).forEach(item => {
      if (item.outputKind !== 'card' || !String(item.recurringGroupId || '').startsWith('legacy_signature_')) return;
      const rule = model.rules.find(entry => entry.id === `outflows:${identity('outflows', item)}`);
      if (!rule) return;
      const staleCards = new Set();
      rule.versions.forEach(version => {
        if (version.from <= options.start || !version.payload || version.payload.outputKind !== 'card') return;
        if (version.payload.outputRef === item.outputRef) return;
        staleCards.add(version.payload.outputRef);
        version.payload.outputRef = item.outputRef;
      });
      months.filter(month => options.sort(month) > options.start).forEach(month => {
        (month.outflows || []).forEach(row => {
          if (identity('outflows', row) !== rule.key || row.paid === true || row.outputKind !== 'card' || !staleCards.has(row.outputRef)) return;
          row.outputRef = item.outputRef;
        });
      });
    });
    model.cardOutputRevision = 1;
    return true;
  }

  function project(model, month, options) {
    const result = options.blank(month);
    const ordinal = options.sort(month);
    const settings = model.settings.filter(entry => entry.from <= ordinal).sort((a, b) => b.from - a.from)[0];
    if (settings) {
      const payload = clone(settings.payload);
      const source = settingsSource(settings, options);
      if (options.projectSettings && source) options.projectSettings(payload, month, source);
      Object.assign(result, payload);
    }
    collections.forEach(collection => { result[collection] = []; });
    if (ordinal < model.start) return result;
    model.rules.forEach(rule => {
      const version = activeVersion(rule, ordinal);
      if (!version || version.stopped) return;
      const source = options.month(version.sourceMonth);
      const offset = ordinal - version.from;
      const total = rule.collection === 'projetos'
        ? Number(version.payload.recurringInstallmentsTotal || 1)
        : Number(version.payload.installmentsTotal || 1);
      const position = rule.collection === 'projetos'
        ? Number(version.payload.recurringInstallmentIndex || 1)
        : Number(version.payload.installmentIndex || 1);
      if ((rule.collection === 'projetos' || total > 1) && position + offset > total) return;
      const item = options.occurrence(rule.collection, clone(version.payload), month, source, offset);
      item._calendarRule = rule.id;
      if (rule.collection === 'outflows') {
        item.id = `calendar_${encodeURIComponent(rule.id)}_${month.id}`;
        item.createdAt = new Date(Date.UTC(Math.floor(ordinal / 12), ordinal % 12, 1)).toISOString();
      }
      result[rule.collection].push(item);
    });
    if (result.selectionVisibility?.version >= 2) {
      result.selectionVisibility.categories ||= {};
      result.selectionVisibility.tags ||= {};
      result.outflows.forEach(item => {
        if (item.category) result.selectionVisibility.categories[item.category] = true;
        const tag = String(item.tag || '').trim().toLocaleLowerCase('pt-BR');
        if (tag) result.selectionVisibility.tags[tag] = true;
      });
    }
    return result;
  }

  function renameSelection(model, kind, source, target, normalize = value => String(value || '').normalize('NFC').trim().toLocaleLowerCase('pt-BR')) {
    const field = kind === 'category' ? 'category' : 'tag';
    const sourceKey = normalize(source);
    const targetKey = normalize(target);
    const rewrite = payload => {
      if (!payload) return;
      if (normalize(payload[field]) === sourceKey) payload[field] = target;
      const visibility = payload.selectionVisibility?.[kind === 'category' ? 'categories' : 'tags'];
      if (visibility) Object.keys(visibility).forEach(key => {
        if (normalize(key) !== sourceKey) return;
        if (!Object.prototype.hasOwnProperty.call(visibility, targetKey)) visibility[targetKey] = visibility[key];
        if (key !== targetKey) delete visibility[key];
      });
      if (kind !== 'category') return;
      ['dailyGoals', 'categorias', '_catOrig'].forEach(key => {
        const values = payload[key];
        if (!values) return;
        Object.keys(values).forEach(name => {
          if (normalize(name) !== sourceKey || name === targetKey) return;
          values[targetKey] = Number(values[targetKey] || 0) + Number(values[name] || 0);
          delete values[name];
        });
      });
      ['dailyCategorySeeds', 'dailyGoalManualCats'].forEach(key => {
        if (Array.isArray(payload[key])) payload[key] = [...new Set(payload[key].map(value => normalize(value) === sourceKey ? target : value))];
      });
    };
    model.rules.forEach(rule => rule.versions.forEach(version => rewrite(version.payload)));
    model.settings.forEach(setting => rewrite(setting.payload));
  }

  function inspect(model, month, months, options, horizon = 36) {
    const start = options.sort(month);
    const projections = [];
    // Read copies of loaded months so paid rows, deletions and local overrides match navigation.
    for (let offset = 0; offset < horizon; offset += 1) {
      const target = options.monthAtOrdinal(start + offset);
      if (!target) break;
      const expected = project(model, target, options);
      const loaded = months.find(entry => options.sort(entry) === start + offset);
      projections.push({ month: target, expected, actual: loaded ? clone(loaded) : clone(expected) });
    }
    return model.rules.map(rule => {
      const version = activeVersion(rule, start);
      const occurrences = [];
      const exceptions = [];
      projections.forEach(({ month: target, expected, actual }) => {
        const matches = row => row._calendarRule === rule.id || identity(rule.collection, row) === rule.key;
        const planned = (expected[rule.collection] || []).find(matches);
        const item = (actual[rule.collection] || []).find(matches);
        if (planned && !item) exceptions.push({ month: target.id, kind: 'removed' });
        if (!item || occurrences.length >= 3) return;
        const changed = !planned || !equal(template(rule.collection, item), template(rule.collection, planned));
        const exception = item.paid === true ? 'paid' : changed ? 'local' : '';
        if (exception) exceptions.push({ month: target.id, kind: exception });
        occurrences.push({ month: clone(target), item: clone(item), exception });
      });
      return {
        id: rule.id, collection: rule.collection,
        versions: clone(rule.versions),
        sourceMonth: version?.sourceMonth || rule.versions.find(entry => entry.sourceMonth)?.sourceMonth || '',
        stopped: version?.stopped === true,
        payload: clone(version?.payload || rule.versions.find(entry => entry.payload)?.payload || {}),
        occurrences, exceptions
      };
    });
  }

  function rowKey(collection, item) {
    return collection === 'outflows' ? item.id : (identity(collection, item) || cleanName(item.nome));
  }

  function updateCards(model, month, options, cardId = '') {
    const from = options.sort(month);
    const previous = model.settings.filter(entry => entry.from <= from).sort((a, b) => b.from - a.from)[0];
    const existing = model.settings.find(entry => entry.from === from);
    const version = existing || { from, cardsSourceMonth: settingsSource(previous, options)?.id, payload: clone(previous?.payload || {}) };
    const cards = clone(month.outflowCards || []);
    const priorPayload = clone(previous?.payload || {});
    const previousSource = settingsSource(previous, options);
    if (options.projectSettings && previousSource) options.projectSettings(priorPayload, month, previousSource);
    const priorCards = priorPayload.outflowCards || [];
    const changed = cards.filter(card => cardId ? card.id === cardId : !equal(card, priorCards.find(prior => prior.id === card.id)));
    const removed = new Set(priorCards.filter(card => (!cardId || card.id === cardId) && !cards.some(next => next.id === card.id)).map(card => card.id));
    if (cardId && !cards.some(card => card.id === cardId)) removed.add(cardId);
    if (!existing) model.settings.push(version);
    model.settings.filter(entry => entry.from >= from).forEach(entry => {
      const payload = clone(entry.payload);
      const source = settingsSource(entry, options);
      if (options.projectSettings && source) options.projectSettings(payload, month, source);
      const unchanged = (payload.outflowCards || []).filter(card => !removed.has(card.id) && !changed.some(next => next.id === card.id));
      entry.payload.outflowCards = [...unchanged, ...clone(changed)];
      entry.cardsSourceMonth = month.id;
    });
  }

  function changeCard(model, month, cardId, targetCardId, options) {
    const from = options.sort(month);
    const matches = version => version?.payload?.outputKind === 'card' && version.payload.outputRef === cardId;
    const change = version => targetCardId
      ? { ...clone(version), payload: { ...clone(version.payload), outputRef: targetCardId } }
      : { from: version.from, stopped: true };
    model.rules.filter(rule => rule.collection === 'outflows').forEach(rule => {
      const active = activeVersion(rule, from);
      if (matches(active) && !rule.versions.some(version => version.from === from)) {
        // Keep the source date/position offset when introducing a transfer version.
        const replacement = change(active);
        if (targetCardId) {
          const projected = project({ ...model, rules: [rule] }, month, options).outflows[0];
          if (!projected) return;
          replacement.payload = template('outflows', { ...projected, outputRef: targetCardId });
          replacement.sourceMonth = month.id;
        }
        replacement.from = from;
        rule.versions.push(replacement);
      }
      rule.versions = rule.versions.map(version => version.from >= from && matches(version) ? change(version) : version);
    });
  }

  function createSession(model, options) {
    const baselines = new Map();

    function remember(month, projected, virtual) {
      const expected = clone(projected);
      options.normalize(expected);
      baselines.set(month.id, { projected: expected, baseline: clone(month), virtual });
    }

    function hydrate(saved) {
      const generated = project(model, saved, options);
      const result = saved._calendarSparse ? { ...generated, ...clone(saved) } : clone(saved);
      collections.forEach(collection => {
        const rows = (result[collection] || []).filter(item => {
          const id = item._calendarRule || `${collection}:${identity(collection, item)}`;
          const rule = model.rules.find(entry => entry.id === id);
          return !rule || !activeVersion(rule, options.sort(result))?.stopped || item.paid === true;
        });
        const hidden = saved._calendarHidden?.[collection] || [];
        generated[collection].forEach(item => {
          const key = rowKey(collection, item);
          if (hidden.includes(key)) return;
          const match = rows.some(row => rowKey(collection, row) === key || identity(collection, row) === identity(collection, item));
          if (!match) rows.push(item);
        });
        result[collection] = rows;
      });
      delete result._calendarHidden;
      delete result._calendarSparse;
      options.normalize(result);
      remember(result, generated, saved._calendarVirtual === true);
      return result;
    }

    function virtual(month) {
      const projected = project(model, month, options);
      projected._calendarVirtual = true;
      options.normalize(projected);
      remember(projected, projected, true);
      return projected;
    }

    function meaningful(month) {
      const result = {};
      [...collections, ...settingsKeys, 'financialGoals', 'calendarEvents', 'patrimonioTransfers', 'obs', 'cardBills'].forEach(key => {
        result[key] = month[key];
      });
      return result;
    }

    function serialize(months) {
      const saved = [];
      months.forEach(month => {
        const baseline = baselines.get(month.id);
        if (!baseline) { saved.push(clone(month)); return; }
        if (baseline.virtual && equal(meaningful(month), meaningful(baseline.projected))) return;
        const packed = clone(month);
        packed._calendarSparse = true;
        packed._calendarHidden = {};
        collections.forEach(collection => {
          const projected = baseline.projected[collection] || [];
          const generated = baseline.projected[collection] || [];
          const generatedKeys = new Set(generated.map(item => rowKey(collection, item)));
          packed[collection] = (month[collection] || []).filter(item => {
            if (!generatedKeys.has(rowKey(collection, item))) return true;
            const original = projected.find(row => rowKey(collection, row) === rowKey(collection, item));
            return !equal(item, original);
          });
          packed._calendarHidden[collection] = generated
            .filter(item => !(month[collection] || []).some(row => rowKey(collection, row) === rowKey(collection, item) || identity(collection, row) === identity(collection, item)))
            .map(item => rowKey(collection, item));
        });
        // Legacy months retain every original row; only generated occurrences are compacted.
        saved.push(packed);
      });
      return saved;
    }

    function refresh(months, ruleId, from) {
      months.forEach(month => {
        if (options.sort(month) <= from) return;
        const baseline = baselines.get(month.id);
        if (!baseline) return;
        const fresh = project(model, month, options);
        collections.forEach(collection => {
          const old = baseline.projected[collection] || [];
          const rows = month[collection] || [];
          const expected = fresh[collection].find(item => item._calendarRule === ruleId);
          const index = rows.findIndex(item => item._calendarRule === ruleId || `${collection}:${identity(collection, item)}` === ruleId);
          if (index >= 0) {
            if (rows[index].paid === true) return;
            const prior = old.find(item => rowKey(collection, item) === rowKey(collection, rows[index]));
            if (expected && prior && !equal(rows[index], prior)) return;
            if (expected) rows[index] = expected;
            else rows.splice(index, 1);
          } else if (expected) {
            const previouslyProjected = (baseline.projected[collection] || []).some(item => `${collection}:${identity(collection, item)}` === ruleId);
            if (!previouslyProjected) rows.push(expected);
          }
          month[collection] = rows;
        });
        options.normalize(month);
        remember(month, fresh, baseline.virtual);
      });
    }

    function upsert(months, month, collection, item) {
      const id = `${collection}:${identity(collection, item)}`;
      const previous = model.rules.find(entry => entry.id === id);
      if (previous) previous.versions = previous.versions.filter(version => version.from < options.sort(month));
      const rule = putRule(model, collection, item, month, options);
      if (rule) refresh(months, rule.id, options.sort(month));
    }

    function stop(months, month, collection, key) {
      const rule = model.rules.find(entry => entry.id === `${collection}:${key}`);
      if (!rule) return;
      const from = options.sort(month);
      rule.versions = rule.versions.filter(entry => entry.from < from);
      rule.versions.push({ from, stopped: true });
      refresh(months, rule.id, from);
    }

    return { hydrate, virtual, serialize, upsert, stop };
  }

  global.ContinuousCalendar = { VERSION, RECURRENCE_REVISION, createModel, repairRecurringRules, repairLegacyCardOutputs, updateCards, changeCard, createSession, project, inspect, renameSelection, identity, isRecurring };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ContinuousCalendar;
})(typeof window !== 'undefined' ? window : globalThis);
