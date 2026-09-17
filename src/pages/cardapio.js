import { criarPedido, lerCardapioPublico } from "../lib/pedidos.js";
import { brl, erroAmigavel, esc, linkWhatsapp, toast } from "../lib/format.js";
import { ico } from "../lib/icons.js";
import {
  idCategoria,
  mostraAPartirDe,
  precoLinha,
  precoMinimo,
  qtdNoGrupo,
  qtdOpcao,
  sanitizarGrupos,
  textoExtras,
  validarExtras
} from "../lib/grupos.js";

function cartKey(chave, mesa) {
  return `flowpdv_cart_${chave}_${mesa || "retirada"}`;
}

function lerCarrinho(chave, mesa) {
  try {
    const arr = JSON.parse(localStorage.getItem(cartKey(chave, mesa)) || "[]") || [];
    return arr.map((i) => ({
      linhaId: i.linhaId || (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
      id: i.id,
      nome: i.nome,
      preco: Number(i.preco) || 0,
      quantidade: Math.max(1, Number(i.quantidade) || 1),
      observacao: i.observacao || "",
      extras: Array.isArray(i.extras) ? i.extras : []
    }));
  } catch {
    return [];
  }
}

function salvarCarrinho(chave, mesa, itens) {
  localStorage.setItem(cartKey(chave, mesa), JSON.stringify(itens));
}

function rotuloPreco(p) {
  const v = brl(precoMinimo(p));
  return mostraAPartirDe(p) ? `A partir de ${v}` : v;
}

function iniciais(nome) {
  const p = String(nome || "L").trim().split(/\s+/).slice(0, 2);
  return p.map((x) => x[0] || "").join("").toUpperCase() || "L";
}

export async function renderCardapio(app, { chave, mesa, itemId }) {
  document.body.className = "is-menu";
  app.innerHTML = `<div class="menu-frame"><p class="empty">Carregando cardápio...</p></div>`;
  let publico;
  try {
    publico = await lerCardapioPublico(chave);
  } catch (err) {
    app.innerHTML = caixaFechada("Cardápio indisponível", erroAmigavel(err));
    return;
  }

  document.title = (publico && publico.nome) ? `${publico.nome} · Cardápio` : "Cardápio · FlowPDV";

  const todos = (publico && publico.produtos) || [];
  const produtos = todos.filter((p) => !p.esgotado);
  let itemAtual = itemId ? String(itemId) : null;
  let busca = "";
  let buscaAberta = Boolean(busca);
  let buscaExtra = "";
  let carrinho = lerCarrinho(chave, mesa);
  let sheetAberto = false;
  let rascunho = novoRascunho();
  const wa = linkWhatsapp(
    publico && publico.whatsapp,
    `Olá, vim pelo cardápio da ${(publico && publico.nome) || "loja"}`
  );

  function novoRascunho() {
    return { qtd: 1, obs: "", extras: [] };
  }

  function pathLista() {
    return mesa ? `/${chave}/mesa/${mesa}` : `/${chave}`;
  }

  function pathItem(id) {
    return `${pathLista()}/item/${encodeURIComponent(id)}`;
  }

  function prodAtual() {
    return todos.find((p) => String(p.id) === String(itemAtual)) || null;
  }

  function totalCarrinho() {
    return carrinho.reduce((s, i) => {
      const p = produtos.find((x) => String(x.id) === String(i.id));
      return s + (p ? precoLinha(p, i.extras, i.quantidade) : (Number(i.preco) || 0) * i.quantidade);
    }, 0);
  }

  function nItens() {
    return carrinho.reduce((s, i) => s + i.quantidade, 0);
  }

  function abrirItem(id) {
    itemAtual = String(id);
    rascunho = novoRascunho();
    buscaExtra = "";
    sheetAberto = false;
    const url = pathItem(id);
    if (location.pathname !== url) history.pushState({}, "", url);
    pintar();
    window.scrollTo(0, 0);
  }

  function fecharItem() {
    itemAtual = null;
    rascunho = novoRascunho();
    const url = pathLista();
    if (location.pathname !== url) history.pushState({}, "", url);
    pintar();
  }

  function setExtra(grupo, opcao, nextQtd) {
    let extras = [...rascunho.extras];
    if (grupo.tipo === "single") {
      extras = extras.filter((e) => String(e.grupoId) !== String(grupo.id));
      if (nextQtd > 0) {
        extras.push({
          grupoId: grupo.id,
          opcaoId: opcao.id,
          quantidade: 1,
          nome: opcao.nome,
          preco: opcao.preco
        });
      }
      rascunho.extras = extras;
      pintar();
      return;
    }
    const atual = qtdOpcao(extras, grupo.id, opcao.id);
    const usado = qtdNoGrupo(extras, grupo.id) - atual;
    let q = Math.max(0, Math.min(99, nextQtd));
    if (grupo.max > 0 && usado + q > grupo.max) {
      toast(`No máximo ${grupo.max} em ${grupo.nome}.`);
      return;
    }
    extras = extras.filter((e) => !(String(e.grupoId) === String(grupo.id) && String(e.opcaoId) === String(opcao.id)));
    if (q > 0) {
      extras.push({
        grupoId: grupo.id,
        opcaoId: opcao.id,
        quantidade: q,
        nome: opcao.nome,
        preco: opcao.preco
      });
    }
    rascunho.extras = extras;
    pintar();
  }

  function adicionarAoPedido() {
    const prod = prodAtual();
    if (!prod || prod.esgotado) return;
    try {
      validarExtras(prod, rascunho.extras);
    } catch (err) {
      toast(err.message || "Complete as opções do item.");
      return;
    }
    carrinho.push({
      linhaId: (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}`,
      id: prod.id,
      nome: prod.nome,
      preco: Number(prod.preco) || 0,
      quantidade: Math.max(1, rascunho.qtd),
      observacao: String(rascunho.obs || "").slice(0, 180),
      extras: rascunho.extras
    });
    salvarCarrinho(chave, mesa, carrinho);
    toast("Adicionado ao pedido");
    fecharItem();
  }

  async function enviar() {
    if (!carrinho.length) return;
    const idem = sessionStorage.getItem(`flowpdv_idem_${chave}_${mesa || "r"}`) || crypto.randomUUID();
    sessionStorage.setItem(`flowpdv_idem_${chave}_${mesa || "r"}`, idem);
    try {
      const res = await criarPedido({
        chave,
        tipo: mesa ? "mesa" : "retirada",
        numeroMesa: mesa || null,
        idempotencyKey: idem,
        itens: carrinho.map((i) => ({
          id: i.id,
          quantidade: i.quantidade,
          observacao: i.observacao || "",
          extras: (i.extras || []).map((e) => ({
            grupoId: e.grupoId,
            opcaoId: e.opcaoId,
            quantidade: e.quantidade || 1
          }))
        }))
      });
      salvarCarrinho(chave, mesa, []);
      sessionStorage.removeItem(`flowpdv_idem_${chave}_${mesa || "r"}`);
      const pedidoId = (res.pedido && res.pedido.id) || res.id;
      history.pushState({}, "", `/${chave}/pedido/${pedidoId}`);
      window.dispatchEvent(new Event("flowpdv:route"));
    } catch (err) {
      toast(erroAmigavel(err), 3200);
    }
  }

  function topoLoja(extra = "") {
    const aberto = !publico.pausado;
    const canal = mesa ? `Mesa ${mesa}` : "Retirada";
    return `
      <header class="store-head">
        <div class="store-row">
          ${publico.logoUrl
            ? `<img class="store-logo" src="${esc(publico.logoUrl)}" alt="">`
            : `<div class="store-logo ph-logo">${esc(iniciais(publico.nome))}</div>`}
          <div class="store-meta">
            <div class="store-kicker">
              <span class="store-status ${aberto ? "on" : "off"}">${aberto ? "Aberto" : "Fechado"}</span>
              ${publico.horarioTexto ? `<span class="store-hora">${esc(publico.horarioTexto)}</span>` : ""}
            </div>
            <h1>${esc(publico.nome || "Cardápio")}</h1>
            ${publico.endereco ? `<p class="store-end">${esc(publico.endereco)}</p>` : ""}
          </div>
          <div class="store-tools">
            <button type="button" class="icon-btn" id="btn-busca" aria-label="Buscar">${ico.search}</button>
            ${wa ? `<a class="icon-btn wa" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ico.wa}</a>` : ""}
          </div>
        </div>
        <div class="store-sub">
          <span class="canal ${mesa ? "mesa" : "retirada"}">${esc(canal)}</span>
          ${aberto && publico.entregaTexto ? `<span class="chip-info">${esc(publico.entregaTexto)}</span>` : ""}
          ${aberto && publico.pedidoMinimoTexto ? `<span class="chip-info">${esc(publico.pedidoMinimoTexto)}</span>` : ""}
        </div>
        ${extra}
      </header>
    `;
  }

  function caixaFechada(titulo, texto, loja) {
    document.body.className = "is-menu";
    return `
      <div class="menu-frame">
        <div class="menu-page">
          ${loja ? topoLoja() : ""}
          <div class="closed-box">
            <h2>${esc(titulo)}</h2>
            <p>${esc(texto)}</p>
            ${loja && loja.whatsapp ? `<a class="btn-primary" href="${esc(linkWhatsapp(loja.whatsapp))}" target="_blank" rel="noopener">Chamar no WhatsApp</a>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  if (!publico || !todos.length) {
    app.innerHTML = caixaFechada("Cardápio ainda não publicado", "A loja precisa marcar os produtos e clicar em Publicar no painel.", publico);
    return;
  }
  if (publico.pausado) {
    app.innerHTML = caixaFechada(
      publico.nome || "Loja",
      "Cardápio fechado no momento. Volte no horário de funcionamento ou fale com a loja.",
      publico
    );
    return;
  }

  function cardProduto(p, destaque) {
    const foto = p.fotoUrl
      ? `<img src="${esc(p.fotoUrl)}" alt="">`
      : `<div class="ph">${ico.photo}</div>`;
    return `
      <article class="${destaque ? "spot-card" : "menu-item"}" data-open="${esc(p.id)}" role="button" tabindex="0">
        ${destaque ? `<div class="spot-media">${foto}</div>` : ""}
        <div class="menu-copy">
          ${p.destaque && !destaque ? `<em class="fav">Mais pedido</em>` : ""}
          <h3>${esc(p.nome)}</h3>
          ${!destaque && p.descricao ? `<p>${esc(p.descricao)}</p>` : ""}
          <strong>${esc(rotuloPreco(p))}</strong>
        </div>
        ${destaque ? "" : `<div class="menu-media">${foto}<span class="add-dot">${ico.plus}</span></div>`}
      </article>
    `;
  }

  function pintarLista() {
    const q = busca.trim().toLowerCase();
    const lista = q
      ? produtos.filter((p) => `${p.nome} ${p.descricao || ""} ${p.categoria || ""}`.toLowerCase().includes(q))
      : produtos;
    const destaques = produtos.filter((p) => p.destaque).slice(0, 12);
    const cats = q ? [] : [...new Set(lista.map((p) => p.categoria || "Geral"))];

    app.innerHTML = `
      <div class="menu-frame">
        <div class="menu-page ${nItens() ? "has-cart" : ""}">
          ${topoLoja(buscaAberta || q ? `
            <div class="store-search">
              <input type="search" id="menu-busca" placeholder="Buscar no cardápio" value="${esc(busca)}">
            </div>` : "")}
          ${!q && cats.length ? `
            <nav class="cats" aria-label="Categorias">
              ${cats.map((c) => `<a href="#${idCategoria(c)}">${esc(c)}</a>`).join("")}
            </nav>` : ""}
          ${!q && destaques.length ? `
            <section class="spot-wrap">
              <h2>Mais pedidos</h2>
              <div class="spot-row">${destaques.map((p) => cardProduto(p, true)).join("")}</div>
            </section>` : ""}
          <div class="menu-list">
            ${q ? `
              <h2 class="sec-title">${lista.length ? "Resultados" : "Nada encontrado"}</h2>
              ${lista.map((p) => cardProduto(p, false)).join("")}
            ` : cats.map((c) => {
              const itens = lista.filter((p) => (p.categoria || "Geral") === c);
              return `
                <section class="menu-sec" id="${idCategoria(c)}">
                  <h2 class="sec-title">${esc(c)}</h2>
                  ${itens.map((p) => cardProduto(p, false)).join("")}
                </section>`;
            }).join("")}
          </div>
          ${nItens() ? `
            <div class="cart-bar">
              <div>
                <small>${nItens()} ${nItens() === 1 ? "item" : "itens"}</small>
                <strong>${brl(totalCarrinho())}</strong>
              </div>
              <button type="button" id="btn-ver-pedido">Ver pedido</button>
            </div>` : ""}
          ${sheetAberto ? pintarSheet() : ""}
        </div>
      </div>
    `;

    bindLista();
  }

  function pintarSheet() {
    return `
      <div class="sheet" id="sheet">
        <div class="sheet-card">
          <div class="sheet-grab"></div>
          <header class="sheet-head">
            <h2>Seu pedido</h2>
            <p>${mesa ? `Mesa ${esc(String(mesa))}` : "Retirada no balcão"}</p>
          </header>
          ${carrinho.map((i) => {
            const p = produtos.find((x) => String(x.id) === String(i.id));
            const extra = textoExtras(i.extras);
            const tot = p ? precoLinha(p, i.extras, i.quantidade) : (i.preco * i.quantidade);
            return `
              <div class="cart-line" data-linha="${esc(i.linhaId)}">
                <div>
                  <strong>${esc(i.nome)}</strong>
                  ${extra ? `<small>${esc(extra)}</small>` : ""}
                  ${i.observacao ? `<small>${esc(i.observacao)}</small>` : ""}
                </div>
                <div class="cart-line-side">
                  <div class="qty mini">
                    <button type="button" data-minus-line>−</button>
                    <span>${i.quantidade}</span>
                    <button type="button" data-plus-line>+</button>
                  </div>
                  <b>${brl(tot)}</b>
                </div>
              </div>`;
          }).join("")}
          <div class="cart-total">
            <span>Total</span>
            <strong>${brl(totalCarrinho())}</strong>
          </div>
          <button class="btn-primary" id="btn-enviar" type="button">Enviar pedido · ${brl(totalCarrinho())}</button>
          <button class="btn-ghost" id="btn-fechar" type="button">Continuar pedindo</button>
        </div>
      </div>
    `;
  }

  function pintarProduto() {
    const prod = prodAtual();
    if (!prod) {
      itemAtual = null;
      pintarLista();
      toast("Esse item não está no cardápio.");
      return;
    }
    if (prod.esgotado) {
      app.innerHTML = `
        <div class="menu-frame"><div class="menu-page">
          <button type="button" class="back-link" id="btn-voltar">← Cardápio</button>
          <div class="closed-box"><h2>${esc(prod.nome)}</h2><p>Item esgotado no momento.</p></div>
        </div></div>`;
      app.querySelector("#btn-voltar").addEventListener("click", fecharItem);
      return;
    }
    const grupos = sanitizarGrupos(prod.grupos);
    const unit = precoLinha(prod, rascunho.extras, 1);
    const tot = unit * rascunho.qtd;
    let pode = true;
    let motivo = "";
    try { validarExtras(prod, rascunho.extras); }
    catch (err) { pode = false; motivo = err.message; }

    app.innerHTML = `
      <div class="menu-frame">
        <div class="prod-page">
          <button type="button" class="icon-btn back-float" id="btn-voltar" aria-label="Voltar">${ico.back}</button>
          ${prod.fotoUrl ? `<img class="prod-hero" src="${esc(prod.fotoUrl)}" alt="">` : `<div class="prod-hero ph-hero">${ico.photo}</div>`}
          <div class="prod-body">
            <p class="prod-cat">${esc(prod.categoria || "")}</p>
            <h1>${esc(prod.nome)}</h1>
            ${prod.descricao ? `<p class="prod-desc">${esc(prod.descricao)}</p>` : ""}
            <p class="prod-from">${mostraAPartirDe(prod) ? "A partir de " : ""}${brl(precoMinimo(prod))}</p>
            ${grupos.length ? grupos.map((g) => {
              const usados = qtdNoGrupo(rascunho.extras, g.id);
              const q = buscaExtra.trim().toLowerCase();
              const ops = q ? g.opcoes.filter((o) => `${o.nome} ${o.descricao || ""}`.toLowerCase().includes(q)) : g.opcoes;
              const regra = g.tipo === "single"
                ? (g.min ? "Obrigatório · escolha 1" : "Escolha 1")
                : `${g.min ? `Mín. ${g.min} · ` : ""}até ${g.max || "livre"} · ${usados}/${g.max || "—"}`;
              return `
                <section class="opt-group">
                  <header>
                    <h2>${esc(g.nome)}</h2>
                    <small>${esc(regra)}</small>
                  </header>
                  ${g.opcoes.length > 8 ? `<input type="search" class="opt-search" placeholder="Pesquisar em ${esc(g.nome)}" value="${esc(buscaExtra)}">` : ""}
                  ${ops.map((o) => {
                    const n = qtdOpcao(rascunho.extras, g.id, o.id);
                    const on = n > 0;
                    return `
                      <div class="opt-row ${on ? "on" : ""}">
                        <div>
                          <strong>${esc(o.nome)}</strong>
                          ${o.descricao ? `<small>${esc(o.descricao)}</small>` : ""}
                          <em>${o.preco ? `+ ${brl(o.preco)}` : "Incluso"}</em>
                        </div>
                        ${g.tipo === "single"
                          ? `<button type="button" class="opt-radio ${on ? "on" : ""}" data-g="${esc(g.id)}" data-o="${esc(o.id)}" data-single="${on ? 0 : 1}" aria-label="${esc(o.nome)}"></button>`
                          : `<div class="qty mini">
                              <button type="button" data-g="${esc(g.id)}" data-o="${esc(o.id)}" data-q="${n - 1}">−</button>
                              <span>${n}</span>
                              <button type="button" data-g="${esc(g.id)}" data-o="${esc(o.id)}" data-q="${n + 1}">+</button>
                            </div>`}
                      </div>`;
                  }).join("") || `<p class="empty">Nenhuma opção nesta busca.</p>`}
                </section>`;
            }).join("") : ""}
            <section class="opt-group">
              <header><h2>Observações</h2><small>Opcional</small></header>
              <textarea class="obs" id="obs-item" maxlength="180" placeholder="Ex.: sem cebola, ponto da carne, sem picles">${esc(rascunho.obs)}</textarea>
            </section>
          </div>
          <div class="prod-footer">
            <div class="qty">
              <button type="button" id="qtd-menos">−</button>
              <span>${rascunho.qtd}</span>
              <button type="button" id="qtd-mais">+</button>
            </div>
            <button class="btn-primary" id="btn-add" type="button" ${pode ? "" : "disabled"}>
              Adicionar ${brl(tot)}
            </button>
          </div>
          ${!pode && motivo ? `<p class="prod-hint">${esc(motivo)}</p>` : ""}
        </div>
      </div>
    `;

    app.querySelector("#btn-voltar").addEventListener("click", fecharItem);
    app.querySelector("#qtd-menos").addEventListener("click", () => {
      rascunho.qtd = Math.max(1, rascunho.qtd - 1);
      pintar();
    });
    app.querySelector("#qtd-mais").addEventListener("click", () => {
      rascunho.qtd = Math.min(99, rascunho.qtd + 1);
      pintar();
    });
    const obs = app.querySelector("#obs-item");
    if (obs) obs.addEventListener("input", () => { rascunho.obs = obs.value; });
    app.querySelectorAll(".opt-search").forEach((el) => {
      el.addEventListener("input", () => { buscaExtra = el.value; pintar(); });
    });
    app.querySelectorAll("[data-g][data-o]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const g = grupos.find((x) => String(x.id) === String(btn.dataset.g));
        const o = g && g.opcoes.find((x) => String(x.id) === String(btn.dataset.o));
        if (!g || !o) return;
        if (btn.dataset.single != null) setExtra(g, o, Number(btn.dataset.single));
        else setExtra(g, o, Number(btn.dataset.q));
      });
    });
    app.querySelector("#btn-add").addEventListener("click", adicionarAoPedido);
  }

  function bindLista() {
    const buscaEl = app.querySelector("#menu-busca");
    if (buscaEl) {
      buscaEl.addEventListener("input", () => { busca = buscaEl.value; pintar(); });
      if (buscaAberta && document.activeElement !== buscaEl) {
        const pos = buscaEl.value.length;
        buscaEl.focus();
        buscaEl.setSelectionRange(pos, pos);
      }
    }
    const btnBusca = app.querySelector("#btn-busca");
    if (btnBusca) {
      btnBusca.addEventListener("click", () => {
        buscaAberta = !buscaAberta;
        if (!buscaAberta) busca = "";
        pintar();
      });
    }
    app.querySelectorAll("[data-open]").forEach((el) => {
      const go = () => abrirItem(el.dataset.open);
      el.addEventListener("click", go);
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); }
      });
    });
    const ver = app.querySelector("#btn-ver-pedido");
    if (ver) ver.addEventListener("click", () => { sheetAberto = true; pintar(); });
    const fechar = app.querySelector("#btn-fechar");
    if (fechar) fechar.addEventListener("click", () => { sheetAberto = false; pintar(); });
    const sheet = app.querySelector("#sheet");
    if (sheet) {
      sheet.addEventListener("click", (ev) => {
        if (ev.target.id === "sheet") { sheetAberto = false; pintar(); }
      });
    }
    app.querySelectorAll("[data-linha]").forEach((row) => {
      const id = row.dataset.linha;
      const plus = row.querySelector("[data-plus-line]");
      const minus = row.querySelector("[data-minus-line]");
      if (plus) plus.addEventListener("click", () => {
        const i = carrinho.find((x) => x.linhaId === id);
        if (i) i.quantidade = Math.min(99, i.quantidade + 1);
        salvarCarrinho(chave, mesa, carrinho);
        pintar();
      });
      if (minus) minus.addEventListener("click", () => {
        const i = carrinho.findIndex((x) => x.linhaId === id);
        if (i < 0) return;
        carrinho[i].quantidade -= 1;
        if (carrinho[i].quantidade <= 0) carrinho.splice(i, 1);
        salvarCarrinho(chave, mesa, carrinho);
        if (!carrinho.length) sheetAberto = false;
        pintar();
      });
    });
    const enviarBtn = app.querySelector("#btn-enviar");
    if (enviarBtn) enviarBtn.addEventListener("click", async () => {
      enviarBtn.disabled = true;
      enviarBtn.textContent = "Enviando...";
      await enviar();
    });
  }

  function pintar() {
    if (itemAtual) pintarProduto();
    else pintarLista();
  }

  pintar();
}
