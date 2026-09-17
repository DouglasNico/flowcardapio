import QRCode from "qrcode";
import { nomeDaLoja, sairDaLoja } from "../lib/auth.js";
import { carregarBackupLoja, precoProduto, produtoAtivo } from "../lib/backup.js";
import {
  assinarUpload,
  enviarFotoCloudinary,
  lerConfig,
  listarOverlays,
  publicarCardapio,
  removerFoto,
  salvarConfig,
  salvarOverlay
} from "../lib/overlay.js";
import { atualizarStatusPedido, escutarPedidosLoja } from "../lib/pedidos.js";
import { brl, erroAmigavel, originPublico, esc } from "../lib/format.js";

function toast(texto) {
  const el = document.createElement("div");
  el.className = "app-toast";
  el.textContent = texto;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    o.start();
    o.stop(ctx.currentTime + 0.16);
  } catch { /* ignore */ }
}

function proximoStatus(status) {
  if (status === "novo") return "em_preparo";
  if (status === "em_preparo") return "pronto";
  if (status === "pronto") return "entregue";
  return null;
}

function rotuloStatus(status) {
  return ({
    novo: "Novo",
    em_preparo: "Em preparo",
    pronto: "Pronto",
    entregue: "Entregue",
    cancelado: "Cancelado"
  })[status] || status;
}

export async function renderPainel(app, sessao) {
  const { chave, licenca } = sessao;
  let aba = "cardapio";
  let produtos = [];
  let overlays = {};
  let config = {};
  let filtro = "";
  let unsubPedidos = null;
  let pedidos = [];
  let conhecidos = new Set();
  let primeiroSnap = true;

  app.innerHTML = `
    <div class="painel-shell">
      <header class="painel-top">
        <div class="painel-brand">
          <img src="/logos/FlowPDV-horizontal-claro.png" alt="FlowPDV">
          <div class="meta">
            <strong>${esc(nomeDaLoja(licenca))}</strong>
            <small>${chave}</small>
          </div>
        </div>
        <nav class="tabs">
          <button type="button" data-aba="cardapio" class="on">Cardápio</button>
          <button type="button" data-aba="pedidos">Pedidos</button>
          <button type="button" data-aba="qr">QR das mesas</button>
        </nav>
        <button class="btn-ghost" id="btn-sair" type="button">Sair</button>
      </header>
      <main class="painel-body" id="painel-main"></main>
    </div>
  `;

  const main = app.querySelector("#painel-main");

  app.querySelector("#btn-sair").addEventListener("click", async () => {
    if (unsubPedidos) unsubPedidos();
    await sairDaLoja();
    history.replaceState({}, "", "/painel");
    window.dispatchEvent(new Event("flowpdv:route"));
  });

  app.querySelectorAll(".tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      aba = btn.dataset.aba;
      app.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b === btn));
      pintar();
    });
  });

  async function carregar() {
    main.innerHTML = `<p class="empty">Carregando produtos do PDV...</p>`;
    try {
      const [backup, overlayMap, cfg] = await Promise.all([
        carregarBackupLoja(chave),
        listarOverlays(chave).catch(() => ({})),
        lerConfig(chave).catch(() => ({}))
      ]);
      overlays = overlayMap;
      config = cfg;
      produtos = (backup.produtos || []).filter(produtoAtivo);
      pintar();
    } catch (err) {
      main.innerHTML = `<p class="empty">${erroAmigavel(err)}</p>`;
    }
  }

  function produtosFiltrados() {
    const q = filtro.trim().toLowerCase();
    return produtos.filter((p) => {
      if (!q) return true;
      return `${p.nome || ""} ${p.categoria || ""} ${p.codigoBarras || ""}`.toLowerCase().includes(q);
    });
  }

  async function toggleVisivel(id, visivel) {
    overlays[id] = { ...(overlays[id] || {}), visivel };
    await salvarOverlay(chave, id, { visivel });
    pintar();
  }

  async function toggleEsgotado(id, esgotado) {
    overlays[id] = { ...(overlays[id] || {}), esgotado };
    await salvarOverlay(chave, id, { esgotado });
    pintar();
  }

  async function salvarDescricao(id, descricao) {
    overlays[id] = { ...(overlays[id] || {}), descricao };
    await salvarOverlay(chave, id, { descricao });
  }

  async function onFoto(id, file) {
    if (!file) return;
    try {
      const oldId = overlays[id] && overlays[id].fotoPublicId;
      const assinatura = await assinarUpload(chave, id);
      const up = await enviarFotoCloudinary(file, assinatura);
      if (oldId && oldId !== up.public_id) {
        try { await removerFoto(chave, id, oldId); } catch { /* troca segue mesmo se o destroy falhar */ }
      }
      overlays[id] = {
        ...(overlays[id] || {}),
        visivel: overlays[id] ? overlays[id].visivel !== false : true,
        fotoUrl: up.secure_url,
        fotoPublicId: up.public_id
      };
      await salvarOverlay(chave, id, overlays[id]);
      toast("Foto enviada.");
      pintar();
    } catch (err) {
      toast(erroAmigavel(err));
    }
  }

  async function onRemoverFoto(id) {
    const publicId = overlays[id] && overlays[id].fotoPublicId;
    if (!publicId) return;
    try {
      await removerFoto(chave, id, publicId);
      overlays[id] = { ...(overlays[id] || {}), fotoUrl: "", fotoPublicId: "" };
      toast("Foto apagada no Cloudinary.");
      pintar();
    } catch (err) {
      toast(erroAmigavel(err));
    }
  }

  function pintarCardapio() {
    const visiveis = produtos.filter((p) => overlays[p.id] && overlays[p.id].visivel).length;
    main.innerHTML = `
      <div class="toolbar">
        <input type="search" id="busca" placeholder="Buscar produto">
        <label class="switch">
          <input type="checkbox" id="pausado" ${config.pausado ? "checked" : ""}>
          Pausar cardápio
        </label>
        <button class="btn-primary" id="btn-publicar" type="button" style="width:auto">Publicar cardápio (${visiveis})</button>
      </div>
      <div class="card" id="lista"></div>
    `;
    const busca = main.querySelector("#busca");
    busca.value = filtro;
    busca.addEventListener("input", () => { filtro = busca.value; pintarLista(); });
    main.querySelector("#pausado").addEventListener("change", async (ev) => {
      config.pausado = ev.target.checked;
      try {
        await salvarConfig(chave, { pausado: config.pausado });
        toast(config.pausado ? "Cardápio pausado." : "Cardápio aberto.");
      } catch (err) { toast(erroAmigavel(err)); }
    });
    main.querySelector("#btn-publicar").addEventListener("click", async (ev) => {
      ev.target.disabled = true;
      ev.target.textContent = "Publicando...";
      try {
        await publicarCardapio(chave);
        toast("Cardápio publicado. O QR já pode abrir.");
      } catch (err) {
        toast(erroAmigavel(err));
      } finally {
        ev.target.disabled = false;
        ev.target.textContent = `Publicar cardápio (${visiveis})`;
      }
    });
    pintarLista();
  }

  function pintarLista() {
    const lista = main.querySelector("#lista");
    if (!lista) return;
    const rows = produtosFiltrados();
    if (!rows.length) {
      lista.innerHTML = `<p class="empty">Nenhum produto no backup do PDV. Cadastre no caixa e sincronize.</p>`;
      return;
    }
    lista.innerHTML = rows.map((p) => {
      const ov = overlays[p.id] || {};
      const foto = ov.fotoUrl ? `<img class="thumb" src="${ov.fotoUrl}" alt="">` : `<div class="thumb">FOTO</div>`;
      return `
        <article class="prod-row" data-id="${p.id}">
          ${foto}
          <div>
            <h3>${esc(p.nome || "Sem nome")}</h3>
            <div class="cat">${esc(p.categoria || "Geral")} · ${brl(precoProduto(p))}</div>
            <textarea data-desc placeholder="Descrição no cardápio"></textarea>
          </div>
          <div class="actions">
            <label class="switch"><input type="checkbox" data-visivel ${ov.visivel ? "checked" : ""}> No cardápio</label>
            <label class="switch"><input type="checkbox" data-esgotado ${ov.esgotado ? "checked" : ""}> Esgotado</label>
            <label class="btn-ghost file-btn">Foto<input type="file" accept="image/jpeg,image/png,image/webp"></label>
            ${ov.fotoPublicId ? `<button type="button" class="btn-ghost" data-del-foto>Apagar foto</button>` : ""}
          </div>
        </article>
      `;
    }).join("");

    lista.querySelectorAll(".prod-row").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector("[data-visivel]").addEventListener("change", (ev) => toggleVisivel(id, ev.target.checked));
      row.querySelector("[data-esgotado]").addEventListener("change", (ev) => toggleEsgotado(id, ev.target.checked));
      row.querySelector('input[type="file"]').addEventListener("change", (ev) => {
        const file = ev.target.files && ev.target.files[0];
        onFoto(id, file);
        ev.target.value = "";
      });
      const del = row.querySelector("[data-del-foto]");
      if (del) del.addEventListener("click", () => onRemoverFoto(id));
      row.querySelector("[data-desc]").value = (overlays[id] && overlays[id].descricao) || "";
      let t;
      row.querySelector("[data-desc]").addEventListener("input", (ev) => {
        clearTimeout(t);
        t = setTimeout(() => salvarDescricao(id, ev.target.value), 500);
      });
    });
  }

  function garantirPedidos() {
    if (unsubPedidos) return;
    unsubPedidos = escutarPedidosLoja(chave, (lista) => {
      if (!primeiroSnap) {
        const novos = lista.filter((p) => p.status === "novo" && !conhecidos.has(p.id));
        if (novos.length) beep();
      }
      conhecidos = new Set(lista.map((p) => p.id));
      primeiroSnap = false;
      pedidos = lista;
      if (aba === "pedidos") pintarPedidos();
    }, (err) => {
      if (aba === "pedidos") main.innerHTML = `<p class="empty">${erroAmigavel(err)}</p>`;
    });
  }

  function pintarPedidos() {
    garantirPedidos();
    if (!pedidos.length) {
      main.innerHTML = `<p class="empty">Nenhum pedido ainda. Publique o cardápio e teste o QR.</p>`;
      return;
    }
    main.innerHTML = pedidos.map((p) => {
      const prox = proximoStatus(p.status);
      const itens = (p.itens || []).map((i) => `<li>${esc(i.quantidade)}× ${esc(i.nome)}${i.observacao ? ` — ${esc(i.observacao)}` : ""}</li>`).join("");
      const onde = p.tipo === "mesa" ? `Mesa ${p.numeroMesa}` : "Retirada";
      return `
        <article class="pedido">
          <header>
            <strong>${onde} · ${brl(p.total)}</strong>
            <span class="badge ${p.status || "novo"}">${rotuloStatus(p.status)}</span>
          </header>
          <ul class="pedido-itens">${itens}</ul>
          <div class="pedido-btns">
            ${prox ? `<button class="btn-primary" data-st="${prox}" data-id="${p.id}" style="width:auto">${rotuloStatus(prox)}</button>` : ""}
            ${p.status !== "cancelado" && p.status !== "entregue" ? `<button class="btn-ghost" data-st="cancelado" data-id="${p.id}">Cancelar</button>` : ""}
          </div>
        </article>
      `;
    }).join("");
    main.querySelectorAll("[data-st]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await atualizarStatusPedido(chave, btn.dataset.id, btn.dataset.st);
        } catch (err) { toast(erroAmigavel(err)); }
      });
    });
  }

  async function pintarQr() {
    main.innerHTML = `
      <div class="qr-grid">
        <div class="card">
          <label>Número da mesa</label>
          <div class="toolbar" style="margin:8px 0 0">
            <input type="number" id="mesa-n" min="1" value="1">
            <button class="btn-primary" id="btn-qr" type="button" style="width:auto">Gerar QR</button>
          </div>
          <p class="qr-link" id="qr-link"></p>
        </div>
        <div class="card" id="qr-box"><p class="empty">Escolha a mesa e gere o QR para colar na mesa.</p></div>
      </div>
    `;
    const gerar = async () => {
      const n = Math.max(1, parseInt(main.querySelector("#mesa-n").value, 10) || 1);
      const url = `${originPublico()}/${chave}/mesa/${n}`;
      main.querySelector("#qr-link").textContent = url;
      const dataUrl = await QRCode.toDataURL(url, { width: 440, margin: 1 });
      main.querySelector("#qr-box").innerHTML = `<img src="${dataUrl}" alt="QR mesa ${n}"><p>Mesa ${n}</p><p class="qr-link">${url}</p>`;
    };
    main.querySelector("#btn-qr").addEventListener("click", gerar);
    await gerar();
  }

  function pintar() {
    if (aba === "cardapio") pintarCardapio();
    else if (aba === "pedidos") pintarPedidos();
    else pintarQr();
  }

  await carregar();
  garantirPedidos();
}
