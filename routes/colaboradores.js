// routes/colaboradores.js
const express = require('express');
const router = express.Router();
const colaboradoresModel = require('../models/colaboradoresModel');
const { uploadFotoColaborador, uploadDocumentoColaborador } = require('../middlewares/upload');
const ErroApp = require('../utils/ErroApp');

// Roda ANTES do multer nas rotas de upload, para não gravar arquivo
// órfão em disco para um colaborador (ou tipo de documento) inexistente.
function exigirColaboradorExistente(req, res, next) {
  if (!colaboradoresModel.existe(req.params.id)) {
    throw new ErroApp('Colaborador não encontrado.', 404);
  }
  next();
}

function exigirTipoDocumentoValido(req, res, next) {
  if (!colaboradoresModel.tipoDocumentoValido(req.params.tipo)) {
    throw new ErroApp('Tipo de documento inválido.');
  }
  next();
}

// Opções fixas usadas pela tela (estado civil e tipos de documento).
router.get('/opcoes', (req, res) => {
  res.json({
    estados_civis: colaboradoresModel.ESTADOS_CIVIS,
    tipos: colaboradoresModel.TIPOS,
    tipos_documento: colaboradoresModel.TIPOS_DOCUMENTO
  });
});

router.get('/', (req, res) => {
  res.json(colaboradoresModel.listar(req.query.busca, req.query.status, req.query.modalidade, req.query.tipo));
});

router.get('/:id', exigirColaboradorExistente, (req, res) => {
  res.json(colaboradoresModel.buscarPorId(req.params.id));
});

router.post('/', (req, res) => {
  res.json({ id: colaboradoresModel.criar(req.body) });
});

router.put('/:id', exigirColaboradorExistente, (req, res) => {
  colaboradoresModel.atualizar(req.params.id, req.body);
  res.json({ ok: true });
});

router.patch('/:id/status', exigirColaboradorExistente, (req, res) => {
  colaboradoresModel.alterarStatus(req.params.id, req.body.status);
  res.json({ ok: true });
});

// ---------- Foto 3x4 ----------

router.post('/:id/foto', exigirColaboradorExistente, uploadFotoColaborador, (req, res) => {
  if (!req.file) throw new ErroApp('Nenhuma foto enviada.');
  const fotoPath = `colaboradores-fotos/${req.file.filename}`;
  colaboradoresModel.salvarFoto(req.params.id, fotoPath);
  res.json({ foto_path: fotoPath });
});

router.delete('/:id/foto', exigirColaboradorExistente, (req, res) => {
  colaboradoresModel.removerFoto(req.params.id);
  res.json({ ok: true });
});

// ---------- Documentos (um de cada tipo) ----------

router.post('/:id/documentos/:tipo', exigirColaboradorExistente, exigirTipoDocumentoValido, uploadDocumentoColaborador, (req, res) => {
  if (!req.file) throw new ErroApp('Nenhum arquivo enviado.');
  colaboradoresModel.salvarDocumento(req.params.id, req.params.tipo, `colaboradores-documentos/${req.file.filename}`);
  res.json({ ok: true });
});

router.delete('/:id/documentos/:tipo', exigirColaboradorExistente, exigirTipoDocumentoValido, (req, res) => {
  colaboradoresModel.removerDocumento(req.params.id, req.params.tipo);
  res.json({ ok: true });
});

module.exports = router;
