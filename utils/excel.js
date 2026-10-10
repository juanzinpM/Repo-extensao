// utils/excel.js
// Monta e envia uma planilha .xlsx como download, a partir de uma lista de
// colunas (rótulo + chave + largura) e linhas (objetos simples, uma chave
// por coluna). Genérico de propósito — qualquer exportação futura do
// sistema (não só alunos) pode reaproveitar essa mesma função.
const ExcelJS = require('exceljs');

const COR_CABECALHO = 'FFDB5A61'; // coral da marca, em ARGB

async function enviarComoExcel(res, { nomeArquivo, nomeAba, colunas, linhas }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema Instituto Missão Art';
  workbook.created = new Date();

  const planilha = workbook.addWorksheet(nomeAba || 'Dados');
  planilha.columns = colunas.map((coluna) => ({
    header: coluna.rotulo,
    key: coluna.chave,
    width: coluna.largura || 20
  }));

  linhas.forEach((linha) => planilha.addRow(linha));

  const linhaCabecalho = planilha.getRow(1);
  linhaCabecalho.eachCell((celula) => {
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_CABECALHO } };
  });
  // Cabeçalho sempre visível ao rolar a planilha para baixo.
  planilha.views = [{ state: 'frozen', ySplit: 1 }];

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { enviarComoExcel };
