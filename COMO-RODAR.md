# Como rodar o Sistema Instituto Missão Art

Guia passo a passo para instalar e executar a aplicação. Para entender como ela funciona por dentro, veja [`APLICACAO.md`](APLICACAO.md).

---

## 1. Pré-requisitos

- **Node.js** versão 18 ou superior (recomendado a versão LTS) — https://nodejs.org
- **npm** (já vem com o Node.js)

Confira no terminal:

```bash
node -v
npm -v
```

> No Windows, os módulos nativos (`bcrypt`, `better-sqlite3`) normalmente instalam sem problema com o Node LTS. Se der erro de compilação, veja a seção [Problemas comuns](#8-problemas-comuns).

---

## 2. Instalar

Dentro da pasta do projeto (a que contém o `server.js`):

```bash
npm install
```

> Use `npm install`, **não** `npm ci` — o `package-lock.json` pode não conter todas as dependências (ex.: `exceljs`).

---

## 3. Escolher o ambiente

Abra `config.js` e confira a constante `AMBIENTE`:

| Valor | Banco usado | Pasta de uploads | Uso |
|---|---|---|---|
| `'teste'` | `dados-teste.db` | `uploads-teste/` | Desenvolvimento, demonstrações, teste do cliente |
| `'producao'` | `dados.db` | `uploads/` | Dados reais |

Em `teste`, aparece um aviso visível na tela de que os dados são de teste. Os arquivos do banco são criados automaticamente na primeira execução.

---

## 4. Criar o primeiro usuário

Não existe tela de cadastro de usuários — crie pelo terminal:

```bash
node create-usuario.js "Nome da Pessoa" email@exemplo.com senhaSegura123
```

- O e-mail é único (repetir dá erro).
- A senha é guardada com hash (bcrypt).
- Repita o comando para cada pessoa que for usar o sistema.

---

## 5. Iniciar o servidor

```bash
node server.js
```

Ou, em desenvolvimento, com reinício automático ao salvar arquivos:

```bash
npx nodemon server.js
```

Se tudo deu certo, o terminal indica que o servidor está rodando na porta **3000**.

Acesse no navegador: **http://localhost:3000** e entre com o e-mail e senha criados.

---

## 6. Acessar de outro computador (rede local)

O servidor escuta em `0.0.0.0`, então outros PCs da mesma rede (Wi-Fi/cabo) conseguem acessar.

1. No PC que roda o servidor, descubra o IP:
   - Windows: `ipconfig` → "Endereço IPv4" (ex.: `192.168.0.15`)
   - Linux/Mac: `ip a` ou `ifconfig`
2. No outro PC, abra: `http://192.168.0.15:3000`
3. Se não abrir, libere a **porta 3000** no Firewall do Windows (ou permita o Node.js quando o Windows perguntar).

Observações:
- O PC servidor precisa ficar **ligado** e com o servidor rodando.
- O IP pode mudar; para uso fixo, configure um **IP fixo** no PC ou reserva no roteador (Fase 12 do plano).

---

## 7. Operação do dia a dia

**Resetar o banco de teste** (apaga tudo e recria do zero — só funciona com `AMBIENTE = 'teste'`):

```bash
node resetar-banco-teste.js
```

Depois do reset, será preciso recriar o usuário (passo 4).

**Backup** — copie periodicamente:
- o arquivo do banco (`dados.db` ou `dados-teste.db`);
- a pasta de uploads (`uploads/` ou `uploads-teste/`).

**Atualizar o sistema** — substitua os arquivos (ou `git pull`), rode `npm install` e reinicie o servidor (`Ctrl+C` e `node server.js` de novo). Os dados não são perdidos, pois ficam no `.db` e na pasta de uploads.

**Manter rodando sem janela aberta (futuro)** — usar o **PM2**:

```bash
npm install -g pm2
pm2 start server.js --name missao-art
pm2 save
```

### Disponibilizar para o cliente testar (fora da rede local)

Opção simples e sem abrir portas no roteador: **Cloudflare Tunnel** (`cloudflared`).

```bash
cloudflared tunnel --url http://localhost:3000
```

Ele mostra um link `https://....trycloudflare.com` para compartilhar. Cuidados:
- O link **muda a cada execução**, e o PC precisa ficar ligado.
- Use sempre `AMBIENTE = 'teste'` (dados fictícios).
- Não há proteção contra tentativas repetidas de login; troque o segredo da sessão em `server.js` e use senha forte.

---

## 8. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Cannot find module './routes/alunos'` | Arquivo com nome errado ou pasta incompleta | Confira se existe `routes/alunos.js` (renomeie arquivos baixados avulsos) ou extraia o projeto completo de novo |
| `Cannot find module 'exceljs'` (ou outro) | Dependências não instaladas | Rode `npm install` |
| `EADDRINUSE: address already in use :::3000` | Já há algo rodando na porta 3000 | Feche o outro servidor/terminal, ou finalize o processo que usa a porta |
| Erro ao instalar `bcrypt` / `better-sqlite3` | Versão do Node incompatível ou falta de ferramentas de compilação | Use o Node.js LTS; no Windows, instale as "Build Tools" se solicitado; apague `node_modules` e rode `npm install` de novo |
| Login não funciona | Usuário não criado (ou banco foi resetado) | Rode `node create-usuario.js ...` |
| Outro PC não acessa | Firewall ou IP errado | Libere a porta 3000, confira o IP e se estão na mesma rede |
| "Reset só funciona em teste" | `AMBIENTE` está em `'producao'` | É proposital, para proteger os dados reais |
| Todo mundo foi deslogado | Servidor reiniciado (sessões ficam em memória) | Comportamento esperado; basta logar de novo |
| Botão "Exportar (Excel)" falha | `exceljs` ausente | `npm install` e reinicie |

---

## 9. Resumo rápido

```bash
npm install
node create-usuario.js "Seu Nome" voce@email.com suaSenha
node server.js
# abrir http://localhost:3000
```
