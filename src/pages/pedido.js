import { escutarPedidoPublico } from "../lib/pedidos.js";
import { brl, erroAmigavel, esc } from "../lib/format.js";

const PASSOS = [
  { id: "novo", label: "Enviado" },
  { id: "em_preparo", label: "Na cozinha" },
  { id: "pronto", label: "Pronto" },
  { id: "entregue", label: "Entregue" }
];

const ROTULO = {
  novo: "Pedido enviado",
  em_preparo: "Na cozinha",
  pronto: "Pronto para retirar / servir",
  entregue: "Entregue",
  cancelado: "Cancelado"
};

function indiceStatus(status) {
  const i = PASSOS.findIndex((p) => p.id === status);
  return i < 0 ? 0 : i;
}

export function renderPedido(app, { chave, pedidoId }) {
  document.body.className = "is-menu";
  app.innerHTML = `<div class="menu-frame"><p class="empty">Acompanhando pedido...</p></div>`;
  const stop = escutarPedidoPublico(pedidoId, (pedido) => {
    if (!pedido) {
      app.innerHTML = `<div class="menu-frame"><div class="closed-box"><h2>Pedido não encontrado</h2><p>Confira o link com a loja.</p></div></div>`;
      return;
    }
    document.title = `${pedido.nomeLoja || "Pedido"} · ${ROTULO[pedido.status] || "Pedido"}`;
    const cancelado = pedido.status === "cancelado";
    const idx = indiceStatus(pedido.status);
    const itens = (pedido.itens || []).map((i) => {
      const detalhe = i.detalhe || "";
      const obs = i.observacao || "";
      return `<li>
        <span>${esc(i.quantidade)}× ${esc(i.nome)}</span>
        ${detalhe ? `<small>${esc(detalhe)}</small>` : ""}
        ${obs ? `<small>${esc(obs)}</small>` : ""}
      </li>`;
    }).join("");
    const voltar = `/${chave}${pedido.numeroMesa ? `/mesa/${pedido.numeroMesa}` : ""}`;
    app.innerHTML = `
      <div class="menu-frame">
        <div class="menu-page track-page">
          <header class="store-head">
            <h1>${esc(pedido.nomeLoja || "Pedido")}</h1>
            <p>${pedido.tipo === "mesa" ? `Mesa ${esc(pedido.numeroMesa)}` : "Retirada no balcão"}</p>
          </header>
          <div class="track-card">
            <p class="badge ${esc(pedido.status || "novo")}">${esc(ROTULO[pedido.status] || pedido.status)}</p>
            ${cancelado ? "" : `
              <ol class="steps">
                ${PASSOS.map((p, i) => `<li class="${i <= idx ? "done" : ""}">${esc(p.label)}</li>`).join("")}
              </ol>
            `}
            <ul class="pedido-itens track-itens">${itens}</ul>
            <p class="track-total"><strong>${brl(pedido.total)}</strong></p>
            <a class="btn-primary" href="${esc(voltar)}">Pedir de novo</a>
          </div>
        </div>
      </div>
    `;
  }, (err) => {
    app.innerHTML = `<div class="menu-frame"><div class="closed-box"><h2>Não foi possível acompanhar</h2><p>${erroAmigavel(err)}</p></div></div>`;
  });
  return () => stop && stop();
}
