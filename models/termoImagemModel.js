// models/termoImagemModel.js
// Termo de uso de imagem: um registro por aluno + ano letivo, que pode
// ser resolvido de duas formas (decisão de escopo já confirmada):
//   - aceite digital (marca a data, sem arquivo)
//   - upload do PDF assinado (guarda o arquivo, sem aceite digital)
// As duas formas são mutuamente exclusivas: a mais recente "vence".
const db = require('../db');
const matriculasModel = require('./matriculasModel');

// O termo vale entre os anos: a ficha mostra o registro mais recente, de
// qualquer ano. Mudar o termo num ano novo cria um registro novo (o do ano
// anterior continua guardado como histórico).
function buscarMaisRecente(alunoId) {
  return db.prepare(
    'SELECT * FROM termos_imagem WHERE aluno_id = ? ORDER BY ano_letivo_id DESC, id DESC LIMIT 1'
  ).get(alunoId) || null;
}

function obterOuCriarRegistro(alunoId) {
  const existente = buscarMaisRecente(alunoId);
  const anoAtual = matriculasModel.anoLetivoAtual();
  if (existente && existente.ano_letivo_id === anoAtual.id) return existente;

  const resultado = db.prepare(
    'INSERT INTO termos_imagem (aluno_id, ano_letivo_id) VALUES (?, ?)'
  ).run(alunoId, anoAtual.id);
  return { id: resultado.lastInsertRowid };
}

function registrarAceiteDigital(alunoId) {
  const registro = obterOuCriarRegistro(alunoId);
  db.prepare(
    "UPDATE termos_imagem SET aceite_digital = 1, data_aceite = CURRENT_TIMESTAMP, arquivo_path = NULL WHERE id = ?"
  ).run(registro.id);
}

function registrarArquivo(alunoId, arquivoPath) {
  const registro = obterOuCriarRegistro(alunoId);
  db.prepare(
    'UPDATE termos_imagem SET arquivo_path = ?, aceite_digital = 0, data_aceite = NULL WHERE id = ?'
  ).run(arquivoPath, registro.id);
}

module.exports = { buscarMaisRecente, registrarAceiteDigital, registrarArquivo };
