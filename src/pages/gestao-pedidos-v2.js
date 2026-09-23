const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = value => Number.isSafeInteger(value) ? (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informado';
const states = { novo: 'Novo', em_preparo: 'Em preparo', pronto: 'Pronto', saiu_entrega: 'Saiu para entrega', entregue: 'Entregue', cancelado: 'Cancelado' };
const payments = { pendente: 'Pendente', pago: 'Pago', estornado: 'Estornado' };
export function renderPedidosGestao(host, read, valid) {
  host.innerHTML = '<header class="page-head"><div><h2>Pedidos</h2><p>Acompanhe os pedidos mais recentes. O preparo, a entrega e o pagamento continuam nos terminais responsáveis.</p></div><button type="button" class="btn-ghost g-orders-refresh">Atualizar pedidos</button></header><p class="g-orders-status" role="status"></p><div class="g-orders-list"></div><button type="button" class="btn-ghost g-orders-more" hidden>Carregar mais pedidos</button>';
  const list = host.querySelector('.g-orders-list'), status = host.querySelector('.g-orders-status'), refresh = host.querySelector('.g-orders-refresh'), more = host.querySelector('.g-orders-more');
  let loading = false, loaded = false, cursor = null, count = 0;
  const alive = () => valid() && host.isConnected;
  async function load(reset) {
    if (loading || !alive()) return;
    loading = true; refresh.disabled = more.disabled = true;
    status.textContent = 'Consultando pedidos…';
    try {
      const page = await read(reset ? null : cursor);
      if (!alive()) return;
      if (reset) { list.replaceChildren(); count = 0; }
      for (const order of page.pedidos) {
        if ([...list.children].some(row => row.dataset.id === order.id)) continue;
        const row = document.createElement('article'); row.className = 'g-order'; row.dataset.id = order.id;
        const channel = { mesa: 'Mesa', retirada: 'Retirada', delivery: 'Delivery' }[order.tipo] || order.tipo || 'Pedido';
        const date = order.criadoEm ? new Date(order.criadoEm).toLocaleString('pt-BR') : 'Data não informada';
        row.innerHTML = `<header><div><h3>${esc(channel)}${order.mesaNome ? ' · ' + esc(order.mesaNome) : ''}</h3><small>${esc(date)}</small></div><strong>${money(order.totalCentavos)}</strong></header><p>${esc(states[order.status] || order.status || 'Estado não informado')} · Pagamento: ${esc(payments[order.pagamento] || order.pagamento)}</p><p>${order.recebidoPdv ? 'Recebido no PDV' : 'Aguardando recebimento no PDV'}</p><details><summary>Ver itens e identificação</summary><p class="g-order-id">Pedido ${esc(order.id)}</p><ul>${order.itens.map(item => `<li>${esc(item.quantidade)} × ${esc(item.nome)} <span>${money(item.totalCentavos)}</span></li>`).join('')}</ul></details>`;
        list.append(row); count++;
      }
      cursor = page.proximo; more.hidden = !cursor; loaded = true;
      status.textContent = count ? `${count} ${count === 1 ? 'pedido carregado' : 'pedidos carregados'}. Use Atualizar pedidos para consultar mudanças.` : 'Nenhum pedido encontrado.';
    } catch (e) {
      if (!alive()) return;
      if (['functions/permission-denied', 'functions/unauthenticated'].includes(e.code)) { list.replaceChildren(); count = 0; cursor = null; more.hidden = true; loaded = false; status.textContent = 'Seu acesso aos pedidos não está autorizado. Entre novamente ou confira a permissão da loja.'; }
      else status.textContent = 'Não foi possível consultar os pedidos. A lista pode estar desatualizada; tente atualizar novamente.';
    } finally { loading = false; if (alive()) refresh.disabled = more.disabled = false; }
  }
  refresh.onclick = () => load(true); more.onclick = () => load(false);
  return { show: () => { if (!loaded) load(true); } };
}
