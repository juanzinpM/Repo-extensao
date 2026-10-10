// public/erros.js
//
// Toda chamada à API do frontend deve passar por aqui, pra ter
// tratamento de erro consistente em todas as telas — incluindo o modal
// de erro, que esse arquivo cria sozinho em qualquer página que o inclua.
//
// Uso:
//   try {
//     const dados = await chamarApi('/api/alunos', { method: 'POST', ... });
//   } catch (erro) {
//     mostrarErro(erro.message);
//   }

async function chamarApi(url, opcoes) {
  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch (erroDeRede) {
    throw new Error('Não foi possível conectar ao servidor. Verifique se ele está ligado e se você está na mesma rede.');
  }

  let dados = null;
  try {
    dados = await resposta.json();
  } catch (erroDeLeitura) {
    // Resposta sem corpo JSON válido (ex: erro cru do servidor) — segue sem "dados".
  }

  if (!resposta.ok) {
    throw new Error((dados && dados.erro) || 'Ocorreu um erro inesperado.');
  }

  return dados;
}

// ---------- Modal de erro ----------
// Criado automaticamente assim que esse script carrega.
(function criarModalErro() {
  const modal = document.createElement('div');
  modal.id = 'modalErro';
  modal.style.cssText = `
    display: none; position: fixed; inset: 0; background: rgba(42,37,35,0.45);
    align-items: center; justify-content: center; z-index: 1000; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
  `;
  modal.innerHTML = `
    <div style="background:#fff; border-radius:10px; padding:22px; width:320px; max-width:90vw; box-shadow:0 4px 24px rgba(0,0,0,0.18);">
      <strong style="font-size:14px; color:#A32D2D;">Ops, algo deu errado</strong>
      <p id="modalErroMensagem" style="font-size:13px; color:#2A2523; margin:10px 0 16px; line-height:1.45;"></p>
      <button id="modalErroFechar" style="background:#DB5A61; color:#fff; border:none; border-radius:6px; padding:8px 16px; font-size:13px; cursor:pointer;">Fechar</button>
    </div>
  `;

  function montar() {
    document.body.appendChild(modal);
  }
  if (document.body) {
    montar();
  } else {
    window.addEventListener('DOMContentLoaded', montar);
  }

  document.addEventListener('click', (evento) => {
    if (evento.target.id === 'modalErroFechar' || evento.target.id === 'modalErro') {
      modal.style.display = 'none';
    }
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') modal.style.display = 'none';
  });
})();

function mostrarErro(mensagem) {
  const modal = document.getElementById('modalErro');
  if (!modal) return; // segurança, caso chamem antes do body existir
  document.getElementById('modalErroMensagem').textContent = mensagem;
  modal.style.display = 'flex';
}
