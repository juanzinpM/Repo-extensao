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
  serie_escola TEXT,
  horario_escola TEXT,
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

const inserirModalidade = db.prepare(
  'INSERT OR IGNORE INTO modalidades (nome, publico) VALUES (?, ?)'
);
const modalidades = [
  ['Break', 'infantil'],
  ['Balé', 'infantil'],
  ['Música', 'infantil'],
  ['Box', 'adulto_e_infantil'],
  ['Futebol', 'infantil'],
  ['Inglês', 'infantil'],
  ['Reforço escolar', 'infantil']
];
modalidades.forEach(([nome, publico]) => inserirModalidade.run(nome, publico));

// Garante que o ano letivo atual exista
const anoAtual = new Date().getFullYear();
db.prepare('INSERT OR IGNORE INTO anos_letivos (ano, ativo) VALUES (?, 1)').run(anoAtual);

console.log(`Banco de dados pronto (${ARQUIVO_BANCO}). Ambiente: ${AMBIENTE.toUpperCase()}. Ano letivo ${anoAtual} garantido.`);

module.exports = db;
