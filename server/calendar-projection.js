const calendar = require('../public/app/modules/continuous-calendar');

const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function monthFromId(id) {
  const [name, year] = String(id).split('_');
  return { id, nome: `${name.toUpperCase()} ${year}`, ordinal: Number(year) * 12 + MONTHS.indexOf(name) };
}

function occurrenceDate(value, source, target) {
  const parts = String(value || '').split('/');
  if (parts.length !== 3) return value || '';
  const year = Number(parts[2]) + (parts[2].length === 2 ? 2000 : 0);
  const originalOrdinal = year * 12 + Number(parts[1]) - 1;
  const dateOrdinal = target.ordinal + originalOrdinal - source.ordinal;
  const targetYear = Math.floor(dateOrdinal / 12);
  const targetMonth = dateOrdinal % 12;
  const day = Math.min(Number(parts[0]), new Date(targetYear, targetMonth + 1, 0).getDate());
  return `${String(day).padStart(2, '0')}/${String(targetMonth + 1).padStart(2, '0')}/${String(targetYear).slice(-2)}`;
}

function getProjectedCalendarMonth(state, monthId) {
  const model = state?.finCalendarModel;
  const existing = (state?.finData || []).find(month => month.id === monthId);
  if (model?.version !== calendar.VERSION) return existing || null;
  const options = {
    sort: month => monthFromId(month.id).ordinal,
    month: monthFromId,
    blank: month => ({ ...monthFromId(month.id), renda: [], outflows: [], projetos: [], cardBills: [] }),
    normalize() {},
    occurrence(collection, payload, month, source, offset) {
      const result = { ...payload, paid: false, patrimonioMovementId: '' };
      if (collection === 'outflows') {
        result.date = occurrenceDate(payload.date, source, monthFromId(month.id));
        result.installmentIndex = Number(payload.installmentIndex || 1) + (Number(payload.installmentsTotal || 1) > 1 ? offset : 0);
      }
      if (collection === 'projetos') {
        result.dataRecebimento = occurrenceDate(payload.dataRecebimento, source, monthFromId(month.id));
        result.recurringInstallmentIndex = Number(payload.recurringInstallmentIndex || 1) + offset;
      }
      return result;
    }
  };
  const session = calendar.createSession(model, options);
  return existing ? session.hydrate(existing) : session.virtual(monthFromId(monthId));
}

module.exports = { getProjectedCalendarMonth };
