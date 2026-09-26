export const INTERVALO_ACOMPANHAMENTO_MS = 10_000;

// Uma consulta por vez; abas ocultas nao mantem timers nem fazem consultas.
export function iniciarAcompanhamento({ consultar, atualizar, erro, documento = document,
  agendar = setTimeout, cancelar = clearTimeout }) {
  let parado = false, executando = false, timer;
  const limpar = () => { cancelar(timer); timer = undefined; };
  function parar() {
    parado = true; limpar(); documento.removeEventListener('visibilitychange', visibilidade);
  }
  async function tick() {
    limpar();
    if (parado || executando || documento.hidden) return;
    executando = true;
    try {
      const pedido = await consultar();
      if (parado) return;
      atualizar(pedido);
      if (pedido.status === 'cancelado' || (pedido.status === 'entregue' && pedido.pagamento === 'pago')) parar();
    } catch (e) { if (!parado) erro(e); }
    finally {
      executando = false;
      if (!parado && !documento.hidden) timer = agendar(tick, INTERVALO_ACOMPANHAMENTO_MS);
    }
  }
  function visibilidade() { limpar(); if (!documento.hidden) void tick(); }
  documento.addEventListener('visibilitychange', visibilidade);
  void tick(); // Reconsulta confirmacoes finais salvas para mostrar estornos.
  return parar;
}
