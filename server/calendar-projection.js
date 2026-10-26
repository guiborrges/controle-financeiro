const calendar = require('../public/app/modules/continuous-calendar');
const projection = require('../public/app/modules/shared/calendar-projection');

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
  return projection.shiftDate(parts[0], projection.monthLag(originalOrdinal, source.ordinal), target.ordinal, (rawDay, targetYear, targetMonth) => {
    const day = Math.min(Number(rawDay), new Date(targetYear, targetMonth + 1, 0).getDate());
    return `${String(day).padStart(2, '0')}/${String(targetMonth + 1).padStart(2, '0')}/${String(targetYear).slice(-2)}`;
  });
}

function getProjectedCalendarMonth(state, monthId) {
  const model = state?.finCalendarModel;
  const existing = (state?.finData || []).find(month => month.id === monthId);
  if (model?.version !== calendar.VERSION) return existing || null;
  const options = {
    sort: month => monthFromId(month.id).ordinal,
    month: monthFromId,
    monthAtOrdinal: ordinal => Number.isFinite(ordinal) ? monthFromId(`${MONTHS[ordinal % 12]}_${Math.floor(ordinal / 12)}`) : null,
    blank: month => ({ ...monthFromId(month.id), renda: [], outflows: [], projetos: [], cardBills: [] }),
    normalize() {},
    projectSettings(payload, target, source) {
      projection.projectCardDates(payload, source, monthFromId(target.id), occurrenceDate);
    },
    occurrence: projection.createOccurrenceProjector({
      income: payload => ({ ...payload, paid: false, patrimonioMovementId: '' }),
      project: (payload, month, source, index) => ({ ...payload, paid: false, patrimonioMovementId: '',
        dataRecebimento: occurrenceDate(payload.dataRecebimento, source, monthFromId(month.id)),
        recurringInstallmentIndex: index }),
      outflow: (payload, month, source) => ({ ...payload, paid: false, patrimonioMovementId: '',
        date: occurrenceDate(payload.date, source, monthFromId(month.id)) }),
      singleOutflowIndex: payload => Number(payload.installmentIndex || 1),
      resetOutflowState: false
    })
  };
  const session = calendar.createSession(model, options);
  return existing ? session.hydrate(existing) : session.virtual(monthFromId(monthId));
}

module.exports = { getProjectedCalendarMonth };
