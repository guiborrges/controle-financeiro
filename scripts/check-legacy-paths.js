const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'data',
  'auth',
  'migration-backups',
  'workspace-logs'
]);

const EXCLUDED_FILES = new Set([
  path.normalize('docs/PROJECT_CONTEXT.md'),
  path.normalize('docs/CHAT_HISTORY_HANDOFF.md'),
  path.normalize('docs/~$AT_HISTORY_HANDOFF.md')
]);

const FORBIDDEN_PATTERNS = [
  /C:\\Users\\guisi\\OneDrive\\Controle Financeiro\\Controle Financeiro/gi,
  /C:\/Users\/guisi\/OneDrive\/Controle Financeiro\/Controle Financeiro/gi,
  /OneDrive\\Controle Financeiro\\Controle Financeiro/gi,
  /OneDrive\/Controle Financeiro\/Controle Financeiro/gi
];

function isBinaryBuffer(buffer) {
  const sampleSize = Math.min(buffer.length, 4096);
  for (let idx = 0; idx < sampleSize; idx += 1) {
    if (buffer[idx] === 0) return true;
  }
  return false;
}

function shouldSkipPath(relativePath) {
  const normalized = path.normalize(relativePath);
  if (EXCLUDED_FILES.has(normalized)) return true;
  const parts = normalized.split(path.sep);
  return parts.some(part => EXCLUDED_DIRS.has(part));
}

function collectFiles(baseDir) {
  const found = [];
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, absolutePath);
      if (shouldSkipPath(relativePath)) continue;
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      found.push({ absolutePath, relativePath });
    }
  };
  walk(baseDir);
  return found;
}

function findForbiddenMentions(content) {
  const hits = [];
  FORBIDDEN_PATTERNS.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches && matches.length) {
      hits.push(...matches);
    }
  });
  return hits;
}

function main() {
  const files = collectFiles(ROOT_DIR);
  const findings = [];

  files.forEach(({ absolutePath, relativePath }) => {
    let buffer = null;
    try {
      buffer = fs.readFileSync(absolutePath);
    } catch {
      return;
    }
    if (!buffer || !buffer.length || isBinaryBuffer(buffer)) return;
    const text = buffer.toString('utf8');
    const hits = findForbiddenMentions(text);
    if (!hits.length) return;
    findings.push({
      file: relativePath.replace(/\\/g, '/'),
      sample: Array.from(new Set(hits)).slice(0, 3)
    });
  });

  if (!findings.length) {
    console.log('[check-legacy-paths] OK: nenhuma referencia ao diretorio antigo foi encontrada.');
    process.exit(0);
  }

  console.error('[check-legacy-paths] ERRO: referencias ao diretorio antigo encontradas:');
  findings.forEach((item) => {
    console.error(`- ${item.file}`);
    item.sample.forEach(sample => console.error(`  -> ${sample}`));
  });
  process.exit(1);
}

main();
