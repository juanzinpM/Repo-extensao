// routes/calendario.js
const express = require('express');
const router = express.Router();
const calendarioModel = require('../models/calendarioModel');
const ErroApp = require('../utils/ErroApp');

function exigirEventoExistente(req, res, next) {
  if (!calendarioModel.existe(req.params.id)) {
    throw new ErroApp('Evento não encontrado.', 404);
  }
  next();
}

// Ocorrências de um período: GET /api/calendario?inicio=2026-10-01&fim=2026-10-31
router.get('/', (req, res) => {
  res.json(calendarioModel.listarOcorrencias(req.query.inicio, req.query.fim));
});

router.get('/:id', exigirEventoExistente, (req, res) => {
  res.json(calendarioModel.buscarPorId(req.params.id));
});

router.post('/', (req, res) => {
  const id = calendarioModel.criar(req.body);
  res.json({ id });
});

router.put('/:id', exigirEventoExistente, (req, res) => {
  calendarioModel.atualizar(req.params.id, req.body);
  res.json({ ok: true });
});

router.delete('/:id', exigirEventoExistente, (req, res) => {
  calendarioModel.remover(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
