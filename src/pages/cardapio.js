import {compararCategorias} from "../lib/categorias.js";
import {telefoneFormatado, calcularEntrega} from "../../shared/entrega.js";
import { acompanharCategorias } from "../lib/categorias-scroll.js";
import "./cardapio-design.css";
import "../lib/foto.css";
import { htmlFoto, normalizarEnquadramento } from "../lib/foto.js";
import { criarPedido, lerCardapioPublico } from "../lib/pedidos.js";
import { brl, erroAmigavel, esc, linkWhatsapp, toast } from "../lib/format.js";
import { ico } from "../lib/icons.js";
import { guardarPedidoLocal } from "../lib/pedido-ui.js";
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
import { CANAL_LOJA } from "../lib/loja.js";

function reduzMovimento() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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
      extras: Array.isArray(i.extras) ? i.extras : [],
      fotoUrl: i.fotoUrl || "",
      fotoEnquadramento: normalizarEnquadramento(i.fotoEnquadramento)
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
  let buscaAberta = false;
  let focarBusca = false;
  let scrollBusca = window.scrollY;
  let pausaBusca = 0;

  function atualizarBusca() {
    const area = app.querySelector('.store-search');
    const aberta = buscaAberta;
    area?.classList.toggle('is-collapsed', !aberta);
    if (area) area.inert = !aberta;
    app.querySelector('#btn-busca')?.setAttribute('aria-expanded', String(aberta));
  }

  function acompanharBusca() {
    const y = window.scrollY, delta = y - scrollBusca;
    if (itemAtual || sheetAberto || performance.now() < pausaBusca) { scrollBusca = y; return; }
    if (Math.abs(delta) <= 8) return;
    scrollBusca = y;
    const aberta = y > 80 && delta > 8 ? false : buscaAberta;
    if (aberta !== buscaAberta) {
      buscaAberta = aberta;
      if (!aberta && document.activeElement?.id === 'menu-busca') document.activeElement.blur();
      pausaBusca = performance.now() + 280;
      atualizarBusca();
    }
  }
  let buscaExtra = "";
  let carrinho = lerCarrinho(chave, mesa);
  let sheetAberto = false;
  let modoPedido = mesa ? 'mesa' : 'retirada';
  const dadosEntrega = {nome:'',telefone:'',rua:'',numero:'',complemento:'',bairroId:''};
  let sheetAnimar = true;
  let animarItem = Boolean(itemId);
  let fechandoItem = false;
  let grupoAberto = null;
  let catAtiva = "";
  let limparCategorias = () => {};
  let limparCarrossel = () => {};
  let pularScroll = false;
  let retornoItem = null;

  function travarFundo(on) {
    const html = document.documentElement;
    const body = document.body;
    if (on) {
      if (!body.classList.contains("is-locked")) {
        const gap = CSS.supports("scrollbar-gutter: stable") ? 0 : Math.max(0, window.innerWidth - html.clientWidth);
        html.style.setProperty("--lock-gap", `${gap}px`);
      }
      html.classList.add("is-locked");
      body.classList.add("is-locked");
    } else {
      html.classList.remove("is-locked");
      body.classList.remove("is-locked");
      html.style.removeProperty("--lock-gap");
    }
  }

  function overlayEl() {
    return document.getElementById("prod-overlay");
  }

  let itemUi = null;

  function textoRegra(g, precisa) {
    const usados = qtdNoGrupo(rascunho.extras, g.id);
    const opcional = g.min <= 0;
    const ativo = !opcional || Boolean(rascunho.ativos[g.id]);
    const falta = usados < precisa(g);
    const escolhida = (g.opcoes.find((o) => qtdOpcao(rascunho.extras, g.id, o.id) > 0) || {}).nome;
    let regra = opcional && !ativo ? "Desativado" : (escolhida || (g.tipo === "single" ? "Escolha 1" : `${usados}/${g.max || "—"}`));
    if (falta && ativo) regra = "Escolha 1";
    if (g.precoGrupo) regra = `${regra} · + ${brl(g.precoGrupo)}`;
    return regra;
  }

  function atualizarProdutoAberto() {
    const overlay = overlayEl();
    if (!overlay || !itemUi) return;
    const { grupos, tot, pode, precisa, foco } = itemUi;
    const body = overlay.querySelector(".prod-body");
    const y = body ? body.scrollTop : 0;
    overlay.querySelectorAll(".opt-group[data-g]").forEach((sec) => {
      const g = grupos.find((x) => String(x.id) === String(sec.dataset.g));
      if (!g) return;
      const opcional = g.min <= 0;
      const ativo = !opcional || Boolean(rascunho.ativos[g.id]);
      const aberto = String(g.id) === foco && ativo;
      const falta = qtdNoGrupo(rascunho.extras, g.id) < precisa(g);
      sec.classList.toggle("open", aberto);
      sec.classList.toggle("need", falta);
      const small = sec.querySelector(".opt-head small");
      if (small) small.textContent = textoRegra(g, precisa);
      const check = sec.querySelector("[data-toggle-g]");
      if (check) {
        check.classList.toggle("on", ativo);
        check.setAttribute("aria-label", `${ativo ? "Desativar" : "Ativar"} ${g.nome}`);
      }
      const q = buscaExtra.trim().toLowerCase();
      sec.querySelectorAll(".opt-row[data-o]").forEach((row) => {
        const o = g.opcoes.find((x) => String(x.id) === String(row.dataset.o));
        if (!o) return;
        const n = qtdOpcao(rascunho.extras, g.id, o.id);
        row.classList.toggle("on", n > 0);
        row.hidden = Boolean(q && !`${o.nome} ${o.descricao || ""}`.toLowerCase().includes(q));
        const radio = row.querySelector("[data-single]");
        if (radio) {
          radio.classList.toggle("on", n > 0);
          radio.dataset.single = n > 0 ? "0" : "1";
        }
        const span = row.querySelector(".qty span");
        if (span) span.textContent = String(n);
      });
    });
    const qtySpan = overlay.querySelector(".prod-footer .qty span");
    if (qtySpan) qtySpan.textContent = String(rascunho.qtd);
    const add = overlay.querySelector("#btn-add");
    if (add) {
      add.classList.toggle("is-off", !pode);
      add.textContent = `Adicionar ${brl(tot)}`;
    }
    if (pularScroll) {
      pularScroll = false;
      requestAnimationFrame(() => {
        const el = overlay.querySelector(`[data-open-g="${foco}"]`);
        if (el) el.scrollIntoView({ block: "nearest", behavior: reduzMovimento() ? "auto" : "smooth" });
      });
    } else if (body) body.scrollTop = y;
  }
  let rascunho = novoRascunho();
  const wa = linkWhatsapp(
    publico && publico.whatsapp,
    `Olá, vim pelo cardápio da ${(publico && publico.nome) || "loja"}`
  );

  function novoRascunho() {
    return { qtd: 1, obs: "", extras: [], ativos: {} };
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

  function taxaEntregaAtual() {
    return modoPedido === 'delivery' ? (Number(publico.delivery?.bairros?.find(b=>b.id===dadosEntrega.bairroId)?.taxaCentavos)||0)/100 : 0;
  }
  function totalComEntrega() { return Math.round((totalCarrinho()+taxaEntregaAtual())*100)/100; }
  function camposEntrega() {
    if (mesa || !publico.delivery?.ativo) return '';
    return `<section class="checkout-entrega"><h3>Como quer receber?</h3><div class="checkout-modos"><button type="button" data-modo="retirada" aria-pressed="${modoPedido==='retirada'}">Retirar na loja</button><button type="button" data-modo="delivery" aria-pressed="${modoPedido==='delivery'}">Receber em casa</button></div>${modoPedido==='delivery'?`<p>Entregamos nos bairros cadastrados de ${esc(publico.deliveryCidade||'nossa cidade')} ${esc(publico.deliveryUf||'')}.</p><label>Bairro<select data-entrega="bairroId"><option value="">Escolha seu bairro</option>${(publico.delivery.bairros||[]).map(b=>`<option value="${esc(b.id)}" ${b.id===dadosEntrega.bairroId?'selected':''}>${esc(b.nome)} — ${brl(b.taxaCentavos/100)}</option>`).join('')}</select></label><div class="checkout-endereco">${Object.entries({nome:'Seu nome',telefone:'WhatsApp com DDD',rua:'Rua / avenida',numero:'Número',complemento:'Complemento (opcional)'}).map(([k,label])=>`<label>${label}<input data-entrega="${k}" value="${esc(dadosEntrega[k])}" maxlength="${k==='telefone'?16:100}" ${k==='telefone'?'type="tel" autocomplete="tel-national"':''}></label>`).join('')}</div><p>Pagamento na entrega. A taxa aparece no total abaixo.</p>`:''}</section>`;
  }

  function nItens() {
    return carrinho.reduce((s, i) => s + i.quantidade, 0);
  }

  function abrirItem(id, origem = null, teclado = false) {
    retornoItem = origem ? { teclado, tipo: origem.classList.contains("spot-card") ? ".spot-card" : ".menu-item" } : null;
    itemAtual = String(id);
    rascunho = novoRascunho();
    buscaExtra = "";
    sheetAberto = false;
    animarItem = !reduzMovimento();
    fechandoItem = false;
    grupoAberto = null;
    const url = pathItem(id);
    if (location.pathname !== url) history.pushState({}, "", url);
    pintar();
  }

  function fecharItem() {
    if (fechandoItem) return;
    const idFechado = String(itemAtual);
    const retorno = retornoItem;
    const overlay = overlayEl();
    const url = pathLista();
    let done = false;
    const concluir = () => {
      if (done) return;
      done = true;
      fechandoItem = false;
      itemAtual = null;
      rascunho = novoRascunho();
      if (location.pathname !== url) history.pushState({}, "", url);
      travarFundo(false);
      if (overlay && overlay.parentNode) overlay.remove();
      pintarLista();
      // Restore keyboard navigation to the same occurrence, without marking mouse-opened cards.
      if (retorno?.teclado) {
        [...app.querySelectorAll(retorno.tipo)].find(el => el.dataset.open === idFechado)?.focus({ preventScroll: true });
      }
      retornoItem = null;
    };
    if (overlay && !reduzMovimento()) {
      fechandoItem = true;
      overlay.classList.remove("is-in");
      overlay.classList.add("is-out");
      overlay.addEventListener("animationend", concluir, { once: true });
      setTimeout(() => { if (fechandoItem) concluir(); }, 380);
      return;
    }
    concluir();
  }

  function setExtra(grupo, opcao, nextQtd, grupos) {
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
        rascunho.ativos[grupo.id] = true;
        const lista = grupos || sanitizarGrupos((prodAtual() || {}).grupos);
        const i = lista.findIndex((x) => String(x.id) === String(grupo.id));
        const prox = i >= 0 ? lista[i + 1] : null;
        grupoAberto = prox ? prox.id : grupo.id;
        pularScroll = true;
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
      extras: rascunho.extras,
      fotoUrl: prod.fotoUrl || "",
      fotoEnquadramento: normalizarEnquadramento(prod.fotoEnquadramento)
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
      if (modoPedido === 'delivery') calcularEntrega(publico.delivery, dadosEntrega);
      const res = await criarPedido({
        chave,
        tipo: modoPedido,
        numeroMesa: mesa || null,
        idempotencyKey: idem,
        entrega: modoPedido === "delivery" ? dadosEntrega : undefined,
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
      const pedidoId = (res.pedido && res.pedido.id) || res.id;
      if (!pedidoId) throw new Error("Pedido enviado, mas sem código de acompanhamento.");
      const remoto = (res.pedido && res.pedido.itens) || [];
      guardarPedidoLocal({
        id: pedidoId,
        chaveLicenca: chave,
        tipo: modoPedido,
        numeroMesa: mesa || null,
        status: (res.pedido && res.pedido.status) || "novo",
        taxaEntrega: res.pedido?.taxaEntrega || 0,
        subtotal: res.pedido?.subtotal ?? totalCarrinho(),
        total: (res.pedido && res.pedido.total) != null ? res.pedido.total : totalCarrinho(),
        nomeLoja: (res.pedido && res.pedido.nomeLoja) || (publico && publico.nome) || "",
        itens: carrinho.map((i, idx) => {
          const p = produtos.find((x) => String(x.id) === String(i.id));
          const r = remoto[idx] || {};
          return {
            id: i.id,
            nome: r.nome || i.nome,
            quantidade: i.quantidade,
            detalhe: r.detalhe || textoExtras(i.extras),
            observacao: i.observacao || "",
            fotoUrl: r.fotoUrl || i.fotoUrl || (p && p.fotoUrl) || "",
            extras: (r.extras && r.extras.length) ? r.extras : (i.extras || [])
          };
        }),
        at: (res.pedido && res.pedido.at) || new Date().toISOString()
      });
      salvarCarrinho(chave, mesa, []);
      sessionStorage.removeItem(`flowpdv_idem_${chave}_${mesa || "r"}`);
      history.pushState({}, "", `/${chave}/pedido/${pedidoId}` + (res.pedido?.acompanhamentoV2 ? `?acompanhamento=${encodeURIComponent(res.pedido.acompanhamentoV2)}` : ""));
      window.dispatchEvent(new Event("flowpdv:route"));
    } catch (err) {
      toast(erroAmigavel(err), 3200);
      const enviarBtn = app.querySelector("#btn-enviar");
      if (enviarBtn) {
        enviarBtn.disabled = false;
        enviarBtn.textContent = `Enviar pedido · ${brl(totalComEntrega())}`;
      }
    }
  }

  function topoLoja(extra = "") {
    const aberto = !publico.pausado;
    const min = String(publico.pedidoMinimoTexto || "").trim();
    const mostraMin = min && !/^sem pedido m[ií]nimo\.?$/i.test(min);
    const meta = [
      mesa ? `Mesa ${mesa}` : CANAL_LOJA,
      aberto ? "Aberto" : "Fechado",
      ...String(publico.horarioTexto || "").split("·")
    ].map(texto => texto.trim()).filter(Boolean)
      .map(texto => `<span class="store-detail">${esc(texto)}</span>`).join("");
    const prazo = aberto && publico.entregaTexto
      ? `<span class="store-detail"><span class="store-delivery">${ico.delivery}<span>Entrega: ${esc(publico.entregaTexto)}</span></span></span>` : "";
    const minimo = aberto && mostraMin ? `<span class="store-detail">${esc(min)}</span>` : "";
    return `
      <header class="store-head">
        <div class="store-row">
          ${publico.logoUrl
            ? `<img class="store-logo" src="${esc(publico.logoUrl)}" alt="">`
            : `<div class="store-logo ph-logo">${esc(iniciais(publico.nome))}</div>`}
          <div class="store-meta">
            <h1>${esc(publico.nome || "Cardápio")}</h1>
            <p class="store-end"><span class="store-status ${aberto ? "on" : "off"}"></span><span class="store-details">${meta}${prazo}${minimo}</span></p>
          </div>
          <div class="store-tools">
            <button type="button" class="icon-btn" id="btn-busca" aria-label="Buscar">${ico.search}</button>
            ${wa ? `<a class="icon-btn wa" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ico.wa}</a>` : ""}
          </div>
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

  function cardProduto(p, destaque, todosDestaque) {
    const foto = p.fotoUrl
      ? htmlFoto(p)
      : `<div class="ph">${ico.photo}</div>`;
    if (destaque) {
      return `
        <article class="spot-card" data-open="${esc(p.id)}" role="button" tabindex="0">
          <div class="spot-media">${foto}
            </div><span class="spot-cap"><b>${esc(p.nome)}</b><small>${esc(rotuloPreco(p))}</small></span>
        </article>`;
    }
    return `
      <article class="menu-item" data-open="${esc(p.id)}" role="button" tabindex="0">
        <div class="menu-media">${foto}<span class="add-dot">${ico.plus}</span></div>
        <div class="menu-copy${p.descricao ? "" : " short"}">
          ${p.destaque && !todosDestaque ? `<em class="fav">Mais pedido</em>` : ""}
          <h3>${esc(p.nome)}</h3>
          ${p.descricao ? `<p>${esc(p.descricao)}</p>` : ""}
          <strong>${esc(rotuloPreco(p))}</strong>
        </div>
      </article>
    `;
  }

  function pintarLista() {
    const q = busca.trim().toLowerCase();
    const lista = q
      ? produtos.filter((p) => `${p.nome} ${p.descricao || ""} ${p.categoria || ""}`.toLowerCase().includes(q))
      : produtos;
    const destaquesAll = produtos.filter((p) => p.destaque);
    const todosDestaque = produtos.length > 0 && destaquesAll.length >= produtos.length;
    const destaques = (!q && !todosDestaque) ? destaquesAll.slice(0, 8) : [];
    const cats = q ? [] : [...new Set(lista.map((p) => p.categoria || "Geral"))].sort(compararCategorias);
    const idMais = "cat-mais-pedidos";
    const abas = [
      ...(destaques.length ? [["Mais pedidos", idMais]] : []),
      ...cats.map((c) => [c, idCategoria(c)])
    ];
    const extraTopo = [
      `<div class="store-search${buscaAberta ? '' : ' is-collapsed'}" id="store-search" ${buscaAberta ? '' : 'inert'}>
          <div class="store-search-inner"><input aria-label="Buscar no cardápio" type="search" id="menu-busca" placeholder="Buscar no cardápio" value="${esc(busca)}"></div>
        </div>`,
      abas.length > 1 ? `
        <nav class="cats" aria-label="Categorias">
          ${abas.map(([nome, id], i) => {
            const on = catAtiva ? catAtiva === id : i === 0;
            return `<button type="button" class="${on ? "on" : ""}" data-cat="${id}">${esc(nome)}</button>`;
          }).join("")}
        </nav>` : ""
    ].join("");

    app.innerHTML = `
      <div class="menu-frame">
        <div class="menu-page ${nItens() ? "has-cart" : ""}">
          ${topoLoja(extraTopo)}
          ${destaques.length ? `
            <section class="spot-wrap" id="${idMais}">
              <div class="spot-heading"><div><h2 id="spot-title">Mais pedidos</h2><p>Explore os destaques da loja.</p></div><div class="spot-controls"><span id="spot-position" aria-live="polite"></span><button type="button" class="icon-btn" data-spot-prev aria-label="Destaques anteriores" aria-controls="spot-carousel">${ico.back}</button><button type="button" class="icon-btn" data-spot-next aria-label="Próximos destaques" aria-controls="spot-carousel">${ico.back}</button></div></div>
              <div class="spot-row" id="spot-carousel" role="region" aria-roledescription="carrossel" aria-labelledby="spot-title" tabindex="0">${destaques.map((p) => cardProduto(p, true, todosDestaque)).join("")}</div>
            </section>` : ""}
          <div class="menu-list">
            ${q ? `
              <h2 class="sec-title">${lista.length ? "Resultados" : "Nada encontrado"}</h2>
              <div class="menu-sec">${lista.map((p) => cardProduto(p, false, todosDestaque)).join("")}</div>
            ` : cats.map((c) => {
              const itens = lista.filter((p) => (p.categoria || "Geral") === c);
              return `
                <section class="menu-sec" id="${idCategoria(c)}">
                  <h2 class="sec-title">${esc(c)}</h2>
                  ${itens.map((p) => cardProduto(p, false, todosDestaque)).join("")}
                </section>`;
            }).join("")}
          </div>
          <footer class="menu-signature"><img src="/logos/FlowPDV-horizontal-claro.png" alt="FlowPDV"><span>Cardápio digital</span></footer>
          ${nItens() ? `
            <button type="button" class="cart-bar" id="btn-ver-pedido">
              <span class="cart-ico">${ico.bag}<em>${nItens()}</em></span>
              <span class="cart-bar-txt">Ver pedido</span>
              <strong>${brl(totalCarrinho())}</strong>
            </button>` : ""}
          ${sheetAberto ? pintarSheet() : ""}
        </div>
      </div>
    `;

    bindLista();
    travarFundo(sheetAberto);
  }

  function linhasExtra(prod, extras) {
    const grupos = sanitizarGrupos(prod && prod.grupos);
    return (extras || []).map((e) => {
      const g = grupos.find((x) => String(x.id) === String(e.grupoId));
      const q = Number(e.quantidade) || 1;
      return {
        grupo: (g && g.nome) || "",
        nome: q > 1 ? `${q}× ${e.nome}` : (e.nome || "")
      };
    }).filter((x) => x.nome);
  }

  function htmlCartItem(i, editar) {
    const p = produtos.find((x) => String(x.id) === String(i.id));
    const tot = p ? precoLinha(p, i.extras, i.quantidade) : (i.preco * i.quantidade);
    const foto = (p && p.fotoUrl) || i.fotoUrl;
    const extras = linhasExtra(p, i.extras);
    return `
      <article class="cart-item" data-linha="${esc(i.linhaId)}">
        ${foto
          ? `<div class="cart-thumb">${htmlFoto({ fotoUrl: foto, fotoEnquadramento: p?.fotoUrl ? p.fotoEnquadramento : i.fotoEnquadramento })}</div>`
          : `<div class="cart-thumb ph">${ico.photo}</div>`}
        <div class="cart-copy">
          <div class="cart-item-top">
            <strong>${esc(i.quantidade)}× ${esc(i.nome)}</strong>
            <b>${brl(tot)}</b>
          </div>
          ${extras.length ? `
            <ul class="cart-extras">
              ${extras.map((e) => `<li>${e.grupo ? `<em>${esc(e.grupo)}</em>` : ""}<span>${esc(e.nome)}</span></li>`).join("")}
            </ul>` : ""}
          ${i.observacao ? `<p class="cart-obs">Obs.: ${esc(i.observacao)}</p>` : ""}
          ${editar ? `
            <div class="cart-item-foot">
              <div class="qty mini">
                <button type="button" data-minus-line>−</button>
                <span>${i.quantidade}</span>
                <button type="button" data-plus-line>+</button>
              </div>
              <button type="button" class="cart-del" data-del-line>Remover</button>
            </div>` : ""}
        </div>
      </article>`;
  }

  function pintarSheet() {
    const canal = mesa ? `Mesa ${esc(String(mesa))}` : CANAL_LOJA;
    return `
      <div class="sheet${sheetAnimar ? " is-in" : ""}" id="sheet">
        <div class="sheet-card">
          <div class="sheet-grab"></div>
          <header class="sheet-head">
            <h2>Seu pedido</h2>
            <p>${canal} · ${nItens()} ${nItens() === 1 ? "item" : "itens"}</p>
          </header>
          <div class="sheet-body">
            ${carrinho.map((i) => htmlCartItem(i, true)).join("")}
          ${camposEntrega()}
          </div>
          <div class="sheet-foot">
            ${modoPedido==='delivery'?`<div class="delivery-total"><span>Subtotal ${brl(totalCarrinho())}</span><span id="checkout-taxa">${dadosEntrega.bairroId?'Entrega '+brl(taxaEntregaAtual()):'Selecione o bairro para calcular a entrega'}</span></div>`:''}
            <div class="cart-total">
              <span>Total</span>
              <strong id="checkout-total">${brl(totalComEntrega())}</strong>
            </div>
            <button class="btn-primary" id="btn-enviar" type="button">Enviar pedido · ${brl(totalComEntrega())}</button>
            <button class="btn-ghost" id="btn-fechar" type="button">Continuar pedindo</button>
          </div>
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
          <button type="button" class="back-link" id="btn-voltar">${ico.back} Cardápio</button>
          <div class="closed-box"><h2>${esc(prod.nome)}</h2><p>Item esgotado no momento.</p></div>
        </div></div>`;
      app.querySelector("#btn-voltar").addEventListener("click", fecharItem);
      return;
    }
    const grupos = sanitizarGrupos(prod.grupos);
    let tot = precoLinha(prod, rascunho.extras, rascunho.qtd);
    for (const g of grupos) {
      const ligado = g.min > 0 || Boolean(rascunho.ativos[g.id]);
      if (!ligado || !g.precoGrupo) continue;
      const tem = (rascunho.extras || []).some((e) => String(e.grupoId) === String(g.id));
      if (!tem) tot += g.precoGrupo * Math.max(1, rascunho.qtd);
    }
    const precisa = (g) => (g.min > 0 ? g.min : (rascunho.ativos[g.id] ? 1 : 0));
    const pendente = grupos.find((g) => qtdNoGrupo(rascunho.extras, g.id) < precisa(g));
    let pode = true;
    let motivo = "";
    try { validarExtras(prod, rascunho.extras); }
    catch (err) { pode = false; motivo = err.message; }
    if (pode && pendente) {
      pode = false;
      motivo = precisa(pendente) === 1
        ? `Escolha uma opção em ${pendente.nome}.`
        : `Escolha ${precisa(pendente)} opções em ${pendente.nome}.`;
    }
    if (!grupoAberto) grupoAberto = pendente ? pendente.id : (grupos[0] && grupos[0].id);
    const foco = String(grupoAberto || "");
    itemUi = { grupos, tot, pode, motivo, pendente, precisa, foco };
    const overlayAtual = overlayEl();
    const entrar = animarItem && !reduzMovimento();
    animarItem = false;
    if (overlayAtual && overlayAtual.dataset.item === String(prod.id) && !entrar) {
      atualizarProdutoAberto();
      travarFundo(true);
      return;
    }

    let overlay = overlayAtual;
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "prod-overlay";
      document.body.appendChild(overlay);
    }
    overlay.className = `prod-overlay${entrar ? " is-in" : ""}`;
    overlay.innerHTML = `
          <div class="prod-page">
            <button type="button" class="icon-btn back-float" id="btn-voltar" aria-label="Voltar">${ico.back}</button>
            ${prod.fotoUrl ? `<div class="prod-hero">${htmlFoto(prod)}</div>` : `<div class="prod-hero ph-hero">${ico.photo}</div>`}
            <div class="prod-body">
              <h1>${esc(prod.nome)}</h1>
            <p class="prod-cat">${esc(prod.categoria || "")}</p>
              ${prod.descricao ? `<p class="prod-desc">${esc(prod.descricao)}</p>` : ""}
              <p class="prod-from">${mostraAPartirDe(prod) ? "A partir de " : ""}${brl(precoMinimo(prod))}</p>
              ${grupos.length ? grupos.map((g) => {
                const opcional = g.min <= 0;
                const ativo = !opcional || Boolean(rascunho.ativos[g.id]);
                const aberto = String(g.id) === foco && ativo;
                const falta = qtdNoGrupo(rascunho.extras, g.id) < precisa(g);
                const q = buscaExtra.trim().toLowerCase();
                return `
                  <section class="opt-group${aberto ? " open" : ""}${falta ? " need" : ""}" data-g="${esc(g.id)}">
                    <header>
                      ${opcional ? `<button type="button" class="opt-check${ativo ? " on" : ""}" data-toggle-g="${esc(g.id)}" aria-label="${ativo ? "Desativar" : "Ativar"} ${esc(g.nome)}"></button>` : ""}
                      <button type="button" class="opt-head" data-open-g="${esc(g.id)}">
                        <h2>${esc(g.nome)}</h2>
                        <small>${esc(textoRegra(g, precisa))}</small>
                      </button>
                    </header>
                    <div class="opt-body"><div class="opt-body-in">
                      ${g.precoGrupo ? `
                        <div class="opt-row locked">
                          <div>
                            <strong>${esc(g.inclusoNome || "Extra do combo")}</strong>
                            <small>Entra junto com a bebida</small>
                          </div>
                          <em>+ ${brl(g.precoGrupo)}</em>
                        </div>` : ""}
                      ${g.opcoes.length > 16 ? `<input type="search" class="opt-search" placeholder="Pesquisar em ${esc(g.nome)}" value="${esc(buscaExtra)}">` : ""}
                      ${g.opcoes.map((o) => {
                        const n = qtdOpcao(rascunho.extras, g.id, o.id);
                        const on = n > 0;
                        const hide = q && !`${o.nome} ${o.descricao || ""}`.toLowerCase().includes(q);
                        return `
                          <div class="opt-row ${on ? "on" : ""}" data-g="${esc(g.id)}" data-o="${esc(o.id)}" role="button" tabindex="0"${hide ? " hidden" : ""}>
                            <div>
                              <strong>${esc(o.nome)}</strong>
                              ${o.descricao ? `<small>${esc(o.descricao)}</small>` : ""}
                              <em>${o.preco ? `+ ${brl(o.preco)}` : (g.precoGrupo ? "Incluso no extra" : "Incluso")}</em>
                            </div>
                            ${g.tipo === "single"
                              ? `<button type="button" class="opt-radio ${on ? "on" : ""}" data-g="${esc(g.id)}" data-o="${esc(o.id)}" data-single="${on ? 0 : 1}" aria-label="${esc(o.nome)}"></button>`
                              : `<div class="qty mini">
                                  <button type="button" data-g="${esc(g.id)}" data-o="${esc(o.id)}" data-delta="-1">−</button>
                                  <span>${n}</span>
                                  <button type="button" data-g="${esc(g.id)}" data-o="${esc(o.id)}" data-delta="1">+</button>
                                </div>`}
                          </div>`;
                      }).join("")}
                    </div></div>
                  </section>`;
              }).join("") : ""}
              <section class="opt-group open">
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
              <button class="btn-primary${pode ? "" : " is-off"}" id="btn-add" type="button">
                Adicionar ${brl(tot)}
              </button>
            </div>
          </div>
    `;

    overlay.dataset.item = String(prod.id);
    travarFundo(true);
    if (pularScroll) {
      pularScroll = false;
      requestAnimationFrame(() => {
        const el = overlay.querySelector(`[data-open-g="${foco}"]`);
        if (el) el.scrollIntoView({ block: "nearest", behavior: reduzMovimento() ? "auto" : "smooth" });
      });
    }
    if (!overlay.dataset.bound) {
      overlay.dataset.bound = "1";
      overlay.addEventListener("click", (ev) => {
        if (ev.target.id === "prod-overlay") fecharItem();
      });
    }

    overlay.querySelector("#btn-voltar").addEventListener("click", fecharItem);
    overlay.querySelector("#qtd-menos").addEventListener("click", () => {
      rascunho.qtd = Math.max(1, rascunho.qtd - 1);
      pintar();
    });
    overlay.querySelector("#qtd-mais").addEventListener("click", () => {
      rascunho.qtd = Math.min(99, rascunho.qtd + 1);
      pintar();
    });
    const obs = overlay.querySelector("#obs-item");
    if (obs) obs.addEventListener("input", () => { rascunho.obs = obs.value; });
    overlay.querySelectorAll(".opt-search").forEach((el) => {
      el.addEventListener("input", () => { buscaExtra = el.value; pintar(); });
    });
    overlay.querySelectorAll("[data-toggle-g]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = btn.dataset.toggleG;
        if (rascunho.ativos[id]) {
          delete rascunho.ativos[id];
          rascunho.extras = rascunho.extras.filter((e) => String(e.grupoId) !== String(id));
          grupoAberto = null;
        } else {
          rascunho.ativos[id] = true;
          grupoAberto = id;
        }
        pintar();
      });
    });
    overlay.querySelectorAll("[data-open-g]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.openG;
        const g = (itemUi && itemUi.grupos || []).find((x) => String(x.id) === String(id));
        if (g && g.min <= 0) rascunho.ativos[id] = true;
        grupoAberto = id;
        pintar();
      });
    });
    function aplicarOpcao(gId, oId, single, delta) {
      const gruposNow = (itemUi && itemUi.grupos) || [];
      const g = gruposNow.find((x) => String(x.id) === String(gId));
      const o = g && g.opcoes.find((x) => String(x.id) === String(oId));
      if (!g || !o) return;
      if (single != null) setExtra(g, o, Number(single), gruposNow);
      else if (delta != null) {
        const n = qtdOpcao(rascunho.extras, g.id, o.id);
        setExtra(g, o, n + Number(delta), gruposNow);
      }
    }
    overlay.querySelectorAll("button[data-g][data-o]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        aplicarOpcao(btn.dataset.g, btn.dataset.o, btn.dataset.single, btn.dataset.delta);
      });
    });
    overlay.querySelectorAll(".opt-row[data-g][data-o]").forEach((row) => {
      const escolher = () => {
        const gruposNow = (itemUi && itemUi.grupos) || [];
        const g = gruposNow.find((x) => String(x.id) === String(row.dataset.g));
        const o = g && g.opcoes.find((x) => String(x.id) === String(row.dataset.o));
        if (!g || !o) return;
        const n = qtdOpcao(rascunho.extras, g.id, o.id);
        if (g.tipo === "single") setExtra(g, o, n ? 0 : 1, gruposNow);
        else if (!n) setExtra(g, o, 1, gruposNow);
      };
      row.addEventListener("click", (ev) => {
        if (ev.target.closest("button, .qty")) return;
        escolher();
      });
      row.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          escolher();
        }
      });
    });
    overlay.querySelector("#btn-add").addEventListener("click", () => {
      const ui = itemUi || {};
      if (!ui.pode) {
        if (ui.pendente) {
          grupoAberto = ui.pendente.id;
          if (ui.pendente.min <= 0) rascunho.ativos[ui.pendente.id] = true;
          pintar();
          requestAnimationFrame(() => {
            const el = overlay.querySelector(`[data-open-g="${ui.pendente.id}"]`);
            if (el) el.scrollIntoView({ block: "center", behavior: reduzMovimento() ? "auto" : "smooth" });
          });
        }
        toast(ui.motivo || "Complete as opções do item.");
        return;
      }
      adicionarAoPedido();
    });
  }

  function ligarCarrossel() {
    limparCarrossel();
    const row = app.querySelector('.spot-row');
    if (!row) return;
    const prev = app.querySelector('[data-spot-prev]'), next = app.querySelector('[data-spot-next]');
    const cards = [...row.querySelectorAll('.spot-card')];
    const medidas = () => {
      const css = getComputedStyle(row), gap = parseFloat(css.columnGap) || 0;
      const passo = cards[0].getBoundingClientRect().width + gap;
      const largura = row.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      return {passo, visiveis:Math.max(1,Math.floor((largura + gap + 1) / passo))};
    };
    const atualizar = () => {
      const {passo,visiveis} = medidas();
      const inicio = Math.min(cards.length, Math.round(row.scrollLeft / passo) + 1);
      prev.disabled = row.scrollLeft <= 2;
      next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
      app.querySelector('#spot-position').textContent = `${inicio}–${Math.min(cards.length,inicio+visiveis-1)} de ${cards.length}`;
    };
    const mover = direcao => {const {passo,visiveis}=medidas();row.scrollBy({left:direcao*passo*visiveis,behavior:reduzMovimento()?'instant':'smooth'});};
    prev.onclick = () => mover(-1);
    next.onclick = () => mover(1);
    const teclado = ev => {if (ev.target !== row || !['ArrowLeft','ArrowRight'].includes(ev.key)) return;ev.preventDefault();mover(ev.key==='ArrowLeft'?-1:1);};
    row.addEventListener('scroll',atualizar,{passive:true});
    row.addEventListener('keydown',teclado);
    const observer = new ResizeObserver(atualizar); observer.observe(row);
    atualizar();
    limparCarrossel = () => {observer.disconnect();row.removeEventListener('scroll',atualizar);row.removeEventListener('keydown',teclado);};
  }

  function bindLista() {
    ligarCarrossel();
    const buscaEl = app.querySelector("#menu-busca");
    if (buscaEl) {
      buscaEl.addEventListener("input", () => { busca = buscaEl.value; buscaAberta = true; focarBusca = true; pintar(); });
      if (focarBusca && !sheetAberto) {
        focarBusca = false;
        const pos = buscaEl.value.length;
        buscaEl.focus({preventScroll:true});
        buscaEl.setSelectionRange(pos, pos);
      }
    }
    const btnBusca = app.querySelector("#btn-busca");
    if (btnBusca) {
      btnBusca.addEventListener("click", () => {
        buscaAberta = !buscaAberta;
        pausaBusca = performance.now() + 280;
        atualizarBusca();
        if (buscaAberta) setTimeout(() => {
          if (buscaAberta && buscaEl?.isConnected && !itemAtual && !sheetAberto) buscaEl.focus({preventScroll:true});
        }, reduzMovimento() ? 0 : 260);
        else if (document.activeElement === buscaEl) buscaEl.blur();
      });
    }
    btnBusca?.setAttribute('aria-controls', 'store-search');
    atualizarBusca();
    limparCategorias();
    limparCategorias = acompanharCategorias(app, {
      aoAtivar: id => { catAtiva = id; }, movimentoReduzido: reduzMovimento
    });
    app.querySelectorAll("[data-open]").forEach((el) => {
      const go = (teclado = false) => abrirItem(el.dataset.open, el, teclado);
      el.addEventListener("click", ev => go(ev.detail === 0));
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(true); }
      });
    });
    const ver = app.querySelector("#btn-ver-pedido");
    if (ver) ver.addEventListener("click", () => { sheetAnimar = true; sheetAberto = true; pintar(); });
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
      const del = row.querySelector("[data-del-line]");
      if (plus) plus.addEventListener("click", () => {
        const i = carrinho.find((x) => x.linhaId === id);
        if (i) i.quantidade = Math.min(99, i.quantidade + 1);
        salvarCarrinho(chave, mesa, carrinho);
        sheetAnimar = false;
        pintar();
      });
      if (minus) minus.addEventListener("click", () => {
        const i = carrinho.findIndex((x) => x.linhaId === id);
        if (i < 0) return;
        carrinho[i].quantidade -= 1;
        if (carrinho[i].quantidade <= 0) carrinho.splice(i, 1);
        salvarCarrinho(chave, mesa, carrinho);
        if (!carrinho.length) sheetAberto = false;
        else sheetAnimar = false;
        pintar();
      });
      if (del) del.addEventListener("click", () => {
        carrinho = carrinho.filter((x) => x.linhaId !== id);
        salvarCarrinho(chave, mesa, carrinho);
        if (!carrinho.length) sheetAberto = false;
        else sheetAnimar = false;
        pintar();
      });
    });
    app.querySelectorAll('[data-modo]').forEach(btn=>btn.onclick=()=>{modoPedido=btn.dataset.modo;sheetAnimar=false;pintar();});
    app.querySelectorAll('[data-entrega]').forEach(el=>el.addEventListener('input',()=>{
      if(el.dataset.entrega==='telefone')el.value=telefoneFormatado(el.value);
      dadosEntrega[el.dataset.entrega]=el.value;
      const total=app.querySelector('#checkout-total'), taxa=app.querySelector('#checkout-taxa'), enviar=app.querySelector('#btn-enviar');
      if(total)total.textContent=brl(totalComEntrega());
      if(taxa)taxa.textContent=dadosEntrega.bairroId?'Entrega '+brl(taxaEntregaAtual()):'Selecione o bairro para calcular a entrega';
      if(enviar)enviar.textContent=`Enviar pedido · ${brl(totalComEntrega())}`;
    }));
    const enviarBtn = app.querySelector("#btn-enviar");
    if (enviarBtn) enviarBtn.addEventListener("click", async () => {
      enviarBtn.disabled = true;
      enviarBtn.textContent = "Enviando...";
      await enviar();
    });
  }

  function pintar() {
    if (itemAtual) {
      if (!app.querySelector(".menu-page")) pintarLista();
      else {
        const sheet = app.querySelector("#sheet");
        if (sheet) sheet.remove();
      }
      pintarProduto();
      return;
    }
    const overlay = overlayEl();
    if (overlay) overlay.remove();
    pintarLista();
  }

  pintar();
  function fecharComEscape(ev) {
    if (ev.key !== "Escape" || ev.defaultPrevented || ev.isComposing || !itemAtual) return;
    ev.preventDefault();
    fecharItem();
  }
  window.addEventListener("keydown", fecharComEscape);
  window.addEventListener('scroll', acompanharBusca, {passive:true});
  return () => { window.removeEventListener("keydown", fecharComEscape); window.removeEventListener('scroll', acompanharBusca); limparCarrossel(); limparCategorias(); overlayEl()?.remove(); travarFundo(false); };
}
