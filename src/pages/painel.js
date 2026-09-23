import {centavosDoCampo, ligarCampoReais} from "../lib/moeda.js";
import {compararCategorias} from "../lib/categorias.js";
import {ligarBuscaCep} from "../lib/cep.js";
import {telefoneFormatado, telefoneDigitos, enderecoEstruturado, enderecoTexto, validarEntrega} from "../../shared/entrega.js";
import QRCode from "qrcode";
import "./painel-catalogo.css";
import { ico } from "../lib/icons.js";
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
import { brl, erroAmigavel, originPublico, esc, toast } from "../lib/format.js";
import { sanitizarGrupos } from "../lib/grupos.js";
import { horaPedido, htmlLinhaItem } from "../lib/pedido-ui.js";
import { abrirEditorGrupos } from "./painel-grupos.js";
import {
  CANAL_LOJA,
  DIAS,
  ENTREGA_PRESETS,
  HORARIO_PRESETS,
  MINIMO_PRESETS,
  lerFormatoLoja,
  patchLoja,
  textoEntrega,
  textoHorario,
  textoMinimo
} from "../lib/loja.js";

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

function acaoStatus(status) {
  if (status === "em_preparo") return "Preparar";
  if (status === "pronto") return "Marcar pronto";
  if (status === "entregue") return "Entregar";
  return rotuloStatus(status);
}

const COLUNAS = [
  { id: "novo", label: "Novos" },
  { id: "em_preparo", label: "Em preparo" },
  { id: "pronto", label: "Prontos" }
];

export async function renderPainel(app, sessao) {
  document.body.className = "is-painel";
  const { chave, licenca } = sessao;
  let aba = "cardapio";
  let produtos = [];
  let overlays = {};
  let config = {};
  let filtro = "";
  let limparCep = () => {};
  let categoria = "", situacao = "", carregado = false, publicando = false;
  const rascunhos = new Map(), salvando = new Set(), estados = new Map(), editoresAbertos = new Set();
  let unsubPedidos = null;
  let pedidos = [];
  let conhecidos = new Set();
  let primeiroSnap = true;
  let vistaPedidos = "cozinha";
  let lojaDraft = null, salvandoLoja = false, pedidosCarregados = false, erroPedidos = "";
  const pedidosSalvando = new Set(), pedidosErros = new Map();

  app.innerHTML = `
    <div class="painel-shell">
      <header class="painel-top">
        <div class="painel-brand">
          <img src="/logos/FlowPDV-horizontal-claro.png" alt="FlowPDV">
          <div class="meta"><span class="store-avatar" aria-hidden="true">${esc(nomeDaLoja(licenca).slice(0,1))}</span><div>
            <strong>${esc(nomeDaLoja(licenca))}</strong>
            <small>Gestão do cardápio</small></div>
          </div>
        </div>
        <nav class="tabs" aria-label="Seções do painel">
          <button type="button" data-aba="cardapio" class="on" aria-current="page">${ico.bag}<span>Cardápio</span></button>
          <button type="button" data-aba="loja">${ico.store}<span>Loja</span></button>
          <button type="button" data-aba="pedidos">${ico.orders}<span>Pedidos</span></button>
          <button type="button" data-aba="qr">${ico.qr}<span>QR e links</span></button>
        </nav>
        <div class="painel-nav-foot"><a class="painel-preview" href="/${encodeURIComponent(chave)}" target="_blank" rel="noopener">${ico.eye}Ver cardápio ${ico.external}</a><button class="btn-ghost" id="btn-sair" type="button">${ico.logout}<span>Sair da conta</span></button></div>
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
      if (!carregado || salvandoLoja) return;
      aba = btn.dataset.aba;
      window.scrollTo({top:0,left:0,behavior:"instant"});
      app.querySelectorAll(".tabs button").forEach((b) => {b.classList.toggle("on", b === btn);if(b===btn)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});
      pintar();
    });
  });

  async function carregar() {
    carregado = false;
    main.innerHTML = `<p class="empty">Carregando produtos do PDV...</p>`;
    try {
      const [backup, overlayMap, cfg] = await Promise.all([
        carregarBackupLoja(chave),
        listarOverlays(chave),
        lerConfig(chave)
      ]);
      overlays = overlayMap;
      config = cfg || {};
      produtos = (backup.produtos || []).filter(produtoAtivo);
      const logo = String(licenca.logoUrl || backup.config?.logoUrl || "");
      const avatar = app.querySelector('.store-avatar');
      if (logo && avatar) {
        const img = document.createElement('img'); img.src = logo; img.alt = '';
        img.onerror = () => avatar.textContent = nomeDaLoja(licenca).slice(0,1);
        avatar.replaceChildren(img);
      }
      carregado = true;
      pintar();
    } catch (err) {
      main.innerHTML = `<section class="catalogo-empty" role="alert"><h2>Não foi possível carregar o cardápio</h2><p>${esc(erroAmigavel(err))}</p><button type="button" class="btn-ghost" id="catalogo-retry">Tentar novamente</button></section>`;
      main.querySelector("#catalogo-retry").onclick = carregar;
    }
  }

  function produtosFiltrados() {
    const q = filtro.trim().toLowerCase();
    return produtos.filter((p) => {
      const ov = overlays[p.id] || {};
      return (!q || `${p.nome || ""} ${p.categoria || ""} ${p.codigoBarras || ""}`.toLowerCase().includes(q))
        && (!categoria || (p.categoria || "Geral") === categoria)
        && (!situacao || (situacao === "visivel" ? ov.visivel : situacao === "oculto" ? !ov.visivel : ov.esgotado));
    });
  }

  function atualizarResumo() {
    const visiveis = produtos.filter(p => overlays[p.id]?.visivel).length;
    const resumo = main.querySelector("#catalogo-resumo");
    if (resumo) resumo.textContent = `${produtos.length} produtos · ${visiveis} selecionados · ${produtos.filter(p=>overlays[p.id]?.esgotado).length} esgotados`;
    const btn = main.querySelector("#btn-publicar");
    if (btn) { btn.disabled = publicando || salvando.size > 0 || rascunhos.size > 0; btn.textContent = publicando ? "Publicando…" : `Publicar cardápio (${visiveis})`; }
    const aviso = main.querySelector("#catalogo-drafts");
    if (aviso) aviso.textContent = rascunhos.size ? "Salve as descrições alteradas antes de publicar." : "As alterações salvas entram no cardápio quando você publica.";
  }

  async function patchOverlay(id, patch, controle) {
    if (salvando.has(id) || publicando) return;
    salvando.add(id); estados.set(id, "Salvando…");
    const row = [...main.querySelectorAll(".prod-card")].find(r=>r.dataset.id===String(id));
    row?.querySelectorAll("input,textarea,button").forEach(e=>e.disabled=true);
    if (row) row.querySelector("[data-save-state]").textContent = "Salvando…";
    atualizarResumo();
    try {
      await salvarOverlay(chave,id,patch);
      overlays[id] = {...(overlays[id]||{}),...patch};
      if (Object.hasOwn(patch,"descricao")) rascunhos.delete(id);
      estados.set(id,"Alteração salva.");
    } catch(err) { estados.set(id,"Não foi salvo. "+erroAmigavel(err)); editoresAbertos.add(id); }
    finally {
      salvando.delete(id); pintarLista(); atualizarResumo();
      const next = [...main.querySelectorAll(".prod-card")].find(r=>r.dataset.id===String(id));
      (next?.querySelector(controle||"[data-visivel]")||main.querySelector("#busca"))?.focus({preventScroll:true});
    }
  }

  async function onFoto(id, file) {
    if (!file) return;
    const wrap = main.querySelector(`.prod-card[data-id="${id}"] .thumb-wrap`);
    if (wrap) wrap.classList.add("is-load");
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
      pintarLista();
    } catch (err) {
      if (wrap) wrap.classList.remove("is-load");
      toast(erroAmigavel(err));
    }
  }

  async function onRemoverFoto(id) {
    const publicId = overlays[id] && overlays[id].fotoPublicId;
    if (!publicId && !overlays[id]?.fotoUrl) return;
    try {
      if (publicId) await removerFoto(chave, id, publicId);
      else await salvarOverlay(chave, id, { fotoUrl: "", fotoPublicId: "" });
      overlays[id] = { ...(overlays[id] || {}), fotoUrl: "", fotoPublicId: "" };
      toast("Foto removida do produto.");
      pintar();
    } catch (err) {
      toast(erroAmigavel(err));
    }
  }

  function pintarLoja() {
    limparCep();
    const cfg = lojaDraft || config;
    const form = lerFormatoLoja(cfg);
    const endereco = enderecoEstruturado(cfg.enderecoDetalhado);
    const entrega = cfg.delivery || {ativo:false,bairros:[]};
    if (lojaDraft) form.dias = lojaDraft.horarioDias;
    const pickDias = DIAS.map((d) => `
      <button type="button" class="pick${form.dias.includes(d.id) ? " on" : ""}" data-dia="${d.id}">${d.curto}</button>
    `).join("");
    const pickHorario = HORARIO_PRESETS.map((p) => {
      const on = p.abre === form.abre && p.fecha === form.fecha && p.dias.length === form.dias.length && p.dias.every((id) => form.dias.includes(id));
      return `<button type="button" class="pick${on ? " on" : ""}" data-hpreset="${p.id}">${p.label}</button>`;
    }).join("");
    const pickEntrega = ENTREGA_PRESETS.map((p) => `
      <button type="button" class="pick${form.entregaMin === p.min && form.entregaMax === p.max ? " on" : ""}" data-emin="${p.min}" data-emax="${p.max}">${p.min}–${p.max} min</button>
    `).join("");
    const pickMin = MINIMO_PRESETS.map((n) => `
      <button type="button" class="pick${Number(form.pedidoMinimoValor) === n ? " on" : ""}" data-minimo="${n}">${n ? brl(n) : "Sem mínimo"}</button>
    `).join("");
    main.innerHTML = `
      <section class="page-head">
        <div>
          <h2>Loja no cardápio</h2>
          <p>Ajuste os dados e salve as alterações para atualizar o cardápio.</p>
        </div>
      </section>
      <div class="loja-layout">
        <div class="card loja-status-card">
          <div>
            <strong>${config.pausado ? "Cardápio pausado" : "Cardápio aberto"}</strong>
            <p>${config.pausado ? "Clientes veem a loja fechada." : "Clientes podem pedir agora."}</p>
          </div>
          <label class="switch big">
            <input type="checkbox" id="pausado" ${cfg.pausado ? "checked" : ""}>
            Pausar pedidos
          </label>
        </div>
        <div class="loja-coluna">
        <div class="card">
          <h3>Funcionamento</h3>
          <p class="loja-help">Escolha um atalho ou monte os dias e o horário.</p>
          <div class="pick-row">${pickHorario}</div>
          <div class="pick-row dias">${pickDias}</div>
          <div class="loja-times">
            <label>Abre<input type="time" id="lj-abre" value="${esc(form.abre)}"></label>
            <label>Fecha<input type="time" id="lj-fecha" value="${esc(form.fecha)}"></label>
          </div>
          <p class="loja-preview-line" id="lj-hora-preview">${esc(textoHorario(form.dias, form.abre, form.fecha) || "Selecione os dias")}</p>
        </div>
        <div class="card">
          <h3>Tempo de entrega</h3>
          <p class="loja-help">Quanto o cliente espera, do pedido até sair.</p>
          <div class="pick-row">${pickEntrega}</div>
          <p class="loja-preview-line" id="lj-ent-preview">${esc(textoEntrega(form.entregaMin, form.entregaMax))}</p>
        </div>
        <div class="card">
          <h3>Pedido mínimo</h3>
          <div class="pick-row">${pickMin}</div>
          <label class="loja-min-extra">Outro valor (R$)
            <input type="number" id="lj-min-val" min="0" step="0.01" value="${form.pedidoMinimoValor || ""}" placeholder="0">
          </label>
          <p class="loja-preview-line" id="lj-min-preview">${esc(textoMinimo(form.pedidoMinimoValor))}</p>
        </div>
        </div><div class="loja-coluna">
        <div class="card">
          <h3>WhatsApp e endereço da loja</h3>
          <div class="loja-grid loja-endereco">
            <label>WhatsApp (DDD + número)<input id="lj-wa" type="tel" autocomplete="tel-national" maxlength="16" placeholder="(DDD) número" value="${esc(telefoneFormatado(cfg.whatsapp))}"></label>
            <label>CEP<input data-endereco="cep" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000" value="${esc(endereco.cep)}" aria-describedby="lj-cep-status"></label>
            <p id="lj-cep-status" class="loja-help span-full" role="status">Digite o CEP para preencher o endereço automaticamente.</p>
            ${Object.entries({rua:'Rua / avenida',numero:'Número',complemento:'Complemento',bairro:'Bairro',cidade:'Cidade',uf:'UF'}).map(([k,label])=>`<label>${label}<input data-endereco="${k}" maxlength="${k==='uf'?2:k==='cep'?9:100}" value="${esc(endereco[k])}" placeholder="${k==='complemento'?'Opcional':label}" ${k==='cep'?'inputmode="numeric"':''}></label>`).join('')}
          </div>
          ${cfg.endereco&&!endereco.rua?`<p class="loja-help">Endereço anterior: ${esc(cfg.endereco)}. Será mantido até você preencher os campos separados.</p>`:''}
        </div>
        <div class="card loja-entrega-card">
          <h3>Entregas por bairro</h3>
          <label class="delivery-switch"><input type="checkbox" id="lj-delivery" ${entrega.ativo?'checked':''}> Receber pedidos para entrega</label>
          <p class="loja-help">Cadastre os bairros da sua cidade. A taxa é somada ao pedido do cliente. O repasse é uma referência interna por entrega para o motoboy, sem pagamento automático.</p>
          <div id="delivery-bairros">${(entrega.bairros||[]).map(b=>`<div class="delivery-bairro" data-bairro-id="${esc(b.id)}"><label>Bairro<input data-bairro-nome value="${esc(b.nome)}" maxlength="80"></label><label>Taxa do cliente (R$)<input data-bairro-taxa type="text" inputmode="numeric" maxlength="18" placeholder="R$ 0,00" value="${esc(brl((b.taxaCentavos||0)/100))}"></label><label>Repasse motoboy (R$)<input data-bairro-repasse type="text" inputmode="numeric" maxlength="18" placeholder="R$ 0,00" value="${esc(brl((b.repasseCentavos||0)/100))}"></label><button type="button" class="btn-ghost" data-bairro-remover aria-label="Remover bairro">${ico.close}</button></div>`).join('')}</div>
          <button type="button" class="btn-ghost" id="lj-add-bairro">Adicionar bairro</button>
          <p class="loja-help">Taxa zero significa entrega grátis. Bairros não cadastrados não podem finalizar entrega. Pedidos de mesa e retirada não recebem essa taxa.</p>
        </div>
        </div>
      </div>
    `;

    main.insertAdjacentHTML("beforeend", '<div class="loja-foot loja-savebar"><span class="loja-saved" id="lj-saved" role="status"></span><button class="btn-primary fit" id="lj-salvar" type="button">Salvar alterações</button></div>');
    const saved = main.querySelector("#lj-saved");
    saved.textContent = lojaDraft ? "Alterações não salvas." : "";
    const saveButton = main.querySelector("#lj-salvar");
    saveButton.disabled = !lojaDraft;
    const horaPrev = main.querySelector("#lj-hora-preview");
    const entPrev = main.querySelector("#lj-ent-preview");
    const minPrev = main.querySelector("#lj-min-preview");

    function estadoForm() {
      const dias = [...main.querySelectorAll("[data-dia].on")].map((b) => b.dataset.dia);
      return {
        dias,
        abre: main.querySelector("#lj-abre").value || "18:00",
        fecha: main.querySelector("#lj-fecha").value || "23:00",
        entregaMin: Number((main.querySelector("[data-emin].on") || {}).dataset.emin) || form.entregaMin,
        entregaMax: Number((main.querySelector("[data-emin].on") || {}).dataset.emax) || form.entregaMax,
        pedidoMinimoValor: Number(main.querySelector("#lj-min-val").value) || 0
      };
    }

    function pintarPrevia() {
      const st = estadoForm();
      horaPrev.textContent = textoHorario(st.dias, st.abre, st.fecha) || "Selecione os dias";
      entPrev.textContent = textoEntrega(st.entregaMin, st.entregaMax);
      minPrev.textContent = textoMinimo(st.pedidoMinimoValor);
    }

    function contatoEntrega() {
      const enderecoDetalhado = enderecoEstruturado(Object.fromEntries([...main.querySelectorAll('[data-endereco]')].map(el=>[el.dataset.endereco,el.value])));
      const bairros = [...main.querySelectorAll('[data-bairro-id]')].map(row=>({id:row.dataset.bairroId,nome:row.querySelector('[data-bairro-nome]').value,taxaCentavos:centavosDoCampo(row.querySelector('[data-bairro-taxa]').value),repasseCentavos:centavosDoCampo(row.querySelector('[data-bairro-repasse]').value)}));
      return {whatsapp:telefoneDigitos(main.querySelector('#lj-wa').value),enderecoDetalhado,endereco:enderecoDetalhado.rua ? enderecoTexto(enderecoDetalhado) : cfg.endereco||enderecoTexto(enderecoDetalhado),delivery:{ativo:main.querySelector('#lj-delivery').checked,bairros}};
    }
    function salvarHorario() {
      lojaDraft = {...config, ...patchLoja(estadoForm()),
        pausado: main.querySelector("#pausado").checked,
        ...contatoEntrega()};
      saved.textContent = "Alterações não salvas.";
      saved.dataset.error = "false";
      saveButton.disabled = false;
      main.querySelectorAll(".pick").forEach(b=>b.setAttribute("aria-pressed", String(b.classList.contains("on"))));
    }
    main.querySelector("#pausado").addEventListener("change", salvarHorario);
    main.querySelector('#lj-wa').addEventListener('input',e=>{e.target.value=telefoneFormatado(e.target.value);});
    main.querySelectorAll('[data-bairro-taxa], [data-bairro-repasse]').forEach(ligarCampoReais);
    main.querySelectorAll('#lj-wa, [data-endereco], #lj-abre, #lj-fecha, #lj-min-val, #lj-delivery, [data-bairro-id] input').forEach(el=>el.addEventListener('input',salvarHorario));
    limparCep = ligarBuscaCep({input:main.querySelector('[data-endereco="cep"]'),campos:Object.fromEntries(['rua','bairro','cidade','uf'].map(k=>[k,main.querySelector(`[data-endereco="${k}"]`)])),status:main.querySelector('#lj-cep-status'),aoPreencher:salvarHorario});
    main.querySelector('#lj-add-bairro').onclick=()=>{salvarHorario();lojaDraft.delivery.bairros.push({id:crypto.randomUUID(),nome:'',taxaCentavos:0,repasseCentavos:0});pintarLoja();main.querySelector('[data-bairro-id]:last-child input').focus();};
    main.querySelectorAll('[data-bairro-remover]').forEach(btn=>btn.onclick=()=>{const id=btn.closest('[data-bairro-id]').dataset.bairroId;salvarHorario();lojaDraft.delivery.bairros=lojaDraft.delivery.bairros.filter(b=>b.id!==id);pintarLoja();});
    main.querySelectorAll(".pick").forEach(b=>b.setAttribute("aria-pressed", String(b.classList.contains("on"))));

    main.querySelectorAll("[data-hpreset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = HORARIO_PRESETS.find((x) => x.id === btn.dataset.hpreset);
        if (!p) return;
        main.querySelectorAll("[data-dia]").forEach((d) => d.classList.toggle("on", p.dias.includes(d.dataset.dia)));
        main.querySelector("#lj-abre").value = p.abre;
        main.querySelector("#lj-fecha").value = p.fecha;
        main.querySelectorAll("[data-hpreset]").forEach((b) => b.classList.toggle("on", b === btn));
        pintarPrevia();
        salvarHorario();
      });
    });
    main.querySelectorAll("[data-dia]").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.classList.toggle("on");
        main.querySelectorAll("[data-hpreset]").forEach((b) => b.classList.remove("on"));
        pintarPrevia();
        salvarHorario();
      });
    });
    ["#lj-abre", "#lj-fecha"].forEach((sel) => {
      main.querySelector(sel).addEventListener("change", () => {
        main.querySelectorAll("[data-hpreset]").forEach((b) => b.classList.remove("on"));
        pintarPrevia();
        salvarHorario();
      });
    });
    main.querySelectorAll("[data-emin]").forEach((btn) => {
      btn.addEventListener("click", () => {
        main.querySelectorAll("[data-emin]").forEach((b) => b.classList.toggle("on", b === btn));
        form.entregaMin = Number(btn.dataset.emin);
        form.entregaMax = Number(btn.dataset.emax);
        pintarPrevia();
        salvarHorario();
      });
    });
    main.querySelectorAll("[data-minimo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        main.querySelector("#lj-min-val").value = btn.dataset.minimo === "0" ? "" : btn.dataset.minimo;
        main.querySelectorAll("[data-minimo]").forEach((b) => b.classList.toggle("on", b === btn));
        pintarPrevia();
        salvarHorario();
      });
    });
    main.querySelector("#lj-min-val").addEventListener("change", () => {
      const n = Number(main.querySelector("#lj-min-val").value) || 0;
      main.querySelectorAll("[data-minimo]").forEach((b) => b.classList.toggle("on", Number(b.dataset.minimo) === n));
      pintarPrevia();
      salvarHorario();
    });
    saveButton.addEventListener("click", async () => {
      if (salvandoLoja) return;
      const st = estadoForm();
      if (!st.dias.length || !main.querySelector("#lj-abre").value || !main.querySelector("#lj-fecha").value || !main.querySelector("#lj-min-val").validity.valid) {
        saved.textContent = "Escolha pelo menos um dia, preencha os horários e informe um mínimo válido.";
        saved.dataset.error = "true"; return;
      }
      if (main.querySelector('[data-endereco="cep"]').getAttribute('aria-busy') === 'true') { saved.textContent = 'Aguarde a consulta do CEP antes de salvar.'; return; }
      const patch = {...patchLoja(st), pausado:main.querySelector("#pausado").checked, ...contatoEntrega()};
      try {
        if (patch.whatsapp && ![10,11].includes(patch.whatsapp.length)) throw new Error('Informe um WhatsApp com DDD válido.');
        if ([...main.querySelectorAll('[data-bairro-id] input')].some(el=>!el.validity.valid)) throw new Error('Revise os valores das taxas e repasses.');
        patch.delivery = validarEntrega(patch.delivery);
        if (patch.delivery.ativo && (!patch.enderecoDetalhado.cidade || !/^[A-Za-z]{2}$/.test(patch.enderecoDetalhado.uf))) throw new Error('Preencha a cidade e UF da loja para ativar as entregas.');
      } catch(err) { saved.textContent=err.message; saved.dataset.error='true'; return; }
      salvandoLoja = true;
      main.querySelectorAll("input,button").forEach(e=>e.disabled=true);
      app.querySelectorAll(".tabs button, #btn-sair").forEach(e=>e.disabled=true);
      saved.textContent = "Salvando alterações…"; saved.dataset.error = "false";
      try {
        await salvarConfig(chave, patch);
        Object.assign(config,patch); lojaDraft = null;
        invalidarCardapioPublico();
        pintarLoja(); main.querySelector("#lj-saved").textContent = "Alterações salvas.";
      } catch(err) {
        saved.textContent = "Não foi possível confirmar o salvamento. Tente novamente. " + erroAmigavel(err);
        saved.dataset.error = "true";
        main.querySelectorAll("input,button").forEach(e=>e.disabled=false);
      } finally {
        salvandoLoja = false;
        app.querySelectorAll(".tabs button, #btn-sair").forEach(e=>e.disabled=false);
      }
    });
  }

  function pintarCardapio() {
    const visiveis = produtos.filter((p) => overlays[p.id] && overlays[p.id].visivel).length;
    const categorias = [...new Set(produtos.map(p=>p.categoria||"Geral"))].sort(compararCategorias);
    main.innerHTML = `
      <section class="page-head catalogo-head">
        <div>
          <h2>Seu cardápio</h2>
          <p>Organize os produtos que seus clientes vão encontrar.</p>
          <p id="catalogo-resumo"></p>
        </div>
      </section>
      <nav class="catalogo-categorias" aria-label="Categorias do cardápio">${["",...categorias].map(c=>`<button type="button" data-categoria="${esc(c)}" aria-pressed="${categoria===c}">${esc(c||"Todos")}<span>${produtos.filter(p=>!c||(p.categoria||"Geral")===c).length}</span></button>`).join("")}</nav>
      <section class="catalogo-filtros" aria-label="Filtrar produtos">
        <label>Buscar produto<input type="search" id="busca" placeholder="Nome, categoria ou código"></label>
        <label>Exibir<select id="catalogo-situacao"><option value="">Todos os produtos</option><option value="visivel">No cardápio</option><option value="oculto">Fora do cardápio</option><option value="esgotado">Esgotados</option></select></label>
        <div class="catalogo-filtro-acoes"><button type="button" class="btn-ghost" id="catalogo-limpar">Limpar filtros</button>
        <button class="btn-primary fit" id="btn-publicar" type="button">Publicar cardápio (${visiveis})</button></div>
      </section>
      <div class="catalogo-feedback"><p id="catalogo-resultados" role="status"></p><p id="catalogo-drafts" role="status"></p></div>
      <div class="prod-list catalogo-list" id="lista"></div>
    `;
    main.querySelectorAll('[data-categoria]').forEach(btn=>btn.onclick=()=>{
      categoria=btn.dataset.categoria;
      main.querySelectorAll('[data-categoria]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
      pintarLista();
    });
    main.querySelector("#catalogo-situacao").value = situacao;
    main.querySelector("#catalogo-situacao").onchange = e=>{situacao=e.target.value;pintarLista();};
    main.querySelector("#catalogo-limpar").onclick = ()=>{filtro="";categoria="";situacao="";pintarCardapio();main.querySelector("#busca").focus();};
    const busca = main.querySelector("#busca");
    busca.value = filtro;
    busca.addEventListener("input", () => { filtro = busca.value; pintarLista(); });
    main.querySelector("#btn-publicar").addEventListener("click", async (ev) => {
      if (publicando || salvando.size || rascunhos.size) return;
      publicando = true;
      pintarLista();
      ev.target.disabled = true;
      ev.target.textContent = "Publicando...";
      try {
        invalidarCardapioPublico();
        await publicarCardapio(chave);
        toast("Cardápio publicado. O QR já pode abrir.");
      } catch (err) {
        toast(erroAmigavel(err));
      } finally {
        publicando = false;
        ev.target.disabled = false;
        pintarLista();
        atualizarResumo();
      }
    });
    pintarLista();
  }

  function pintarLista() {
    const lista = main.querySelector("#lista");
    if (!lista) return;
    const rows = produtosFiltrados();
    atualizarResumo();
    main.querySelector("#catalogo-resultados").textContent = `${rows.length} de ${produtos.length} produtos`;
    if (!rows.length) {
      lista.innerHTML = produtos.length ? `<section class="catalogo-empty"><h3>Nenhum produto encontrado</h3><p>Experimente outro termo ou limpe os filtros.</p></section>` : `<section class="catalogo-empty"><h3>Seu cardápio começa no PDV</h3><p>Cadastre os produtos no caixa e sincronize para organizá-los aqui.</p></section>`;
      return;
    }
    lista.innerHTML = rows.map((p) => {
      const ov = overlays[p.id] || overlays[String(p.id)] || {};
      const nOp = sanitizarGrupos(ov.grupos).length;
      const foto = ov.fotoUrl ? `<img class="thumb" src="${esc(ov.fotoUrl)}" alt="">` : `<div class="thumb">${esc((p.nome || "?").slice(0, 1))}</div>`;
      return `
        <article class="prod-card ${ov.visivel ? "on" : ""}" data-id="${esc(p.id)}">
          <div class="produto-midia"><div class="thumb-wrap">
            ${foto}
            <span class="thumb-load">Enviando foto...</span>
          </div><div class="produto-foto-acoes"><button type="button" class="btn-ghost" data-add-foto>${ico.photo}${ov.fotoUrl ? "Trocar foto" : "Adicionar foto"}</button><input data-foto-input type="file" accept="image/jpeg,image/png,image/webp" hidden>${ov.fotoUrl || ov.fotoPublicId ? `<button type="button" class="btn-ghost foto-remover" data-del-foto>Remover foto</button>` : ""}</div></div>
          <div class="prod-card-body">
            <div class="prod-card-top">
              <h3>${esc(p.nome || "Sem nome")}</h3>
              <b>${brl(precoProduto(p))}</b>
            </div>
            <div class="cat">${esc(p.categoria || "Geral")}${nOp ? ` · ${nOp} grupo${nOp > 1 ? "s" : ""} de opção` : ""}${ov.destaque ? " · Destaque" : ""}</div>

            <div class="prod-card-foot">
              <div class="chip-row">
                <label class="chip${ov.visivel ? " on" : ""}"><input type="checkbox" data-visivel ${ov.visivel ? "checked" : ""}> No cardápio</label>
                <label class="chip${ov.destaque ? " on" : ""}"><input type="checkbox" data-destaque ${ov.destaque ? "checked" : ""}> Mais pedido</label>
                <label class="chip warn${ov.esgotado ? " on" : ""}"><input type="checkbox" data-esgotado ${ov.esgotado ? "checked" : ""}> Esgotado</label>
              </div>
              <div class="prod-card-actions">

                <button type="button" class="btn-ghost" data-opcoes>Opções${nOp ? ` (${nOp})` : ""}</button>
              </div>
            </div>
          </div>

            <details class="produto-editor" ${editoresAbertos.has(String(p.id)) || rascunhos.has(String(p.id)) ? "open" : ""}><summary>Editar descrição ${ico.chevron}</summary><label class="catalogo-desc">Descrição para o cliente<textarea data-desc placeholder="Ingredientes, preparo ou detalhes do produto"></textarea></label>
            <div class="catalogo-save"><button type="button" class="btn-ghost" data-save-desc>Salvar descrição</button><span data-save-state role="status">${esc(estados.get(String(p.id))||"")}</span></div></details>
        </article>
      `;
    }).join("");

    lista.querySelectorAll(".prod-card").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector("details").addEventListener("toggle",e=>{if(e.target.open)editoresAbertos.add(id);else editoresAbertos.delete(id);});
      const prod = produtos.find((p) => String(p.id) === String(id));
      const ovAtual = () => overlays[id] || overlays[String(id)] || {};
      row.querySelector("[data-visivel]").addEventListener("change", (ev) => patchOverlay(id, { visivel: ev.target.checked }, "[data-visivel]"));
      row.querySelector("[data-destaque]").addEventListener("change", (ev) => patchOverlay(id, { destaque: ev.target.checked }, "[data-destaque]"));
      row.querySelector("[data-esgotado]").addEventListener("change", (ev) => patchOverlay(id, { esgotado: ev.target.checked }, "[data-esgotado]"));
      row.querySelector("[data-add-foto]").addEventListener("click",()=>row.querySelector("[data-foto-input]").click());
      row.querySelectorAll('input[type="file"]').forEach((inp) => {
        inp.addEventListener("change", (ev) => {
          const file = ev.target.files && ev.target.files[0];
          onFoto(id, file);
          ev.target.value = "";
        });
      });
      const del = row.querySelector("[data-del-foto]");
      if (del) del.addEventListener("click", () => onRemoverFoto(id));
      const desc = row.querySelector("[data-desc]"), save = row.querySelector("[data-save-desc]");
      desc.value = rascunhos.has(id) ? rascunhos.get(id) : ovAtual().descricao || "";
      save.disabled = !rascunhos.has(id) || salvando.has(id);
      desc.oninput = ()=>{
        if(desc.value === (ovAtual().descricao||"")) rascunhos.delete(id); else rascunhos.set(id,desc.value);
        save.disabled = !rascunhos.has(id);
        row.querySelector("[data-save-state]").textContent = rascunhos.has(id) ? "Descrição não salva." : "";
        atualizarResumo();
      };
      save.onclick = ()=>patchOverlay(id,{descricao:desc.value},"[data-save-desc]");
      if(salvando.has(id) || publicando) row.querySelectorAll("input,textarea,button").forEach(e=>e.disabled=true);
      row.querySelector("[data-opcoes]").addEventListener("click", () => {
        abrirEditorGrupos({
          produto: prod,
          overlay: ovAtual(),
          produtos,
          onSave: async (grupos) => {
            if(publicando || salvando.size || rascunhos.size) throw new Error("Salve as descrições e aguarde as alterações antes de salvar opções.");
            await salvarOverlay(chave, id, { grupos });
            overlays[id] = { ...ovAtual(), grupos };
            invalidarCardapioPublico();
            if (overlays[id].visivel) {
              await publicarCardapio(chave);
              toast("Opções no cardápio do cliente. Manda ele atualizar a página.");
            } else {
              toast("Opções salvas. Marca No cardápio e clica em Publicar.");
            }
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
      pedidos = lista; pedidosCarregados = true; erroPedidos = "";
      if (aba === "pedidos") pintarPedidos();
    }, (err) => {
      erroPedidos = erroAmigavel(err); pedidosCarregados = false;
      if (aba === "pedidos") pintarPedidos();
    });
  }

  function htmlCardPedido(p) {
    const prox = proximoStatus(p.status);
    const onde = p.tipo === "mesa" ? `Mesa ${p.numeroMesa}` : p.tipo === "delivery" ? "Entrega" : "Retirada";
    const hora = horaPedido(p.at || p.atualizadoEm);
    const itens = (p.itens || []).map((i) => htmlLinhaItem(i, {semFoto:true})).join("");
    return `
      <article class="k-card" data-id="${esc(p.id)}">
        <header>
          <div>
            <strong>${esc(onde)}</strong>
            <small>${hora ? `${hora} · ` : ""}#${esc(String(p.id || "").replace(/^PED-/, "").slice(-6).toUpperCase())}</small>
          </div>
          <span class="badge ${esc(p.status || "novo")}">${esc(rotuloStatus(p.status))}</span>
        </header>
        ${p.tipo==='delivery'?`<div class="pedido-entrega"><strong>${esc(p.cliente?.nome||'Cliente')}</strong><p>${esc(telefoneFormatado(p.cliente?.telefone))}</p><p>${esc(enderecoTexto(p.endereco))}</p><small>Taxa: ${brl(p.taxaEntrega||0)} · Repasse motoboy: ${brl(p.repasseMotoboy||0)}</small></div>`:''}
        <ul class="pi-list">${itens}</ul><p class="pedido-feedback" role="status">${esc(pedidosSalvando.has(p.id) ? "Atualizando pedido…" : pedidosErros.get(p.id) || "")}</p>
        <footer>
          <b>${brl(p.total)}</b>
          <div class="pedido-btns">
            ${prox ? `<button class="btn-primary fit" data-st="${prox}" data-id="${esc(p.id)}" type="button">${esc(acaoStatus(prox))}</button>` : ""}
            ${p.status !== "cancelado" && p.status !== "entregue" ? `<button class="btn-ghost" data-st="cancelado" data-id="${esc(p.id)}" type="button">Cancelar</button>` : ""}
          </div>
        </footer>
      </article>`;
  }

  function pintarPedidos() {
    if (erroPedidos) {
      main.innerHTML = '<section class="empty-card" role="alert"><h2>Pedidos indisponíveis</h2><p>'+esc(erroPedidos)+'</p><button type="button" class="btn-ghost" id="pedidos-retry">Tentar novamente</button></section>';
      main.querySelector('#pedidos-retry').onclick = ()=>{unsubPedidos?.(); unsubPedidos=null; erroPedidos=""; pintarPedidos(); garantirPedidos();};
      return;
    }
    if (!pedidosCarregados) {main.innerHTML='<p class="empty" role="status">Carregando pedidos…</p>'; return;}
    const vivos = pedidos.filter((p) => p.status !== "entregue" && p.status !== "cancelado");
    const feitos = pedidos.filter((p) => p.status === "entregue" || p.status === "cancelado");
    main.classList.add("wide");
    if (!pedidos.length) {
      main.innerHTML = `<div class="empty-card"><h2>Nenhum pedido ainda</h2><p>Publique o cardápio e teste o QR da mesa ou o link de ${CANAL_LOJA.toLowerCase()}.</p></div>`;
      return;
    }
    const por = {
      novo: pedidos.filter((p) => p.status === "novo"),
      em_preparo: pedidos.filter((p) => p.status === "em_preparo"),
      pronto: pedidos.filter((p) => p.status === "pronto")
    };
    const cozinha = `
      <div class="kanban">
        ${COLUNAS.map((col) => {
          const lista = por[col.id] || [];
          return `
            <section class="kanban-col ${col.id}">
              <header>
                <h3>${esc(col.label)}</h3>
                <span>${lista.length}</span>
              </header>
              <div class="kanban-stack">
                ${lista.map((p) => htmlCardPedido(p)).join("") || `<p class="kanban-empty">Nenhum pedido</p>`}
              </div>
            </section>`;
        }).join("")}
      </div>`;
    const historico = feitos.length
      ? `<div class="hist-list">${feitos.map((p) => htmlCardPedido(p)).join("")}</div>`
      : `<div class="empty-card"><h2>Nenhum pedido no histórico</h2><p>Pedidos entregues ou cancelados aparecem aqui.</p></div>`;
    main.innerHTML = `
      <section class="page-head">
        <div>
          <h2>Pedidos</h2>
          <p>${vistaPedidos === "entregues" ? "Histórico de entregues e cancelados." : "Kanban da cozinha. Novos avisam com um som."}</p>
        </div>
        <div class="subtabs">
          <button type="button" data-vista="cozinha" class="${vistaPedidos === "cozinha" ? "on" : ""}">Cozinha <em>${vivos.length}</em></button>
          <button type="button" data-vista="entregues" class="${vistaPedidos === "entregues" ? "on" : ""}">Histórico <em>${feitos.length}</em></button>
        </div>
      </section>
      ${vistaPedidos === "entregues" ? historico : cozinha}
    `;
    main.querySelectorAll("[data-vista]").forEach((btn) => {
      btn.addEventListener("click", () => {
        vistaPedidos = btn.dataset.vista;
        pintarPedidos();
      });
    });
    main.querySelectorAll("[data-st]").forEach((btn) => {
      btn.disabled = pedidosSalvando.has(btn.dataset.id);
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const st = btn.dataset.st;
        if (pedidosSalvando.has(id)) return;
        const statusAnterior = pedidos.find(p=>p.id===id)?.status;
        pedidosSalvando.add(id); pedidosErros.delete(id); pintarPedidos();
        try {
          await atualizarStatusPedido(chave, id, st);
          // Atualizar somente após confirmação, sem sobrescrever um snapshot mais recente.
          const confirmado = pedidos.find(p=>p.id===id);
          if (confirmado?.status === statusAnterior) confirmado.status = st;
        } catch (err) {
          pedidosErros.set(id, "Não foi possível confirmar. " + erroAmigavel(err));
        } finally {
          pedidosSalvando.delete(id);
          if (aba === "pedidos") pintarPedidos();
        }
      });
    });
  }

  async function pintarQr() {
    const urlLoja = `${originPublico()}/${chave}`;
    const nome = nomeDaLoja(licenca);
    const copiar = async (texto) => {
      try {
        await navigator.clipboard.writeText(texto);
        toast("Link copiado.");
      } catch {
        toast("Não deu pra copiar o link.");
      }
    };
    const baixar = (dataUrl, arquivo) => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = arquivo;
      a.click();
    };
    main.innerHTML = `
      <section class="page-head">
        <div>
          <h2>QR e links</h2>
          <p>Imprime o QR da mesa ou o da loja. O cliente abre o cardápio no celular.</p>
        </div>
      </section>
      <p class="painel-notice" role="status">${['localhost','127.0.0.1'].includes(location.hostname) ? "Ambiente local: estes links não são acessíveis em outro celular. Use o endereço publicado para distribuir os QRs." : "Os QRs usam o endereço atual. Confira se o cardápio está publicado antes de compartilhar."}</p>
      <div class="qr-grid">
        <article class="qr-card">

          <h3>QR da mesa</h3>
          <p class="qr-lead">Cola na mesa. Já abre o pedido com o número certo.</p>
          <div class="qr-step">
            <label for="mesa-n">Mesa</label>
            <div class="qr-stepper">
              <button type="button" id="mesa-menos" aria-label="Menos">−</button>
              <input type="number" id="mesa-n" min="1" max="9999" step="1" value="1">
              <button type="button" id="mesa-mais" aria-label="Mais">+</button>
            </div>
          </div>
          <div class="qr-art" id="qr-mesa-art"></div>
          <div class="qr-actions">
            <button type="button" class="btn-ghost" id="qr-mesa-copiar">Copiar link</button>
            <button type="button" class="btn-primary fit" id="qr-mesa-baixar">Baixar QR</button>
          </div>
          <p class="qr-url" id="qr-mesa-url"></p>
        </article>
        <article class="qr-card">

          <h3>QR da loja</h3>
          <p class="qr-lead">Balcão, delivery ou retirada. Sem número de mesa.</p>
          <div class="qr-step">
            <span>Canal</span>
            <span class="qr-pill">${esc(CANAL_LOJA)}</span>
          </div>
          <div class="qr-art" id="qr-loja-art"></div>
          <div class="qr-actions">
            <button type="button" class="btn-ghost" id="qr-loja-copiar">Copiar link</button>
            <button type="button" class="btn-primary fit" id="qr-loja-baixar">Baixar QR</button>
          </div>
          <p class="qr-url">${esc(urlLoja)}</p>
        </article>
      </div>
    `;
    const grid = main.querySelector('.qr-grid');
    const q = sel=>grid.querySelector(sel);
    let mesaUrl = "", mesaQr = "", mesaNumero = 1, versao = 0;
    const mesaAcoes = [q('#qr-mesa-copiar'),q('#qr-mesa-baixar')];
    const gerarMesa = async () => {
      const atual = ++versao, input = q('#mesa-n');
      mesaAcoes.forEach(b=>b.disabled=true); mesaQr=""; mesaUrl="";
      if (!input.validity.valid || !input.value) {q('#qr-mesa-art').textContent="Informe uma mesa de 1 a 9999.";q('#qr-mesa-url').textContent="";return;}
      const n = Number(input.value), url = originPublico()+'/'+encodeURIComponent(chave)+'/mesa/'+n;
      q('#qr-mesa-art').textContent = "Gerando QR…";
      try {
        const qr = await QRCode.toDataURL(url, {width:520,margin:1,color:{dark:"#0b1220",light:"#ffffff"}});
        if (atual !== versao || !grid.isConnected) return;
        mesaUrl=url; mesaQr=qr; mesaNumero=n;
        q('#qr-mesa-url').textContent=url;
        q('#qr-mesa-art').innerHTML='<img src="'+qr+'" alt="QR mesa '+n+'"><strong>Mesa '+n+'</strong><small>'+esc(nome)+'</small>';
        mesaAcoes.forEach(b=>b.disabled=false);
      } catch {if(atual===versao && grid.isConnected)q('#qr-mesa-art').textContent="Não foi possível gerar o QR. Altere a mesa para tentar novamente.";}
    };
    q('#mesa-menos').onclick=()=>{q('#mesa-n').value=String(Math.max(1,(Number(q('#mesa-n').value)||1)-1));gerarMesa();};
    q('#mesa-mais').onclick=()=>{q('#mesa-n').value=String(Math.min(9999,(Number(q('#mesa-n').value)||1)+1));gerarMesa();};
    q('#mesa-n').oninput=gerarMesa;
    q('#qr-mesa-copiar').onclick=()=>mesaUrl && copiar(mesaUrl);
    q('#qr-mesa-baixar').onclick=()=>mesaQr && baixar(mesaQr,'mesa-'+mesaNumero+'.png');
    const lojaAcoes = [q('#qr-loja-copiar'),q('#qr-loja-baixar')];
    lojaAcoes.forEach(b=>b.disabled=true);
    gerarMesa();
    try {
      const lojaQr=await QRCode.toDataURL(urlLoja,{width:520,margin:1,color:{dark:"#0b1220",light:"#ffffff"}});
      if(!grid.isConnected)return;
      q('#qr-loja-art').innerHTML='<img src="'+lojaQr+'" alt="QR da loja"><strong>'+esc(nome)+'</strong><small>'+esc(CANAL_LOJA)+'</small>';
      q('#qr-loja-copiar').onclick=()=>copiar(urlLoja);
      q('#qr-loja-baixar').onclick=()=>baixar(lojaQr,'cardapio-loja.png');
      lojaAcoes.forEach(b=>b.disabled=false);
    } catch {if(grid.isConnected)q('#qr-loja-art').textContent="Não foi possível gerar o QR. Reabra esta aba para tentar novamente.";}
  }

  function pintar() {
    limparCep();
    main.dataset.aba = aba;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) main.animate([{transform:"translateY(7px)",opacity:.65},{transform:"translateY(0)",opacity:1}],{duration:220,easing:"cubic-bezier(.22,1,.36,1)"});
    main.classList.toggle("wide", aba === "pedidos" || aba === "qr");
    if (aba === "cardapio") pintarCardapio();
    else if (aba === "loja") pintarLoja();
    else if (aba === "pedidos") pintarPedidos();
    else pintarQr();
  }

  await carregar();
  garantirPedidos();
}
