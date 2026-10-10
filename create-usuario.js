// create-usuario.js
// Uso: node create-usuario.js "Nome Completo" email@exemplo.com senha123
const bcrypt = require('bcrypt');
const db = require('./db');

const [, , nome, email, senha] = process.argv;

if (!nome || !email || !senha) {
  console.log('Uso: node create-usuario.js "Nome Completo" email@exemplo.com senha123');
  process.exit(1);
}

const senhaHash = bcrypt.hashSync(senha, 10);

try {
  db.prepare('INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)')
    .run(nome, email, senhaHash);
  console.log(`Usuário "${nome}" criado com sucesso. Já pode fazer login com ${email}.`);
} catch (erro) {
  if (String(erro.message).includes('UNIQUE')) {
    console.log('Já existe um usuário cadastrado com esse e-mail.');
  } else {
    console.error(erro);
  }
}
