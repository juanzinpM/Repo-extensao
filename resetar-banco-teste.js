// resetar-banco-teste.js
// Apaga todos os dados de TESTE e recria o banco do zero (tabelas + catálogos).
//
// Uso: node resetar-banco-teste.js
//
// Por segurança, só funciona se config.js estiver com AMBIENTE = 'teste' —
// nunca apaga o banco de produção.

const fs = require('fs');
const { AMBIENTE, ARQUIVO_BANCO } = require('./config');

if (AMBIENTE !== 'teste') {
  console.log('O ambiente atual em config.js é "producao".');
  console.log('Por segurança, este script só roda com AMBIENTE = "teste". Nada foi apagado.');
  process.exit(1);
}

if (fs.existsSync(ARQUIVO_BANCO)) {
  fs.unlinkSync(ARQUIVO_BANCO);
  console.log(`Banco de teste "${ARQUIVO_BANCO}" apagado.`);
} else {
  console.log('Não havia banco de teste ainda — tudo certo.');
}

// Recria o banco do zero (tabelas + catálogos fixos)
require('./db');
console.log('Banco de teste recriado do zero. Pronto para novos cenários.');
