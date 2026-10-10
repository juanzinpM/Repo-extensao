// models/modalidadesModel.js
const db = require('../db');
const ErroApp = require('../utils/ErroApp');

function listar() {
  return db.prepare('SELECT * FROM modalidades ORDER BY nome').all();
}

function buscarPorIds(ids) {
  if (!ids || ids.length === 0) return [];
  const marcadores = ids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM modalidades WHERE id IN (${marcadores})`).all(...ids);
}

// Permite cadastrar modalidades novas sem alterar código (RF06).
function criar(nome, publico) {
  if (!nome || !nome.trim()) {
    throw new ErroApp('O nome da modalidade é obrigatório.');
  }
  const publicoValido = publico === 'adulto_e_infantil' ? 'adulto_e_infantil' : 'infantil';

  const existente = db.prepare('SELECT id FROM modalidades WHERE nome = ?').get(nome.trim());
  if (existente) {
    throw new ErroApp('Já existe uma modalidade com esse nome.');
  }

  const resultado = db
    .prepare('INSERT INTO modalidades (nome, publico) VALUES (?, ?)')
    .run(nome.trim(), publicoValido);
  return resultado.lastInsertRowid;
}

module.exports = { listar, buscarPorIds, criar };
