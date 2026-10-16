// routes/alunos.js
const express = require('express');
const fs = require('fs');
const router = express.Router();
const alunosModel = require('../models/alunosModel');
const documentosModel = require('../models/documentosModel');
const termoImagemModel = require('../models/termoImagemModel');
const matriculasModel = require('../models/matriculasModel');
const exportacaoModel = require('../models/exportacaoModel');
const { uploadFoto, uploadDocumento, uploadTermoImagem } = require('../middlewares/upload');
const { enviarComoExcel } = require('../utils/excel');
const ErroApp = require('../utils/ErroApp');

// Precisa rodar ANTES do multer nas rotas de upload: se checássemos depois,
// o arquivo já teria sido gravado em disco pra um aluno inexistente, e
// sobraria órfão lá (o multer processa o upload antes do handler da rota
// executar, então o roteador precisa barrar no middleware, não dentro dela).
// Responsável legal é obrigatório só para menores de 18 anos. Sem data de
// nascimento não dá para saber a idade, então nesse caso continua obrigatório.
function exigirResponsavelSeMenor(corpo) {
  const idade = matriculasModel.calcularIdade(corpo.data_nascimento);
  const maiorDeIdade = idade !== null && idade >= 18;
  const semResponsavel = !Array.isArray(corpo.responsaveis) || corpo.responsaveis.length === 0;
  if (!maiorDeIdade && semResponsavel) {
    throw new ErroApp('É obrigatório informar ao menos um responsável legal.');
  }
}

function exigirAlunoExistente(req, res, next) {
  if (!alunosModel.existe(req.params.id)) {
    throw new ErroApp('Aluno não encontrado.', 404);
  }
  next();
}

router.get('/', (req, res) => {
  res.json(alunosModel.listar(req.query.busca, req.query.status, req.query.modalidade));
});

// Precisa vir ANTES de "GET /:id" — senão o Express trata
// "pendentes-rematricula" como se fosse um :id.
router.get('/pendentes-rematricula', (req, res) => {
  res.json(matriculasModel.listarPendentesRematricula());
});

// Colunas da ficha completa exportada — mesma ordem em que os dados aparecem
// no cadastro (dados principais, status/modalidade, depois ficha de saúde).
const COLUNAS_EXPORTACAO = [
  { rotulo: 'Nome', chave: 'nome', largura: 28 },
  { rotulo: 'CPF', chave: 'cpf', largura: 16 },
  { rotulo: 'RG', chave: 'rg', largura: 14 },
  { rotulo: 'Data de nascimento', chave: 'data_nascimento', largura: 16 },
  { rotulo: 'Idade', chave: 'idade', largura: 8 },
  { rotulo: 'Nome do pai', chave: 'nome_pai', largura: 26 },
  { rotulo: 'Nome da mãe', chave: 'nome_mae', largura: 26 },
  { rotulo: 'Endereço', chave: 'endereco', largura: 30 },
  { rotulo: 'Bairro', chave: 'bairro', largura: 18 },
  { rotulo: 'Complemento', chave: 'complemento', largura: 18 },
  { rotulo: 'Telefone fixo', chave: 'telefone_fixo', largura: 16 },
  { rotulo: 'Celular', chave: 'celular', largura: 16 },
  { rotulo: 'E-mail', chave: 'email', largura: 26 },
  { rotulo: 'Escola', chave: 'escola', largura: 24 },
  { rotulo: 'Série', chave: 'serie_escola', largura: 12 },
  { rotulo: 'Período escolar', chave: 'periodo_escola', largura: 16 },
  { rotulo: 'Possui convênio', chave: 'possui_convenio', largura: 14 },
  { rotulo: 'Qual convênio', chave: 'convenio_qual', largura: 20 },
  { rotulo: 'Status', chave: 'status', largura: 14 },
  { rotulo: 'Entrada na lista de espera', chave: 'data_entrada_lista_espera', largura: 20 },
  { rotulo: 'Modalidades (ano vigente)', chave: 'modalidades', largura: 26 },
  { rotulo: 'Responsáveis', chave: 'responsaveis', largura: 40 },
  { rotulo: 'Possui deficiência', chave: 'possui_deficiencia', largura: 16 },
  { rotulo: 'Qual deficiência', chave: 'deficiencia_qual', largura: 20 },
  { rotulo: 'Problemas de saúde', chave: 'problemas_saude', largura: 26 },
  { rotulo: 'Outros problemas de saúde', chave: 'outros_problemas_saude', largura: 26 },
  { rotulo: 'Doenças contagiosas (já teve)', chave: 'doencas_contagiosas', largura: 26 },
  { rotulo: 'Outras doenças contagiosas', chave: 'outras_doencas_contagiosas', largura: 26 },
  { rotulo: 'Fumante', chave: 'fumante', largura: 10 },
  { rotulo: 'Usa remédio contínuo', chave: 'usa_remedio_continuo', largura: 18 },
  { rotulo: 'Qual remédio contínuo', chave: 'remedio_continuo_qual', largura: 22 },
  { rotulo: 'Já fez cirurgia', chave: 'ja_fez_cirurgia', largura: 14 },
  { rotulo: 'Qual cirurgia', chave: 'cirurgia_qual', largura: 22 },
  { rotulo: 'Possui dores/lesões', chave: 'possui_dores_lesoes', largura: 16 },
  { rotulo: 'Quais dores/lesões', chave: 'dores_lesoes_qual', largura: 22 },
  { rotulo: 'Alérgico', chave: 'alergico', largura: 10 },
  { rotulo: 'A que é alérgico', chave: 'alergico_a_que', largura: 22 },
  { rotulo: 'Usa medicamento controlado', chave: 'usa_medicamento_controlado', largura: 20 },
  { rotulo: 'Qual medicamento controlado', chave: 'medicamento_controlado_qual', largura: 24 },
  { rotulo: 'Alérgico a medicamento', chave: 'alergico_a_medicamento', largura: 18 },
  { rotulo: 'A qual medicamento é alérgico', chave: 'alergico_medicamento_qual', largura: 24 },
  { rotulo: 'Solicitar atestado de saúde', chave: 'solicitar_atestado_saude', largura: 20 },
  { rotulo: 'Motivo do atestado', chave: 'atestado_motivo', largura: 22 },
  { rotulo: 'Observações', chave: 'observacoes', largura: 30 }
];

// Precisa vir ANTES de "GET /:id" pelo mesmo motivo de "pendentes-rematricula"
// acima — senão o Express trata "exportar" como se fosse um :id.
// Aceita os mesmos filtros de GET /api/alunos (busca/status/modalidade) —
// exporta exatamente o que está filtrado na tela no momento.
router.get('/exportar', async (req, res) => {
  const linhas = exportacaoModel.listarParaExportacao(
    req.query.busca,
    req.query.status,
    req.query.modalidade
  );

  const dataDeHoje = new Date().toISOString().slice(0, 10);
  await enviarComoExcel(res, {
    nomeArquivo: `alunos-${dataDeHoje}.xlsx`,
    nomeAba: 'Alunos',
    colunas: COLUNAS_EXPORTACAO,
    linhas
  });
});

router.get('/:id', (req, res) => {
  const aluno = alunosModel.buscarPorId(req.params.id);
  if (!aluno) {
    throw new ErroApp('Aluno não encontrado.', 404);
  }
  res.json(aluno);
});

router.post('/', (req, res) => {
  if (!req.body.nome || !req.body.nome.trim()) {
    throw new ErroApp('O nome do aluno é obrigatório.');
  }
  exigirResponsavelSeMenor(req.body);
  const id = alunosModel.criar(req.body);
  res.json({ id });
});

router.put('/:id', (req, res) => {
  if (!req.body.nome || !req.body.nome.trim()) {
    throw new ErroApp('O nome do aluno é obrigatório.');
  }
  exigirResponsavelSeMenor(req.body);
  if (!alunosModel.existe(req.params.id)) {
    throw new ErroApp('Aluno não encontrado.', 404);
  }
  alunosModel.atualizar(req.params.id, req.body);
  res.json({ ok: true });
});

router.patch('/:id/status', (req, res) => {
  if (!alunosModel.existe(req.params.id)) {
    throw new ErroApp('Aluno não encontrado.', 404);
  }
  alunosModel.alterarStatus(req.params.id, req.body.status, req.body.data_entrada_lista_espera);
  res.json({ ok: true });
});

router.get('/:id/situacao-matricula', exigirAlunoExistente, (req, res) => {
  res.json(matriculasModel.situacaoMatricula(req.params.id));
});

// ---------- Foto do aluno ----------

router.post('/:id/foto', exigirAlunoExistente, uploadFoto, (req, res) => {
  if (!req.file) {
    throw new ErroApp('Nenhuma foto enviada.');
  }
  const fotoPath = `fotos/${req.file.filename}`;
  alunosModel.salvarFoto(req.params.id, fotoPath);
  res.json({ foto_path: fotoPath });
});

router.delete('/:id/foto', exigirAlunoExistente, (req, res) => {
  alunosModel.removerFoto(req.params.id);
  res.json({ ok: true });
});

// ---------- Documentos anexados ----------

router.get('/:id/documentos', exigirAlunoExistente, (req, res) => {
  res.json(documentosModel.listarPorAluno(req.params.id));
});

router.post('/:id/documentos', exigirAlunoExistente, uploadDocumento, (req, res) => {
  if (!req.body.tipo || !req.body.tipo.trim()) {
    // O multer já processou e salvou o arquivo em disco nesse ponto (ele
    // roda antes do handler) — como a validação falhou, apaga o órfão.
    if (req.file) fs.unlink(req.file.path, () => {});
    throw new ErroApp('Informe o tipo do documento.');
  }
  if (!req.file) {
    throw new ErroApp('Nenhum arquivo enviado.');
  }
  const id = documentosModel.criar(req.params.id, req.body.tipo, `documentos/${req.file.filename}`);
  res.json({ id });
});

router.delete('/:id/documentos/:documentoId', (req, res) => {
  const documento = documentosModel.buscarPorId(req.params.documentoId);
  if (!documento || String(documento.aluno_id) !== String(req.params.id)) {
    throw new ErroApp('Documento não encontrado.', 404);
  }
  documentosModel.remover(documento);
  res.json({ ok: true });
});

// ---------- Termo de uso de imagem ----------

router.get('/:id/termo-imagem', exigirAlunoExistente, (req, res) => {
  res.json(termoImagemModel.buscarDoAlunoNoAnoAtual(req.params.id) || {});
});

router.post('/:id/termo-imagem/aceite', exigirAlunoExistente, (req, res) => {
  termoImagemModel.registrarAceiteDigital(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/termo-imagem/arquivo', exigirAlunoExistente, uploadTermoImagem, (req, res) => {
  if (!req.file) {
    throw new ErroApp('Nenhum arquivo enviado.');
  }
  termoImagemModel.registrarArquivo(req.params.id, `termos-imagem/${req.file.filename}`);
  res.json({ ok: true });
});

module.exports = router;
