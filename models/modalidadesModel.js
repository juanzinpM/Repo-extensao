// models/modalidadesModel.js
const db = require('../db');
const ErroApp = require('../utils/ErroApp');

// Minúsculas, sem acentos e com espaços repetidos reduzidos a um só.
function normalizarNome(nome) {
  return String(nome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

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

  // "Box", "box" e "BOX" (e também "Inglês"/"Ingles") são a mesma modalidade.
  // A comparação é feita aqui, e não no SQL, porque o NOCASE do SQLite só
  // ignora maiúsculas do alfabeto ASCII (não funcionaria com "Inglês" x "INGLÊS").
  const nomeNormalizado = normalizarNome(nome);
  const existente = listar().find((m) => normalizarNome(m.nome) === nomeNormalizado);
  if (existente) {
    throw new ErroApp('Já existe uma modalidade com esse nome.');
  }

  const resultado = db
    .prepare('INSERT INTO modalidades (nome, publico) VALUES (?, ?)')
    .run(nome.trim(), publicoValido);
  return resultado.lastInsertRowid;
}

module.exports = { listar, buscarPorIds, criar };
