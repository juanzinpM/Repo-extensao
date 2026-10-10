// models/matriculasModel.js
const db = require('../db');
const ErroApp = require('../utils/ErroApp');
const modalidadesModel = require('./modalidadesModel');

function anoLetivoAtual() {
  const ano = new Date().getFullYear();
  let linha = db.prepare('SELECT * FROM anos_letivos WHERE ano = ?').get(ano);
  if (!linha) {
    db.prepare('INSERT INTO anos_letivos (ano, ativo) VALUES (?, 1)').run(ano);
    linha = db.prepare('SELECT * FROM anos_letivos WHERE ano = ?').get(ano);
  }
  return linha;
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const nascimento = new Date(dataNascimento);
  if (Number.isNaN(nascimento.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAniversario =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (aindaNaoFezAniversario) idade -= 1;
  return idade;
}

// RF06: Box aceita adultos; as demais modalidades são só infantis (por ora).
function validarModalidadesParaIdade(dataNascimento, modalidades) {
  const idade = calcularIdade(dataNascimento);
  if (idade === null || idade < 18) return; // sem data ou é criança: sem restrição

  const somenteInfantis = modalidades.filter((m) => m.publico === 'infantil');
  if (somenteInfantis.length > 0) {
    const nomes = somenteInfantis.map((m) => m.nome).join(', ');
    throw new ErroApp(
      `Aluno maior de idade não pode ser inscrito em modalidade exclusiva para o público infantil: ${nomes}.`
    );
  }
}

function obterOuCriarMatricula(alunoId, anoLetivoId) {
  let matricula = db
    .prepare('SELECT * FROM matriculas WHERE aluno_id = ? AND ano_letivo_id = ?')
    .get(alunoId, anoLetivoId);

  if (!matricula) {
    const resultado = db
      .prepare('INSERT INTO matriculas (aluno_id, ano_letivo_id) VALUES (?, ?)')
      .run(alunoId, anoLetivoId);
    matricula = { id: resultado.lastInsertRowid, aluno_id: alunoId, ano_letivo_id: anoLetivoId };
  }
  return matricula;
}

function salvarModalidadesDoAluno(alunoId, dataNascimento, modalidadeIds) {
  const ids = (modalidadeIds || []).map(Number).filter((id) => !Number.isNaN(id));
  const modalidades = modalidadesModel.buscarPorIds(ids);

  validarModalidadesParaIdade(dataNascimento, modalidades);

  const anoLetivo = anoLetivoAtual();
  const matricula = obterOuCriarMatricula(alunoId, anoLetivo.id);

  db.prepare('DELETE FROM matricula_modalidades WHERE matricula_id = ?').run(matricula.id);
  const vincular = db.prepare(
    'INSERT INTO matricula_modalidades (matricula_id, modalidade_id) VALUES (?, ?)'
  );
  ids.forEach((modalidadeId) => vincular.run(matricula.id, modalidadeId));
}

function listarModalidadesDoAluno(alunoId) {
  const anoLetivo = anoLetivoAtual();
  const matricula = db
    .prepare('SELECT * FROM matriculas WHERE aluno_id = ? AND ano_letivo_id = ?')
    .get(alunoId, anoLetivo.id);
  if (!matricula) return [];

  return db
    .prepare('SELECT modalidade_id FROM matricula_modalidades WHERE matricula_id = ?')
    .all(matricula.id)
    .map((linha) => linha.modalidade_id);
}

// ---------- Rematrícula anual ----------
// A matrícula do ano vigente já é criada automaticamente por
// salvarModalidadesDoAluno() sempre que o cadastro é salvo — não existe
// uma ação de "rematricular" separada. O que falta é: 1) avisar quem
// ainda não tem matrícula no ano atual, e 2) sugerir as modalidades do
// ano anterior, pra não obrigar reescolher tudo do zero.

function buscarUltimaMatriculaAnterior(alunoId) {
  const anoAtual = anoLetivoAtual();
  // Só conta como "matrícula anterior" um ano em que o aluno de fato tinha
  // alguma modalidade vinculada — uma matrícula "vazia" (linha criada
  // automaticamente ao salvar o cadastro, sem modalidade nenhuma marcada)
  // não conta como matrícula de verdade.
  return db.prepare(`
    SELECT m.id, al.ano
    FROM matriculas m
    JOIN anos_letivos al ON al.id = m.ano_letivo_id
    JOIN matricula_modalidades mm ON mm.matricula_id = m.id
    WHERE m.aluno_id = ? AND al.ano < ?
    GROUP BY m.id
    ORDER BY al.ano DESC
    LIMIT 1
  `).get(alunoId, anoAtual.ano);
}

function situacaoMatricula(alunoId) {
  const anoAtual = anoLetivoAtual();
  const modalidadesNoAnoAtual = db.prepare(`
    SELECT mm.modalidade_id
    FROM matriculas m
    JOIN matricula_modalidades mm ON mm.matricula_id = m.id
    WHERE m.aluno_id = ? AND m.ano_letivo_id = ?
  `).all(alunoId, anoAtual.id);

  if (modalidadesNoAnoAtual.length > 0) {
    return { matriculadoNoAnoAtual: true, anoAtual: anoAtual.ano };
  }

  const anterior = buscarUltimaMatriculaAnterior(alunoId);
  if (!anterior) {
    // Nunca teve modalidade vinculada em nenhum ano — não é "pendente de
    // rematrícula", é um aluno que ainda não escolheu modalidade nenhuma vez.
    return { matriculadoNoAnoAtual: false, anoAtual: anoAtual.ano, anoAnterior: null, modalidadesSugeridas: [] };
  }

  const modalidadesSugeridas = db
    .prepare('SELECT modalidade_id FROM matricula_modalidades WHERE matricula_id = ?')
    .all(anterior.id)
    .map((linha) => linha.modalidade_id);

  return {
    matriculadoNoAnoAtual: false,
    anoAtual: anoAtual.ano,
    anoAnterior: anterior.ano,
    modalidadesSugeridas
  };
}

// Alunos que já tiveram modalidade vinculada alguma vez, não estão
// inativos, e não têm modalidade vinculada no ano letivo vigente —
// é a fila de rematrícula. (Ignora matrícula "vazia" — ver nota acima.)
function listarPendentesRematricula() {
  const anoAtual = anoLetivoAtual();
  return db.prepare(`
    SELECT DISTINCT a.id, a.nome, a.escola, a.status
    FROM alunos a
    WHERE a.status != 'inativo'
      AND EXISTS (
        SELECT 1 FROM matriculas m
        JOIN matricula_modalidades mm ON mm.matricula_id = m.id
        WHERE m.aluno_id = a.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM matriculas m2
        JOIN matricula_modalidades mm2 ON mm2.matricula_id = m2.id
        WHERE m2.aluno_id = a.id AND m2.ano_letivo_id = ?
      )
    ORDER BY a.nome
  `).all(anoAtual.id);
}

module.exports = {
  anoLetivoAtual, salvarModalidadesDoAluno, listarModalidadesDoAluno,
  situacaoMatricula, listarPendentesRematricula, calcularIdade
};
