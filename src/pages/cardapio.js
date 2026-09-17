import { criarPedido, lerCardapioPublico } from "../lib/pedidos.js";
import { brl, erroAmigavel, esc } from "../lib/format.js";

function cartKey(chave, mesa) {
  return `flowpdv_cart_${chave}_${mesa || "retirada"}`;
}

function lerCarrinho(chave, mesa) {
  try { return JSON.parse(localStorage.getItem(cartKey(chave, mesa)) || "[]") || []; }
  catch { return []; }
}

function salvarCarrinho(chave, mesa, itens) {
  localStorage.setItem(cartKey(chave, mesa), JSON.stringify(itens));
}

export async function renderCardapio(app, { chave, mesa }) {
  app.innerHTML = `<p class="empty">Carregando cardápio...</p>`;
  let publico;
  try {
    publico = await lerCardapioPublico(chave);
  } catch (err) {
    app.innerHTML = `<div class="closed-box"><h2>Cardápio indisponível</h2><p>${erroAmigavel(err)}</p></div>`;
    return;
  }

  if (!publico || !(publico.produtos || []).length) {
    app.innerHTML = `<div class="closed-box"><h2>Cardápio ainda não publicado</h2><p>A loja precisa marcar os produtos e clicar em Publicar no painel.</p></div>`;
    return;
  }
  if (publico.pausado) {
    app.innerHTML = `<div class="closed-box"><h2>${publico.nome || "Loja"}</h2><p>Cardápio fechado no momento.</p></div>`;
    return;
  }

  const produtos = (publico.produtos || []).filter((p) => !p.esgotado);
  const categorias = ["Todos", ...Array.from(new Set(produtos.map((p) => p.categoria || "Geral")))];
  let cat = "Todos";
  let carrinho = lerCarrinho(chave, mesa);
  let sheetAberto = false;

  function qtd(id) {
    const item = carrinho.find((i) => i.id === id);
    return item ? item.quantidade : 0;
  }

  function setQtd(prod, n) {
    const q = Math.max(0, n);
    const i = carrinho.findIndex((x) => x.id === prod.id);
    if (q <= 0) {
      if (i >= 0) carrinho.splice(i, 1);
    } else if (i >= 0) {
      carrinho[i].quantidade = q;
    } else {
      carrinho.push({
        id: prod.id,
        nome: prod.nome,
        preco: prod.preco,
        quantidade: q,
        observacao: ""
      });
    }
    salvarCarrinho(chave, mesa, carrinho);
    pintar();
  }

  function total() {
    return carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
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
          observacao: i.observacao || ""
        }))
      });
      salvarCarrinho(chave, mesa, []);
      sessionStorage.removeItem(`flowpdv_idem_${chave}_${mesa || "r"}`);
      const pedidoId = (res.pedido && res.pedido.id) || res.id;
      history.pushState({}, "", `/${chave}/pedido/${pedidoId}`);
      window.dispatchEvent(new Event("flowpdv:route"));
    } catch (err) {
      const el = document.createElement("div");
      el.className = "app-toast";
      el.textContent = erroAmigavel(err);
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }
  }

  function pintar() {
    const lista = cat === "Todos" ? produtos : produtos.filter((p) => (p.categoria || "Geral") === cat);
    const nItens = carrinho.reduce((s, i) => s + i.quantidade, 0);
    app.innerHTML = `
      <div class="menu-page">
        <header class="menu-head">
          <div>
            <h1>${esc(publico.nome || "Cardápio")}</h1>
            <small>${mesa ? `Mesa ${esc(mesa)}` : "Retirada no balcão"}</small>
          </div>
        </header>
        <div class="cats">
          ${categorias.map((c) => `<button type="button" class="${c === cat ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
        </div>
        <div class="menu-list">
          ${lista.map((p) => `
            <article class="menu-item">
              ${p.fotoUrl ? `<img src="${p.fotoUrl}" alt="">` : `<div class="ph"></div>`}
              <div>
                <h3>${esc(p.nome)}</h3>
                <p>${esc(p.descricao || "")}</p>
                <footer>
                  <strong>${brl(p.preco)}</strong>
                  <div class="qty">
                    <button type="button" data-minus="${p.id}">−</button>
                    <span>${qtd(p.id)}</span>
                    <button type="button" data-plus="${p.id}">+</button>
                  </div>
                </footer>
              </div>
            </article>
          `).join("") || `<p class="empty">Nada nesta categoria.</p>`}
        </div>
        ${nItens ? `
          <div class="cart-bar">
            <span>${nItens} ${nItens === 1 ? "item" : "itens"} · ${brl(total())}</span>
            <button type="button" id="btn-ver-pedido">Ver pedido</button>
          </div>` : ""}
        ${sheetAberto ? `
          <div class="sheet" id="sheet">
            <div class="sheet-card">
              <h2>Seu pedido</h2>
              ${carrinho.map((i) => `
                <div class="cart-line">
                  <span>${esc(i.quantidade)}× ${esc(i.nome)}</span>
                  <strong>${brl(i.preco * i.quantidade)}</strong>
                </div>
              `).join("")}
              <label>Observação</label>
              <textarea class="obs" id="obs-geral" placeholder="Ex.: sem cebola, ponto da carne">${carrinho.map((i) => i.observacao).filter(Boolean).join(" · ")}</textarea>
              <button class="btn-primary" id="btn-enviar" type="button">Enviar pedido · ${brl(total())}</button>
              <button class="btn-ghost" id="btn-fechar" type="button" style="width:100%;margin-top:8px">Voltar</button>
            </div>
          </div>` : ""}
      </div>
    `;

    app.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => { cat = b.dataset.cat; pintar(); }));
    app.querySelectorAll("[data-plus]").forEach((b) => {
      const prod = produtos.find((p) => String(p.id) === String(b.dataset.plus));
      if (prod) b.addEventListener("click", () => setQtd(prod, qtd(prod.id) + 1));
    });
    app.querySelectorAll("[data-minus]").forEach((b) => {
      const prod = produtos.find((p) => String(p.id) === String(b.dataset.minus));
      if (prod) b.addEventListener("click", () => setQtd(prod, qtd(prod.id) - 1));
    });
    const ver = app.querySelector("#btn-ver-pedido");
    if (ver) ver.addEventListener("click", () => { sheetAberto = true; pintar(); });
    const fechar = app.querySelector("#btn-fechar");
    if (fechar) fechar.addEventListener("click", () => { sheetAberto = false; pintar(); });
    const obs = app.querySelector("#obs-geral");
    if (obs) obs.addEventListener("input", () => {
      if (carrinho[0]) carrinho[0].observacao = obs.value;
      salvarCarrinho(chave, mesa, carrinho);
    });
    const enviarBtn = app.querySelector("#btn-enviar");
    if (enviarBtn) enviarBtn.addEventListener("click", async () => {
      enviarBtn.disabled = true;
      enviarBtn.textContent = "Enviando...";
      await enviar();
    });
  }

  pintar();
}
