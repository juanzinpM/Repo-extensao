// utils/ErroApp.js
//
// Erro "esperado" de regra de negócio — usado sempre que uma rota sabe
// exatamente o que deu errado e quer mostrar uma mensagem amigável.
//
// Uso nas rotas:
//   if (!nome) throw new ErroApp('O nome do aluno é obrigatório.');       // 400 por padrão
//   if (!aluno) throw new ErroApp('Aluno não encontrado.', 404);
//
// Qualquer erro que NÃO seja um ErroApp é tratado como inesperado pelo
// middlewares/tratarErros.js, e o usuário só vê uma mensagem genérica.
class ErroApp extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
    this.amigavel = true; // marca esse erro como "seguro pra mostrar ao usuário"
  }
}

module.exports = ErroApp;
