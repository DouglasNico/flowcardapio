import { escutarPedidoPublico } from "../lib/pedidos.js";
import { brl, erroAmigavel, esc } from "../lib/format.js";
import { ico } from "../lib/icons.js";
import { CANAL_LOJA } from "../lib/loja.js";
import { guardarPedidoLocal, htmlLinhaItem, lerPedidoLocal } from "../lib/pedido-ui.js";

const PASSOS = [
  { id: "novo", label: "Pedido enviado" },
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

const AJUDA = {
  novo: "A loja já recebeu o seu pedido.",
  em_preparo: "A cozinha está preparando agora.",
  pronto: "Pode retirar no balcão ou aguardar na mesa.",
  entregue: "Pedido concluído. Bom apetite!",
  cancelado: "Este pedido foi cancelado pela loja."
};

function indiceStatus(status) {
  const i = PASSOS.findIndex((p) => p.id === status);
  return i < 0 ? 0 : i;
}

export function renderPedido(app, { chave, pedidoId }) {
  document.body.className = "is-menu";
  let desenhado = false;
  let timerNotFound = null;

  function pintar(pedido) {
    if (!pedido) return;
    desenhado = true;
    if (timerNotFound) {
      clearTimeout(timerNotFound);
      timerNotFound = null;
    }
    guardarPedidoLocal(pedido);
    const rotulo = pedido.tipo === "delivery" && pedido.status === "pronto" ? "Pronto para entrega" : ROTULO[pedido.status] || pedido.status || "Pedido";
    document.title = `${pedido.nomeLoja || "Pedido"} · ${rotulo}`;
    const cancelado = pedido.status === "cancelado";
    const idx = indiceStatus(pedido.status);
    const voltar = `/${chave}${pedido.numeroMesa ? `/mesa/${pedido.numeroMesa}` : ""}`;
    const canal = pedido.tipo === "mesa" ? `Mesa ${pedido.numeroMesa}` : pedido.tipo === "delivery" ? "Entrega em casa" : "Retirada na loja";
    const itens = (pedido.itens || []).map((i) => htmlLinhaItem(i)).join("");
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
            <p class="badge ${esc(pedido.status || "novo")}">${esc(rotulo)}</p>
            <h2 class="track-title">${esc(pedido.tipo==="delivery" && pedido.status==="pronto" ? "Pedido pronto. Aguarde a entrega da loja." : AJUDA[pedido.status] || "Acompanhe o andamento.")}</h2>
            <p class="track-id">Pedido ${esc(String(pedido.id || pedidoId || "").replace(/^PED-/, "").slice(-6).toUpperCase())}</p>
            ${cancelado ? "" : `
              <ol class="steps">
                ${PASSOS.map((p, i) => `<li class="${i < idx ? "done" : i === idx ? "now" : ""}">${esc(p.label)}</li>`).join("")}
              </ol>
            `}
            <ul class="track-itens">${itens}</ul>
            ${pedido.tipo==="delivery"?`<p class="track-taxa">Entrega: ${brl(pedido.taxaEntrega||0)} · incluída no total</p>`:""}<div class="track-total"><span>Total</span><strong>${brl(pedido.total)}</strong></div>
            <a class="btn-primary" href="${esc(voltar)}">${ico.back} Pedir de novo</a>
          </div>
        </div>
      </div>
    `;
  }

  const cached = lerPedidoLocal(pedidoId);
  if (cached) pintar(cached);
  else {
    app.innerHTML = `<div class="menu-frame"><p class="empty">Acompanhando pedido...</p></div>`;
  }

  timerNotFound = setTimeout(() => {
    if (!desenhado) {
      app.innerHTML = `<div class="menu-frame"><div class="closed-box"><h2>Pedido não encontrado</h2><p>Confira o link com a loja.</p></div></div>`;
    }
  }, 8000);

  const stop = escutarPedidoPublico(pedidoId, (pedido) => {
    if (!pedido) return;
    pintar(pedido);
  }, (err) => {
    if (desenhado) return;
    app.innerHTML = `<div class="menu-frame"><div class="closed-box"><h2>Não foi possível acompanhar</h2><p>${erroAmigavel(err)}</p></div></div>`;
  });

  return () => {
    if (timerNotFound) clearTimeout(timerNotFound);
    if (stop) stop();
  };
}
