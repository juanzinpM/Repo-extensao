// models/colaboradoresModel.js
// Cadastro de colaboradores: dados principais, modalidades em que atuam,
// dias/horários de disponibilidade, foto 3x4 e documentos anexados.
const fs = require('fs');
const path = require('path');
const db = require('../db');
const ErroApp = require('../utils/ErroApp');
const { PASTA_UPLOADS } = require('../config');

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Separado(a)', 'Divorciado(a)', 'Viúvo(a)'];
const STATUS_VALIDOS = ['ativo', 'inativo'];
const TIPOS = { voluntario: 'Voluntário', professor: 'Professor', estagiario: 'Estagiário' };

// Tipo (chave guardada no banco) -> nome mostrado na tela e nas mensagens.
const TIPOS_DOCUMENTO = {
  cpf_rg: 'CPF/RG',
  comprovante_endereco: 'Comprovante de endereço',
  diploma_certificado: 'Diploma/certificado',
  antecedentes: 'Atestado de antecedentes criminais',
  atestado_saude: 'Atestado de saúde',
  termo_imagem: 'Termo de imagem',
  regras_convivencia: 'Regras de convivência'
};

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Obrigatórios: [campo, rótulo]. Formação, PIX e igreja são opcionais.
const OBRIGATORIOS = [
  ['tipo', 'Tipo'], ['nome', 'Nome completo'], ['data_nascimento', 'Data de nascimento'], ['estado_civil', 'Estado civil'],
  ['cpf', 'CPF'], ['telefone', 'Telefone/WhatsApp'], ['endereco', 'Endereço'],
  ['bairro', 'Bairro'], ['cep', 'CEP'], ['email', 'E-mail']
];
const OPCIONAIS = ['formacao', 'chave_pix', 'igreja'];

const LIMITE_TEXTO = 200;

function texto(valor) {
  return String(valor ?? '').trim();
}

function soDigitos(valor) {
  return texto(valor).replace(/\D/g, '');
}

function dataValida(valor) {
  if (!REGEX_DATA.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

function validarEMontar(corpo, idAtual) {
  const dados = {};
  const faltando = [];
  OBRIGATORIOS.forEach(([campo, rotulo]) => {
    dados[campo] = texto(corpo[campo]);
    if (!dados[campo]) faltando.push(rotulo);
  });
  if (faltando.length > 0) {
    throw new ErroApp(`Preencha os campos obrigatórios: ${faltando.join(', ')}.`);
  }
  OPCIONAIS.forEach((campo) => { dados[campo] = texto(corpo[campo]) || null; });

  [...OBRIGATORIOS.map(([c]) => c), ...OPCIONAIS].forEach((campo) => {
    if (dados[campo] && dados[campo].length > LIMITE_TEXTO) {
      throw new ErroApp(`O campo "${campo.replace(/_/g, ' ')}" aceita no máximo ${LIMITE_TEXTO} caracteres.`);
    }
  });

  if (!Object.prototype.hasOwnProperty.call(TIPOS, dados.tipo)) throw new ErroApp('Tipo inválido.');
  const status = texto(corpo.status) || 'ativo';
  if (!STATUS_VALIDOS.includes(status)) throw new ErroApp('Status inválido.');
  dados.status = status;
  if (!dataValida(dados.data_nascimento)) throw new ErroApp('Data de nascimento inválida.');
  if (dados.data_nascimento > new Date().toISOString().slice(0, 10)) {
    throw new ErroApp('A data de nascimento não pode ser no futuro.');
  }
  if (!ESTADOS_CIVIS.includes(dados.estado_civil)) throw new ErroApp('Estado civil inválido.');
  if (soDigitos(dados.cpf).length !== 11) throw new ErroApp('CPF incompleto: informe os 11 dígitos.');
  const digitosTelefone = soDigitos(dados.telefone).length;
  if (digitosTelefone !== 10 && digitosTelefone !== 11) {
    throw new ErroApp('Telefone/WhatsApp incompleto: informe DDD e número.');
  }
  if (soDigitos(dados.cep).length !== 8) throw new ErroApp('CEP incompleto: informe os 8 dígitos.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) throw new ErroApp('E-mail inválido.');

  const duplicado = db.prepare(
    "SELECT id FROM colaboradores WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ? AND id IS NOT ?"
  ).get(soDigitos(dados.cpf), idAtual ?? null);
  if (duplicado) throw new ErroApp('Já existe um colaborador cadastrado com este CPF.');

  const modalidades = Array.isArray(corpo.modalidade_ids) ? corpo.modalidade_ids.map(Number) : [];
  if (modalidades.some((id) => !Number.isInteger(id) || id <= 0)) throw new ErroApp('Modalidade inválida.');
  const existentes = modalidades.length
    ? db.prepare(`SELECT COUNT(*) AS n FROM modalidades WHERE id IN (${modalidades.map(() => '?').join(',')})`).get(...modalidades).n
    : 0;
  if (existentes !== new Set(modalidades).size) throw new ErroApp('Modalidade não encontrada.');

  const disponibilidades = (Array.isArray(corpo.disponibilidades) ? corpo.disponibilidades : []).map((d) => {
    const dia = Number(d.dia_semana);
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) throw new ErroApp('Dia da semana inválido na disponibilidade.');
    if (!REGEX_HORA.test(texto(d.hora_inicio)) || !REGEX_HORA.test(texto(d.hora_fim))) {
      throw new ErroApp('Informe horário de início e de término em cada disponibilidade.');
    }
    if (texto(d.hora_fim) <= texto(d.hora_inicio)) {
      throw new ErroApp('Na disponibilidade, o término precisa ser depois do início.');
    }
    return { dia_semana: dia, hora_inicio: texto(d.hora_inicio), hora_fim: texto(d.hora_fim) };
  });

  return { dados, modalidades: [...new Set(modalidades)], disponibilidades };
}

function gravarRelacionados(id, modalidades, disponibilidades) {
  db.prepare('DELETE FROM colaborador_modalidades WHERE colaborador_id = ?').run(id);
  db.prepare('DELETE FROM colaborador_disponibilidades WHERE colaborador_id = ?').run(id);
  const inserirMod = db.prepare('INSERT INTO colaborador_modalidades (colaborador_id, modalidade_id) VALUES (?, ?)');
  modalidades.forEach((m) => inserirMod.run(id, m));
  const inserirDisp = db.prepare(
    'INSERT INTO colaborador_disponibilidades (colaborador_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)'
  );
  disponibilidades.forEach((d) => inserirDisp.run(id, d.dia_semana, d.hora_inicio, d.hora_fim));
}

const COLUNAS = [...OBRIGATORIOS.map(([c]) => c), ...OPCIONAIS, 'status'];

function criar(corpo) {
  const { dados, modalidades, disponibilidades } = validarEMontar(corpo, null);
  return db.transaction(() => {
    const resultado = db.prepare(
      `INSERT INTO colaboradores (${COLUNAS.join(', ')}) VALUES (${COLUNAS.map(() => '?').join(', ')})`
    ).run(...COLUNAS.map((c) => dados[c]));
    const id = resultado.lastInsertRowid;
    gravarRelacionados(id, modalidades, disponibilidades);
    return id;
  })();
}

function atualizar(id, corpo) {
  const { dados, modalidades, disponibilidades } = validarEMontar(corpo, Number(id));
  db.transaction(() => {
    db.prepare(
      `UPDATE colaboradores SET ${COLUNAS.map((c) => `${c} = ?`).join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(...COLUNAS.map((c) => dados[c]), id);
    gravarRelacionados(id, modalidades, disponibilidades);
  })();
}

function existe(id) {
  return !!db.prepare('SELECT 1 FROM colaboradores WHERE id = ?').get(id);
}

function listar(busca, status, modalidadeId, tipo) {
  const condicoes = [];
  const parametros = [];
  if (busca && String(busca).trim()) {
    const termo = `%${String(busca).trim()}%`;
    const digitos = soDigitos(busca);
    condicoes.push(
      "(v.nome LIKE ? OR v.email LIKE ?" +
      (digitos ? " OR REPLACE(REPLACE(v.cpf, '.', ''), '-', '') LIKE ?" : '') + ')'
    );
    parametros.push(termo, termo);
    if (digitos) parametros.push(`%${digitos}%`);
  }
  if (status) {
    condicoes.push('v.status = ?');
    parametros.push(status);
  }
  if (tipo) {
    condicoes.push('v.tipo = ?');
    parametros.push(tipo);
  }
  if (modalidadeId) {
    condicoes.push('EXISTS (SELECT 1 FROM colaborador_modalidades vm WHERE vm.colaborador_id = v.id AND vm.modalidade_id = ?)');
    parametros.push(modalidadeId);
  }
  const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  return db.prepare(`
    SELECT v.id, v.nome, v.tipo, v.telefone, v.status,
      (SELECT GROUP_CONCAT(m.nome, ', ') FROM colaborador_modalidades vm
         JOIN modalidades m ON m.id = vm.modalidade_id WHERE vm.colaborador_id = v.id) AS modalidades
    FROM colaboradores v ${onde} ORDER BY v.nome COLLATE NOCASE
  `).all(...parametros);
}

function buscarPorId(id) {
  const colaborador = db.prepare('SELECT * FROM colaboradores WHERE id = ?').get(id);
  if (!colaborador) return null;
  colaborador.modalidade_ids = db.prepare(
    'SELECT modalidade_id FROM colaborador_modalidades WHERE colaborador_id = ?'
  ).all(id).map((l) => l.modalidade_id);
  colaborador.disponibilidades = db.prepare(
    'SELECT dia_semana, hora_inicio, hora_fim FROM colaborador_disponibilidades WHERE colaborador_id = ? ORDER BY dia_semana, hora_inicio'
  ).all(id);
  colaborador.documentos = db.prepare(
    'SELECT id, tipo, arquivo_path, data_upload FROM colaborador_documentos WHERE colaborador_id = ?'
  ).all(id);
  return colaborador;
}

function alterarStatus(id, status) {
  if (!STATUS_VALIDOS.includes(status)) throw new ErroApp('Status inválido.');
  db.prepare('UPDATE colaboradores SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
}

// ---------- Arquivos ----------

function apagarArquivo(caminhoRelativo) {
  if (!caminhoRelativo) return;
  fs.unlink(path.join(__dirname, '..', PASTA_UPLOADS, caminhoRelativo), () => {});
}

function salvarFoto(id, fotoPath) {
  const anterior = db.prepare('SELECT foto_path FROM colaboradores WHERE id = ?').get(id);
  db.prepare('UPDATE colaboradores SET foto_path = ? WHERE id = ?').run(fotoPath, id);
  if (anterior && anterior.foto_path && anterior.foto_path !== fotoPath) apagarArquivo(anterior.foto_path);
}

function removerFoto(id) {
  const anterior = db.prepare('SELECT foto_path FROM colaboradores WHERE id = ?').get(id);
  db.prepare('UPDATE colaboradores SET foto_path = NULL WHERE id = ?').run(id);
  if (anterior) apagarArquivo(anterior.foto_path);
}

function tipoDocumentoValido(tipo) {
  return Object.prototype.hasOwnProperty.call(TIPOS_DOCUMENTO, tipo);
}

// Enviar de novo o mesmo tipo substitui o documento anterior.
function salvarDocumento(id, tipo, arquivoPath) {
  const anterior = db.prepare('SELECT arquivo_path FROM colaborador_documentos WHERE colaborador_id = ? AND tipo = ?').get(id, tipo);
  db.prepare(`
    INSERT INTO colaborador_documentos (colaborador_id, tipo, arquivo_path) VALUES (?, ?, ?)
    ON CONFLICT (colaborador_id, tipo) DO UPDATE SET arquivo_path = excluded.arquivo_path, data_upload = CURRENT_TIMESTAMP
  `).run(id, tipo, arquivoPath);
  if (anterior && anterior.arquivo_path !== arquivoPath) apagarArquivo(anterior.arquivo_path);
}

function removerDocumento(id, tipo) {
  const anterior = db.prepare('SELECT arquivo_path FROM colaborador_documentos WHERE colaborador_id = ? AND tipo = ?').get(id, tipo);
  if (!anterior) throw new ErroApp('Documento não encontrado.', 404);
  db.prepare('DELETE FROM colaborador_documentos WHERE colaborador_id = ? AND tipo = ?').run(id, tipo);
  apagarArquivo(anterior.arquivo_path);
}

module.exports = {
  ESTADOS_CIVIS, TIPOS, TIPOS_DOCUMENTO, existe, listar, buscarPorId, criar, atualizar, alterarStatus,
  salvarFoto, removerFoto, tipoDocumentoValido, salvarDocumento, removerDocumento
};
