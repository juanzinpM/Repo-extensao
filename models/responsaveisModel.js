// models/responsaveisModel.js
const db = require('../db');

const campos = ['nome', 'cpf', 'rg', 'telefone', 'email', 'parentesco'];

function buscarPorCpf(cpf) {
  if (!cpf) return null;
  return db.prepare('SELECT * FROM responsaveis WHERE cpf = ?').get(cpf);
}

function criar(dados) {
  const colunas = campos.join(', ');
  const marcadores = campos.map(() => '?').join(', ');
  const valores = campos.map((campo) => dados[campo] ?? null);
  const resultado = db
    .prepare(`INSERT INTO responsaveis (${colunas}) VALUES (${marcadores})`)
    .run(...valores);
  return resultado.lastInsertRowid;
}

function atualizar(id, dados) {
  const atribuicoes = campos.map((campo) => `${campo} = ?`).join(', ');
  const valores = campos.map((campo) => dados[campo] ?? null);
  db.prepare(`UPDATE responsaveis SET ${atribuicoes} WHERE id = ?`).run(...valores, id);
}

// Recebe a lista de responsáveis vinda do formulário do aluno.
// Se já existir um responsável com o mesmo CPF, reaproveita o cadastro
// (e atualiza os dados) em vez de duplicar — útil quando dois alunos
// (irmãos, por exemplo) têm o mesmo responsável.
// O primeiro da lista é marcado como responsável principal.
function salvarResponsaveisDoAluno(alunoId, listaResponsaveis) {
  db.prepare('DELETE FROM aluno_responsaveis WHERE aluno_id = ?').run(alunoId);

  const vincular = db.prepare(
    'INSERT INTO aluno_responsaveis (aluno_id, responsavel_id, principal) VALUES (?, ?, ?)'
  );

  (listaResponsaveis || []).forEach((responsavel, indice) => {
    let responsavelId;
    const existente = buscarPorCpf(responsavel.cpf);
    if (existente) {
      atualizar(existente.id, responsavel);
      responsavelId = existente.id;
    } else {
      responsavelId = criar(responsavel);
    }
    vincular.run(alunoId, responsavelId, indice === 0 ? 1 : 0);
  });
}

function listarPorAluno(alunoId) {
  return db.prepare(`
    SELECT r.*, ar.principal
    FROM responsaveis r
    JOIN aluno_responsaveis ar ON ar.responsavel_id = r.id
    WHERE ar.aluno_id = ?
    ORDER BY ar.principal DESC, r.nome
  `).all(alunoId);
}

module.exports = { buscarPorCpf, criar, atualizar, salvarResponsaveisDoAluno, listarPorAluno };
