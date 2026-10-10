// models/usuariosModel.js
// Única camada que sabe como buscar/salvar usuários no banco.
const db = require('../db');

function buscarPorEmail(email) {
  return db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
}

module.exports = { buscarPorEmail };
