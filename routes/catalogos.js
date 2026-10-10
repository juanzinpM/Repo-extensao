// routes/catalogos.js
// Endpoints de catálogos fixos (usados nos checkboxes da ficha de saúde).
const express = require('express');
const router = express.Router();
const alunosModel = require('../models/alunosModel');

router.get('/problemas-saude', (req, res) => {
  res.json(alunosModel.listarProblemasSaude());
});

router.get('/doencas-contagiosas', (req, res) => {
  res.json(alunosModel.listarDoencasContagiosas());
});

module.exports = router;
