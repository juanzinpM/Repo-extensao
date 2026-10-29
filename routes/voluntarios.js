// routes/voluntarios.js
const express = require('express');
const router = express.Router();
const voluntariosModel = require('../models/voluntariosModel');
const { uploadFotoVoluntario, uploadDocumentoVoluntario } = require('../middlewares/upload');
const ErroApp = require('../utils/ErroApp');

// Roda ANTES do multer nas rotas de upload, para não gravar arquivo
// órfão em disco para um voluntário (ou tipo de documento) inexistente.
function exigirVoluntarioExistente(req, res, next) {
  if (!voluntariosModel.existe(req.params.id)) {
    throw new ErroApp('Voluntário não encontrado.', 404);
  }
  next();
}

function exigirTipoDocumentoValido(req, res, next) {
  if (!voluntariosModel.tipoDocumentoValido(req.params.tipo)) {
    throw new ErroApp('Tipo de documento inválido.');
  }
  next();
}

// Opções fixas usadas pela tela (estado civil e tipos de documento).
router.get('/opcoes', (req, res) => {
  res.json({
    estados_civis: voluntariosModel.ESTADOS_CIVIS,
    tipos_documento: voluntariosModel.TIPOS_DOCUMENTO
  });
});

router.get('/', (req, res) => {
  res.json(voluntariosModel.listar(req.query.busca, req.query.status, req.query.modalidade));
});

router.get('/:id', exigirVoluntarioExistente, (req, res) => {
  res.json(voluntariosModel.buscarPorId(req.params.id));
});

router.post('/', (req, res) => {
  res.json({ id: voluntariosModel.criar(req.body) });
});

router.put('/:id', exigirVoluntarioExistente, (req, res) => {
  voluntariosModel.atualizar(req.params.id, req.body);
  res.json({ ok: true });
});

router.patch('/:id/status', exigirVoluntarioExistente, (req, res) => {
  voluntariosModel.alterarStatus(req.params.id, req.body.status);
  res.json({ ok: true });
});

// ---------- Foto 3x4 ----------

router.post('/:id/foto', exigirVoluntarioExistente, uploadFotoVoluntario, (req, res) => {
  if (!req.file) throw new ErroApp('Nenhuma foto enviada.');
  const fotoPath = `voluntarios-fotos/${req.file.filename}`;
  voluntariosModel.salvarFoto(req.params.id, fotoPath);
  res.json({ foto_path: fotoPath });
});

router.delete('/:id/foto', exigirVoluntarioExistente, (req, res) => {
  voluntariosModel.removerFoto(req.params.id);
  res.json({ ok: true });
});

// ---------- Documentos (um de cada tipo) ----------

router.post('/:id/documentos/:tipo', exigirVoluntarioExistente, exigirTipoDocumentoValido, uploadDocumentoVoluntario, (req, res) => {
  if (!req.file) throw new ErroApp('Nenhum arquivo enviado.');
  voluntariosModel.salvarDocumento(req.params.id, req.params.tipo, `voluntarios-documentos/${req.file.filename}`);
  res.json({ ok: true });
});

router.delete('/:id/documentos/:tipo', exigirVoluntarioExistente, exigirTipoDocumentoValido, (req, res) => {
  voluntariosModel.removerDocumento(req.params.id, req.params.tipo);
  res.json({ ok: true });
});

module.exports = router;
