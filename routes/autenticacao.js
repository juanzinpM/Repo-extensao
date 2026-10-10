// routes/autenticacao.js
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const usuariosModel = require('../models/usuariosModel');
const { AMBIENTE } = require('../config');
const ErroApp = require('../utils/ErroApp');

router.post('/login', (req, res) => {
  const { email, senha } = req.body;

  const usuario = usuariosModel.buscarPorEmail(email);
  if (!usuario) {
    throw new ErroApp('E-mail ou senha inválidos.', 401);
  }

  const senhaCorreta = bcrypt.compareSync(senha, usuario.senha_hash);
  if (!senhaCorreta) {
    throw new ErroApp('E-mail ou senha inválidos.', 401);
  }

  req.session.usuarioId = usuario.id;
  req.session.usuarioNome = usuario.nome;
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get('/ambiente', (req, res) => {
  res.json({ ambiente: AMBIENTE });
});

router.get('/sessao', (req, res) => {
  if (req.session && req.session.usuarioId) {
    return res.json({ logado: true, nome: req.session.usuarioNome });
  }
  res.json({ logado: false });
});

module.exports = router;
