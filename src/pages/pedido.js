import { escutarPedidoPublico } from "../lib/pedidos.js";
import { brl, erroAmigavel, esc } from "../lib/format.js";
import { ico } from "../lib/icons.js";

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
    const canal = pedido.tipo === "mesa" ? `Mesa ${pedido.numeroMesa}` : "Retirada no balcão";
    app.innerHTML = `
      <div class="menu-frame">
        <div class="menu-page track-page">
          <header class="store-head">
            <div class="store-row">
              <div class="store-meta">
                <h1>${esc(pedido.nomeLoja || "Pedido")}</h1>
                <p class="store-end">${esc(canal)}</p>
              </div>
            </div>
          </header>
          <div class="track-card">
            <p class="badge ${esc(pedido.status || "novo")}">${esc(ROTULO[pedido.status] || pedido.status)}</p>
            <p class="track-id">Pedido ${esc(String(pedido.id || "").slice(-6).toUpperCase())}</p>
            ${cancelado ? "" : `
              <ol class="steps">
                ${PASSOS.map((p, i) => `<li class="${i < idx ? "done" : i === idx ? "now" : ""}">${esc(p.label)}</li>`).join("")}
              </ol>
            `}
            <ul class="track-itens">${itens}</ul>
            <div class="track-total"><span>Total</span><strong>${brl(pedido.total)}</strong></div>
            <a class="btn-primary" href="${esc(voltar)}">${ico.back} Pedir de novo</a>
          </div>
        </div>
      </div>
    `;
  }, (err) => {
    app.innerHTML = `<div class="menu-frame"><div class="closed-box"><h2>Não foi possível acompanhar</h2><p>${erroAmigavel(err)}</p></div></div>`;
  });
  return () => stop && stop();
}
