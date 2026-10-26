'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const BEGIN = '<!-- MEUFIN_SNAPSHOT_BEGIN -->';
const END = '<!-- MEUFIN_SNAPSHOT_END -->';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function parseManual(text) {
  const start = text.lastIndexOf(BEGIN);
  const end = text.indexOf(END, start);
  if (start < 0 || end < 0) throw new Error('Pacote de reconstrucao ausente.');
  const block = text.slice(start + BEGIN.length, end).trim();
  const match = block.match(/^```json\s+([\s\S]+)\s+```$/);
  if (!match) throw new Error('Envelope de reconstrucao invalido.');
  const envelope = JSON.parse(match[1]);
  if (envelope.format !== 'meufin-reconstruction-v1') throw new Error('Formato desconhecido.');
  const packed = Buffer.from(envelope.gzipBase64, 'base64');
  if (hash(packed) !== envelope.sha256) throw new Error('Pacote corrompido.');
  const bundle = JSON.parse(zlib.gunzipSync(packed, { maxOutputLength: 64 * 1024 * 1024 }));
  if (!Array.isArray(bundle.files) || !bundle.files.length || bundle.files.length > 2000) throw new Error('Inventario invalido.');
  const seen = new Set();
  for (const file of bundle.files) {
    if (typeof file.path !== 'string' || !file.path || file.path.includes('\\') || file.path.includes(':')
      || path.posix.isAbsolute(file.path) || file.path.split('/').some(part => !part || part === '.' || part === '..')
      || seen.has(file.path)) throw new Error('Caminho invalido ou repetido.');
    seen.add(file.path);
    const bytes = Buffer.from(file.base64, 'base64');
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw new Error(`Arquivo corrompido: ${file.path}`);
  }
  return bundle;
}

function extractSnapshot(bundle, destination) {
  const root = path.resolve(destination);
  if (fs.existsSync(root)) {
    if (fs.lstatSync(root).isSymbolicLink() || !fs.statSync(root).isDirectory() || fs.readdirSync(root).length) {
      throw new Error('O destino precisa ser um diretorio vazio, sem link simbolico.');
    }
  } else fs.mkdirSync(root, { recursive: true });
  for (const file of bundle.files) {
    const target = path.resolve(root, ...file.path.split('/'));
    if (!target.startsWith(root + path.sep)) throw new Error('Arquivo fora do destino.');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(file.base64, 'base64'), { flag: 'wx' });
  }
  return bundle.files.length;
}

if (require.main === module) {
  try {
    const [manual, destination] = process.argv.slice(2);
    if (!manual) throw new Error('Uso: node reconstruct-from-manual.js MANUAL.md [PASTA_VAZIA]');
    const bundle = parseManual(fs.readFileSync(manual, 'utf8'));
    if (destination) console.log(`${extractSnapshot(bundle, destination)} arquivos reconstruidos em ${path.resolve(destination)}.`);
    else console.log(`Integridade aprovada: ${bundle.files.length} arquivos; base ${bundle.referenceCommit}.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { parseManual, extractSnapshot, BEGIN, END };
