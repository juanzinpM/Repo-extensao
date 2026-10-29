// db.js
// Cria/abre o banco SQLite e garante que todas as tabelas existam.
// Rodar com: node db.js  (pode rodar várias vezes sem problema, é idempotente)

const Database = require('better-sqlite3');
const { AMBIENTE, ARQUIVO_BANCO } = require('./config');
const db = new Database(ARQUIVO_BANCO);

db.pragma('foreign_keys = ON');

db.exec(`
-- ==========================================================
-- USUÁRIOS (login do sistema)
-- ==========================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- ALUNOS (dados principais + ficha de saúde)
-- ==========================================================
CREATE TABLE IF NOT EXISTS alunos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  rg TEXT,
  cpf TEXT,
  data_nascimento TEXT,
  nome_pai TEXT,
  nome_mae TEXT,
  endereco TEXT,
  bairro TEXT,
  complemento TEXT,
  telefone_fixo TEXT,
  celular TEXT,
  email TEXT,
  escola TEXT,
  nivel_ensino TEXT,
  periodo_escola TEXT,
  possui_convenio INTEGER DEFAULT 0,
  convenio_qual TEXT,
  possui_deficiencia INTEGER DEFAULT 0,
  deficiencia_qual TEXT,
  foto_path TEXT,
  outros_problemas_saude TEXT,
  outras_doencas_contagiosas TEXT,
  fumante INTEGER DEFAULT 0,
  usa_remedio_continuo INTEGER DEFAULT 0,
  remedio_continuo_qual TEXT,
  ja_fez_cirurgia INTEGER DEFAULT 0,
  cirurgia_qual TEXT,
  possui_dores_lesoes INTEGER DEFAULT 0,
  dores_lesoes_qual TEXT,
  alergico INTEGER DEFAULT 0,
  alergico_a_que TEXT,
  usa_medicamento_controlado INTEGER DEFAULT 0,
  medicamento_controlado_qual TEXT,
  alergico_a_medicamento INTEGER DEFAULT 0,
  alergico_medicamento_qual TEXT,
  solicitar_atestado_saude INTEGER DEFAULT 0,
  atestado_motivo TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'lista_espera')),
  data_entrada_lista_espera TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- CATÁLOGOS DE SAÚDE (listas fixas da ficha) + vínculos N:N
-- ==========================================================
CREATE TABLE IF NOT EXISTS problemas_saude (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS aluno_problemas_saude (
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  problema_id INTEGER NOT NULL REFERENCES problemas_saude(id) ON DELETE CASCADE,
  PRIMARY KEY (aluno_id, problema_id)
);

CREATE TABLE IF NOT EXISTS doencas_contagiosas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS aluno_doencas_contagiosas (
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  doenca_id INTEGER NOT NULL REFERENCES doencas_contagiosas(id) ON DELETE CASCADE,
  PRIMARY KEY (aluno_id, doenca_id)
);

-- ==========================================================
-- RESPONSÁVEIS LEGAIS
-- ==========================================================
CREATE TABLE IF NOT EXISTS responsaveis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  telefone TEXT,
  email TEXT,
  parentesco TEXT
);

CREATE TABLE IF NOT EXISTS aluno_responsaveis (
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  responsavel_id INTEGER NOT NULL REFERENCES responsaveis(id) ON DELETE CASCADE,
  principal INTEGER DEFAULT 0,
  PRIMARY KEY (aluno_id, responsavel_id)
);

-- ==========================================================
-- MODALIDADES
-- ==========================================================
CREATE TABLE IF NOT EXISTS modalidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  publico TEXT NOT NULL DEFAULT 'infantil' CHECK (publico IN ('infantil', 'adulto_e_infantil'))
);

-- ==========================================================
-- ANOS LETIVOS, MATRÍCULAS E MODALIDADES POR MATRÍCULA
-- ==========================================================
CREATE TABLE IF NOT EXISTS anos_letivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ano INTEGER NOT NULL UNIQUE,
  ativo INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS matriculas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  ano_letivo_id INTEGER NOT NULL REFERENCES anos_letivos(id),
  data_matricula TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (aluno_id, ano_letivo_id)
);

CREATE TABLE IF NOT EXISTS matricula_modalidades (
  matricula_id INTEGER NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
  modalidade_id INTEGER NOT NULL REFERENCES modalidades(id) ON DELETE CASCADE,
  PRIMARY KEY (matricula_id, modalidade_id)
);

-- ==========================================================
-- DOCUMENTOS ANEXADOS (por aluno + ano letivo)
-- ==========================================================
CREATE TABLE IF NOT EXISTS documentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  ano_letivo_id INTEGER NOT NULL REFERENCES anos_letivos(id),
  tipo TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  data_upload TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- TERMO DE USO DE IMAGEM (por aluno + ano letivo)
-- ==========================================================
CREATE TABLE IF NOT EXISTS termos_imagem (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  ano_letivo_id INTEGER NOT NULL REFERENCES anos_letivos(id),
  aceite_digital INTEGER DEFAULT 0,
  data_aceite TEXT,
  arquivo_path TEXT
);
`);

// ==========================================================
// Popular catálogos fixos (só insere se ainda não existir)
// ==========================================================
const inserirSeNaoExiste = db.prepare(
  'INSERT OR IGNORE INTO problemas_saude (nome) VALUES (?)'
);
const problemasSaude = [
  'Amigdalite', 'Bronquite', 'Otite', 'Sinusite', 'Palpitação',
  'Hemorragia', 'Dispneia (falta de ar)', 'Convulsão (desmaio)',
  'Doenças cardíacas', 'Desvios posturais', 'Problemas articulares',
  'Câncer', 'Problemas circulatórios', 'Hipertensão',
  'Diabetes/pré-diabetes', 'Colesterol alto'
];
problemasSaude.forEach((nome) => inserirSeNaoExiste.run(nome));

const inserirDoenca = db.prepare(
  'INSERT OR IGNORE INTO doencas_contagiosas (nome) VALUES (?)'
);
const doencas = [
  'Sarampo', 'Coqueluche', 'Varicela', 'Catapora',
  'Escarlatina', 'Caxumba', 'Rubéola', 'Covid'
];
doencas.forEach((nome) => inserirDoenca.run(nome));

// Migração: "Box" virou "Boxe" e "Break" virou "Breaking". Em bancos já criados,
// renomeia a modalidade existente (mantendo matrículas e alunos vinculados)
// ANTES do cadastro dos nomes padrão abaixo — senão ficariam duas versões.
[['Box', 'Boxe'], ['Break', 'Breaking']].forEach(([antigo, novo]) => {
  db.prepare(`
    UPDATE modalidades SET nome = ?
    WHERE nome = ? AND NOT EXISTS (SELECT 1 FROM modalidades WHERE nome = ?)
  `).run(novo, antigo, novo);
});

const inserirModalidade = db.prepare(
  'INSERT OR IGNORE INTO modalidades (nome, publico) VALUES (?, ?)'
);
const modalidades = [
  ['Breaking', 'infantil'],
  ['Balé', 'infantil'],
  ['Música', 'infantil'],
  ['Boxe', 'adulto_e_infantil'],
  ['Futebol', 'infantil'],
  ['Inglês', 'infantil'],
  ['Reforço escolar', 'infantil']
];
modalidades.forEach(([nome, publico]) => inserirModalidade.run(nome, publico));

// ==========================================================
// CALENDÁRIO (aulas e eventos, com recorrência opcional)
// Guarda só o cadastro-base; as ocorrências de cada dia são calculadas
// na hora da consulta (ver models/calendarioModel.js).
// ==========================================================
db.exec(`
CREATE TABLE IF NOT EXISTS calendario_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK (tipo IN ('aula', 'evento')),
  titulo TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  modalidade_id INTEGER REFERENCES modalidades(id) ON DELETE SET NULL,
  descricao TEXT,
  data_inicio TEXT NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT,
  recorrencia TEXT NOT NULL DEFAULT 'nenhuma' CHECK (recorrencia IN ('nenhuma', 'semanal', 'mensal')),
  dias_semana TEXT,
  recorrencia_ate TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Garante que o ano letivo atual exista
const anoAtual = new Date().getFullYear();
db.prepare('INSERT OR IGNORE INTO anos_letivos (ano, ativo) VALUES (?, 1)').run(anoAtual);

// Migração: bancos criados antes da troca de "horário escolar" (texto livre)
// por "período escolar" (manhã/tarde/noite/integral) só têm a coluna antiga.
// RENAME COLUMN preserva os dados já gravados.
const colunasAlunos = db.prepare('PRAGMA table_info(alunos)').all().map((c) => c.name);
if (colunasAlunos.includes('horario_escola') && !colunasAlunos.includes('periodo_escola')) {
  db.exec('ALTER TABLE alunos RENAME COLUMN horario_escola TO periodo_escola');
}
// Mesma ideia: "série" (texto livre) virou "nível de ensino" (lista fixa).
if (colunasAlunos.includes('serie_escola') && !colunasAlunos.includes('nivel_ensino')) {
  db.exec('ALTER TABLE alunos RENAME COLUMN serie_escola TO nivel_ensino');
}

// ---------- Colaboradores (antes chamados de "voluntários") ----------
// Bancos que já tinham as tabelas antigas são renomeados, sem perder dados.
const tabelasAtuais = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
if (tabelasAtuais.includes('voluntarios') && !tabelasAtuais.includes('colaboradores')) {
  db.exec(`
    ALTER TABLE voluntarios RENAME TO colaboradores;
    ALTER TABLE voluntario_modalidades RENAME TO colaborador_modalidades;
    ALTER TABLE voluntario_disponibilidades RENAME TO colaborador_disponibilidades;
    ALTER TABLE voluntario_documentos RENAME TO colaborador_documentos;
    ALTER TABLE colaborador_modalidades RENAME COLUMN voluntario_id TO colaborador_id;
    ALTER TABLE colaborador_disponibilidades RENAME COLUMN voluntario_id TO colaborador_id;
    ALTER TABLE colaborador_documentos RENAME COLUMN voluntario_id TO colaborador_id;
  `);
}

db.exec(`
CREATE TABLE IF NOT EXISTS colaboradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL DEFAULT 'voluntario' CHECK (tipo IN ('voluntario', 'professor', 'estagiario')),
  nome TEXT NOT NULL,
  data_nascimento TEXT NOT NULL,
  estado_civil TEXT NOT NULL,
  cpf TEXT NOT NULL,
  telefone TEXT NOT NULL,
  endereco TEXT NOT NULL,
  bairro TEXT NOT NULL,
  cep TEXT NOT NULL,
  email TEXT NOT NULL,
  formacao TEXT,
  chave_pix TEXT,
  igreja TEXT,
  foto_path TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS colaborador_modalidades (
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  modalidade_id INTEGER NOT NULL REFERENCES modalidades(id) ON DELETE CASCADE,
  PRIMARY KEY (colaborador_id, modalidade_id)
);

-- Dias e horários em que o colaborador pretende atuar (0 = domingo ... 6 = sábado).
CREATE TABLE IF NOT EXISTS colaborador_disponibilidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL
);

-- Um documento de cada tipo por colaborador (enviar de novo substitui o anterior).
CREATE TABLE IF NOT EXISTS colaborador_documentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  data_upload TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (colaborador_id, tipo)
);
`);

const colunasColaboradores = db.prepare('PRAGMA table_info(colaboradores)').all().map((c) => c.name);
if (!colunasColaboradores.includes('tipo')) {
  db.exec("ALTER TABLE colaboradores ADD COLUMN tipo TEXT NOT NULL DEFAULT 'voluntario' CHECK (tipo IN ('voluntario', 'professor', 'estagiario'))");
}

console.log(`Banco de dados pronto (${ARQUIVO_BANCO}). Ambiente: ${AMBIENTE.toUpperCase()}. Ano letivo ${anoAtual} garantido.`);

module.exports = db;
