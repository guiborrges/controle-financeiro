const path = require('path');

const { hashPassword } = require(path.join(__dirname, '..', 'server', 'password'));
const { findUserByUsername, updateUser } = require(path.join(__dirname, '..', 'server', 'user-store'));

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : '';
}

const password = getArg('password');
const username = getArg('user');
const displayName = getArg('name');
const email = getArg('email');

if (!password) {
  console.error('Uso: node scripts/set-password.js --password "SuaSenha" [--user guilherme] [--name "Guilherme"] [--email "email@dominio.com"]');
  process.exit(1);
}

const targetUsername = username || 'guilherme';
const user = findUserByUsername(targetUsername);

if (!user) {
  console.error(`Usuário não encontrado: ${targetUsername}`);
  process.exit(1);
}

const nextUser = updateUser(user.id, {
  username: username || user.username,
  displayName: displayName || user.displayName,
  email: email || user.email,
  passwordHash: hashPassword(password)
});

console.log(`Senha atualizada com sucesso para o usuario ${nextUser.username}.`);
