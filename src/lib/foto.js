import { esc } from "./format.js";

function limitar(valor, min, max, padrao) {
  const n = typeof valor === "number" ? valor : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
}

// Fotos antigas continuam preenchendo o cartão até a loja escolher outro ajuste.
export function normalizarEnquadramento(valor) {
  const v = valor && typeof valor === "object" ? valor : {};
  const modo = v.modo === "inteira" ? "inteira" : "preencher";
  return {
    modo,
    zoom: limitar(v.zoom, 1, 3, 1),
    x: modo === "inteira" ? 50 : limitar(v.x, 0, 100, 50),
    y: modo === "inteira" ? 50 : limitar(v.y, 0, 100, 50)
  };
}

export function estiloEnquadramento(valor) {
  const e = normalizarEnquadramento(valor);
  return `--foto-zoom:${e.zoom};--foto-x:${e.x}%;--foto-y:${e.y}%`;
}

export function htmlFoto(produto) {
  const e = normalizarEnquadramento(produto.fotoEnquadramento);
  const url = esc(produto.fotoUrl);
  return `<span class="foto-produto" data-modo="${e.modo}" style="${estiloEnquadramento(e)}" aria-hidden="true">
    ${e.modo === "inteira" ? `<img class="foto-fundo" src="${url}" alt="" draggable="false">` : ""}
    <img class="foto-frente" src="${url}" alt="" draggable="false">
  </span>`;
}
