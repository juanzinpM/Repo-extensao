// models/documentosModel.js
// Documentos anexados ao aluno (RG, comprovante de endereço, etc.),
// sempre vinculados ao ano letivo em que foram enviados.
const fs = require('fs');
const path = require('path');
const db = require('../db');
const matriculasModel = require('./matriculasModel');
const { PASTA_UPLOADS } = require('../config');

// Os documentos valem entre os anos letivos: a ficha mostra tudo o que já foi
// anexado, com o ano em que cada arquivo foi enviado.
function listarPorAluno(alunoId) {
  return db.prepare(`
    SELECT d.*, al.ano AS ano_letivo FROM documentos d
    JOIN anos_letivos al ON al.id = d.ano_letivo_id
    WHERE d.aluno_id = ? ORDER BY d.data_upload DESC, d.id DESC
  `).all(alunoId);
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

// Documentos com espaço próprio na ficha (um arquivo por aluno). Enviar de
// novo substitui o anterior, de qualquer ano, e apaga o arquivo antigo.
const TIPOS_UNICOS = {
  'regras-convivencia': 'Regras de convivência',
  'termo-rematricula': 'Termo de rematrícula'
};

function substituirPorTipo(alunoId, tipo, arquivoPath) {
  const antigos = db.prepare(
    'SELECT * FROM documentos WHERE aluno_id = ? AND tipo = ?'
  ).all(alunoId, tipo);
  antigos.forEach(remover);
  return criar(alunoId, tipo, arquivoPath);
}

function remover(documento) {
  // Apaga o arquivo físico também — melhor esforço: se o arquivo já não
  // existir por algum motivo, apenas ignora e segue removendo do banco.
  fs.unlink(path.join(__dirname, '..', PASTA_UPLOADS, documento.arquivo_path), () => {});
  db.prepare('DELETE FROM documentos WHERE id = ?').run(documento.id);
}

module.exports = { TIPOS_UNICOS, listarPorAluno, buscarPorId, criar, substituirPorTipo, remover };
