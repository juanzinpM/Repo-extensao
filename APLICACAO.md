# Sistema Instituto Missão Art — Documentação da Aplicação

Sistema web para cadastro e gestão de alunos do **Instituto Missão Art**: ficha completa do aluno (dados pessoais, saúde, responsáveis), matrícula por modalidade e ano letivo, status (ativo / inativo / lista de espera), anexos, termo de uso de imagem, rematrícula e exportação para Excel.

> Para instruções de instalação e execução, veja [`COMO-RODAR.md`](COMO-RODAR.md).

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Servidor | Node.js (CommonJS) + Express 5 |
| Banco de dados | SQLite via `better-sqlite3` (arquivo local, `foreign_keys` ligado) |
| Sessão / login | `express-session` (sessão de 8h, em memória) + `bcrypt` (hash de senha) |
| Upload de arquivos | `multer` 2 |
| Exportação | `exceljs` (gera `.xlsx`) |
| Front-end | HTML/CSS/JS puro (sem framework), servido como arquivos estáticos |
| Desenvolvimento | `nodemon` (opcional) |

---

## 2. Arquitetura

Camadas bem separadas — cada uma com uma única responsabilidade:

```
Navegador ──► routes/  ──► models/  ──► db.js (SQLite)
              (HTTP)       (todo o SQL)
```

- **routes/** — recebe a requisição, valida o básico, chama o model e responde. **Não contém SQL.**
- **models/** — toda a regra de negócio e **todo o SQL** do sistema.
- **middlewares/** — `exigirLogin` (barra quem não está logado), `upload` (multer), `tratarErros` (resposta padronizada de erro).
- **utils/** — `ErroApp` (erro com status HTTP) e `excel.js` (gerador genérico de planilha).
- **public/** — páginas que **não** exigem login (tela de login, CSS, JS compartilhado, logo).
- **protegido/** — páginas que **só são servidas após login** (`index`, `alunos.html`).

### Estrutura de pastas

```
sistema-missao-art/
├── server.js                  # monta o Express, sessão, rotas e inicia na porta 3000
├── config.js                  # AMBIENTE (teste/producao), arquivo do banco, pasta de uploads
├── db.js                      # cria tabelas, semeia catálogos, garante o ano letivo atual
├── create-usuario.js          # CLI para criar usuário de acesso
├── resetar-banco-teste.js     # apaga e recria o banco de TESTE
├── routes/
│   ├── autenticacao.js        # login, logout, sessão, ambiente
│   ├── alunos.js              # CRUD de alunos, status, arquivos, rematrícula, exportação
│   ├── catalogos.js           # problemas de saúde e doenças contagiosas
│   └── modalidades.js         # listar e criar modalidades
├── models/
│   ├── alunosModel.js
│   ├── matriculasModel.js     # ano letivo, idade, modalidades do aluno, rematrícula
│   ├── responsaveisModel.js
│   ├── modalidadesModel.js
│   ├── documentosModel.js
│   ├── termoImagemModel.js
│   ├── exportacaoModel.js
│   └── usuariosModel.js
├── middlewares/
│   ├── exigirLogin.js
│   ├── tratarErros.js
│   └── upload.js
├── utils/
│   ├── ErroApp.js
│   └── excel.js
├── public/                    # sem login: login.html, tema.css, layout.js, erros.js, img/logo.png
└── protegido/                 # com login: index e alunos.html
```

### Ambientes (`config.js`)

| `AMBIENTE` | Banco | Uploads |
|---|---|---|
| `'teste'` | `dados-teste.db` | `uploads-teste/` |
| `'producao'` | `dados.db` | `uploads/` |

Em ambiente de teste, o front mostra um **banner** avisando que os dados são de teste (via `GET /api/ambiente`). O script `resetar-banco-teste.js` **só funciona em teste** — não apaga o banco de produção.

---

## 3. Modelo de dados

| Tabela | Descrição |
|---|---|
| `usuarios` | Quem acessa o sistema (nome, e-mail único, senha com hash bcrypt) |
| `alunos` | Ficha do aluno: dados pessoais, escola, convênio, ficha de saúde, status, foto, observações |
| `problemas_saude` | Catálogo fixo (16 itens) |
| `aluno_problemas_saude` | Vínculo N:N aluno ↔ problemas de saúde |
| `doencas_contagiosas` | Catálogo fixo (8 itens) |
| `aluno_doencas_contagiosas` | Vínculo N:N aluno ↔ doenças que já teve |
| `responsaveis` | Responsáveis legais (reaproveitados por CPF) |
| `aluno_responsaveis` | Vínculo N:N aluno ↔ responsável (parentesco, principal) |
| `modalidades` | Break, Balé, Música, Box, Futebol, Inglês, Reforço escolar (+ as criadas pela tela) |
| `anos_letivos` | Ano letivo (o do ano corrente é criado automaticamente) |
| `matriculas` | Uma por aluno **por ano letivo** (`UNIQUE aluno + ano`) |
| `matricula_modalidades` | Modalidades em que o aluno está matriculado naquele ano |
| `documentos` | Anexos do aluno (tipo + caminho do arquivo) |
| `termos_imagem` | Termo de uso de imagem (aceite digital **ou** arquivo assinado) por ano |

---

## 4. Regras de negócio

**Responsáveis**
- Todo aluno precisa de **pelo menos 1 responsável legal**.
- Responsável é **reaproveitado pelo CPF** (irmãos compartilham o mesmo cadastro de responsável).
- O **primeiro da lista é o responsável principal**.

**Modalidades e idade**
- A modalidade **Box** aceita adultos e crianças (`adulto_e_infantil`).
- Todas as demais modalidades são **só infantil**: aluno com **18 anos ou mais** é bloqueado nelas.
- A idade é calculada a partir da data de nascimento.

**Status**
- Valores: `ativo`, `inativo`, `lista_espera`. O aluno **nasce `ativo`**.
- Ao entrar em `lista_espera`, a `data_entrada_lista_espera` é preenchida automaticamente com a data de hoje (pode ser informada manualmente). Ao sair da fila, é zerada.

**Rematrícula**
- Ano letivo = ano corrente.
- Precisa de rematrícula o aluno que: **não está inativo**, teve **alguma modalidade em ano anterior** e **ainda não tem modalidade no ano atual**.
- Uma "matrícula vazia" (registro do ano sem nenhuma modalidade) **não conta** como matriculado.

**Arquivos**
- Tamanho máximo: **5 MB**.
- Foto: JPEG, PNG ou WebP. Documentos e termo assinado: essas imagens **ou PDF**.
- Os arquivos ficam em pasta própria e são **servidos só para usuários logados** (`/uploads`).

**Termo de uso de imagem**
- Por ano letivo, pode ser registrado por **aceite digital** ou por **upload do arquivo assinado** — os dois são **mutuamente exclusivos**.

**Exportação**
- Gera Excel com a **ficha completa** (~44 colunas: básico, status, modalidades, responsáveis e saúde) e **respeita os filtros aplicados na tela** (busca, status, modalidade).

---

## 5. Funcionalidades

1. **Login / logout** com sessão de 8 horas.
2. **Cadastro e edição de aluno** — dados pessoais, escola, convênio, observações.
3. **Ficha de saúde** — deficiência, problemas de saúde (catálogo), doenças contagiosas já tidas, fumante, remédio contínuo, cirurgia, dores/lesões, alergias, medicamento controlado, atestado de saúde.
4. **Responsáveis legais** — múltiplos por aluno, com parentesco, telefone e principal.
5. **Modalidades e matrícula** — por ano letivo; cadastro de novas modalidades pela tela.
6. **Status e lista de espera**.
7. **Foto do aluno, documentos anexados e termo de uso de imagem**.
8. **Rematrícula** — indicador por aluno e filtro de "pendentes de rematrícula".
9. **Lista com filtros** — busca por nome/CPF, status e modalidade.
10. **Exportação para Excel**.
11. **Identidade visual** — sidebar, topbar e logo do Instituto; paleta coral `#DB5A61`, carvão `#2A2224`, fundo `#FAF7F4`.

---

## 6. Endpoints da API

Todos exigem login, exceto `login`, `logout`, `ambiente` e `sessao`.

### Autenticação (`routes/autenticacao.js`)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/login` | Autentica por e-mail e senha |
| POST | `/api/logout` | Encerra a sessão |
| GET | `/api/ambiente` | Informa teste/produção (banner) |
| GET | `/api/sessao` | Informa se há sessão ativa |

### Catálogos e modalidades
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/problemas-saude` | Lista problemas de saúde |
| GET | `/api/doencas-contagiosas` | Lista doenças contagiosas |
| GET | `/api/modalidades` | Lista modalidades |
| POST | `/api/modalidades` | Cria modalidade (valida nome vazio/duplicado) |

### Alunos (`/api/alunos`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Lista (query: `busca`, `status`, `modalidade`) |
| GET | `/pendentes-rematricula` | Alunos que precisam de rematrícula |
| GET | `/exportar` | Baixa `alunos-AAAA-MM-DD.xlsx` (aceita os mesmos filtros) |
| GET | `/:id` | Ficha completa do aluno |
| POST | `/` | Cria aluno (exige nome e ≥ 1 responsável) |
| PUT | `/:id` | Atualiza aluno |
| PATCH | `/:id/status` | Altera status |
| GET | `/:id/situacao-matricula` | Situação de matrícula/rematrícula no ano atual |
| POST | `/:id/foto` | Envia foto |
| GET | `/:id/documentos` | Lista documentos |
| POST | `/:id/documentos` | Anexa documento (campo `tipo` + arquivo) |
| DELETE | `/:id/documentos/:documentoId` | Remove documento |
| GET | `/:id/termo-imagem` | Termo de imagem do ano atual |
| POST | `/:id/termo-imagem/aceite` | Registra aceite digital |
| POST | `/:id/termo-imagem/arquivo` | Envia termo assinado |

> **Atenção na ordem das rotas:** `/pendentes-rematricula` e `/exportar` precisam ficar **antes** de `GET /:id`, senão o Express interpreta o texto como um `:id`.

---

## 7. Padrão de tratamento de erros

- Erros esperados: `throw new ErroApp('mensagem', status)` (status padrão **400**). A mensagem vai ao usuário como está.
- Erros inesperados: resposta **500 genérica** ("erro interno"), com o detalhe **logado no terminal** do servidor.
- `tratarErros` é o **último** `app.use` do `server.js` (Express 5 repassa rejeições de handlers `async` automaticamente).
- No front, `chamarApi()` (em `public/erros.js`) exibe qualquer erro num **modal** padronizado.

---

## 8. Segurança

- Senhas guardadas com **bcrypt** (nunca em texto puro).
- Páginas em `protegido/`, rotas `/api/*` (exceto autenticação) e `/uploads` **só respondem com sessão válida**.
- Uploads validados por tipo e tamanho.
- Todo SQL usa **parâmetros** (`?`), sem concatenação de entrada do usuário.

## 9. Limitações conhecidas

- **Sem testes automatizados** — há cenários BDD (dado/quando/então) documentados para teste manual.
- **Sem perfis de acesso**: todo usuário logado tem acesso total.
- **Segredo da sessão fixo no código** (`server.js`) — deve ser trocado/externalizado antes de produção real.
- **Sem proteção contra força bruta** no login (rate limit).
- **Sessões em memória**: reiniciar o servidor desloga todo mundo.
- **Fora do MVP**: cadastro de voluntários, perfis de acesso.
- Pendentes do plano: Fase 12 (IP fixo, PM2, teste em 2 PCs) e manuais.
- O `package-lock.json` pode estar desatualizado em relação ao `exceljs` — use `npm install` (não `npm ci`).
