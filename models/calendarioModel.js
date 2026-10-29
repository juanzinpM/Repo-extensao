// models/calendarioModel.js
// Aulas e eventos do calendário. O banco guarda só o cadastro-base
// (primeira data + regra de recorrência); as ocorrências de cada dia são
// calculadas na consulta (listarOcorrencias), então uma aula "todo sábado"
// é UMA linha no banco e aparece em todos os sábados do período pedido.
const db = require('../db');
const ErroApp = require('../utils/ErroApp');

const TIPOS = ['aula', 'evento'];
const RECORRENCIAS = ['nenhuma', 'semanal', 'mensal'];
const MAXIMO_DIAS_CONSULTA = 400; // evita consulta gigante por engano

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- Datas (sempre em UTC, para o fuso do servidor não deslocar o dia) ----------

function paraTimestamp(dataTexto) {
  const [ano, mes, dia] = dataTexto.split('-').map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

function paraTexto(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function dataValida(texto) {
  if (typeof texto !== 'string' || !REGEX_DATA.test(texto)) return false;
  return paraTexto(paraTimestamp(texto)) === texto; // rejeita 2026-02-31
}

function diasNoMes(ano, mesZeroBase) {
  return new Date(Date.UTC(ano, mesZeroBase + 1, 0)).getUTCDate();
}

const UM_DIA = 24 * 60 * 60 * 1000;

// ---------- Validação ----------

function limparTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarEMontar(dados) {
  const tipo = dados.tipo;
  if (!TIPOS.includes(tipo)) {
    throw new ErroApp('Escolha se é uma aula ou um evento.');
  }

  const titulo = limparTexto(dados.titulo);
  if (!titulo) throw new ErroApp('Informe o título.');
  if (titulo.length > 120) throw new ErroApp('O título pode ter no máximo 120 caracteres.');

  const responsavel = limparTexto(dados.responsavel);
  if (!responsavel) throw new ErroApp('Informe o nome do responsável.');
  if (responsavel.length > 120) throw new ErroApp('O nome do responsável pode ter no máximo 120 caracteres.');

  const descricao = limparTexto(dados.descricao);
  if (descricao.length > 500) throw new ErroApp('A descrição pode ter no máximo 500 caracteres.');

  if (!dataValida(dados.data_inicio)) throw new ErroApp('Informe uma data válida.');

  if (!REGEX_HORA.test(dados.hora_inicio || '')) throw new ErroApp('Informe o horário de início (HH:MM).');
  let horaFim = null;
  if (dados.hora_fim) {
    if (!REGEX_HORA.test(dados.hora_fim)) throw new ErroApp('Horário de término inválido (use HH:MM).');
    if (dados.hora_fim <= dados.hora_inicio) {
      throw new ErroApp('O horário de término precisa ser depois do horário de início.');
    }
    horaFim = dados.hora_fim;
  }

  let modalidadeId = null;
  if (tipo === 'aula' && dados.modalidade_id) {
    const modalidade = db.prepare('SELECT id FROM modalidades WHERE id = ?').get(dados.modalidade_id);
    if (!modalidade) throw new ErroApp('Modalidade não encontrada.');
    modalidadeId = modalidade.id;
  }

  const recorrencia = dados.recorrencia || 'nenhuma';
  if (!RECORRENCIAS.includes(recorrencia)) throw new ErroApp('Recorrência inválida.');

  let diasSemana = null;
  let recorrenciaAte = null;
  if (recorrencia !== 'nenhuma') {
    if (dados.recorrencia_ate) {
      if (!dataValida(dados.recorrencia_ate)) throw new ErroApp('Data final da recorrência inválida.');
      if (dados.recorrencia_ate < dados.data_inicio) {
        throw new ErroApp('A data final da recorrência não pode ser antes da data de início.');
      }
      recorrenciaAte = dados.recorrencia_ate;
    }
  }
  if (recorrencia === 'semanal') {
    const lista = Array.isArray(dados.dias_semana) ? dados.dias_semana : [];
    const dias = [...new Set(lista.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
    if (dias.length === 0) throw new ErroApp('Escolha ao menos um dia da semana.');
    diasSemana = dias.join(',');
  }

  return {
    tipo, titulo, responsavel, descricao: descricao || null,
    data_inicio: dados.data_inicio, hora_inicio: dados.hora_inicio, hora_fim: horaFim,
    modalidade_id: modalidadeId, recorrencia, dias_semana: diasSemana, recorrencia_ate: recorrenciaAte
  };
}

// ---------- CRUD ----------

function formatar(linha) {
  if (!linha) return null;
  return {
    ...linha,
    dias_semana: linha.dias_semana ? linha.dias_semana.split(',').map(Number) : []
  };
}

function existe(id) {
  return !!db.prepare('SELECT 1 FROM calendario_eventos WHERE id = ?').get(id);
}

function buscarPorId(id) {
  return formatar(db.prepare(`
    SELECT e.*, m.nome AS modalidade_nome
    FROM calendario_eventos e
    LEFT JOIN modalidades m ON m.id = e.modalidade_id
    WHERE e.id = ?
  `).get(id));
}

const COLUNAS = [
  'tipo', 'titulo', 'responsavel', 'modalidade_id', 'descricao', 'data_inicio',
  'hora_inicio', 'hora_fim', 'recorrencia', 'dias_semana', 'recorrencia_ate'
];

function criar(dados) {
  const v = validarEMontar(dados);
  const resultado = db
    .prepare(`INSERT INTO calendario_eventos (${COLUNAS.join(', ')}) VALUES (${COLUNAS.map(() => '?').join(', ')})`)
    .run(...COLUNAS.map((c) => v[c]));
  return resultado.lastInsertRowid;
}

function atualizar(id, dados) {
  const v = validarEMontar(dados);
  db.prepare(`UPDATE calendario_eventos SET ${COLUNAS.map((c) => `${c} = ?`).join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...COLUNAS.map((c) => v[c]), id);
}

function remover(id) {
  db.prepare('DELETE FROM calendario_eventos WHERE id = ?').run(id);
}

// ---------- Ocorrências por período ----------

// Datas (YYYY-MM-DD) em que o evento acontece dentro de [inicio, fim].
function datasDoEvento(evento, inicio, fim) {
  const datas = [];
  const primeiro = paraTimestamp(evento.data_inicio);
  const limiteInferior = Math.max(paraTimestamp(inicio), primeiro);
  let limiteSuperior = paraTimestamp(fim);
  if (evento.recorrencia_ate) limiteSuperior = Math.min(limiteSuperior, paraTimestamp(evento.recorrencia_ate));
  if (limiteInferior > limiteSuperior) return datas;

  if (evento.recorrencia === 'nenhuma') {
    datas.push(evento.data_inicio);
    return datas;
  }

  if (evento.recorrencia === 'semanal') {
    const dias = evento.dias_semana ? evento.dias_semana.split(',').map(Number) : [];
    for (let t = limiteInferior; t <= limiteSuperior; t += UM_DIA) {
      if (dias.includes(new Date(t).getUTCDay())) datas.push(paraTexto(t));
    }
    return datas;
  }

  // mensal: mesmo dia do mês (em meses mais curtos, cai no último dia)
  const diaDesejado = Number(evento.data_inicio.slice(8, 10));
  const inicioDoPeriodo = new Date(limiteInferior);
  let ano = inicioDoPeriodo.getUTCFullYear();
  let mes = inicioDoPeriodo.getUTCMonth();
  const ultimo = new Date(limiteSuperior);
  const anoFinal = ultimo.getUTCFullYear();
  const mesFinal = ultimo.getUTCMonth();
  while (ano < anoFinal || (ano === anoFinal && mes <= mesFinal)) {
    const dia = Math.min(diaDesejado, diasNoMes(ano, mes));
    const t = Date.UTC(ano, mes, dia);
    if (t >= limiteInferior && t <= limiteSuperior) datas.push(paraTexto(t));
    mes += 1;
    if (mes > 11) { mes = 0; ano += 1; }
  }
  return datas;
}

function listarOcorrencias(inicio, fim) {
  if (!dataValida(inicio) || !dataValida(fim)) {
    throw new ErroApp('Informe o período com datas válidas (início e fim).');
  }
  if (fim < inicio) throw new ErroApp('A data final não pode ser antes da inicial.');
  if ((paraTimestamp(fim) - paraTimestamp(inicio)) / UM_DIA > MAXIMO_DIAS_CONSULTA) {
    throw new ErroApp('Período grande demais para consulta.');
  }

  const eventos = db.prepare(`
    SELECT e.*, m.nome AS modalidade_nome
    FROM calendario_eventos e
    LEFT JOIN modalidades m ON m.id = e.modalidade_id
    WHERE e.data_inicio <= ?
      AND (e.recorrencia_ate IS NULL OR e.recorrencia_ate >= ?)
  `).all(fim, inicio);

  const ocorrencias = [];
  eventos.forEach((evento) => {
    datasDoEvento(evento, inicio, fim).forEach((data) => {
      ocorrencias.push({
        evento_id: evento.id,
        data,
        tipo: evento.tipo,
        titulo: evento.titulo,
        responsavel: evento.responsavel,
        modalidade_id: evento.modalidade_id,
        modalidade_nome: evento.modalidade_nome,
        hora_inicio: evento.hora_inicio,
        hora_fim: evento.hora_fim,
        recorrencia: evento.recorrencia
      });
    });
  });

  ocorrencias.sort((a, b) =>
    a.data.localeCompare(b.data) || a.hora_inicio.localeCompare(b.hora_inicio) || a.titulo.localeCompare(b.titulo)
  );
  return ocorrencias;
}

module.exports = { existe, buscarPorId, criar, atualizar, remover, listarOcorrencias };
