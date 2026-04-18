const { setDeveloperPassword } = require('../server/developer-store');

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

const password = readArg('--password');

if (!password || password.length < 8) {
  console.error('Uso: node scripts/set-developer-password.js --password "SuaSenhaForte"');
  process.exit(1);
}

setDeveloperPassword(password);
console.log('Senha do desenvolvedor atualizada com sucesso.');
