// public/layout.js
// Monta as partes fixas de qualquer página protegida: aviso de ambiente
// de teste, nome do usuário logado na topbar e botão de sair.
// Depende de chamarApi()/mostrarErro() (vem de /erros.js — inclua os dois
// scripts nessa ordem). Cada página chama iniciarLayout() no fim do seu
// próprio script de inicialização.

async function iniciarLayout() {
  try {
    const ambiente = await chamarApi('/api/ambiente');
    const aviso = document.getElementById('avisoAmbiente');
    if (aviso) aviso.style.display = ambiente.ambiente === 'teste' ? 'block' : 'none';

    const sessao = await chamarApi('/api/sessao');
    if (!sessao.logado) {
      window.location.href = '/login.html';
      return;
    }

    const nomeEl = document.getElementById('nomeUsuario');
    if (nomeEl) nomeEl.textContent = sessao.nome;

    const avatarEl = document.getElementById('avatarInicial');
    if (avatarEl) avatarEl.textContent = (sessao.nome || '?').trim().charAt(0).toUpperCase();
  } catch (erro) {
    mostrarErro(erro.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const botaoSair = document.getElementById('botaoSair');
  if (!botaoSair) return;
  botaoSair.addEventListener('click', async () => {
    try {
      await chamarApi('/api/logout', { method: 'POST' });
      window.location.href = '/login.html';
    } catch (erro) {
      mostrarErro(erro.message);
    }
  });
});
