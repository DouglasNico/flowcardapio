import { protegerRascunhosGestao } from '../lib/rascunhos-gestao-v2.js';
import { enviarFotoGestaoV2 } from '../lib/upload-foto-v2.js';
import { ico } from '../lib/icons.js';
import { renderContatoGestao } from './gestao-contato-v2.js';
import { renderFotoGestao, validarFotoV2 } from './gestao-foto-v2.js';
import { renderAdicionaisGestao } from './gestao-adicionais-v2.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ambienteGestaoV2 } from '../lib/gestao-v2.js';
import './painel-catalogo.css';
import './gestao-v2.css';
import { renderDeliveryGestao } from './gestao-delivery-v2.js';
import { renderMesasGestao } from './gestao-mesas-v2.js';
import { renderPedidosGestao } from './gestao-pedidos-v2.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export async function renderGestaoV2(app) {
  document.body.className = 'is-painel';
  document.title = 'Gestão V2 · FlowPDV';
  let s, disposed = false, epoch = 0, draftGuard;
  try { s = await ambienteGestaoV2(); } catch (e) { app.textContent = e.message; return; }
  const unsubscribe = onAuthStateChanged(s.auth, user => {
    draftGuard?.dispose();
    const current = ++epoch, valid = () => !disposed && epoch === current;
    if (!valid()) return;
    app.innerHTML = `<main class="gestao-v2"><header class="page-head"><div><h1>Gestão do cardápio</h1><p>${s.local ? 'Ambiente local de teste' : 'Ambiente hospedado'}</p></div>${user ? '<button class="btn-ghost" id="g-sair">Sair da conta</button>' : ''}</header><p id="g-status" role="status" aria-live="polite"></p><div id="g-content"></div></main>`;
    const content = app.querySelector('#g-content'), status = app.querySelector('#g-status');
    const say = (text, tone = 'info') => { if (valid()) { status.dataset.tone = tone; status.textContent = text; } };
    if (!user) {
      content.innerHTML = '<form id="g-login" class="g-form"><h2>Acesso do gerente</h2><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><button class="btn-primary">Entrar</button></form>';
      const form = content.querySelector('form');
      form.onsubmit = async e => {
        e.preventDefault(); form.querySelector('button').disabled = true; say('Entrando…');
        try { await signInWithEmailAndPassword(s.auth, form.elements.email.value.trim(), form.elements.password.value); }
        catch { say('Não foi possível entrar. Confira e-mail, senha e a conexão com o ambiente de teste.'); }
        finally { if (valid()) form.querySelector('button').disabled = false; }
      };
      return;
    }
    app.querySelector('#g-sair').onclick = async () => { try { await signOut(s.auth); } catch { say('Não foi possível sair. Tente novamente.'); } };
    if (!user.emailVerified) { say('Confirme o e-mail da conta e entre novamente para acessar a gestão.'); return; }
    const salvoLoja = localStorage.getItem('flowpdv_gestao_loja_id') || '';
    content.innerHTML = `
      <form id="g-store" class="g-form">
        <h2>Abra sua loja</h2>
        <label>Endereço ou identificador da loja
          <input name="loja" required pattern="[A-Za-z0-9_-]{1,80}" maxlength="80" placeholder="Ex: burger-teste ou ID da loja" value="${esc(salvoLoja)}">
        </label>
        <button class="btn-primary">Abrir catálogo</button>
        <div style="border-top:1px solid var(--line);margin-top:16px;padding-top:16px;text-align:center;">
          <p style="font-size:13px;color:var(--slate);margin-bottom:10px;">Ainda não tem loja cadastrada?</p>
          <button type="button" class="btn-ghost" id="g-btn-nova-loja" style="width:100%;">+ Cadastrar Nova Loja</button>
        </div>
      </form>

      <form id="g-create-store" class="g-form" hidden>
        <h2>Cadastrar Nova Loja</h2>
        <p style="font-size:13px;color:var(--slate);margin:0 0 16px;">Crie seu cardápio independente em segundos para operar 100% pelo celular.</p>
        <label>Nome da loja / restaurante
          <input name="nome" required maxlength="80" placeholder="Ex: Espetinho do Zé">
        </label>
        <label>Endereço do cardápio (Link)
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:12px;color:var(--slate);white-space:nowrap;">flowpdv.app.br/</span>
            <input name="slug" required pattern="[a-z0-9-]{3,60}" maxlength="60" placeholder="espetinho-do-ze" style="text-transform:lowercase;">
          </div>
          <small style="color:var(--slate);font-size:11px;">Apenas letras minúsculas, números e hífens.</small>
        </label>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button type="submit" class="btn-primary" style="flex:1;">Criar Loja e Começar</button>
          <button type="button" class="btn-ghost" id="g-btn-voltar-loja">Voltar</button>
        </div>
        <p class="g-result" role="status"></p>
      </form>

      <section id="g-catalog"></section>
    `;
    const storeForm = content.querySelector('#g-store'), createForm = content.querySelector('#g-create-store'), catalog = content.querySelector('#g-catalog');
    const btnNovaLoja = content.querySelector('#g-btn-nova-loja'), btnVoltarLoja = content.querySelector('#g-btn-voltar-loja'), createResult = createForm.querySelector('.g-result');
    let data, lojaId, uncertain = false, busy = false, activeTab = 'catalogo', lojaDraft = null, productDraft = null, deliveryDraft = null, mesaDraft = null, addonDraft = null, contatoDraft = null;
    draftGuard = protegerRascunhosGestao(content, () => busy);
    app.querySelector('#g-sair').onclick = async () => {
      if (busy) { say('Aguarde a operação terminar antes de sair.', 'info'); return; }
      if (draftGuard.pending() && !window.confirm('Há alterações não salvas. Deseja descartá-las e sair da conta?')) return;
      try { await signOut(s.auth); } catch { say('Não foi possível sair. Tente novamente.', 'error'); }
    };

    btnNovaLoja.onclick = () => {
      storeForm.hidden = true;
      createForm.hidden = false;
      createForm.elements.nome.focus();
    };

    btnVoltarLoja.onclick = () => {
      createForm.hidden = true;
      storeForm.hidden = false;
    };

    createForm.elements.nome.oninput = () => {
      if (!createForm.elements.slug.dataset.manual) {
        const auto = createForm.elements.nome.value
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 50);
        createForm.elements.slug.value = auto;
      }
    };
    createForm.elements.slug.oninput = () => {
      createForm.elements.slug.dataset.manual = 'true';
    };

    createForm.onsubmit = async e => {
      e.preventDefault();
      const nomeLoja = createForm.elements.nome.value.trim();
      const slugLoja = createForm.elements.slug.value.trim().toLowerCase();
      if (!nomeLoja || !slugLoja) return;

      createForm.querySelectorAll('button,input').forEach(el => el.disabled = true);
      createResult.textContent = 'Criando sua loja no FlowPDV…';
      try {
        const resp = await s.call('criarLojaIndependenteV2', { nome: nomeLoja, slug: slugLoja });
        lojaId = resp.slug || resp.lojaId;
        localStorage.setItem('flowpdv_gestao_loja_id', lojaId);
        createForm.hidden = true;
        say('Loja criada com sucesso! Carregando catálogo…', 'success');
        await load();
      } catch (err) {
        createResult.textContent = err.code === 'functions/already-exists'
          ? 'Este link de cardápio já está em uso por outra loja. Escolha outro.'
          : (err.message || 'Não foi possível criar a loja. Tente novamente.');
      } finally {
        createForm.querySelectorAll('button,input').forEach(el => el.disabled = false);
      }
    };

    async function load(redraw = true) {
      const result = await s.call('consultarConfiguracaoV2', { lojaId });
      const cursors = new Set();
      while (result.proximaMesa) {
        if (!valid()) return;
        if (cursors.has(result.proximaMesa)) throw new Error('Paginação de mesas inválida.');
        cursors.add(result.proximaMesa);
        const page = await s.call('listarMesasConfiguracaoV2', { lojaId, versao: result.versao, apos: result.proximaMesa });
        result.mesas.push(...page.mesas); result.proximaMesa = page.proximaMesa;
      }
      if (!valid()) return;
      data = result;
      if (result.lojaId) lojaId = result.lojaId;
      uncertain = false; if (redraw) draw();
    }
    storeForm.onsubmit = async e => {
      e?.preventDefault?.(); lojaId = storeForm.elements.loja.value.trim(); storeForm.querySelector('button').disabled = true;
      say('Consultando seu acesso à loja…');
      try {
        await load();
        if (valid()) {
          storeForm.hidden = true;
          localStorage.setItem('flowpdv_gestao_loja_id', data.slug || lojaId);
          say('Catálogo carregado.', 'success');
        }
      }
      catch (e) { say(e.code === 'functions/permission-denied' ? 'Sua conta não tem permissão de gerente nesta loja.' : 'Não foi possível abrir a loja. Confira o endereço ou identificador e a conexão.'); }
      finally { if (valid()) storeForm.querySelector('button').disabled = false; }
    };
    if (salvoLoja) {
      setTimeout(() => {
        if (valid() && !data && storeForm.isConnected) {
          storeForm.dispatchEvent(new Event('submit'));
        }
      }, 50);
    }
    function draw() {
      let sidebar = app.querySelector('.g-sidebar');
      if (!sidebar) {
        const main = app.querySelector('main.gestao-v2'), shell = document.createElement('div'); shell.className = 'g-shell';
        sidebar = document.createElement('aside'); sidebar.className = 'g-sidebar';
        sidebar.innerHTML = '<div class="g-side-brand"><img src="/logos/FlowPDV-horizontal-claro.png" alt="FlowPDV"><div class="g-side-store"><strong></strong><small>Gestão do cardápio</small></div></div><div class="g-side-nav"></div><div class="g-side-foot"></div>';
        main.before(shell); shell.append(sidebar, main);
        const logout = app.querySelector('#g-sair');
        const foot = sidebar.querySelector('.g-side-foot');
        const switchBtn = document.createElement('button');
        switchBtn.type = 'button';
        switchBtn.className = 'btn-ghost';
        switchBtn.style.cssText = 'color:#94a3b8;font-size:12px;text-align:left;padding:6px 0;border:0;background:none;cursor:pointer;';
        switchBtn.textContent = '⇄ Trocar de loja';
        switchBtn.onclick = () => {
          localStorage.removeItem('flowpdv_gestao_loja_id');
          location.reload();
        };
        foot.append(switchBtn);
        if (logout) foot.append(logout);
        const preview = document.createElement('a'); preview.className = 'g-side-preview'; preview.target = '_blank'; preview.rel = 'noopener'; preview.innerHTML = `${ico.eye}<span>Ver cardápio online</span>${ico.external}`;
        foot.prepend(preview);
      }
      sidebar.querySelector('.g-side-store strong').textContent = data.nome || 'Minha loja';
      sidebar.querySelector('.g-side-preview').href = `/${encodeURIComponent(data.slug)}`;
      const products = data.catalogo?.produtos || [];
      catalog.innerHTML = `<header class="page-head"><div><h2>${esc(data.nome)}</h2><p>${products.length} ${products.length === 1 ? 'produto' : 'produtos'} no catálogo</p></div><button class="btn-ghost" id="g-reload">Recarregar catálogo</button></header><label class="g-search">Buscar produto<input id="g-search" type="search" placeholder="Nome ou categoria"></label><div class="g-products"></div><div id="g-editor"></div>`;
      const list = catalog.querySelector('.g-products'), editor = catalog.querySelector('#g-editor');
      const panel = document.createElement('section'); panel.id = 'g-panel-catalogo';
      for (const el of [catalog.querySelector('.g-search'), list, editor]) panel.append(el);
      catalog.append(panel);
      const operation = document.createElement('section'); operation.className = 'g-form'; operation.id = 'g-operation';
      const published = data.catalogo?.publicado === true, enabled = data.modulos.cardapio === true;
      const available = products.filter(p => p.ativo && !p.esgotado).length;
      operation.innerHTML = `<h3>${published ? (enabled && !data.catalogo.pausado ? 'Cardápio disponível no teste' : 'Novos pedidos pausados') : 'Cardápio fora do ar no teste'}</h3><p>${available} de ${products.length} produtos disponíveis. Editar produtos não coloca o cardápio no ar.</p><p>${s.local ? 'Estes controles afetam apenas o ambiente local.' : 'Estes controles alteram o cardápio neste site.'} Pedidos já aceitos continuam no PDV.</p><div class="g-actions"><button type="button" class="btn-primary" id="g-publish">${published ? 'Retirar do ar no teste' : 'Disponibilizar no teste'}</button><button type="button" class="btn-ghost" id="g-pause">${enabled ? 'Pausar novos pedidos' : 'Retomar recebimento'}</button></div><p class="g-result" role="status"></p>`;
      if (!s.local) operation.innerHTML = operation.innerHTML.replaceAll(' no teste', '');
      panel.prepend(operation);
      async function operate(name, payload) {
        if (busy || uncertain) return;
        if (draftGuard.pending()) { say('Salve seus rascunhos antes de mudar a disponibilidade do cardápio.'); return; }
        busy = true; content.querySelectorAll('button,input,select,textarea').forEach(el => el.disabled = true);
        operation.querySelector('.g-result').textContent = 'Atualizando disponibilidade…';
        try {
          await s.call(name, { lojaId, versao: data.versao, ...payload });
          if (!valid()) return;
          uncertain = true; await load(false); draw(); say(s.local ? 'Disponibilidade atualizada no ambiente local.' : 'Disponibilidade atualizada no site.', 'success');
        } catch (e) {
          if (!valid()) return;
          uncertain = true;
          operation.querySelector('.g-result').textContent = `${e.code === 'functions/failed-precondition' ? e.message : 'Não foi possível confirmar a alteração.'} Recarregue o catálogo para conferir o estado antes de tentar novamente.`;
        } finally {
          busy = false;
          if (valid()) content.querySelectorAll('button,input,select,textarea').forEach(el => el.disabled = false);
        }
      }
      operation.querySelector('#g-publish').onclick = () => operate('publicarCatalogoV2', { publicado: !published });
      operation.querySelector('#g-pause').onclick = () => operate('salvarModulosV2', { segmento: data.segmento, modulos: { ...data.modulos, cardapio: !enabled }, cozinha: data.cozinha });
      const createProduct = document.createElement('button'); createProduct.type = 'button'; createProduct.className = 'btn-primary'; createProduct.id = 'g-new-product'; createProduct.textContent = 'Cadastrar produto'; panel.prepend(createProduct);
      createProduct.onclick = () => {
        if (busy || uncertain) return;
        if (productDraft && !window.confirm('Descartar o rascunho para cadastrar outro produto?')) return;
        productDraft = null; dirty = false;
        const product = { id: crypto.randomUUID(), novo: true, nome: '', categoria: '', descricao: '', precoCentavos: 0, ativo: true, esgotado: false, grupos: [] };
        productDraft = { versao: data.versao, product }; edit(product);
      };
      const tabs = document.createElement('nav'); tabs.className = 'g-tabs'; tabs.setAttribute('aria-label', 'Seções da gestão');
      tabs.innerHTML = '<button type="button" data-section="catalogo">Catálogo</button><button type="button" data-section="loja">Loja</button><button type="button" data-section="delivery">Delivery</button><button type="button" data-section="mesas">Mesas e QR</button>';
      catalog.insertBefore(tabs, panel);
      const contactTab = document.createElement('button'); contactTab.type = 'button'; contactTab.dataset.section = 'contato'; contactTab.textContent = 'Contato'; tabs.append(contactTab);
      const contactPanel = document.createElement('section'); contactPanel.id = 'g-panel-contato'; catalog.append(contactPanel);
      renderContatoGestao(contactPanel, contatoDraft || { versao: data.versao, contato: data.contato || {} }, draft => { contatoDraft = draft; }, async (payload, result) => {
        if (busy || uncertain) return;
        busy = true; content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
        result.textContent = 'Salvando contato…';
        try {
          await s.call('salvarContatoLojaV2', { lojaId, ...payload });
          if (!valid()) return;
          uncertain = true; await load(false); contatoDraft = null; draftGuard.clear('g-contact-form'); draw(); say('Contato salvo e atualizado.', 'success');
        } catch (e) {
          if (!valid()) return;
          uncertain = true;
          result.textContent = e.code === 'functions/failed-precondition' ? 'A configuração mudou. Recarregue antes de salvar; seu rascunho foi mantido.' : 'Não foi possível confirmar o salvamento. Recarregue para conferir os dados; seu rascunho foi mantido.';
        } finally {
          busy = false;
          if (valid()) { content.querySelectorAll('button,input,select').forEach(el => el.disabled = false); if (uncertain) content.querySelectorAll('button[type=submit],.g-edit button').forEach(el => el.disabled = true); }
        }
      });
      const addonTab = document.createElement('button'); addonTab.type = 'button'; addonTab.dataset.section = 'adicionais'; addonTab.textContent = 'Adicionais'; tabs.append(addonTab);
      const addonPanel = document.createElement('section'); addonPanel.id = 'g-panel-adicionais'; catalog.append(addonPanel);
      renderAdicionaisGestao(addonPanel, data, addonDraft, draft => { addonDraft = draft; }, async (payload, result) => {
        if (busy || uncertain) return;
        busy = true; content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
        result.textContent = 'Salvando adicional…';
        try {
          await s.call('salvarOpcaoCardapioV2', { lojaId, ...payload });
          if (!valid()) return;
          uncertain = true; await load(false); addonDraft = null; draftGuard.clear('g-addon-form'); draw(); say('Adicional salvo e atualizado.', 'success');
        } catch (e) {
          if (!valid()) return;
          uncertain = true;
          result.textContent = e.code === 'functions/failed-precondition' ? 'A configuração mudou. Recarregue antes de salvar; seu rascunho foi mantido.' : 'Não foi possível confirmar o salvamento. Recarregue para conferir os dados; seu rascunho foi mantido.';
        } finally {
          busy = false;
          if (valid()) { content.querySelectorAll('button,input,select').forEach(el => el.disabled = false); if (uncertain) content.querySelectorAll('button[type=submit],.g-edit button').forEach(el => el.disabled = true); }
        }
      });
      const ordersTab = document.createElement('button'); ordersTab.type = 'button'; ordersTab.dataset.section = 'pedidos'; ordersTab.textContent = 'Pedidos'; tabs.append(ordersTab);
      const ordersPanel = document.createElement('section'); ordersPanel.id = 'g-panel-pedidos'; catalog.append(ordersPanel);
      const orders = renderPedidosGestao(ordersPanel, {
        read: apos => s.call('listarPedidosGestaoV2', { lojaId, ...(apos ? { apos } : {}) }),
        updateStatus: (pedidoId, status, pagamento) => s.call('atualizarStatusPedidoGestaoV2', { lojaId, pedidoId, status, ...(pagamento ? { pagamento } : {}) }),
        lojaId
      }, valid);
      const shopPanel = document.createElement('section'); shopPanel.id = 'g-panel-loja'; catalog.append(shopPanel);
      const deliveryPanel = document.createElement('section'); deliveryPanel.id = 'g-panel-delivery'; catalog.append(deliveryPanel);
      const mesasPanel = document.createElement('section'); mesasPanel.id = 'g-panel-mesas'; catalog.append(mesasPanel);
      renderMesasGestao(mesasPanel, data, mesaDraft, draft => { mesaDraft = draft; }, async (payload, result) => {
        if (busy || uncertain) return;
        busy = true; content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
        result.textContent = 'Salvando mesa…';
        try {
          await s.call('salvarMesaV2', { lojaId, ...payload });
          if (!valid()) return;
          uncertain = true; await load(false); mesaDraft = null; draftGuard.clear('g-table-form'); draw(); say('Mesa salva e atualizada.', 'success');
        } catch (e) {
          if (!valid()) return;
          uncertain = true;
          result.textContent = ['functions/failed-precondition', 'functions/already-exists'].includes(e.code) ? `${e.message} Suas alterações foram mantidas. Recarregue antes de tentar novamente.` : 'Não foi possível confirmar o resultado. Recarregue para conferir os dados; suas alterações estão aqui.';
        } finally {
          busy = false;
          if (valid()) { content.querySelectorAll('button,input,select').forEach(el => el.disabled = false); if (uncertain) content.querySelectorAll('button[type=submit],.g-edit button').forEach(el => el.disabled = true); }
        }
      });
      renderDeliveryGestao(deliveryPanel, deliveryDraft || { versao: data.versao, delivery: data.delivery }, draft => { deliveryDraft = draft; }, async (payload, result) => {
        if (busy || uncertain) return;
        busy = true; content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
        result.textContent = 'Salvando delivery…';
        try {
          await s.call('salvarConfiguracaoDeliveryV2', { lojaId, ...payload });
          if (!valid()) return;
          uncertain = true; await load(false); deliveryDraft = null; draftGuard.clear('g-delivery'); draw(); say('Delivery salvo e atualizado.', 'success');
        } catch (e) {
          if (!valid()) return;
          uncertain = true;
          result.textContent = e.code === 'functions/failed-precondition' ? 'A configuração mudou. Suas alterações estão aqui; recarregue antes de salvar.' : 'Não foi possível confirmar o resultado. Suas alterações estão aqui; recarregue para conferir os dados.';
        } finally {
          busy = false;
          if (valid()) { content.querySelectorAll('button,input,select').forEach(el => el.disabled = false); if (uncertain) content.querySelectorAll('button[type=submit],.g-edit button').forEach(el => el.disabled = true); }
        }
      });
      const initial = lojaDraft || { versao: data.versao, segmento: data.segmento, modulos: { ...data.modulos } };
      const segments = { lanchonete: 'Lanchonete', restaurante: 'Restaurante', adega: 'Adega', mercado: 'Mercado', padaria: 'Padaria', roupas: 'Roupas', outro: 'Outro' };
      shopPanel.innerHTML = `<form class="g-form g-shop"><h2>Funcionamento da loja</h2><label>Segmento<select name="segmento">${Object.entries(segments).map(([value, label]) => `<option value="${value}" ${initial.segmento === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><fieldset><legend>Canais de atendimento</legend>${[['cardapio','Receber pedidos pelo cardápio'],['mesas','Pedidos nas mesas'],['retirada','Retirada na loja'],['garcom','Atendimento por garçom']].map(([key, label]) => `<label class="g-check"><input type="checkbox" name="${key}" ${initial.modulos[key] ? 'checked' : ''}>${label}</label>`).join('')}</fieldset><p>O delivery e a configuração da cozinha são mantidos como estão.</p><button class="btn-primary" type="submit">Salvar configuração</button><p class="g-result" role="status"></p></form>`;
      const shopForm = shopPanel.querySelector('form');
      const shopValues = () => ({ versao: initial.versao, segmento: shopForm.elements.segmento.value, modulos: Object.fromEntries(['cardapio','mesas','retirada','garcom'].map(key => [key, shopForm.elements[key].checked])) });
      shopForm.oninput = () => { lojaDraft = shopValues(); };
      const switchTab = tab => {
        activeTab = tab; panel.hidden = tab !== 'catalogo'; shopPanel.hidden = tab !== 'loja'; deliveryPanel.hidden = tab !== 'delivery'; mesasPanel.hidden = tab !== 'mesas';
        contactPanel.hidden = tab !== 'contato'; addonPanel.hidden = tab !== 'adicionais'; ordersPanel.hidden = tab !== 'pedidos'; if (tab === 'pedidos') orders.show();
        tabs.querySelectorAll('button').forEach(button => button.setAttribute('aria-current', button.dataset.section === tab ? 'page' : 'false'));
      };
      const navIcons = { catalogo: ico.bag, loja: ico.store, delivery: ico.bag, mesas: ico.qr, contato: ico.store, adicionais: ico.bag, pedidos: ico.orders };
      for (const button of tabs.querySelectorAll('button')) { const label = button.textContent; button.innerHTML = `${navIcons[button.dataset.section] || ico.store}<span>${esc(label)}</span>`; }
      sidebar.querySelector('.g-side-nav').replaceChildren(tabs);
      tabs.onclick = event => { const button = event.target.closest('[data-section]'); if (!button || busy) return; switchTab(button.dataset.section); window.scrollTo({ top: 0, behavior: 'instant' }); };
      switchTab(activeTab);
      shopForm.onsubmit = async event => {
        event.preventDefault(); if (busy || uncertain) return;
        const draft = lojaDraft || shopValues(), result = shopForm.querySelector('.g-result');
        if (draft.modulos.cardapio && !draft.modulos.mesas && !draft.modulos.retirada && !data.delivery?.ativo) { result.textContent = 'Ative mesas ou retirada para receber pedidos pelo cardápio.'; return; }
        busy = true; content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
        result.textContent = 'Salvando configuração…';
        try {
          await s.call('salvarModulosV2', { lojaId, ...draft, cozinha: data.cozinha });
          if (!valid()) return;
          uncertain = true; await load(false); lojaDraft = null; draftGuard.clear('g-shop'); draw();
          result.textContent = 'Configuração salva.'; say('Configuração da loja atualizada.', 'success');
        } catch (e) {
          if (!valid()) return;
          uncertain = true;
          result.textContent = e.code === 'functions/failed-precondition' ? 'Não foi possível salvar: ' + e.message + ' Suas alterações foram mantidas. Recarregue antes de tentar novamente.' : 'Não foi possível confirmar o salvamento. Suas alterações foram mantidas. Recarregue para conferir os dados.';
        } finally {
          busy = false;
          if (valid()) { content.querySelectorAll('button,input,select').forEach(el => el.disabled = false); if (uncertain) content.querySelectorAll('.g-edit button,.g-shop button').forEach(el => el.disabled = true); }
        }
      };
      let dirty = Boolean(productDraft);
      catalog.querySelector('#g-reload').onclick = async () => {
        if (busy) return;
        if ((dirty || lojaDraft || deliveryDraft || mesaDraft || addonDraft || contatoDraft) && !window.confirm('Descartar as alterações dos formulários e carregar os dados salvos?')) return;
        busy = true; content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
        say('Atualizando catálogo…');
        try { await load(false); lojaDraft = null; productDraft = null; deliveryDraft = null; mesaDraft = null; addonDraft = null; contatoDraft = null; draftGuard.clear(); draw(); say('Catálogo atualizado.'); } catch { say('Não foi possível atualizar. Suas alterações continuam no formulário.'); }
        finally { busy = false; if (valid()) { content.querySelectorAll('button,input,select').forEach(el => el.disabled = false); if (uncertain) { const save = content.querySelector('.g-edit button'); if (save) save.disabled = true; } } }
      };
      function filter() {
        const query = catalog.querySelector('#g-search').value.trim().toLocaleLowerCase('pt-BR');
        list.innerHTML = '';
        for (const p of products.filter(p => `${p.nome} ${p.categoria || ''}`.toLocaleLowerCase('pt-BR').includes(query))) {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'g-product';
          button.innerHTML = `<span><strong>${esc(p.nome)}</strong><small>${esc(p.categoria || 'Sem categoria')} · ${p.esgotado ? 'Esgotado' : p.ativo ? 'Disponível' : 'Oculto'}</small></span><span>${(p.precoCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>`;
          button.onclick = () => {
            if (dirty && !window.confirm('Descartar as alterações deste formulário para editar outro produto?')) return;
            dirty = false; productDraft = null; edit(p);
          }; list.append(button);
        }
        if (!list.children.length) list.textContent = products.length ? 'Nenhum produto encontrado.' : 'Esta loja ainda não possui produtos no catálogo.';
      }
      catalog.querySelector('#g-search').oninput = filter; filter();
      if (productDraft) edit(productDraft.product, productDraft.versao);
      function edit(p, version = data.versao) {
        const productVersion = version;
        editor.innerHTML = `<form class="g-form g-edit"><h2>${p.novo ? 'Cadastrar produto' : 'Editar produto'}</h2><label>Nome<input name="nome" required maxlength="80" value="${esc(p.nome)}"></label><label>Categoria<input name="categoria" maxlength="60" value="${esc(p.categoria)}"></label><label>Descrição<input name="descricao" maxlength="300" value="${esc(p.descricao)}"></label><label>Preço (R$)<input name="preco" type="number" required min="0" max="10000" step="0.01" value="${(p.precoCentavos / 100).toFixed(2)}"></label><label class="g-check"><input name="ativo" type="checkbox" ${p.ativo ? 'checked' : ''}>Mostrar no cardápio</label><label class="g-check"><input name="esgotado" type="checkbox" ${p.esgotado ? 'checked' : ''}>Produto esgotado</label><button class="btn-primary" ${uncertain ? 'disabled' : ''}>Salvar produto</button><p class="g-result" role="status"></p></form>`;
        const form = editor.querySelector('form'), result = form.querySelector('.g-result');
        renderFotoGestao(form, p.imagemUrl, p.novo ? null : async file => {
          if (busy || uncertain) throw Error('Recarregue os dados ou aguarde o salvamento antes de enviar a foto.');
          busy = true; const uid = s.auth.currentUser?.uid;
          content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
          try {
            const url = await enviarFotoGestaoV2(file, async () => {
              const signature = await s.call('assinarFotoCardapioV2', { lojaId, produtoId: p.id, versao: productVersion });
              if (!valid() || s.auth.currentUser?.uid !== uid) throw Error('A sessão mudou. Entre novamente.');
              return signature;
            });
            if (!valid() || s.auth.currentUser?.uid !== uid) throw Error('A sessão mudou. Entre novamente.');
            return url;
          } finally { busy = false; if (valid()) content.querySelectorAll('button,input,select').forEach(el => el.disabled = false); }
        });
        form.oninput = () => { dirty = true; const f = form.elements; productDraft = { versao: productVersion, product: { ...p, imagemUrl: f.imagemUrl.value, nome: f.nome.value, categoria: f.categoria.value, descricao: f.descricao.value, precoCentavos: Number(f.preco.value) * 100, ativo: f.ativo.checked, esgotado: f.esgotado.checked } }; };
        if (uncertain) result.textContent = 'Recarregue o catálogo antes de salvar novamente.';
        if (activeTab === 'catalogo') { form.elements.nome.focus({ preventScroll: true }); editor.scrollIntoView({ behavior: 'instant', block: 'start' }); }
        form.onsubmit = async e => {
          e.preventDefault(); if (uncertain || busy) return;
          const fields = form.elements, payload = { lojaId, versao: productVersion, produtoId: p.id, imagemUrl: fields.imagemUrl.value.trim(), nome: fields.nome.value.trim(), categoria: fields.categoria.value.trim(), descricao: fields.descricao.value.trim(), precoCentavos: Math.round(Number(fields.preco.value) * 100), ativo: fields.ativo.checked, esgotado: fields.esgotado.checked };
          if (!payload.nome) { result.textContent = 'Informe o nome do produto.'; return; }
          try { validarFotoV2(payload.imagemUrl); } catch (e) { result.textContent = e.message; return; }
          busy = true; content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
          result.textContent = 'Salvando produto…';
          try {
            await s.call('salvarProdutoCardapioV2', payload);
            if (!valid()) return;
            uncertain = true;
            await load(false); productDraft = null; draftGuard.clear('g-edit'); draw(); say('Produto salvo e catálogo atualizado.', 'success');
          } catch (e) {
            if (!valid()) return;
            uncertain = true;
            result.textContent = e.code === 'functions/failed-precondition' ? 'Os dados podem ter mudado em outra sessão. Suas alterações estão aqui; recarregue o catálogo antes de salvar.' : 'Não foi possível confirmar o resultado. Suas alterações estão aqui; recarregue para conferir o que foi salvo.';
          } finally {
            busy = false;
            if (valid()) { content.querySelectorAll('button,input,select').forEach(el => el.disabled = false); if (uncertain) content.querySelectorAll('.g-edit button,.g-shop button').forEach(el => el.disabled = true); }
          }
        };
      }
    }
  });
  return () => { disposed = true; epoch++; draftGuard?.dispose(); unsubscribe(); };
}

