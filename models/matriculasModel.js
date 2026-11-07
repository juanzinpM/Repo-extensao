// models/matriculasModel.js
const db = require('../db');
const ErroApp = require('../utils/ErroApp');
const modalidadesModel = require('./modalidadesModel');

// Data "de hoje" usada nas regras de ano letivo. Só os testes substituem
// (variável de ambiente DATA_SIMULADA, formato AAAA-MM-DD).
function hoje() {
  if (process.env.DATA_SIMULADA) return new Date(`${process.env.DATA_SIMULADA}T12:00:00`);
  return new Date();
}

function obterOuCriarAnoLetivo(ano) {
  let linha = db.prepare('SELECT * FROM anos_letivos WHERE ano = ?').get(ano);
  if (!linha) {
    db.prepare('INSERT INTO anos_letivos (ano, ativo) VALUES (?, 1)').run(ano);
    linha = db.prepare('SELECT * FROM anos_letivos WHERE ano = ?').get(ano);
  }
  return linha;
}

function anoLetivoAtual() {
  const ano = hoje().getFullYear();
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
  const agora = hoje();
  let idade = agora.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAniversario =
    agora.getMonth() < nascimento.getMonth() ||
    (agora.getMonth() === nascimento.getMonth() && agora.getDate() < nascimento.getDate());
  if (aindaNaoFezAniversario) idade -= 1;
  return idade;
}

// RF06: Boxe aceita adultos; as demais modalidades são só infantis (por ora).
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
    WHERE a.status = 'ativo'
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

// ---------- Rematrícula (ano alvo, em lote, antecipada) ----------
// A partir de 1º de outubro dá para rematricular para o ano seguinte, antes
// da virada. Nesse período o "ano alvo" é o ano que vem; fora dele, é o ano
// vigente (e quem não tem modalidade nele está pendente).
const MES_INICIO_REMATRICULA_ANTECIPADA = 9; // outubro (janeiro = 0)

function infoRematricula() {
  const agora = hoje();
  const anoAtual = agora.getFullYear();
  const antecipada = agora.getMonth() >= MES_INICIO_REMATRICULA_ANTECIPADA;
  return { ano_atual: anoAtual, ano_alvo: antecipada ? anoAtual + 1 : anoAtual, antecipada };
}

const TIPO_TERMO_REMATRICULA = 'Termo de rematrícula';

function modalidadesDaMatricula(matriculaId) {
  return db.prepare('SELECT modalidade_id FROM matricula_modalidades WHERE matricula_id = ?')
    .all(matriculaId).map((l) => l.modalidade_id);
}

// Matrícula "de verdade" (com ao menos uma modalidade) de um aluno num ano.
function matriculaComModalidades(alunoId, ano) {
  return db.prepare(`
    SELECT m.id FROM matriculas m
    JOIN anos_letivos al ON al.id = m.ano_letivo_id
    JOIN matricula_modalidades mm ON mm.matricula_id = m.id
    WHERE m.aluno_id = ? AND al.ano = ?
    GROUP BY m.id
  `).get(alunoId, ano);
}

function matriculaOrigem(alunoId, anoAlvo) {
  return db.prepare(`
    SELECT m.id, al.ano FROM matriculas m
    JOIN anos_letivos al ON al.id = m.ano_letivo_id
    JOIN matricula_modalidades mm ON mm.matricula_id = m.id
    WHERE m.aluno_id = ? AND al.ano < ?
    GROUP BY m.id ORDER BY al.ano DESC LIMIT 1
  `).get(alunoId, anoAlvo);
}

function montarLinhaRematricula(aluno, anoAlvo) {
  const alvo = matriculaComModalidades(aluno.id, anoAlvo);
  const origem = matriculaOrigem(aluno.id, anoAlvo);
  const termo = db.prepare('SELECT 1 FROM documentos WHERE aluno_id = ? AND tipo = ? LIMIT 1')
    .get(aluno.id, TIPO_TERMO_REMATRICULA);
  return {
    id: aluno.id,
    nome: aluno.nome,
    status: aluno.status,
    rematriculado: !!alvo,
    modalidades_alvo: alvo ? modalidadesDaMatricula(alvo.id) : [],
    ano_origem: origem ? origem.ano : null,
    modalidades_origem: origem ? modalidadesDaMatricula(origem.id) : [],
    termo_entregue: !!termo
  };
}

// Alunos ativos que já tiveram modalidade em algum ano anterior ao alvo
// (ou já estão rematriculados no alvo). Lista de espera e inativos ficam de fora.
function listarParaRematricula(alunoId) {
  const info = infoRematricula();
  const filtro = alunoId ? 'AND a.id = ?' : '';
  const alunos = db.prepare(`
    SELECT a.id, a.nome, a.status FROM alunos a
    WHERE a.status = 'ativo' ${filtro}
      AND EXISTS (
        SELECT 1 FROM matriculas m
        JOIN anos_letivos al ON al.id = m.ano_letivo_id
        JOIN matricula_modalidades mm ON mm.matricula_id = m.id
        WHERE m.aluno_id = a.id AND al.ano <= ?
      )
    ORDER BY a.nome COLLATE NOCASE
  `).all(...(alunoId ? [alunoId] : []), info.ano_alvo);
  return { ...info, alunos: alunos.map((a) => montarLinhaRematricula(a, info.ano_alvo)) };
}

// itens: [{ aluno_id, modalidade_ids }]. Valida tudo antes de gravar qualquer coisa.
function rematricular(itens, confirmarAntecipada) {
  const info = infoRematricula();
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new ErroApp('Selecione ao menos um aluno para rematricular.');
  }
  if (info.antecipada && confirmarAntecipada !== true) {
    throw new ErroApp(`Confirme a rematrícula antecipada: o ano letivo ${info.ano_alvo} ainda não começou.`);
  }

  const validados = itens.map((item) => {
    const aluno = db.prepare('SELECT id, nome, status, data_nascimento FROM alunos WHERE id = ?').get(item.aluno_id);
    if (!aluno) throw new ErroApp('Aluno não encontrado.', 404);
    const prefixo = `${aluno.nome}: `;
    if (aluno.status !== 'ativo') throw new ErroApp(`${prefixo}só alunos ativos podem ser rematriculados.`);
    const ids = [...new Set((item.modalidade_ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    if (ids.length === 0) throw new ErroApp(`${prefixo}escolha ao menos uma modalidade.`);
    const modalidades = modalidadesModel.buscarPorIds(ids);
    if (modalidades.length !== ids.length) throw new ErroApp(`${prefixo}modalidade não encontrada.`);
    try {
      validarModalidadesParaIdade(aluno.data_nascimento, modalidades);
    } catch (erro) {
      throw new ErroApp(prefixo + erro.message);
    }
    return { alunoId: aluno.id, ids };
  });

  const anoLetivo = obterOuCriarAnoLetivo(info.ano_alvo);
  db.transaction(() => {
    validados.forEach(({ alunoId, ids }) => {
      const matricula = obterOuCriarMatricula(alunoId, anoLetivo.id);
      db.prepare('DELETE FROM matricula_modalidades WHERE matricula_id = ?').run(matricula.id);
      const vincular = db.prepare('INSERT INTO matricula_modalidades (matricula_id, modalidade_id) VALUES (?, ?)');
      ids.forEach((id) => vincular.run(matricula.id, id));
    });
  })();
  return { ano_alvo: info.ano_alvo, total: validados.length };
}

// Só dá para desfazer enquanto o ano alvo ainda não começou.
function desfazerRematriculaAntecipada(alunoId) {
  const info = infoRematricula();
  if (!info.antecipada) {
    throw new ErroApp('Só é possível desfazer uma rematrícula antecipada, antes da virada do ano.');
  }
  const anoLetivo = db.prepare('SELECT id FROM anos_letivos WHERE ano = ?').get(info.ano_alvo);
  if (!anoLetivo) throw new ErroApp('Este aluno não tem rematrícula para desfazer.');
  const resultado = db.prepare('DELETE FROM matriculas WHERE aluno_id = ? AND ano_letivo_id = ?').run(alunoId, anoLetivo.id);
  if (resultado.changes === 0) throw new ErroApp('Este aluno não tem rematrícula para desfazer.');
}

module.exports = {
  anoLetivoAtual, salvarModalidadesDoAluno, listarModalidadesDoAluno,
  situacaoMatricula, listarPendentesRematricula, calcularIdade,
  infoRematricula, listarParaRematricula, rematricular, desfazerRematriculaAntecipada,
  TIPO_TERMO_REMATRICULA
};
