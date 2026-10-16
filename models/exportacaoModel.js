// models/exportacaoModel.js
// Monta a ficha completa de cada aluno para exportação (Excel), reaproveitando
// os mesmos filtros da listagem (alunosModel.listar) e os mesmos dados que já
// compõem a ficha de um aluno (alunosModel.buscarPorId) — nenhum SQL novo
// aqui, só tradução de ids de catálogo (modalidade, problema de saúde,
// doença contagiosa) para nomes legíveis em planilha.
const alunosModel = require('./alunosModel');
const modalidadesModel = require('./modalidadesModel');
const matriculasModel = require('./matriculasModel');

const ROTULO_STATUS = { ativo: 'Ativo', inativo: 'Inativo', lista_espera: 'Lista de espera' };

function simNao(valor) {
  return valor ? 'Sim' : 'Não';
}

// Traduz uma lista de ids de catálogo (ex: modalidade_ids) para os nomes
// correspondentes, juntando tudo numa única célula de planilha.
function nomesPorIds(catalogo, ids) {
  const idsSet = new Set((ids || []).map(String));
  return catalogo
    .filter((item) => idsSet.has(String(item.id)))
    .map((item) => item.nome)
    .join(', ');
}

function textoResponsaveis(responsaveis) {
  return (responsaveis || [])
    .map((resp) => {
      const partes = [resp.nome];
      if (resp.parentesco) partes.push(`(${resp.parentesco})`);
      if (resp.telefone) partes.push(`- ${resp.telefone}`);
      if (resp.principal) partes.push('[Principal]');
      return partes.join(' ');
    })
    .join(' | ');
}

function montarFichaCompleta(alunoId, catalogos) {
  const aluno = alunosModel.buscarPorId(alunoId);

  return {
    nome: aluno.nome,
    cpf: aluno.cpf,
    rg: aluno.rg,
    data_nascimento: aluno.data_nascimento,
    idade: matriculasModel.calcularIdade(aluno.data_nascimento),
    nome_pai: aluno.nome_pai,
    nome_mae: aluno.nome_mae,
    endereco: aluno.endereco,
    bairro: aluno.bairro,
    complemento: aluno.complemento,
    telefone_fixo: aluno.telefone_fixo,
    celular: aluno.celular,
    email: aluno.email,
    escola: aluno.escola,
    serie_escola: aluno.serie_escola,
    periodo_escola: aluno.periodo_escola,
    possui_convenio: simNao(aluno.possui_convenio),
    convenio_qual: aluno.convenio_qual,
    status: ROTULO_STATUS[aluno.status] || aluno.status,
    data_entrada_lista_espera: aluno.data_entrada_lista_espera,
    modalidades: nomesPorIds(catalogos.modalidades, aluno.modalidade_ids),
    responsaveis: textoResponsaveis(aluno.responsaveis),
    possui_deficiencia: simNao(aluno.possui_deficiencia),
    deficiencia_qual: aluno.deficiencia_qual,
    problemas_saude: nomesPorIds(catalogos.problemasSaude, aluno.problemas_saude_ids),
    outros_problemas_saude: aluno.outros_problemas_saude,
    doencas_contagiosas: nomesPorIds(catalogos.doencasContagiosas, aluno.doencas_contagiosas_ids),
    outras_doencas_contagiosas: aluno.outras_doencas_contagiosas,
    fumante: simNao(aluno.fumante),
    usa_remedio_continuo: simNao(aluno.usa_remedio_continuo),
    remedio_continuo_qual: aluno.remedio_continuo_qual,
    ja_fez_cirurgia: simNao(aluno.ja_fez_cirurgia),
    cirurgia_qual: aluno.cirurgia_qual,
    possui_dores_lesoes: simNao(aluno.possui_dores_lesoes),
    dores_lesoes_qual: aluno.dores_lesoes_qual,
    alergico: simNao(aluno.alergico),
    alergico_a_que: aluno.alergico_a_que,
    usa_medicamento_controlado: simNao(aluno.usa_medicamento_controlado),
    medicamento_controlado_qual: aluno.medicamento_controlado_qual,
    alergico_a_medicamento: simNao(aluno.alergico_a_medicamento),
    alergico_medicamento_qual: aluno.alergico_medicamento_qual,
    solicitar_atestado_saude: simNao(aluno.solicitar_atestado_saude),
    atestado_motivo: aluno.atestado_motivo,
    observacoes: aluno.observacoes
  };
}

// Aplica os MESMOS filtros da listagem (busca/status/modalidade) e depois
// monta a ficha completa de cada aluno encontrado — o Excel exportado traz
// exatamente quem a secretária está vendo filtrado na tela.
function listarParaExportacao(busca, status, modalidadeId) {
  const resumos = alunosModel.listar(busca, status, modalidadeId);

  // Catálogos buscados uma única vez fora do laço — evita reconsultar o
  // banco a cada aluno só pra traduzir ids em nomes.
  const catalogos = {
    problemasSaude: alunosModel.listarProblemasSaude(),
    doencasContagiosas: alunosModel.listarDoencasContagiosas(),
    modalidades: modalidadesModel.listar()
  };

  return resumos.map((resumo) => montarFichaCompleta(resumo.id, catalogos));
}

module.exports = { listarParaExportacao };
