// middlewares/tratarErros.js
//
// Middleware de erro do Express — precisa ter exatamente 4 parâmetros
// (err, req, res, next) pra ser reconhecido como middleware de erro.
// Fica registrado por ÚLTIMO no server.js, depois de todas as rotas.
//
// O Express encaminha pra cá automaticamente qualquer erro lançado
// (throw) dentro de uma rota ou middleware, mesmo sem try/catch manual.
function tratarErros(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err.amigavel) {
    // Erro esperado (ErroApp): a mensagem já foi pensada pra ser mostrada ao usuário.
    return res.status(err.status || 400).json({ erro: err.message });
  }

  // Erro inesperado: nunca mostra stack trace nem detalhe técnico pro usuário.
  // Mas registra o erro real no terminal, pra quem estiver mantendo o sistema investigar.
  console.error(`[${new Date().toISOString()}] Erro inesperado em ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ erro: 'Ocorreu um erro inesperado. Tente novamente em instantes.' });
}

module.exports = tratarErros;
