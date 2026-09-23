import { esc } from "./format.js";
import { ico } from "./icons.js";

export function horaPedido(iso) {
  const d = new Date(iso || "");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function extrasItem(i) {
  if (Array.isArray(i && i.extras) && i.extras.length) {
    return i.extras.map((e) => {
      const q = Number(e.quantidade) || 1;
      const nome = String(e.nome || "").trim();
      if (!nome) return "";
      return q > 1 ? `${q}× ${nome}` : nome;
    }).filter(Boolean);
  }
  return String((i && i.detalhe) || "")
    .split(/[,·]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function htmlLinhaItem(i, { semFoto = false } = {}) {
  const extras = extrasItem(i);
  const foto = i && i.fotoUrl;
  return `
    <li class="pi${semFoto ? " pi-cozinha" : ""}">
      ${semFoto ? "" : foto
        ? `<img class="pi-foto" src="${esc(foto)}" alt="">`
        : `<div class="pi-foto ph">${ico.photo}</div>`}
      <div class="pi-copy">
        <strong>${esc(i.quantidade)}× ${esc(i.nome)}</strong>
        ${extras.map((x) => `<small>${esc(x)}</small>`).join("")}
        ${i.observacao ? `<small class="pi-obs">Obs.: ${esc(i.observacao)}</small>` : ""}
      </div>
    </li>`;
}

export function guardarPedidoLocal(pedido) {
  if (!pedido || !pedido.id) return;
  try {
    sessionStorage.setItem(`flowpdv_pedido_${pedido.id}`, JSON.stringify(pedido));
  } catch { /* ignore */ }
}

export function lerPedidoLocal(id) {
  try {
    return JSON.parse(sessionStorage.getItem(`flowpdv_pedido_${id}`) || "null");
  } catch {
    return null;
  }
}
