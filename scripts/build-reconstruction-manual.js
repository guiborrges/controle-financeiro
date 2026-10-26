'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { BEGIN, END, parseManual } = require('./reconstruct-from-manual');

const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const output = 'docs/MEUFIN-RECONSTRUCAO-COMPLETA.md';
const template = 'docs/MEUFIN-ESPECIFICACAO.md';
const extra = ['scripts/build-reconstruction-manual.js', 'scripts/reconstruct-from-manual.js',
  'tests/reconstruction-manual.test.js', template];
const seedStub = "'use strict';\n// Historico privado excluido do manual de reconstrucao.\nfunction getLegacySeedForUser() { return null; }\nmodule.exports = { getLegacySeedForUser };\n";
const seedTestStub = "const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { getLegacySeedForUser } = require('../server/legacy-seed-data');\ntest('reconstructed edition has no private seed for any user', () => {\n  assert.equal(getLegacySeedForUser({ username: 'guilherme', permissions: { canAccessESO: true } }), null);\n  assert.equal(getLegacySeedForUser({ username: 'other' }), null);\n});\n";

function sourceFiles() {
  const tracked = execFileSync('git', ['ls-files', '-z', '--', 'public', 'server', 'workers', 'tests', 'scripts',
    '.github', '.githooks', '.gitignore', '.editorconfig', 'server.js', 'package.json', 'package-lock.json', 'render.yaml'],
  { cwd: root }).toString('utf8').split('\0').filter(Boolean);
  return [...new Set([...tracked, ...extra])].sort().map(file => {
    if (/^(?:auth|data|output|tmp|node_modules)\//.test(file) || /(?:^|\/)\.env(?:\.|$)/.test(file)) {
      throw new Error(`Arquivo nao permitido: ${file}`);
    }
    const target = path.join(root, file);
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`Link nao permitido: ${file}`);
    const substituted = ['server/legacy-seed-data.js', 'tests/legacy-seed-privacy.test.js'].includes(file);
    const bytes = file === 'server/legacy-seed-data.js' ? Buffer.from(seedStub)
      : file === 'tests/legacy-seed-privacy.test.js' ? Buffer.from(seedTestStub) : fs.readFileSync(target);
    return { path: file, bytes: bytes.length, sha256: hash(bytes), substituted, base64: bytes.toString('base64') };
  });
}

function build() {
  const referenceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim();
  const files = sourceFiles();
  const bundle = { version: 1, referenceCommit, files };
  const packed = zlib.gzipSync(Buffer.from(JSON.stringify(bundle)), { level: 9 });
  const envelope = { format: 'meufin-reconstruction-v1', sha256: hash(packed), gzipBase64: packed.toString('base64') };
  const guide = fs.readFileSync(path.join(root, template), 'utf8');
  const extractor = fs.readFileSync(path.join(root, 'scripts/reconstruct-from-manual.js'), 'utf8');
  const inventory = files.map(file => `| ${file.path} | ${file.bytes} | ${file.sha256} | ${file.substituted ? 'Base privada substituida por vazio' : 'Codigo/recurso'} |`).join('\n');
  const appendix = `\n\n# Anexo A - Reconstrucao independente do repositorio\n\n` +
    `Base Git: ${referenceCommit}. O pacote inclui o conteudo do workspace na geracao, inclusive esta entrega documental.\n` +
    `${files.length} arquivos. Dependencias de terceiros nao sao incorporadas: npm ci usa o lockfile incluido.\n` +
    `Nao inclui dados de usuarios, sessoes, backups, node_modules ou credenciais de ambiente.\n` +
    `server/legacy-seed-data.js foi substituido por uma funcao que retorna null; seu teste especifico foi substituido por teste de ausencia de seed. Nenhum historico privado e necessario para reconstruir o produto.\n` +
    `Nao afirma equivalencia dos dados pessoais nem dos seeds privados. SHA-256 detecta corrupcao, nao autentica autoria.\n\n` +
    `## Como usar apenas este documento\n\n` +
    `O codigo abaixo e o extrator completo e usa apenas Node.js. Ele pode ser executado como reconstruct-from-manual.js, com este documento e uma pasta vazia.\n` +
    `No workspace atual o mesmo extrator ja existe em scripts/reconstruct-from-manual.js.\n\n` +
    '```powershell\nnode scripts/reconstruct-from-manual.js docs/MEUFIN-RECONSTRUCAO-COMPLETA.md\n' +
    'node scripts/reconstruct-from-manual.js docs/MEUFIN-RECONSTRUCAO-COMPLETA.md C:/meufin-reconstruido\n```\n\n' +
    `O primeiro comando so verifica. O segundo exige destino vazio e nao sobrescreve arquivos. Apos extrair: npm ci, npm test e npm start, com storage de teste isolado.\n` +
    `O gerador desta entrega usa Git; a extracao/execucao do aplicativo reconstruido nao depende de acesso ao repositorio original.\n` +
    `Smoke pode exigir CDN ou vendor local; benchmark historico requer commits antigos que nao fazem parte do pacote.\n\n` +
    '<details>\n<summary>Extrator completo, sem dependencias npm</summary>\n\n```javascript\n' + extractor + '\n```\n\n</details>\n\n' +
    `## Inventario com verificacao por arquivo\n\n| Caminho | Bytes | SHA-256 | Observacao |\n|---|---:|---|---|\n${inventory}\n\n` +
    '<details>\n<summary>Pacote completo de fontes e recursos (JSON comprimido em Base64)</summary>\n\n' +
    BEGIN + '\n```json\n' + JSON.stringify(envelope, null, 2) + '\n```\n' + END + '\n\n</details>\n';
  const manual = guide + appendix;
  parseManual(manual);
  fs.writeFileSync(path.join(root, output), manual);
  console.log(JSON.stringify({ output, files: files.length, bytes: Buffer.byteLength(manual), referenceCommit }));
}

if (require.main === module) build();
module.exports = { sourceFiles, build };
