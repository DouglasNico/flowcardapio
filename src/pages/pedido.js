import { escutarPedidoPublico } from "../lib/pedidos.js";
import { brl, erroAmigavel, esc } from "../lib/format.js";

const ROTULO = {
  novo: "Pedido enviado",
  em_preparo: "Na cozinha",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado"
};

export function renderPedido(app, { chave, pedidoId }) {
  app.innerHTML = `<p class="empty">Acompanhando pedido...</p>`;
  const stop = escutarPedidoPublico(pedidoId, (pedido) => {
    if (!pedido) {
      app.innerHTML = `<div class="closed-box"><h2>Pedido não encontrado</h2><p>Confira o link com a loja.</p></div>`;
      return;
    }
    const itens = (pedido.itens || []).map((i) => `<li>${esc(i.quantidade)}× ${esc(i.nome)}</li>`).join("");
    app.innerHTML = `
      <div class="menu-page">
        <header class="menu-head">
          <div>
            <h1>${esc(pedido.nomeLoja || "Pedido")}</h1>
            <small>${pedido.tipo === "mesa" ? `Mesa ${pedido.numeroMesa}` : "Retirada"}</small>
          </div>
        </header>
        <div class="closed-box">
          <p class="badge ${pedido.status || "novo"}">${ROTULO[pedido.status] || pedido.status}</p>
          <ul class="pedido-itens" style="text-align:left;display:inline-block;margin-top:12px">${itens}</ul>
          <p><strong>${brl(pedido.total)}</strong></p>
          <p><a href="/${chave}${pedido.numeroMesa ? `/mesa/${pedido.numeroMesa}` : ""}">Pedir de novo</a></p>
        </div>
      </div>
    `;
  }, (err) => {
    app.innerHTML = `<div class="closed-box"><h2>Não foi possível acompanhar</h2><p>${erroAmigavel(err)}</p></div>`;
  });
  return () => stop && stop();
}
