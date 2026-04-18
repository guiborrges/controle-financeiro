const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const STORAGE_DIR = process.env.FIN_STORAGE_DIR
  ? path.resolve(process.env.FIN_STORAGE_DIR)
  : ROOT_DIR;

function resolveStoragePath(...segments) {
  return path.join(STORAGE_DIR, ...segments);
}

module.exports = {
  ROOT_DIR,
  STORAGE_DIR,
  resolveStoragePath
};
