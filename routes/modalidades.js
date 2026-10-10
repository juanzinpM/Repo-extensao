// routes/modalidades.js
const express = require('express');
const router = express.Router();
const modalidadesModel = require('../models/modalidadesModel');

router.get('/', (req, res) => {
  res.json(modalidadesModel.listar());
});

router.post('/', (req, res) => {
  const id = modalidadesModel.criar(req.body.nome, req.body.publico);
  res.json({ id });
});

module.exports = router;
