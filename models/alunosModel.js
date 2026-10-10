// models/alunosModel.js
// Única camada que sabe como ler/gravar alunos no banco.
// Rotas (routes/alunos.js) não têm SQL nenhum — só chamam essas funções.
const db = require('../db');
const responsaveisModel = require('./responsaveisModel');
const matriculasModel = require('./matriculasModel');
const ErroApp = require('../utils/ErroApp');

const STATUS_VALIDOS = ['ativo', 'inativo', 'lista_espera'];

const camposAluno = [
  'nome', 'rg', 'cpf', 'data_nascimento', 'nome_pai', 'nome_mae',
  'endereco', 'bairro', 'complemento', 'telefone_fixo', 'celular', 'email',
  'escola', 'serie_escola', 'horario_escola', 'possui_convenio', 'convenio_qual'
];

const camposSaude = [
  'possui_deficiencia', 'deficiencia_qual',
  'outros_problemas_saude', 'outras_doencas_contagiosas',
  'fumante', 'usa_remedio_continuo', 'remedio_continuo_qual',
  'ja_fez_cirurgia', 'cirurgia_qual',
  'possui_dores_lesoes', 'dores_lesoes_qual',
  'alergico', 'alergico_a_que',
  'usa_medicamento_controlado', 'medicamento_controlado_qual',
  'alergico_a_medicamento', 'alergico_medicamento_qual',
  'solicitar_atestado_saude', 'atestado_motivo',
  'observacoes'
];

const camposFicha = [...camposAluno, ...camposSaude];

function listar(busca, status, modalidadeId) {
  const condicoes = [];
  const parametros = [];
  let joinModalidade = '';

  if (modalidadeId) {
    // Filtra pela modalidade vinculada no ano letivo VIGENTE — a mesma
    // referência usada em todo o resto do sistema (matriculasModel).
    const anoLetivo = matriculasModel.anoLetivoAtual();
    joinModalidade = `
      JOIN matriculas m ON m.aluno_id = a.id AND m.ano_letivo_id = ?
      JOIN matricula_modalidades mm ON mm.matricula_id = m.id AND mm.modalidade_id = ?
    `;
    parametros.push(anoLetivo.id, modalidadeId);
  }

  if (busca) {
    condicoes.push('(a.nome LIKE ? OR a.cpf LIKE ?)');
    const termo = `%${busca}%`;
    parametros.push(termo, termo);
  }
  if (status) {
    condicoes.push('a.status = ?');
    parametros.push(status);
  }

  const clausulaWhere = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db.prepare(`
    SELECT DISTINCT a.id, a.nome, a.cpf, a.escola, a.status, a.data_entrada_lista_espera
    FROM alunos a
    ${joinModalidade}
    ${clausulaWhere}
    ORDER BY a.nome
  `).all(...parametros);
}

function buscarPorId(id) {
  const aluno = db.prepare('SELECT * FROM alunos WHERE id = ?').get(id);
  if (!aluno) return null;

  aluno.problemas_saude_ids = db
    .prepare('SELECT problema_id FROM aluno_problemas_saude WHERE aluno_id = ?')
    .all(aluno.id)
    .map((linha) => linha.problema_id);

  aluno.doencas_contagiosas_ids = db
    .prepare('SELECT doenca_id FROM aluno_doencas_contagiosas WHERE aluno_id = ?')
    .all(aluno.id)
    .map((linha) => linha.doenca_id);

  aluno.responsaveis = responsaveisModel.listarPorAluno(aluno.id);
  aluno.modalidade_ids = matriculasModel.listarModalidadesDoAluno(aluno.id);

  return aluno;
}

function existe(id) {
  return !!db.prepare('SELECT id FROM alunos WHERE id = ?').get(id);
}

function salvarVinculosSaude(alunoId, problemasIds, doencasIds) {
  db.prepare('DELETE FROM aluno_problemas_saude WHERE aluno_id = ?').run(alunoId);
  db.prepare('DELETE FROM aluno_doencas_contagiosas WHERE aluno_id = ?').run(alunoId);

  const inserirProblema = db.prepare(
    'INSERT INTO aluno_problemas_saude (aluno_id, problema_id) VALUES (?, ?)'
  );
  (problemasIds || []).forEach((problemaId) => inserirProblema.run(alunoId, problemaId));

  const inserirDoenca = db.prepare(
    'INSERT INTO aluno_doencas_contagiosas (aluno_id, doenca_id) VALUES (?, ?)'
  );
  (doencasIds || []).forEach((doencaId) => inserirDoenca.run(alunoId, doencaId));
}

function criar(dados) {
  const colunas = camposFicha.join(', ');
  const marcadores = camposFicha.map(() => '?').join(', ');
  const valores = camposFicha.map((campo) => dados[campo] ?? null);

  const resultado = db
    .prepare(`INSERT INTO alunos (${colunas}) VALUES (${marcadores})`)
    .run(...valores);

  salvarVinculosSaude(resultado.lastInsertRowid, dados.problemas_saude_ids, dados.doencas_contagiosas_ids);
  responsaveisModel.salvarResponsaveisDoAluno(resultado.lastInsertRowid, dados.responsaveis);
  matriculasModel.salvarModalidadesDoAluno(resultado.lastInsertRowid, dados.data_nascimento, dados.modalidade_ids);
  return resultado.lastInsertRowid;
}

function atualizar(id, dados) {
  const atribuicoes = camposFicha.map((campo) => `${campo} = ?`).join(', ');
  const valores = camposFicha.map((campo) => dados[campo] ?? null);

  db.prepare(`UPDATE alunos SET ${atribuicoes}, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...valores, id);

  salvarVinculosSaude(id, dados.problemas_saude_ids, dados.doencas_contagiosas_ids);
  responsaveisModel.salvarResponsaveisDoAluno(id, dados.responsaveis);
  matriculasModel.salvarModalidadesDoAluno(id, dados.data_nascimento, dados.modalidade_ids);
}

function alterarStatus(id, status, dataEntradaListaEspera) {
  if (!STATUS_VALIDOS.includes(status)) {
    throw new ErroApp('Status inválido.');
  }

  // Data de entrada na lista de espera só faz sentido nesse status;
  // ao sair da lista de espera o campo é limpo.
  const dataListaEspera = status === 'lista_espera'
    ? (dataEntradaListaEspera || new Date().toISOString().slice(0, 10))
    : null;

  db.prepare(
    'UPDATE alunos SET status = ?, data_entrada_lista_espera = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, dataListaEspera, id);
}

function salvarFoto(id, fotoPath) {
  db.prepare('UPDATE alunos SET foto_path = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?').run(fotoPath, id);
}

function listarProblemasSaude() {
  return db.prepare('SELECT * FROM problemas_saude ORDER BY id').all();
}

function listarDoencasContagiosas() {
  return db.prepare('SELECT * FROM doencas_contagiosas ORDER BY id').all();
}

module.exports = {
  listar, buscarPorId, existe, criar, atualizar, alterarStatus, salvarFoto,
  listarProblemasSaude, listarDoencasContagiosas, STATUS_VALIDOS
};
