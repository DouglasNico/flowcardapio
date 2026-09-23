import "./styles.css";
import { lerSessaoLocal, loginGestor } from "./lib/auth.js";
import { normalizarChave } from "./lib/chave.js";
import { renderLogin } from "./pages/login.js";
import { renderPainel } from "./pages/painel.js";
import { renderCardapio } from "./pages/cardapio.js";
import { renderPedido } from "./pages/pedido.js";

const app = document.getElementById("app");
let cleanup = null;

function parseRota(pathname) {
  const p = decodeURIComponent(pathname).replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/painel") return { name: "painel" };
  const pedido = p.match(/^\/([^/]+)\/pedido\/([^/]+)$/);
  if (pedido) return { name: "pedido", chave: normalizarChave(pedido[1]), pedidoId: pedido[2] };
  const itemMesa = p.match(/^\/([^/]+)\/mesa\/(\d+)\/item\/([^/]+)$/);
  if (itemMesa) {
    return {
      name: "cardapio",
      chave: normalizarChave(itemMesa[1]),
      mesa: Number(itemMesa[2]),
      itemId: decodeURIComponent(itemMesa[3])
    };
  }
  const mesa = p.match(/^\/([^/]+)\/mesa\/(\d+)$/);
  if (mesa) return { name: "cardapio", chave: normalizarChave(mesa[1]), mesa: Number(mesa[2]) };
  const itemLoja = p.match(/^\/([^/]+)\/item\/([^/]+)$/);
  if (itemLoja && itemLoja[1].toUpperCase() !== "PAINEL") {
    return {
      name: "cardapio",
      chave: normalizarChave(itemLoja[1]),
      mesa: null,
      itemId: decodeURIComponent(itemLoja[2])
    };
  }
  const loja = p.match(/^\/([^/]+)$/);
  if (loja && loja[1].toUpperCase() !== "PAINEL") {
    return { name: "cardapio", chave: normalizarChave(loja[1]), mesa: null };
  }
  return { name: "painel" };
}

async function sessaoPainel() {
  const local = lerSessaoLocal();
  if (!local) return null;
  try {
    return await loginGestor(local.chave, local.pin, true);
  } catch {
    return null;
  }
}

async function render() {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
  if (/^\/gestao-v2\/?$/.test(location.pathname)) {
    const { renderGestaoV2 } = await import('./pages/gestao-v2.js');
    cleanup = await renderGestaoV2(app) || null;
    return;
  }
  if (/^\/v2\/[a-z0-9-]+\/garcom\/?$/.test(location.pathname)) {
    const { renderGarcomV2 } = await import('./pages/garcom-v2.js');
    cleanup = await renderGarcomV2(app) || null;
    return;
  }
  if (location.pathname.startsWith('/v2/')) {
    const { renderCardapioV2 } = await import('./pages/cardapio-v2.js');
    cleanup = await renderCardapioV2(app) || null;
    return;
  }
  const rota = parseRota(location.pathname);
  document.body.className = "";
  document.title = rota.name === "painel" ? "Painel · FlowPDV Cardápio" : "Cardápio · FlowPDV";

  if (rota.name === "cardapio") {
    cleanup = await renderCardapio(app, rota) || null;
    return;
  }
  if (rota.name === "pedido") {
    cleanup = renderPedido(app, rota) || null;
    return;
  }

  const sessao = await sessaoPainel();
  if (!sessao) {
    document.body.className = "is-painel";
    renderLogin(app);
    return;
  }
  await renderPainel(app, sessao);
}

window.addEventListener("popstate", render);
window.addEventListener("flowpdv:route", render);
render();
