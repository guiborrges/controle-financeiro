(function initCalendarProjection(global) {
  'use strict';

  function monthLag(dateOrdinal, sourceOrdinal) {
    return dateOrdinal - sourceOrdinal;
  }

  function shiftDate(day, lag, targetOrdinal, format) {
    const ordinal = targetOrdinal + lag;
    return format(day, Math.floor(ordinal / 12), ordinal % 12);
  }

  function projectCardDates(payload, source, target, projectDate) {
    payload.outflowCards = (payload.outflowCards || []).map(card => ({
      ...card,
      closingDate: projectDate(card.closingDate, source, target),
      paymentDate: projectDate(card.paymentDate, source, target)
    }));
  }

  function nextIndex(value, offset) {
    return Number(value || 1) + offset;
  }

  // Cloning and date interpretation remain explicit adapter policies, not new defaults.
  function createOccurrenceProjector(adapter) {
    return (collection, payload, month, source, offset) => {
      if (collection === 'renda') return adapter.income(payload, month, source);
      if (collection === 'projetos') {
        return adapter.project(payload, month, source, nextIndex(payload.recurringInstallmentIndex, offset));
      }
      const result = adapter.outflow(payload, month, source);
      result.installmentIndex = Number(payload.installmentsTotal || 1) > 1
        ? nextIndex(payload.installmentIndex, offset)
        : adapter.singleOutflowIndex(payload);
      result.paid = false;
      if (adapter.resetOutflowState) {
        result.status = 'planned';
        result.sharedParticipants = (result.sharedParticipants || []).map(person => ({ ...person, paid: false }));
      }
      return result;
    };
  }

  const api = { monthLag, shiftDate, projectCardDates, nextIndex, createOccurrenceProjector };
  global.CalendarProjection = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
