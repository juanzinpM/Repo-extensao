// server.js
// Só monta o Express, aplica os middlewares e liga as rotas.
// Toda a lógica de negócio mora em routes/ e models/.
const express = require('express');
const session = require('express-session');
const path = require('path');

require('./db'); // garante que o banco e as tabelas existem antes de tudo
const { AMBIENTE, PASTA_UPLOADS } = require('./config');
const exigirLogin = require('./middlewares/exigirLogin');

const app = express();
const PORTA = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'troque-este-segredo-antes-de-usar-de-verdade',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // sessão dura 8 horas
}));

// Arquivos públicos (tela de login, css, js do frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Rotas de autenticação ficam públicas (login precisa funcionar sem sessão)
app.use('/api', require('./routes/autenticacao'));

// ---------- A partir daqui, tudo exige login ----------
app.use(exigirLogin);

// Páginas protegidas — qualquer .html colocado em "protegido/" já fica
// automaticamente atrás do login.
app.use(express.static(path.join(__dirname, 'protegido'), { index: 'alunos.html' }));

// Foto, documentos e termo de imagem enviados — atrás do login também,
// já que podem conter dado sensível de aluno (inclusive menor de idade).
app.use('/uploads', express.static(path.join(__dirname, PASTA_UPLOADS)));

// Rotas de API protegidas
app.use('/api', require('./routes/catalogos'));
app.use('/api/alunos', require('./routes/alunos'));
app.use('/api/modalidades', require('./routes/modalidades'));

// Precisa ser o ÚLTIMO app.use() — captura qualquer erro lançado nas rotas acima.
app.use(require('./middlewares/tratarErros'));

app.listen(PORTA, '0.0.0.0', () => {
  console.log(`Servidor rodando. Acesse http://localhost:${PORTA} neste PC`);
  console.log(`ou http://SEU-IP-LOCAL:${PORTA} a partir do outro PC na rede.`);
});
