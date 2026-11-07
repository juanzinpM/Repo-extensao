// routes/rematricula.js
const express = require('express');
const router = express.Router();
const matriculasModel = require('../models/matriculasModel');
const alunosModel = require('../models/alunosModel');
const ErroApp = require('../utils/ErroApp');

function exigirAlunoExistente(req, res, next) {
  if (!alunosModel.existe(req.params.id)) {
    throw new ErroApp('Aluno não encontrado.', 404);
  }
  next();
}

// Ano alvo e situação geral (antecipada ou não) + alunos a rematricular.
// ?aluno=ID limita a lista a um aluno (usado pelo botão da ficha).
router.get('/', (req, res) => {
  res.json(matriculasModel.listarParaRematricula(req.query.aluno ? Number(req.query.aluno) : null));
});

router.get('/aluno/:id', exigirAlunoExistente, (req, res) => {
  const resultado = matriculasModel.listarParaRematricula(Number(req.params.id));
  res.json({
    ano_alvo: resultado.ano_alvo,
    antecipada: resultado.antecipada,
    elegivel: resultado.alunos.length > 0,
    rematriculado: resultado.alunos.length > 0 && resultado.alunos[0].rematriculado
  });
});

router.post('/', (req, res) => {
  res.json(matriculasModel.rematricular(req.body.itens, req.body.confirmar_antecipada));
});

router.delete('/aluno/:id', exigirAlunoExistente, (req, res) => {
  matriculasModel.desfazerRematriculaAntecipada(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
