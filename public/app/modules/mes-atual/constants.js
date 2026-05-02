const MONTH_METRIC_TITLE_STORAGE_KEY_MAP = Object.freeze({
  resultado: 'metricResultado',
  gastos: 'metricGastos',
  renda: 'metricRenda',
  projetos: 'metricProjetos',
  metas: 'metricMetas'
});

const UNIFIED_OUTFLOW_METHOD_META = Object.freeze({
  boleto: Object.freeze({ label: 'Boleto' }),
  dinheiro: Object.freeze({ label: 'Dinheiro' }),
  pix: Object.freeze({ label: 'Pix' }),
  debito: Object.freeze({ label: 'Débito' })
});

const UNIFIED_OUTFLOW_GLOBAL_MIGRATION_VERSION = 6;

const GUILHERME_REQUIRED_CARDS = Object.freeze([
  Object.freeze({ key: 'xp', name: 'XP', institution: 'xp', closingDay: 2, paymentDay: 10 }),
  Object.freeze({ key: 'nubank', name: 'Nubank', institution: 'nubank', closingDay: 2, paymentDay: 10 }),
  Object.freeze({ key: 'inter', name: 'Inter', institution: 'inter', closingDay: 2, paymentDay: 10 })
]);
