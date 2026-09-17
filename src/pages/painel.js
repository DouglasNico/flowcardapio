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
import { atualizarStatusPedido, escutarPedidosLoja, invalidarCardapioPublico } from "../lib/pedidos.js";
import { brl, erroAmigavel, originPublico, esc, soDigitos, toast } from "../lib/format.js";
import { textoExtras } from "../lib/grupos.js";
import { abrirEditorGrupos } from "./painel-grupos.js";

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

function linhaPedidoItem(i) {
  const extra = textoExtras(i.extras) || i.detalhe || "";
  const obs = i.observacao ? ` — ${i.observacao}` : "";
  return `${esc(i.quantidade)}× ${esc(i.nome)}${extra ? ` (${esc(extra)})` : ""}${esc(obs)}`;
}

export async function renderPainel(app, sessao) {
  document.body.className = "is-painel";
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
            <small>Painel do cardápio · ${chave}</small>
          </div>
        </div>
        <nav class="tabs">
          <button type="button" data-aba="cardapio" class="on">Cardápio</button>
          <button type="button" data-aba="loja">Loja</button>
          <button type="button" data-aba="pedidos">Pedidos</button>
          <button type="button" data-aba="qr">QR e links</button>
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
      config = cfg || {};
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

  async function patchOverlay(id, patch) {
    overlays[id] = { ...(overlays[id] || {}), ...patch };
    await salvarOverlay(chave, id, patch);
    pintar();
  }

  async function onFoto(id, file) {
    if (!file) return;
    try {
      const oldId = overlays[id] && overlays[id].fotoPublicId;
      const assinatura = await assinarUpload(chave, id);
      const up = await enviarFotoCloudinary(file, assinatura);
      if (oldId && oldId !== up.public_id) {
        try { await removerFoto(chave, id, oldId); } catch { /* troca segue */ }
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

  function pintarLoja() {
    main.innerHTML = `
      <section class="page-head">
        <div>
          <h2>Dados da loja</h2>
          <p>Isso aparece no topo do cardápio. Horário e WhatsApp atualizam na hora; produtos só depois de publicar.</p>
        </div>
      </section>
      <div class="card loja-card">
        <div class="loja-grid">
          <label>WhatsApp (com DDD)<input id="lj-wa" inputmode="numeric" placeholder="19999999999" value="${esc(config.whatsapp || "")}"></label>
          <label>Endereço / bairro<input id="lj-end" placeholder="Jardim Santa Izabel, Hortolândia" value="${esc(config.endereco || "")}"></label>
          <label>Horário<input id="lj-hora" placeholder="Ter a Dom · 18:00–23:00" value="${esc(config.horarioTexto || "")}"></label>
          <label>Entrega<input id="lj-ent" placeholder="40–70 min" value="${esc(config.entregaTexto || "")}"></label>
          <label>Pedido mínimo<input id="lj-min" placeholder="Sem pedido mínimo" value="${esc(config.pedidoMinimoTexto != null ? config.pedidoMinimoTexto : "Sem pedido mínimo")}"></label>
        </div>
        <div class="loja-foot">
          <label class="switch">
            <input type="checkbox" id="pausado" ${config.pausado ? "checked" : ""}>
            Pausar cardápio
          </label>
          <button class="btn-primary" id="lj-salvar" type="button" style="width:auto">Salvar</button>
        </div>
      </div>
    `;
    main.querySelector("#pausado").addEventListener("change", async (ev) => {
      config.pausado = ev.target.checked;
      try {
        await salvarConfig(chave, { pausado: config.pausado });
        toast(config.pausado ? "Cardápio pausado." : "Cardápio aberto.");
      } catch (err) { toast(erroAmigavel(err)); }
    });
    main.querySelector("#lj-salvar").addEventListener("click", async (ev) => {
      ev.target.disabled = true;
      const patch = {
        whatsapp: soDigitos(main.querySelector("#lj-wa").value),
        endereco: main.querySelector("#lj-end").value.trim().slice(0, 120),
        horarioTexto: main.querySelector("#lj-hora").value.trim().slice(0, 80),
        entregaTexto: main.querySelector("#lj-ent").value.trim().slice(0, 80),
        pedidoMinimoTexto: main.querySelector("#lj-min").value.trim().slice(0, 60)
      };
      try {
        await salvarConfig(chave, patch);
        Object.assign(config, patch);
        toast("Dados da loja salvos.");
      } catch (err) {
        toast(erroAmigavel(err));
      } finally {
        ev.target.disabled = false;
      }
    });
  }

  function pintarCardapio() {
    const visiveis = produtos.filter((p) => overlays[p.id] && overlays[p.id].visivel).length;
    main.innerHTML = `
      <section class="page-head">
        <div>
          <h2>Produtos</h2>
          <p>Marque os itens, coloque foto e opções, depois publique para o QR atualizar.</p>
        </div>
        <div class="toolbar">
          <input type="search" id="busca" placeholder="Buscar produto">
          <button class="btn-primary" id="btn-publicar" type="button" style="width:auto">Publicar (${visiveis})</button>
        </div>
      </section>
      <div class="prod-list" id="lista"></div>
    `;
    const busca = main.querySelector("#busca");
    busca.value = filtro;
    busca.addEventListener("input", () => { filtro = busca.value; pintarLista(); });
    main.querySelector("#btn-publicar").addEventListener("click", async (ev) => {
      ev.target.disabled = true;
      ev.target.textContent = "Publicando...";
      try {
        invalidarCardapioPublico();
        await publicarCardapio(chave);
        toast("Cardápio publicado. O QR já pode abrir.");
      } catch (err) {
        toast(erroAmigavel(err));
      } finally {
        ev.target.disabled = false;
        ev.target.textContent = `Publicar (${visiveis})`;
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
      const nOp = (ov.grupos && ov.grupos.length) || 0;
      const foto = ov.fotoUrl ? `<img class="thumb" src="${ov.fotoUrl}" alt="">` : `<div class="thumb">${esc((p.nome || "?").slice(0, 1))}</div>`;
      return `
        <article class="prod-card ${ov.visivel ? "on" : ""}" data-id="${p.id}">
          ${foto}
          <div class="prod-card-body">
            <div class="prod-card-top">
              <h3>${esc(p.nome || "Sem nome")}</h3>
              <b>${brl(precoProduto(p))}</b>
            </div>
            <div class="cat">${esc(p.categoria || "Geral")}${nOp ? ` · ${nOp} grupo${nOp > 1 ? "s" : ""} de opção` : ""}${ov.destaque ? " · Destaque" : ""}</div>
            <textarea data-desc placeholder="Descrição que o cliente lê no cardápio"></textarea>
            <div class="chip-row">
              <label class="chip${ov.visivel ? " on" : ""}"><input type="checkbox" data-visivel ${ov.visivel ? "checked" : ""}> No cardápio</label>
              <label class="chip${ov.destaque ? " on" : ""}"><input type="checkbox" data-destaque ${ov.destaque ? "checked" : ""}> Mais pedido</label>
              <label class="chip warn${ov.esgotado ? " on" : ""}"><input type="checkbox" data-esgotado ${ov.esgotado ? "checked" : ""}> Esgotado</label>
            </div>
            <div class="prod-card-actions">
              <label class="btn-ghost file-btn">Foto<input type="file" accept="image/jpeg,image/png,image/webp"></label>
              ${ov.fotoPublicId ? `<button type="button" class="btn-ghost" data-del-foto>Apagar foto</button>` : ""}
              <button type="button" class="btn-ghost" data-opcoes>Opções${nOp ? ` (${nOp})` : ""}</button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    lista.querySelectorAll(".prod-card").forEach((row) => {
      const id = row.dataset.id;
      const prod = produtos.find((p) => String(p.id) === String(id));
      row.querySelector("[data-visivel]").addEventListener("change", (ev) => patchOverlay(id, { visivel: ev.target.checked }));
      row.querySelector("[data-destaque]").addEventListener("change", (ev) => patchOverlay(id, { destaque: ev.target.checked }));
      row.querySelector("[data-esgotado]").addEventListener("change", (ev) => patchOverlay(id, { esgotado: ev.target.checked }));
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
        const valor = ev.target.value;
        overlays[id] = { ...(overlays[id] || {}), descricao: valor };
        clearTimeout(t);
        t = setTimeout(() => salvarOverlay(chave, id, { descricao: valor }), 500);
      });
      row.querySelector("[data-opcoes]").addEventListener("click", () => {
        abrirEditorGrupos({
          produto: prod,
          overlay: overlays[id] || {},
          produtos,
          onSave: async (grupos) => {
            overlays[id] = { ...(overlays[id] || {}), grupos };
            await salvarOverlay(chave, id, { grupos });
            pintarLista();
          }
        });
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
      main.innerHTML = `<div class="empty-card"><h2>Nenhum pedido ainda</h2><p>Publique o cardápio e teste o QR da mesa ou o link de retirada.</p></div>`;
      return;
    }
    main.innerHTML = `
      <section class="page-head"><div><h2>Pedidos ao vivo</h2><p>Novos pedidos avisam com um som. Avance o status conforme a cozinha.</p></div></section>
      <div class="pedido-list">
        ${pedidos.map((p) => {
          const prox = proximoStatus(p.status);
          const itens = (p.itens || []).map((i) => `<li>${linhaPedidoItem(i)}</li>`).join("");
          const onde = p.tipo === "mesa" ? `Mesa ${p.numeroMesa}` : "Retirada";
          return `
            <article class="pedido">
              <header>
                <div>
                  <strong>${onde}</strong>
                  <small>${brl(p.total)} · ${esc(String(p.id || "").slice(-6).toUpperCase())}</small>
                </div>
                <span class="badge ${p.status || "novo"}">${rotuloStatus(p.status)}</span>
              </header>
              <ul class="pedido-itens">${itens}</ul>
              <div class="pedido-btns">
                ${prox ? `<button class="btn-primary" data-st="${prox}" data-id="${p.id}" style="width:auto">${rotuloStatus(prox)}</button>` : ""}
                ${p.status !== "cancelado" && p.status !== "entregue" ? `<button class="btn-ghost" data-st="cancelado" data-id="${p.id}">Cancelar</button>` : ""}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
    main.querySelectorAll("[data-st]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await atualizarStatusPedido(chave, btn.dataset.id, btn.dataset.st);
        } catch (err) { toast(erroAmigavel(err)); }
      });
    });
  }

  async function pintarQr() {
    const urlLoja = `${originPublico()}/${chave}`;
    main.innerHTML = `
      <section class="page-head">
        <div>
          <h2>QR e links</h2>
          <p>Cole o QR na mesa. O link da loja é a retirada no balcão.</p>
        </div>
      </section>
      <div class="qr-grid">
        <div class="card">
          <h3>QR da mesa</h3>
          <label>Número da mesa</label>
          <div class="toolbar" style="margin:8px 0 0">
            <input type="number" id="mesa-n" min="1" value="1">
            <button class="btn-primary" id="btn-qr" type="button" style="width:auto">Gerar</button>
          </div>
          <p class="qr-link" id="qr-link"></p>
        </div>
        <div class="card qr-preview" id="qr-box"><p class="empty">Gere o QR da mesa.</p></div>
        <div class="card">
          <h3>Retirada</h3>
          <p class="qr-link">${esc(urlLoja)}</p>
          <div id="qr-loja"></div>
        </div>
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
    const lojaQr = await QRCode.toDataURL(urlLoja, { width: 280, margin: 1 });
    main.querySelector("#qr-loja").innerHTML = `<img src="${lojaQr}" alt="QR da loja">`;
  }

  function pintar() {
    if (aba === "cardapio") pintarCardapio();
    else if (aba === "loja") pintarLoja();
    else if (aba === "pedidos") pintarPedidos();
    else pintarQr();
  }

  await carregar();
  garantirPedidos();
}
