// middlewares/exigirLogin.js
// Bloqueia páginas e rotas de API para quem não está logado.
const ErroApp = require('../utils/ErroApp');

function exigirLogin(req, res, next) {
  if (req.session && req.session.usuarioId) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    throw new ErroApp('Sessão expirada. Faça login novamente.', 401);
  }
  return res.redirect('/login.html');
}

module.exports = exigirLogin;
