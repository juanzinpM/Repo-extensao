// models/documentosModel.js
// Documentos anexados ao aluno (RG, comprovante de endereço, etc.),
// sempre vinculados ao ano letivo em que foram enviados.
const fs = require('fs');
const path = require('path');
const db = require('../db');
const matriculasModel = require('./matriculasModel');
const { PASTA_UPLOADS } = require('../config');

function listarPorAluno(alunoId) {
  const anoLetivo = matriculasModel.anoLetivoAtual();
  return db.prepare(
    'SELECT * FROM documentos WHERE aluno_id = ? AND ano_letivo_id = ? ORDER BY data_upload DESC'
  ).all(alunoId, anoLetivo.id);
}

function buscarPorId(id) {
  return db.prepare('SELECT * FROM documentos WHERE id = ?').get(id);
}

function criar(alunoId, tipo, arquivoPath) {
  const anoLetivo = matriculasModel.anoLetivoAtual();
  const resultado = db.prepare(
    'INSERT INTO documentos (aluno_id, ano_letivo_id, tipo, arquivo_path) VALUES (?, ?, ?, ?)'
  ).run(alunoId, anoLetivo.id, tipo, arquivoPath);
  return resultado.lastInsertRowid;
}

function remover(documento) {
  // Apaga o arquivo físico também — melhor esforço: se o arquivo já não
  // existir por algum motivo, apenas ignora e segue removendo do banco.
  fs.unlink(path.join(__dirname, '..', PASTA_UPLOADS, documento.arquivo_path), () => {});
  db.prepare('DELETE FROM documentos WHERE id = ?').run(documento.id);
}

module.exports = { listarPorAluno, buscarPorId, criar, remover };
