const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');

test('Nodemailer can send through a safe in-memory JSON transport', async () => {
  const major = Number(require('nodemailer/package.json').version.split('.')[0]);
  assert.equal(major >= 9, true);

  const transport = nodemailer.createTransport({ jsonTransport: true });
  const result = await transport.sendMail({
    from: 'financeiro@example.test',
    to: 'usuario@example.test',
    subject: 'Recuperacao de senha',
    text: 'Mensagem de compatibilidade.'
  });

  assert.equal(typeof result.message, 'string');
  assert.match(result.message, /Recuperacao de senha/);
});
