// middlewares/upload.js
//
// Configuração do multer (upload de arquivo) usada pelas rotas de foto,
// documentos e termo de imagem. Cada tipo de arquivo tem sua própria
// subpasta dentro de PASTA_UPLOADS (config.js), pra não misturar tudo.
//
// Erros do multer (arquivo grande demais, tipo não aceito) são convertidos
// em ErroApp aqui mesmo, pra chegar com mensagem amigável no tratarErros.js.
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ErroApp = require('../utils/ErroApp');
const { PASTA_UPLOADS } = require('../config');

const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'];
const TIPOS_DOCUMENTO = [...TIPOS_IMAGEM, 'application/pdf'];

function caminhoCompleto(subpasta) {
  return path.join(__dirname, '..', PASTA_UPLOADS, subpasta);
}

function criarStorage(subpasta) {
  const pastaDestino = caminhoCompleto(subpasta);
  fs.mkdirSync(pastaDestino, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, pastaDestino),
    filename: (req, file, cb) => {
      // Nome único: id do aluno + timestamp, pra nunca sobrescrever
      // upload antigo nem colidir entre alunos diferentes.
      const extensao = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.params.id}-${Date.now()}${extensao}`);
    }
  });
}

function criarUpload(subpasta, tiposAceitos, campoArquivo) {
  const middlewareMulter = multer({
    storage: criarStorage(subpasta),
    limits: { fileSize: TAMANHO_MAXIMO_BYTES },
    fileFilter: (req, file, cb) => {
      if (!tiposAceitos.includes(file.mimetype)) {
        return cb(new ErroApp(`Tipo de arquivo não permitido. Aceitos: ${tiposAceitos.join(', ')}.`));
      }
      cb(null, true);
    }
  }).single(campoArquivo);

  // Envolve o middleware do multer pra traduzir os erros dele (ex: limite
  // de tamanho) em ErroApp, em vez de deixar cair como erro genérico 500.
  return (req, res, next) => {
    middlewareMulter(req, res, (erro) => {
      if (!erro) return next();
      if (erro instanceof multer.MulterError && erro.code === 'LIMIT_FILE_SIZE') {
        return next(new ErroApp(`Arquivo muito grande. Tamanho máximo: ${TAMANHO_MAXIMO_BYTES / 1024 / 1024}MB.`));
      }
      return next(erro);
    });
  };
}

module.exports = {
  uploadFoto: criarUpload('fotos', TIPOS_IMAGEM, 'foto'),
  uploadDocumento: criarUpload('documentos', TIPOS_DOCUMENTO, 'arquivo'),
  uploadTermoImagem: criarUpload('termos-imagem', TIPOS_DOCUMENTO, 'arquivo')
};
