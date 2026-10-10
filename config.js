// config.js
// Controla se o sistema está rodando em modo TESTE ou PRODUÇÃO.
//
// Em "teste", os dados ficam em um arquivo separado (dados-teste.db),
// então nunca se misturam com dados reais de alunos.
//
// Quando a instituição for começar a usar de verdade, troque para
// 'producao' — o sistema vai criar um "dados.db" novo e limpo.

const AMBIENTE = 'teste'; // troque para 'producao' quando for entregar

const ARQUIVO_BANCO = AMBIENTE === 'producao' ? 'dados.db' : 'dados-teste.db';

// Pasta onde ficam foto, documentos e termo de imagem enviados.
// Separada por ambiente pelo mesmo motivo do banco: nunca misturar
// arquivo de teste com arquivo real de aluno.
const PASTA_UPLOADS = AMBIENTE === 'producao' ? 'uploads' : 'uploads-teste';

module.exports = { AMBIENTE, ARQUIVO_BANCO, PASTA_UPLOADS };
