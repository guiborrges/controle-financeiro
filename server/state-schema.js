const DEFAULT_FIN_STATE_SCHEMA_VERSION = '3';

function resolveSchemaVersion(rawVersion) {
  const candidate = String(rawVersion || '').trim();
  return candidate || DEFAULT_FIN_STATE_SCHEMA_VERSION;
}

module.exports = {
  DEFAULT_FIN_STATE_SCHEMA_VERSION,
  resolveSchemaVersion
};

