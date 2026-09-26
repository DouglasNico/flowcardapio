import { protegerRascunhosGestao } from '../lib/rascunhos-gestao-v2.js';
import { enviarFotoGestaoV2 } from '../lib/upload-foto-v2.js';
import { ico } from '../lib/icons.js';
import { renderContatoGestao } from './gestao-contato-v2.js';
import { renderFotoGestao, validarFotoV2 } from './gestao-foto-v2.js';
import { renderAdicionaisGestao } from './gestao-adicionais-v2.js';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { mascaraMoeda, formatarBRL, mascaraTelefone } from '../lib/moeda.js';
import { ambienteGestaoV2 } from '../lib/gestao-v2.js';
import { htmlFoto } from '../lib/foto.js';
import '../lib/foto.css';
import './painel-foto.css';
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

    app.innerHTML = `
      <main class="gestao-v2">
        <header class="g-topbar">
          <div class="g-topbar-brand">
            <img src="/logos/FlowPDV-horizontal-claro.png" alt="FlowPDV" class="g-topbar-logo">
            <span class="g-topbar-badge">Gestão V2</span>
          </div>
          <div class="g-topbar-user">
            ${user ? `
              <div class="g-user-chip">
                <span class="g-user-dot"></span>
                <span>${esc(user.email)}</span>
              </div>
              <button type="button" class="btn-ghost g-btn-sair" id="g-sair">Sair</button>
            ` : ''}
          </div>
        </header>
        <p id="g-status" role="status" aria-live="polite"></p>
        <div id="g-content"></div>
      </main>
    `;

    const content = app.querySelector('#g-content'), status = app.querySelector('#g-status');
    const say = (text, tone = 'info') => { if (valid()) { status.dataset.tone = tone; status.textContent = text; } };

    if (!user) {
      content.innerHTML = `
        <div class="g-onboard-wrapper">
          <div class="g-onboard-card">
            <div class="g-onboard-header">
              <img src="/logos/FlowPDV-horizontal-claro.png" alt="FlowPDV" style="height:36px; margin:0 auto 12px; display:block;">
              <h2>Acesso da Gerência</h2>
              <p>Gerencie produtos, fotos, combos, pedidos e configurações em tempo real.</p>
            </div>

            <div class="g-auth-toggle-wrap">
              <button type="button" class="g-auth-toggle-btn is-active" id="g-tab-login">Entrar</button>
              <button type="button" class="g-auth-toggle-btn" id="g-tab-reg">Cadastre-se grátis</button>
            </div>

            <form id="g-login" class="g-store-form">
              <div class="g-field-group">
                <label for="g-login-email">E-mail cadastrado</label>
                <input id="g-login-email" name="email" type="email" autocomplete="username" placeholder="seu-email@exemplo.com" required>
              </div>
              <div class="g-field-group">
                <label for="g-login-password">Senha de acesso</label>
                <input id="g-login-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required>
              </div>
              <button type="submit" class="btn-primary g-btn-submit-store" style="margin-top:8px;">
                <span>Entrar no Painel</span>
                <span style="font-size:16px;">→</span>
              </button>
            </form>

            <form id="g-register" class="g-store-form" hidden style="display: none;">
              <div class="g-field-group">
                <label for="g-reg-nome">Nome do Gerente / Estabelecimento</label>
                <input id="g-reg-nome" name="nome" type="text" placeholder="Ex: Hamburgueria Silva" required maxlength="80">
              </div>
              <div class="g-field-group">
                <label for="g-reg-email">E-mail para acesso</label>
                <input id="g-reg-email" name="email" type="email" autocomplete="username" placeholder="seu-email@exemplo.com" required>
              </div>
              <div class="g-field-group">
                <label for="g-reg-password">Crie sua Senha (mínimo 6 caracteres)</label>
                <input id="g-reg-password" name="password" type="password" autocomplete="new-password" placeholder="••••••••" required minlength="6">
              </div>
              <button type="submit" class="btn-primary g-btn-submit-store" style="margin-top:8px;">
                <span>Criar Conta e Começar</span>
                <span style="font-size:16px;">→</span>
              </button>
            </form>
          </div>
        </div>
      `;

      const tabLogin = content.querySelector('#g-tab-login');
      const tabReg = content.querySelector('#g-tab-reg');
      const formLogin = content.querySelector('#g-login');
      const formReg = content.querySelector('#g-register');

      tabLogin.onclick = () => {
        tabLogin.classList.add('is-active');
        tabReg.classList.remove('is-active');
        formLogin.hidden = false;
        formLogin.style.display = 'flex';
        formReg.hidden = true;
        formReg.style.display = 'none';
        say('');
      };
      tabReg.onclick = () => {
        tabReg.classList.add('is-active');
        tabLogin.classList.remove('is-active');
        formReg.hidden = false;
        formReg.style.display = 'flex';
        formLogin.hidden = true;
        formLogin.style.display = 'none';
        say('');
      };

      formLogin.onsubmit = async e => {
        e.preventDefault(); formLogin.querySelector('button').disabled = true; say('Entrando…');
        try { await signInWithEmailAndPassword(s.auth, formLogin.elements.email.value.trim(), formLogin.elements.password.value); }
        catch { say('Não foi possível entrar. Confira e-mail, senha e sua conexão.'); }
        finally { if (valid()) formLogin.querySelector('button').disabled = false; }
      };

      formReg.onsubmit = async e => {
        e.preventDefault(); formReg.querySelector('button').disabled = true; say('Criando sua conta…');
        const nome = formReg.elements.nome.value.trim();
        const email = formReg.elements.email.value.trim();
        const password = formReg.elements.password.value;
        try {
          const cred = await createUserWithEmailAndPassword(s.auth, email, password);
          if (cred.user && nome) {
            try { await updateProfile(cred.user, { displayName: nome }); } catch {}
          }
          say('Conta criada com sucesso! Carregando painel…', 'success');
        } catch (err) {
          say(err.code === 'auth/email-already-in-use' ? 'Este e-mail já possui cadastro. Use a aba Entrar.' : (err.message || 'Não foi possível cadastrar a conta.'));
        } finally {
          if (valid()) formReg.querySelector('button').disabled = false;
        }
      };
      return;
    }

    const btnSair = app.querySelector('#g-sair');
    if (btnSair) {
      btnSair.onclick = async () => { try { await signOut(s.auth); } catch { say('Não foi possível sair. Tente novamente.'); } };
    }

    const salvoLoja = localStorage.getItem('flowpdv_gestao_loja_id') || '';
    content.innerHTML = `
      <div class="g-onboard-wrapper">
        <div id="g-store-card" class="g-onboard-card">
          <div class="g-onboard-header">
            <div class="g-onboard-icon">${ico.store}</div>
            <h2>Painel do Lojista</h2>
            <p>Selecione um estabelecimento para gerenciar ou comece uma nova operação online.</p>
          </div>

          <div id="g-minhas-lojas-box" class="g-minhas-lojas-box" hidden>
            <div class="g-section-header">
              <span class="g-section-label">Suas Lojas</span>
              <span class="g-section-count" id="g-lojas-count"></span>
            </div>
            <div id="g-lojas-grid" class="g-lojas-grid"></div>
          </div>

          <form id="g-store" class="g-store-form">
            <div class="g-field-group">
              <label for="g-input-loja">Acessar Loja por Endereço ou ID</label>
              <div class="g-input-wrap">
                <span class="g-input-prefix">flowpdv.app.br/</span>
                <input id="g-input-loja" name="loja" required pattern="[A-Za-z0-9_-]{1,80}" maxlength="80" placeholder="burger-teste" value="${esc(salvoLoja)}">
              </div>
              <div class="g-quick-suggestions">
                <span class="g-quick-label">Atalhos rápidos:</span>
                <button type="button" class="g-chip-btn" data-fill-loja="burger-teste">🍔 burger-teste</button>
              </div>
            </div>
            <button type="submit" class="btn-primary g-btn-submit-store" style="margin-top:10px;">
              <span>Abrir Painel da Loja</span>
              <span style="font-size:16px;">→</span>
            </button>
          </form>

          <div class="g-onboard-divider">
            <span>ou</span>
          </div>

          <div class="g-new-store-cta">
            <div class="g-new-store-cta-info">
              <strong>+ Cadastrar Nova Loja Independente</strong>
              <p>Crie seu cardápio em segundos para gerenciar pelo celular sem PDV desktop.</p>
            </div>
            <button type="button" class="btn-outline" id="g-btn-nova-loja">Criar Loja</button>
          </div>
        </div>

        <form id="g-create-store" class="g-onboard-card" hidden>
          <div class="g-onboard-header">
            <div class="g-onboard-icon" style="background:#ffedd5; color:#c2410c;">${ico.store}</div>
            <h2>Cadastrar Nova Loja</h2>
            <p>Seu cardápio estará no ar imediatamente para receber pedidos no WhatsApp e celular.</p>
          </div>

          <div class="g-field-group">
            <label for="g-create-nome">Nome do Estabelecimento *</label>
            <input id="g-create-nome" name="nome" required maxlength="80" placeholder="Ex: Hamburgueria Artesanal">
          </div>

          <div class="g-field-group">
            <label for="g-create-slug">Endereço Público do Cardápio *</label>
            <div class="g-input-wrap">
              <span class="g-input-prefix">flowpdv.app.br/</span>
              <input id="g-create-slug" name="slug" required pattern="[a-z0-9-]{3,60}" maxlength="60" placeholder="hamburgueria-artesanal" style="text-transform:lowercase;">
            </div>
            <small class="g-field-hint">Este será o link oficial do cardápio para seus clientes.</small>
          </div>

          <div class="g-create-actions">
            <button type="submit" class="btn-primary g-btn-create-submit">Criar Loja e Começar</button>
            <button type="button" class="btn-ghost" id="g-btn-voltar-loja">Voltar</button>
          </div>
          <p class="g-result" role="status"></p>
        </form>
      </div>

      <section id="g-catalog" hidden></section>
    `;

    const storeCard = content.querySelector('#g-store-card'), storeForm = content.querySelector('#g-store'), createForm = content.querySelector('#g-create-store'), catalog = content.querySelector('#g-catalog');
    const btnNovaLoja = content.querySelector('#g-btn-nova-loja'), btnVoltarLoja = content.querySelector('#g-btn-voltar-loja'), createResult = createForm.querySelector('.g-result');
    let data, lojaId, uncertain = false, busy = false, activeTab = 'catalogo', categoriaFiltro = '', lojaDraft = null, productDraft = null, deliveryDraft = null, mesaDraft = null, addonDraft = null, contatoDraft = null;
    draftGuard = protegerRascunhosGestao(content, () => busy);

    // Carrega lojas já vinculadas ao usuário
    (async () => {
      try {
        const res = await s.call('listarMinhasLojasV2', {});
        const lojas = res?.lojas || [];
        const box = content.querySelector('#g-minhas-lojas-box');
        const grid = content.querySelector('#g-lojas-grid');
        const count = content.querySelector('#g-lojas-count');
        if (box && grid && lojas.length > 0) {
          box.hidden = false;
          if (count) count.textContent = `${lojas.length} cadastrada${lojas.length > 1 ? 's' : ''}`;
          grid.innerHTML = lojas.map(l => `
            <button type="button" class="g-loja-card" data-loja-slug="${esc(l.slug || l.lojaId)}">
              <div class="g-loja-card-icon">${ico.store}</div>
              <div class="g-loja-card-info">
                <strong>${esc(l.nome)}</strong>
                <small>flowpdv.app.br/${esc(l.slug)}</small>
              </div>
              <span class="g-loja-card-arrow">Abrir →</span>
            </button>
          `).join('');
          grid.querySelectorAll('.g-loja-card').forEach(btn => {
            btn.onclick = () => {
              storeForm.elements.loja.value = btn.dataset.lojaSlug;
              storeForm.dispatchEvent(new Event('submit'));
            };
          });
        }
      } catch (err) {
        console.warn('Erro ao carregar lojas do gerente:', err);
      }
    })();

    content.querySelectorAll('[data-fill-loja]').forEach(btn => {
      btn.onclick = () => {
        storeForm.elements.loja.value = btn.dataset.fillLoja;
        storeForm.dispatchEvent(new Event('submit'));
      };
    });

    btnNovaLoja.onclick = () => {
      storeCard.hidden = true;
      createForm.hidden = false;
      createForm.elements.nome.focus();
    };

    btnVoltarLoja.onclick = () => {
      createForm.hidden = true;
      storeCard.hidden = false;
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
        if (valid()) {
          const wrapper = content.querySelector('.g-onboard-wrapper');
          if (wrapper) { wrapper.hidden = true; wrapper.style.display = 'none'; }
          say('');
        }
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
          const wrapper = content.querySelector('.g-onboard-wrapper');
          if (wrapper) { wrapper.hidden = true; wrapper.style.display = 'none'; }
          if (storeCard) storeCard.hidden = true;
          storeForm.hidden = true;
          localStorage.setItem('flowpdv_gestao_loja_id', data.slug || lojaId);
          say('');
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
      const topbar = app.querySelector('.g-topbar');
      if (topbar) {
        topbar.hidden = true;
        topbar.style.display = 'none';
      }
      const wrapper = content.querySelector('.g-onboard-wrapper');
      if (wrapper) {
        wrapper.hidden = true;
        wrapper.style.display = 'none';
      }
      catalog.hidden = false;
      catalog.style.display = '';
      const curStatus = app.querySelector('#g-status');
      if (curStatus && (curStatus.textContent.includes('Carregando') || curStatus.textContent.includes('Consultando') || curStatus.textContent.includes('criada com sucesso'))) {
        say('');
      }

      const published = data.catalogo?.publicado === true, enabled = data.modulos.cardapio === true;
      const storeLogo = data.catalogo?.logoUrl || data.catalogo?.logotipoUrl || data.logoUrl || '';
      const storeInitials = (data.nome || 'LP').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

      // Construção da Barra Lateral Moderna (Sidebar)
      let sidebar = app.querySelector('.g-sidebar');
      if (!sidebar) {
        const main = app.querySelector('main.gestao-v2'), shell = document.createElement('div'); shell.className = 'g-shell';
        sidebar = document.createElement('aside'); sidebar.className = 'g-sidebar';
        sidebar.innerHTML = `
          <div class="g-sidebar-top">
            <div class="g-sidebar-brand">
              <img src="/logos/FlowPDV-horizontal-escuro.png" alt="FlowPDV" class="g-sidebar-brand-img">
            </div>

            <div class="g-sidebar-store-card">
              <div class="g-store-avatar-box">
                ${storeLogo ? `<img src="${esc(storeLogo)}" alt="Logo" class="g-store-avatar-img">` : `<div class="g-store-avatar-ph">${esc(storeInitials)}</div>`}
              </div>
              <div class="g-store-meta-box">
                <strong class="g-store-name-txt" title="${esc(data.nome)}">${esc(data.nome || 'Minha Loja')}</strong>
                <span class="g-store-status-badge ${published && enabled ? 'is-live' : 'is-paused'}">
                  <span class="g-status-dot-pulse"></span>
                  <span>${published && enabled ? 'Cardápio no ar' : 'Pausado'}</span>
                </span>
              </div>
            </div>
          </div>

          <div class="g-side-nav"></div>

          <div class="g-sidebar-foot">
            <a href="/${encodeURIComponent(data.slug)}" target="_blank" rel="noopener" class="g-btn-view-menu">
              <span style="display:flex; align-items:center; gap:8px;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                <span>Ver cardápio online</span>
              </span>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>

            <div class="g-sidebar-user-card">
              <div class="g-user-info-row">
                <span class="g-user-badge-icon">👤</span>
                <div class="g-user-text-col">
                  <span class="g-user-role-label">Gerente</span>
                  <span class="g-user-email-label" title="${esc(user.email)}">${esc(user.email)}</span>
                </div>
              </div>
              <div class="g-user-actions-row">
                <button type="button" class="g-user-mini-btn" id="g-switch-store">
                  ⇄ Trocar loja
                </button>
                <button type="button" class="g-user-mini-btn g-user-mini-btn--danger" id="g-logout">
                  Sair
                </button>
              </div>
            </div>
          </div>
        `;
        main.before(shell); shell.append(sidebar, main);

        sidebar.querySelector('#g-switch-store').onclick = () => {
          localStorage.removeItem('flowpdv_gestao_loja_id');
          location.reload();
        };

        sidebar.querySelector('#g-logout').onclick = async () => {
          try { await signOut(s.auth); } catch { say('Não foi possível sair.'); }
        };
      } else {
        // Atualiza cabeçalho da loja na sidebar existente
        const nameEl = sidebar.querySelector('.g-store-name-txt');
        if (nameEl) nameEl.textContent = data.nome || 'Minha Loja';
        const avatarEl = sidebar.querySelector('.g-store-avatar-box');
        if (avatarEl) {
          avatarEl.innerHTML = storeLogo 
            ? `<img src="${esc(storeLogo)}" alt="Logo" class="g-store-avatar-img">` 
            : `<div class="g-store-avatar-ph">${esc(storeInitials)}</div>`;
        }
        const previewEl = sidebar.querySelector('.g-btn-view-menu');
        if (previewEl) previewEl.href = `/${encodeURIComponent(data.slug)}`;
      }

      const products = data.catalogo?.produtos || [];
      const available = products.filter(p => p.ativo && !p.esgotado).length;

      catalog.innerHTML = `
        <div id="g-panel-catalogo">
          <header class="g-catalog-head-row">
            <div class="g-catalog-title-group">
              <h2>${esc(data.nome || 'Cardápio')}</h2>
              <div class="g-catalog-meta">
                <span class="g-badge-${published ? (enabled && !data.catalogo?.pausado ? 'live' : 'paused') : 'off'}">
                  ${published ? (enabled && !data.catalogo?.pausado ? '● Cardápio no ar' : '⏸ Novos pedidos pausados') : '○ Cardápio fora do ar'}
                </span>
                <span>${available} de ${products.length} produtos disponíveis</span>
              </div>
            </div>
            <div class="g-catalog-actions">
              <button type="button" class="btn-primary g-btn-new-product" id="g-new-product">
                <span style="font-size:18px; line-height:1;">+</span>
                <span>Cadastrar Produto</span>
              </button>
              <button type="button" class="btn-ghost" id="g-pause">
                ${enabled ? 'Pausar pedidos' : 'Retomar pedidos'}
              </button>
              <button type="button" class="btn-ghost" id="g-publish">
                ${published ? 'Retirar do ar' : 'Publicar'}
              </button>
              <button type="button" class="btn-ghost" id="g-reload" title="Recarregar catálogo">
                ↻ Atualizar
              </button>
            </div>
          </header>

          <div class="g-catalog-toolbar">
            <div class="g-search-box">
              <span class="g-search-icon">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </span>
              <input id="g-search" type="search" placeholder="Buscar produto por nome ou categoria…">
            </div>
            <div class="g-cat-pills" id="g-cat-pills"></div>
          </div>

          <div class="g-products-grid" id="g-products-grid"></div>
        </div>

        <div id="g-modal-product-wrap"></div>
      `;

      const panel = catalog.querySelector('#g-panel-catalogo');
      const grid = catalog.querySelector('#g-products-grid');
      const pillsContainer = catalog.querySelector('#g-cat-pills');
      const searchInput = catalog.querySelector('#g-search');
      const modalWrap = catalog.querySelector('#g-modal-product-wrap');

      async function operate(name, payload) {
        if (busy || uncertain) return;
        if (draftGuard.pending()) { say('Salve seus rascunhos antes de mudar a disponibilidade do cardápio.'); return; }
        busy = true; content.querySelectorAll('button,input,select,textarea').forEach(el => el.disabled = true);
        say('Atualizando disponibilidade…');
        try {
          await s.call(name, { lojaId, versao: data.versao, ...payload });
          if (!valid()) return;
          uncertain = true; await load(false); draw(); say('Disponibilidade atualizada.', 'success');
        } catch (e) {
          if (!valid()) return;
          uncertain = true;
          say(`${e.code === 'functions/failed-precondition' ? e.message : 'Não foi possível confirmar a alteração.'} Recarregue o catálogo.`, 'error');
        } finally {
          busy = false;
          if (valid()) content.querySelectorAll('button,input,select,textarea').forEach(el => el.disabled = false);
        }
      }

      catalog.querySelector('#g-publish').onclick = () => operate('publicarCatalogoV2', { publicado: !published });
      catalog.querySelector('#g-pause').onclick = () => operate('salvarModulosV2', { segmento: data.segmento, modulos: { ...data.modulos, cardapio: !enabled }, cozinha: data.cozinha });

      catalog.querySelector('#g-new-product').onclick = () => {
        if (busy || uncertain) return;
        productDraft = null;
        const newProduct = {
          id: crypto.randomUUID(),
          novo: true,
          nome: '',
          categoria: categoriaFiltro || '',
          descricao: '',
          precoCentavos: 0,
          ativo: true,
          esgotado: false,
          grupos: []
        };
        edit(newProduct);
      };

      // Abas de Seções
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
          result.textContent = e.code === 'functions/failed-precondition' ? 'A configuração mudou. Recarregue antes de salvar.' : 'Não foi possível confirmar o salvamento.';
        } finally {
          busy = false;
          if (valid()) content.querySelectorAll('button,input,select').forEach(el => el.disabled = false);
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
          result.textContent = e.code === 'functions/failed-precondition' ? 'A configuração mudou. Recarregue antes de salvar.' : 'Não foi possível confirmar o salvamento.';
        } finally {
          busy = false;
          if (valid()) content.querySelectorAll('button,input,select').forEach(el => el.disabled = false);
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
          result.textContent = ['functions/failed-precondition', 'functions/already-exists'].includes(e.code) ? `${e.message} Recarregue antes de tentar.` : 'Não foi possível confirmar o resultado.';
        } finally {
          busy = false;
          if (valid()) content.querySelectorAll('button,input,select').forEach(el => el.disabled = false);
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
          result.textContent = e.code === 'functions/failed-precondition' ? 'A configuração mudou. Recarregue antes de salvar.' : 'Não foi possível confirmar o resultado.';
        } finally {
          busy = false;
          if (valid()) content.querySelectorAll('button,input,select').forEach(el => el.disabled = false);
        }
      });

      // Painel Loja (Identidade, Logotipo, WhatsApp com Máscara, Segmento Limpo, Canais)
      const initial = lojaDraft || { versao: data.versao, segmento: data.segmento, modulos: { ...data.modulos } };
      const currentLogo = data.catalogo?.logoUrl || data.catalogo?.logotipoUrl || data.logoUrl || '';
      const segments = { lanchonete: 'Lanchonete', restaurante: 'Restaurante', pizzaria: 'Pizzaria', adega: 'Adega / Bebidas', mercado: 'Mercado', padaria: 'Padaria', roupas: 'Roupas / Moda', outro: 'Outro' };

      shopPanel.innerHTML = `
        <form class="g-form g-shop" id="g-shop-form">
          <h2>Identidade e Canais da Loja</h2>

          <div class="g-store-identity-card">
            <div class="g-logo-row">
              <div class="g-logo-preview-circle" id="g-logo-preview">
                ${currentLogo ? `<img src="${esc(currentLogo)}" alt="Logo" id="g-logo-img">` : `<span style="font-size:32px;">🏪</span>`}
              </div>
              <div class="g-logo-info">
                <strong>Logotipo do Estabelecimento</strong>
                <small>Exibido no cabeçalho do cardápio e no compartilhamento social.</small>
                <button type="button" class="btn-outline" id="g-btn-pick-logo">📷 Escolher Logotipo</button>
                <input type="file" id="g-logo-file-input" accept="image/jpeg,image/png,image/webp" hidden>
                <input type="hidden" name="logoUrl" id="g-input-logo-url" value="${esc(currentLogo)}">
                <p id="g-logo-status" style="font-size:12px; margin:4px 0 0; color:#64748b;"></p>
              </div>
            </div>

            <div class="g-field-row" style="margin-top:12px;">
              <div class="g-field-group" style="flex:1;">
                <label for="g-shop-nome">Nome da Loja</label>
                <input id="g-shop-nome" name="nome" value="${esc(data.nome || '')}" required maxlength="80">
              </div>
              <div class="g-field-group" style="flex:1;">
                <label for="g-shop-whats">WhatsApp para Pedidos</label>
                <input id="g-shop-whats" name="whatsapp" value="${esc(data.contato?.whatsapp || '')}" placeholder="(11) 99999-9999">
              </div>
            </div>
          </div>

          <label>Segmento do Negócio
            <select name="segmento">
              ${Object.entries(segments).map(([value, label]) => `<option value="${value}" ${initial.segmento === value ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </label>

          <fieldset>
            <legend>Canais de atendimento ativos</legend>
            ${[['cardapio','Receber pedidos pelo cardápio online'],['mesas','Pedidos nas mesas via QR Code'],['retirada','Retirada no balcão'],['garcom','Atendimento presencial por garçom']].map(([key, label]) => `
              <label class="g-check">
                <input type="checkbox" name="${key}" ${initial.modulos[key] ? 'checked' : ''}>
                <span>${label}</span>
              </label>
            `).join('')}
          </fieldset>

          <button class="btn-primary" type="submit" style="margin-top:12px; padding:12px 24px;">Salvar Alterações da Loja</button>
          <p class="g-result" role="status"></p>
        </form>
      `;

      const shopForm = shopPanel.querySelector('form');
      const logoInput = shopPanel.querySelector('#g-logo-file-input');
      const pickLogoBtn = shopPanel.querySelector('#g-btn-pick-logo');
      const logoStatus = shopPanel.querySelector('#g-logo-status');
      const logoHidden = shopPanel.querySelector('#g-input-logo-url');
      const logoPreview = shopPanel.querySelector('#g-logo-preview');
      const whatsInput = shopPanel.querySelector('#g-shop-whats');

      // Aplica máscara telefônica automática no WhatsApp
      mascaraTelefone(whatsInput);

      pickLogoBtn.onclick = () => logoInput.click();
      logoInput.onchange = async () => {
        const file = logoInput.files?.[0];
        if (!file) return;
        logoStatus.textContent = 'Enviando logotipo…';
        pickLogoBtn.disabled = true;
        try {
          const url = await enviarFotoGestaoV2(file, async () => {
            return await s.call('assinarFotoCardapioV2', { lojaId, produtoId: 'logo', versao: data.versao });
          });
          logoHidden.value = url;
          logoPreview.innerHTML = `<img src="${esc(url)}" alt="Logo" id="g-logo-img">`;
          logoStatus.textContent = 'Logotipo pronto! Clique em Salvar abaixo.';
          logoStatus.style.color = '#15803d';
        } catch (err) {
          logoStatus.textContent = 'Falha no envio do logo: ' + err.message;
          logoStatus.style.color = '#b91c1c';
        } finally {
          pickLogoBtn.disabled = false;
        }
      };

      const shopValues = () => ({
        versao: initial.versao,
        segmento: shopForm.elements.segmento.value,
        modulos: Object.fromEntries(['cardapio','mesas','retirada','garcom'].map(key => [key, shopForm.elements[key].checked]))
      });

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
        if (draft.modulos.cardapio && !draft.modulos.mesas && !draft.modulos.retirada && !data.delivery?.ativo) {
          result.textContent = 'Ative mesas ou retirada para receber pedidos pelo cardápio.';
          return;
        }
        busy = true; content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
        result.textContent = 'Salvando configurações da loja…';
        try {
          const novoNome = shopForm.elements.nome?.value?.trim();
          const novoWhats = shopForm.elements.whatsapp?.value?.replace(/\D/g, '');
          const novoLogo = logoHidden.value?.trim();

          await s.call('salvarModulosV2', {
            lojaId,
            versao: data.versao,
            ...draft,
            cozinha: data.cozinha,
            nome: novoNome || data.nome,
            whatsapp: novoWhats !== undefined ? novoWhats : (data.contato?.whatsapp ?? ''),
            logoUrl: novoLogo !== undefined ? novoLogo : (data.logoUrl ?? '')
          });
          if (!valid()) return;
          uncertain = true; await load(false); lojaDraft = null; draftGuard.clear('g-shop'); draw();
          say('Configurações da loja atualizadas com sucesso!', 'success');
        } catch (e) {
          if (!valid()) return;
          uncertain = true;
          result.textContent = e.code === 'functions/failed-precondition' ? 'Não foi possível salvar: ' + e.message : 'Não foi possível confirmar o salvamento.';
        } finally {
          busy = false;
          if (valid()) content.querySelectorAll('button,input,select').forEach(el => el.disabled = false);
        }
      };

      catalog.querySelector('#g-reload').onclick = async () => {
        if (busy) return;
        busy = true; content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
        say('Atualizando catálogo…');
        try {
          await load(false);
          lojaDraft = null; productDraft = null; deliveryDraft = null; mesaDraft = null; addonDraft = null; contatoDraft = null;
          draftGuard.clear(); draw(); say('Catálogo atualizado.', 'success');
        } catch {
          say('Não foi possível atualizar.');
        } finally {
          busy = false;
          if (valid()) content.querySelectorAll('button,input,select').forEach(el => el.disabled = false);
        }
      };

      // Categorias únicas existentes para filtros e datalist ordenadas de forma intuitiva
      const prioridadeCategorias = ['Lanches', 'Pizzas', 'Porções', 'Combos', 'Bebidas', 'Refrigerantes', 'Cervejas', 'Sobremesas', 'Salgados', 'Geral'];
      const distinctCats = [...new Set(products.map(p => p.categoria?.trim()).filter(Boolean))].sort((a, b) => {
        const ia = prioridadeCategorias.findIndex(cat => cat.toLowerCase() === a.toLowerCase());
        const ib = prioridadeCategorias.findIndex(cat => cat.toLowerCase() === b.toLowerCase());
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b, 'pt-BR');
      });

      // Renderiza as Category Pills
      function renderPills() {
        pillsContainer.innerHTML = '';
        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = `g-cat-pill ${categoriaFiltro === '' ? 'is-active' : ''}`;
        allBtn.textContent = `Todos (${products.length})`;
        allBtn.onclick = () => { categoriaFiltro = ''; renderPills(); filter(); };
        pillsContainer.append(allBtn);

        for (const cat of distinctCats) {
          const count = products.filter(p => p.categoria?.trim() === cat).length;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `g-cat-pill ${categoriaFiltro === cat ? 'is-active' : ''}`;
          btn.textContent = `${cat} (${count})`;
          btn.onclick = () => { categoriaFiltro = cat; renderPills(); filter(); };
          pillsContainer.append(btn);
        }
      }
      renderPills();

      // Renderiza os Cards de Produtos
      function filter() {
        const query = searchInput.value.trim().toLocaleLowerCase('pt-BR');
        grid.innerHTML = '';

        const filtered = products.filter(p => {
          const matchesQuery = `${p.nome} ${p.categoria || ''} ${p.descricao || ''}`.toLocaleLowerCase('pt-BR').includes(query);
          const matchesCat = !categoriaFiltro || p.categoria?.trim() === categoriaFiltro;
          return matchesQuery && matchesCat;
        });

        if (!filtered.length) {
          grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; background: #ffffff; border-radius: 14px; border: 1px dashed var(--line); color: #64748b;">
              <p style="font-size: 16px; font-weight: 700; margin: 0 0 6px; color: var(--navy);">Nenhum produto encontrado</p>
              <p style="font-size: 13px; margin: 0 0 16px;">${products.length ? 'Tente buscar com outros termos ou selecione outra categoria.' : 'Seu catálogo ainda está vazio. Cadastre seu primeiro produto!'}</p>
              <button type="button" class="btn-primary g-btn-new-product" id="g-btn-empty-add" style="margin: 0 auto;">
                <span>+</span><span>Cadastrar Produto</span>
              </button>
            </div>
          `;
          grid.querySelector('#g-btn-empty-add')?.addEventListener('click', () => {
            catalog.querySelector('#g-new-product').click();
          });
          return;
        }

        for (const p of filtered) {
          const card = document.createElement('article');
          card.className = `g-prod-card ${p.esgotado ? 'is-soldout' : ''}`;
          const isCombo = Boolean(p.combo?.ativo);
          const gruposCount = p.grupos?.length || 0;

          card.innerHTML = `
            <div class="g-prod-media">
              ${p.imagemUrl ? htmlFoto({ fotoUrl: p.imagemUrl, fotoEnquadramento: p.fotoEnquadramento }) : `<div class="g-prod-ph">${ico.burger}</div>`}
              ${isCombo ? `<span class="g-prod-badge-combo">COMBO</span>` : ''}
            </div>
            <div class="g-prod-info">
              <div class="g-prod-meta">
                <span class="g-prod-cat">${esc(p.categoria || 'Geral')}</span>
                <span class="g-prod-status ${p.esgotado ? 'is-soldout' : (p.ativo ? 'is-active' : 'is-hidden')}">
                  ${p.esgotado ? 'Esgotado' : (p.ativo ? 'Disponível' : 'Oculto')}
                </span>
              </div>
              <h3 class="g-prod-title">${esc(p.nome)}</h3>
              <p class="g-prod-desc">${esc(p.descricao || 'Sem descrição cadastrada.')}</p>
              <div class="g-prod-footer">
                <div class="g-prod-footer-main">
                  <div>
                    <span class="g-prod-price">${formatarBRL(p.precoCentavos)}</span>
                    ${isCombo ? `<span class="g-combo-price">+ Combo por ${formatarBRL(p.combo?.preco < 100 ? p.combo.preco * 100 : p.combo.preco)}</span>` : ''}
                  </div>
                  <button type="button" class="g-btn-card-options" data-act="options" title="Gerenciar ponto da carne, molhos e adicionais">
                    ⚙️ Opções ${gruposCount > 0 ? `<span class="g-opt-chip">${gruposCount}</span>` : ''}
                  </button>
                </div>
                <div class="g-prod-actions">
                  <button type="button" class="g-btn-card-act is-soldout-btn" data-act="toggle-soldout" title="${p.esgotado ? 'Disponibilizar produto' : 'Marcar como esgotado'}">
                    ${p.esgotado ? '🟢 Ativar' : '⏸ Esgotar'}
                  </button>
                  <button type="button" class="g-btn-card-act is-edit-btn" data-act="edit">
                    Editar
                  </button>
                  <button type="button" class="g-btn-card-act is-del-btn" data-act="delete" title="Excluir produto">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          `;

          card.querySelector('[data-act=edit]').onclick = () => edit(p);
          card.querySelector('[data-act=options]').onclick = () => editProductOptions(p);

          card.querySelector('[data-act=toggle-soldout]').onclick = async () => {
            if (busy || uncertain) return;
            busy = true;
            say('Alterando status do produto…');
            try {
              await s.call('salvarProdutoCardapioV2', {
                lojaId,
                versao: data.versao,
                produtoId: p.id,
                nome: p.nome,
                categoria: p.categoria || '',
                descricao: p.descricao || '',
                imagemUrl: p.imagemUrl || '',
                precoCentavos: p.precoCentavos,
                ativo: p.ativo,
                esgotado: !p.esgotado,
                ...(p.combo ? { combo: p.combo } : {}),
                ...(p.grupos ? { grupos: p.grupos } : {})
              });
              uncertain = true;
              await load(false);
              draw();
              say(`Produto ${!p.esgotado ? 'marcado como esgotado' : 'disponibilizado'}.`, 'success');
            } catch (err) {
              say('Erro ao alterar status: ' + err.message, 'error');
            } finally {
              busy = false;
            }
          };

          card.querySelector('[data-act=delete]').onclick = async () => {
            if (busy || uncertain) return;
            if (!window.confirm(`Deseja realmente excluir "${p.nome}" do cardápio?`)) return;
            busy = true;
            say('Excluindo produto…');
            try {
              await s.call('excluirProdutoCardapioV2', {
                lojaId,
                versao: data.versao,
                produtoId: p.id
              });
              uncertain = true;
              await load(false);
              draw();
              say('Produto excluído com sucesso.', 'success');
            } catch (err) {
              say('Erro ao excluir produto: ' + err.message, 'error');
            } finally {
              busy = false;
            }
          };

          grid.append(card);
        }
      }

      searchInput.oninput = filter;
      filter();

      // Modal Drawer para Cadastro / Edição de Produto Principal
      function edit(p, version = data.versao) {
        const productVersion = version;
        let precoCentavosAtual = p.precoCentavos || 0;
        let rawComboPreco = p.combo?.preco;
        if (rawComboPreco && rawComboPreco < 100) rawComboPreco = rawComboPreco * 100;
        let comboPrecoCentavosAtual = rawComboPreco || (precoCentavosAtual ? precoCentavosAtual + 1000 : 2500);

        document.documentElement.classList.add('g-modal-open');
        document.body.classList.add('g-modal-open');

        // Bebidas pré-selecionadas do combo
        let selectedBebidas = [];
        if (Array.isArray(p.combo?.bebidas)) {
          selectedBebidas = p.combo.bebidas.map(b => typeof b === 'string' ? { produtoId: idParaSlug(b), nome: b } : { produtoId: b.produtoId || idParaSlug(b.nome), nome: b.nome });
        } else if (p.combo?.bebidas && typeof p.combo.bebidas === 'string') {
          selectedBebidas = p.combo.bebidas.split(',').map(s => s.trim()).filter(Boolean).map(nome => ({ produtoId: idParaSlug(nome), nome }));
        }

        modalWrap.innerHTML = `
          <div class="g-modal-overlay" id="g-modal-overlay">
            <div class="g-modal-card" role="dialog" aria-modal="true" aria-labelledby="g-modal-title">
              <header class="g-modal-header">
                <div>
                  <h3 id="g-modal-title">${p.novo ? 'Cadastrar Novo Produto' : 'Editar Produto'}</h3>
                  <p>Preencha os dados e foto para exibir no cardápio online.</p>
                </div>
                <button type="button" class="g-modal-close" id="g-modal-close" aria-label="Fechar">✕</button>
              </header>

              <form class="g-form-modal" id="g-form-product">
                <div class="g-form-modal-body">
                  <!-- Dropzone de foto com enquadramento do painel -->
                  <div id="g-photo-container"></div>

                  <!-- Nome e Preço -->
                  <div class="g-field-row">
                    <div class="g-field-group" style="flex:2;">
                      <label for="g-prod-nome">Nome do Produto *</label>
                      <input id="g-prod-nome" name="nome" required maxlength="80" placeholder="Ex: X-Burger Especial" value="${esc(p.nome)}">
                    </div>
                    <div class="g-field-group" style="flex:1;">
                      <label for="g-prod-preco">Preço (R$) *</label>
                      <input id="g-prod-preco" name="preco" type="text" inputmode="numeric" placeholder="R$ 0,00" required>
                    </div>
                  </div>

                  <!-- Categoria -->
                  <div class="g-field-group">
                    <label for="g-prod-cat">Categoria do Produto</label>
                    <div style="display:flex; gap:8px;">
                      <select id="g-prod-cat-select" style="flex:1; height:42px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 12px; font-size:14px; background:#fff; font-weight:600; color:var(--navy);">
                        <option value="">-- Selecione uma categoria --</option>
                        ${distinctCats.map(c => `<option value="${esc(c)}" ${p.categoria === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                        <option value="__nova__">+ Nova categoria (digitar)...</option>
                      </select>
                      <input id="g-prod-cat" name="categoria" maxlength="60" placeholder="Digite a categoria" value="${esc(p.categoria || '')}" style="flex:1; height:42px; font-size:14px; display:${distinctCats.includes(p.categoria) && p.categoria ? 'none' : 'block'};">
                    </div>
                    <div class="g-cat-suggestions" style="margin-top:6px;">
                      <span class="g-suggestion-label">Atalhos rápidos:</span>
                      ${['🍔 Lanches', '🍕 Pizzas', '🍟 Porções', '🥤 Bebidas', '🍰 Sobremesas', '🏷️ Combos', '🍺 Cervejas', '🥟 Salgados'].map(s => {
                        const raw = s.replace(/^[^\w\s]+\s*/, '');
                        return `<button type="button" class="g-chip-cat" data-cat-sug="${esc(raw)}">${s}</button>`;
                      }).join('')}
                    </div>
                  </div>

                  <!-- Descrição -->
                  <div class="g-field-group">
                    <label for="g-prod-desc">Descrição e Ingredientes</label>
                    <textarea id="g-prod-desc" name="descricao" rows="2" maxlength="300" placeholder="Ex: Pão artesanal, hambúrguer 160g, queijo cheddar, bacon crocante e molho especial.">${esc(p.descricao || '')}</textarea>
                  </div>

                  <!-- Opção de Combo -->
                  <div class="g-combo-box">
                    <label class="g-check g-combo-check">
                      <input type="checkbox" id="g-combo-ativo" name="comboAtivo" ${p.combo?.ativo ? 'checked' : ''}>
                      <span><strong>Oferecer Combo</strong> (Lanche + Acompanhamento + Bebida)</span>
                    </label>
                    <div class="g-combo-content" id="g-combo-content" ${p.combo?.ativo ? '' : 'style="display:none;"'}>
                      <div class="g-field-row">
                        <div class="g-field-group" style="flex:1;">
                          <label for="g-combo-preco">Preço do Combo Completo (R$)</label>
                          <input id="g-combo-preco" name="comboPreco" type="text" inputmode="numeric" placeholder="R$ 0,00">
                        </div>
                        <div class="g-field-group" style="flex:2;">
                          <label for="g-combo-fixos">Acompanhamento incluso</label>
                          <input id="g-combo-fixos" name="comboFixos" placeholder="Ex: Batata frita individual 100g" value="${esc(p.combo?.fixos?.[0]?.nome || 'Batata frita individual')}">
                        </div>
                      </div>

                      <div class="g-field-group" style="margin-top:6px;">
                        <label style="margin:0 0 6px; font-weight:700; color:#1e40af; font-size:13.5px;">Opções de Bebidas inclusas no Combo</label>
                        
                        <!-- Barra de Ferramentas de Filtro e Busca -->
                        <div class="g-combo-filter-toolbar" style="display:flex; gap:8px; margin-bottom:10px;">
                          <select id="g-combo-cat-select" class="g-combo-cat-select" style="flex:1; height:38px; border-radius:8px; border:1px solid #cbd5e1; padding:0 10px; font-size:13px; font-weight:600; background:#fff;">
                            <!-- Preenchido via JS -->
                          </select>
                          <input type="text" id="g-combo-search-bebida" class="g-combo-search-input" placeholder="🔍 Buscar bebida..." style="flex:1.5; height:38px; font-size:13px;">
                        </div>

                        <!-- 1) Grid de Seleção de Bebidas (Fica em cima) -->
                        <div class="g-combo-beverages-picker" id="g-combo-beverages-picker"></div>

                        <!-- 2) Bebidas Selecionadas (Fica em baixo, como o usuário pediu!) -->
                        <div class="g-combo-selected-section" style="margin-top:10px; padding:10px 12px; background:#eff6ff; border-radius:10px; border:1px solid #bfdbfe;">
                          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <strong style="font-size:12.5px; color:#1e40af;">🥤 Bebidas Selecionadas no Combo:</strong>
                            <span id="g-combo-count" style="font-size:12px; font-weight:700; color:#2563eb;">0 selecionadas</span>
                          </div>
                          <div class="g-combo-selected-chips" id="g-combo-selected-chips"></div>
                        </div>

                        <!-- 3) Adicionar Bebida Avulsa -->
                        <div class="g-combo-add-custom-row" style="margin-top:8px;">
                          <input type="text" id="g-combo-custom-input" placeholder="Ou digite outra bebida (ex: Suco de Maracujá 400ml)...">
                          <button type="button" class="btn-ghost" id="g-combo-btn-add-custom">+ Adicionar</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Switches de status -->
                  <div class="g-status-switches">
                    <label class="g-check">
                      <input type="checkbox" name="ativo" ${p.ativo !== false ? 'checked' : ''}>
                      <span>Mostrar no cardápio online</span>
                    </label>
                    <label class="g-check">
                      <input type="checkbox" name="esgotado" ${p.esgotado ? 'checked' : ''}>
                      <span style="color:#c2410c; font-weight:600;">Esgotado temporariamente</span>
                    </label>
                  </div>

                  <p class="g-result" role="status" style="margin:4px 0 0;"></p>
                </div>

                <!-- Rodapé Fixo (sempre visível sem descer barra) -->
                <footer class="g-modal-footer">
                  <button type="button" class="btn-ghost" id="g-modal-cancel">Cancelar</button>
                  <button type="submit" class="btn-primary g-btn-save-prod">Salvar Produto</button>
                </footer>
              </form>
            </div>
          </div>
        `;

        const overlay = modalWrap.querySelector('#g-modal-overlay');
        const form = modalWrap.querySelector('#g-form-product');
        const closeBtn = modalWrap.querySelector('#g-modal-close');
        const cancelBtn = modalWrap.querySelector('#g-modal-cancel');
        const result = form.querySelector('.g-result');
        const photoContainer = form.querySelector('#g-photo-container');
        const inputPreco = form.querySelector('#g-prod-preco');
        const inputComboPreco = form.querySelector('#g-combo-preco');
        const comboAtivoCheck = form.querySelector('#g-combo-ativo');
        const comboContent = form.querySelector('#g-combo-content');
        const inputCat = form.querySelector('#g-prod-cat');

        function fechar() {
          modalWrap.innerHTML = '';
          productDraft = null;
          document.documentElement.classList.remove('g-modal-open');
          document.body.classList.remove('g-modal-open');
        }

        closeBtn.onclick = fechar;
        cancelBtn.onclick = fechar;
        overlay.onclick = e => { if (e.target === overlay) fechar(); };

        mascaraMoeda(inputPreco, val => { precoCentavosAtual = val; });
        inputPreco.value = formatarBRL(precoCentavosAtual);

        mascaraMoeda(inputComboPreco, val => { comboPrecoCentavosAtual = val; });
        inputComboPreco.value = formatarBRL(comboPrecoCentavosAtual);

        comboAtivoCheck.onchange = () => {
          comboContent.style.display = comboAtivoCheck.checked ? '' : 'none';
        };

        const catSelect = form.querySelector('#g-prod-cat-select');
        if (catSelect && inputCat) {
          catSelect.onchange = () => {
            if (catSelect.value === '__nova__') {
              inputCat.style.display = 'block';
              inputCat.value = '';
              inputCat.focus();
            } else if (catSelect.value) {
              inputCat.value = catSelect.value;
              inputCat.style.display = 'none';
            } else {
              inputCat.style.display = 'block';
            }
          };
          form.querySelectorAll('[data-cat-sug]').forEach(btn => {
            btn.onclick = () => {
              const val = btn.dataset.catSug;
              inputCat.value = val;
              let opt = Array.from(catSelect.options).find(o => o.value === val);
              if (!opt) {
                opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val;
                catSelect.add(opt, catSelect.options.length - 1);
              }
              catSelect.value = val;
              inputCat.style.display = 'none';
            };
          });
        }

        // Configuração do Seletor de Bebidas do Combo
        const chipsWrap = form.querySelector('#g-combo-selected-chips');
        const countEl = form.querySelector('#g-combo-count');
        const catSelectBebida = form.querySelector('#g-combo-cat-select');
        const searchInputBebida = form.querySelector('#g-combo-search-bebida');
        const pickerWrap = form.querySelector('#g-combo-beverages-picker');
        const customInput = form.querySelector('#g-combo-custom-input');
        const addCustomBtn = form.querySelector('#g-combo-btn-add-custom');

        const allCats = [...new Set(products.map(x => x.categoria?.trim()).filter(Boolean))];
        let activeBevCat = allCats.find(c => /bebida|refrig|suco|cervej/i.test(c)) || 'Todas';

        function renderCatSelect() {
          const catList = ['Todas as Categorias', ...allCats];
          catSelectBebida.innerHTML = catList.map(c => `
            <option value="${esc(c)}" ${(activeBevCat === c || (c === 'Todas as Categorias' && activeBevCat === 'Todas')) ? 'selected' : ''}>
              ${c === 'Todas as Categorias' ? '🥤 Todas as Categorias de Bebidas' : esc(c)}
            </option>
          `).join('');

          catSelectBebida.onchange = () => {
            activeBevCat = catSelectBebida.value === 'Todas as Categorias' ? 'Todas' : catSelectBebida.value;
            renderPicker();
          };
        }

        function renderChips() {
          countEl.textContent = `${selectedBebidas.length} selecionada${selectedBebidas.length === 1 ? '' : 's'}`;
          chipsWrap.innerHTML = selectedBebidas.map((b, idx) => `
            <span class="g-combo-chip-item">
              <span>${esc(b.nome)}</span>
              <button type="button" class="g-combo-chip-del" data-del-idx="${idx}" title="Remover bebida">✕</button>
            </span>
          `).join('');

          chipsWrap.querySelectorAll('[data-del-idx]').forEach(btn => {
            btn.onclick = e => {
              e.stopPropagation();
              const idx = Number(btn.dataset.delIdx);
              selectedBebidas.splice(idx, 1);
              renderChips();
              renderPicker();
            };
          });
        }

        function renderPicker() {
          const q = searchInputBebida.value.trim().toLowerCase();
          const available = products.filter(prod => {
            const matchesCat = activeBevCat === 'Todas' || (prod.categoria?.trim() || '') === activeBevCat;
            const matchesQuery = !q || prod.nome.toLowerCase().includes(q) || (prod.categoria || '').toLowerCase().includes(q);
            return matchesCat && matchesQuery;
          });

          if (!available.length) {
            pickerWrap.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:16px; font-size:12px; color:#94a3b8;">Nenhum item encontrado nesta categoria. Use o campo abaixo para adicionar bebida avulsa.</div>`;
            return;
          }

          pickerWrap.innerHTML = available.map(prod => {
            const isSel = selectedBebidas.some(b => b.produtoId === prod.id || b.nome.toLowerCase() === prod.nome.toLowerCase());
            return `
              <div class="g-combo-bev-option ${isSel ? 'is-selected' : ''}" data-id="${esc(prod.id)}" data-nome="${esc(prod.nome)}">
                <span class="g-combo-bev-check">${isSel ? '✓' : ''}</span>
                <span class="g-combo-bev-name" title="${esc(prod.nome)}">${esc(prod.nome)}</span>
              </div>
            `;
          }).join('');

          pickerWrap.querySelectorAll('.g-combo-bev-option').forEach(opt => {
            opt.onclick = () => {
              const pid = opt.dataset.id;
              const nome = opt.dataset.nome;
              const foundIdx = selectedBebidas.findIndex(b => b.produtoId === pid || b.nome.toLowerCase() === nome.toLowerCase());
              if (foundIdx >= 0) {
                selectedBebidas.splice(foundIdx, 1);
              } else {
                selectedBebidas.push({ produtoId: pid, nome });
              }
              renderChips();
              renderPicker();
            };
          });
        }

        renderCatSelect();
        renderChips();
        renderPicker();

        searchInputBebida.oninput = () => renderPicker();

        function addCustomBebida() {
          const val = customInput.value.trim();
          if (!val) return;
          if (!selectedBebidas.some(b => b.nome.toLowerCase() === val.toLowerCase())) {
            selectedBebidas.push({ produtoId: idParaSlug(val), nome: val });
          }
          customInput.value = '';
          renderChips();
          renderPicker();
        }

        addCustomBtn.onclick = addCustomBebida;
        customInput.onkeydown = e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addCustomBebida();
          }
        };

        renderFotoGestao(photoContainer, p.imagemUrl, async file => {
          if (busy || uncertain) throw Error('Aguarde o salvamento antes de enviar outra foto.');
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
          } finally {
            busy = false;
            if (valid()) content.querySelectorAll('button,input,select').forEach(el => el.disabled = false);
          }
        }, p.fotoEnquadramento, p.nome);

        form.onsubmit = async e => {
          e.preventDefault();
          if (uncertain || busy) return;
          const fields = form.elements;
          const nomeVal = fields.nome.value.trim();
          const fotoVal = form.querySelector('[name=imagemUrl]')?.value?.trim() || '';

          if (!nomeVal) {
            result.textContent = 'Informe o nome do produto.';
            return;
          }
          try { validarFotoV2(fotoVal); } catch (err) {
            result.textContent = err.message;
            return;
          }

          let comboPayload = undefined;
          if (comboAtivoCheck.checked) {
            const fixosNome = fields.comboFixos.value.trim() || 'Acompanhamento';
            const comboCentavos = Math.round(Number(comboPrecoCentavosAtual) || 0);
            comboPayload = {
              ativo: true,
              preco: comboCentavos,
              precoCentavos: comboCentavos,
              fixos: [{ quantidade: 1, nome: fixosNome }],
              bebidas: selectedBebidas.length > 0 ? selectedBebidas : [{ produtoId: 'bebida-padrao', nome: 'Refrigerante 350ml' }]
            };
          } else {
            comboPayload = { ativo: false };
          }

          const fotoEnquadramentoRaw = form.querySelector('[name=fotoEnquadramento]')?.value;
          let fotoEnquadramento = undefined;
          if (fotoEnquadramentoRaw) {
            try { fotoEnquadramento = JSON.parse(fotoEnquadramentoRaw); } catch {}
          }

          const payload = {
            lojaId,
            versao: productVersion,
            produtoId: p.id,
            imagemUrl: fotoVal,
            fotoEnquadramento,
            nome: nomeVal,
            categoria: fields.categoria.value.trim(),
            descricao: fields.descricao.value.replace(/[\r\n]+/g, ' ').trim(),
            precoCentavos: Math.round(Number(precoCentavosAtual) || 0),
            ativo: fields.ativo.checked,
            esgotado: fields.esgotado.checked,
            combo: comboPayload,
            ...(p.grupos ? { grupos: p.grupos } : {})
          };

          busy = true;
          content.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
          result.textContent = 'Salvando produto…';

          try {
            await s.call('salvarProdutoCardapioV2', payload);
            if (!valid()) return;
            uncertain = true;
            await load(false);
            productDraft = null;
            draftGuard.clear('g-form-product');
            fechar();
            draw();
            say('Produto salvo com sucesso no cardápio!', 'success');
          } catch (err) {
            if (!valid()) return;
            uncertain = true;
            result.textContent = err.code === 'functions/failed-precondition'
              ? 'Os dados mudaram em outra sessão. Recarregue o catálogo.'
              : (err.message || 'Não foi possível confirmar o salvamento.');
          } finally {
            busy = false;
            if (valid()) content.querySelectorAll('button,input,select').forEach(el => el.disabled = false);
          }
        };
      }

      // Modal Drawer para Opções & Adicionais Específicos do Produto
      function editProductOptions(p) {
        let grupos = structuredClone(p.grupos || []);

        document.documentElement.classList.add('g-modal-open');
        document.body.classList.add('g-modal-open');

        modalWrap.innerHTML = `
          <div class="g-modal-overlay" id="g-modal-options-overlay">
            <div class="g-modal-card g-options-modal-card" role="dialog" aria-modal="true" aria-labelledby="g-opt-title">
              <header class="g-modal-header">
                <div>
                  <h3 id="g-opt-title">⚙️ Opções & Adicionais · ${esc(p.nome)}</h3>
                  <p>Configure complementos, ponto da carne, molhos e adicionais deste item.</p>
                </div>
                <button type="button" class="g-modal-close" id="g-opt-close" aria-label="Fechar">✕</button>
              </header>

              <div class="g-form-modal">
                <div class="g-form-modal-body" style="gap:16px;">
                  <div class="g-template-chips-wrap">
                    <span style="font-size:12px; font-weight:700; color:var(--navy); width:100%; display:block; margin-bottom:4px;">
                      💡 Modelos rápidos para adicionar com 1 clique:
                    </span>
                    <button type="button" class="g-template-chip" data-template="ponto">
                      🥩 + Ponto da Carne (Obrigatório)
                    </button>
                    <button type="button" class="g-template-chip" data-template="molhos">
                      🥫 + Molhos da Casa (Até 2)
                    </button>
                    <button type="button" class="g-template-chip" data-template="adicionais">
                      🥓 + Adicionais Extras (Bacon, Queijo, etc.)
                    </button>
                    <button type="button" class="g-template-chip" data-template="queijo">
                      🧀 + Escolha do Queijo (Cheddar, Prato, etc.)
                    </button>
                  </div>

                  <div class="g-groups-list" id="g-groups-list"></div>

                  <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:12px; padding:16px;">
                    <strong style="display:block; font-size:13.5px; color:var(--navy); margin-bottom:10px;">
                      + Criar Novo Grupo de Opções Personalizado
                    </strong>
                    <div class="g-field-row" style="align-items:flex-end;">
                      <div class="g-field-group" style="flex:2;">
                        <label for="g-new-grp-nome">Nome do Grupo</label>
                        <input id="g-new-grp-nome" placeholder="Ex: Molhos Especiais, Ponto da Carne, Queijo...">
                      </div>
                      <div class="g-field-group" style="flex:1.6;">
                        <label for="g-new-grp-tipo">Regra de Escolha</label>
                        <select id="g-new-grp-tipo" style="height:42px; border-radius:10px; border:1.5px solid #cbd5e1; padding:0 10px; font-weight:600; font-size:13px; background:#fff;">
                          <option value="opcional_1">🟢 Opcional (até 1)</option>
                          <option value="opcional_multi">🟢 Opcional (múltiplas)</option>
                          <option value="obrig_1" selected>🔴 Obrigatório (escolha 1)</option>
                          <option value="obrig_multi">🔴 Obrigatório (1 ou mais)</option>
                        </select>
                      </div>
                      <div class="g-field-group" id="g-wrap-grp-max" style="flex:1;">
                        <label for="g-new-grp-max">Máximo</label>
                        <input id="g-new-grp-max" type="number" min="1" max="20" value="1" style="height:42px;">
                      </div>
                    </div>
                    <button type="button" class="btn-outline" id="g-btn-add-group" style="margin-top:10px; width:100%; height:40px; font-weight:700;">
                      + Adicionar Grupo
                    </button>
                  </div>
                </div>

                <footer class="g-modal-footer">
                  <p class="g-result" id="g-opt-result" role="status" style="margin:0; font-size:12px;"></p>
                  <button type="button" class="btn-ghost" id="g-opt-cancel">Cancelar</button>
                  <button type="button" class="g-btn-save-prod" id="g-opt-save">Salvar Opções</button>
                </footer>
              </div>
            </div>
          </div>
        `;

        const overlay = modalWrap.querySelector('#g-modal-options-overlay');
        const closeBtn = modalWrap.querySelector('#g-opt-close');
        const cancelBtn = modalWrap.querySelector('#g-opt-cancel');
        const saveBtn = modalWrap.querySelector('#g-opt-save');
        const resultEl = modalWrap.querySelector('#g-opt-result');
        const groupsListEl = modalWrap.querySelector('#g-groups-list');
        const addGroupBtn = modalWrap.querySelector('#g-btn-add-group');

        function fechar() {
          modalWrap.innerHTML = '';
          document.documentElement.classList.remove('g-modal-open');
          document.body.classList.remove('g-modal-open');
        }

        closeBtn.onclick = fechar;
        cancelBtn.onclick = fechar;
        overlay.onclick = e => { if (e.target === overlay) fechar(); };

        function renderGroups() {
          groupsListEl.innerHTML = '';
          if (!grupos.length) {
            groupsListEl.innerHTML = `
              <div style="text-align:center; padding:24px; background:#f8fafc; border-radius:10px; border:1px dashed #cbd5e1; color:#64748b;">
                Nenhum grupo de opções criado para este produto ainda. Escolha um modelo acima ou crie um grupo!
              </div>
            `;
            return;
          }

          grupos.forEach((g, gIdx) => {
            const card = document.createElement('div');
            card.className = 'g-group-card';
            const isObrig = g.min >= 1;

            card.innerHTML = `
              <div class="g-group-header" style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                <div class="g-group-title-row" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1;">
                  <strong class="g-group-title-txt" style="font-size:15px; color:var(--navy);">${esc(g.nome)}</strong>
                  <select class="g-group-rule-select" data-edit-grp-rule="${gIdx}" style="font-size:12px; font-weight:700; border-radius:6px; border:1px solid #cbd5e1; padding:3px 8px; cursor:pointer; background:${isObrig ? '#fee2e2; color:#b91c1c;' : '#dcfce7; color:#15803d;'}">
                    <option value="obrig_1" ${isObrig && g.max === 1 ? 'selected' : ''}>🔴 Obrigatório (escolha 1)</option>
                    <option value="obrig_multi" ${isObrig && g.max > 1 ? 'selected' : ''}>🔴 Obrigatório (escolha ${g.max})</option>
                    <option value="opcional_1" ${!isObrig && g.max === 1 ? 'selected' : ''}>🟢 Opcional (até 1)</option>
                    <option value="opcional_multi" ${!isObrig && g.max > 1 ? 'selected' : ''}>🟢 Opcional (até ${g.max})</option>
                  </select>
                  <label style="font-size:12px; color:#64748b; margin:0; display:inline-flex; align-items:center; gap:4px;">
                    Máx:
                    <input type="number" min="1" max="20" value="${g.max || 1}" data-edit-grp-max="${gIdx}" style="width:48px; height:28px; padding:2px 4px; font-size:12px; text-align:center; border:1px solid #cbd5e1; border-radius:6px;">
                  </label>
                </div>
                <button type="button" class="btn-ghost" data-del-grp="${gIdx}" style="padding:4px 8px; font-size:12px; color:#ef4444;" title="Excluir grupo">
                  🗑️ Excluir
                </button>
              </div>

              <div class="g-group-options-list">
                ${(g.opcoes || []).map((o, oIdx) => `
                  <div class="g-option-row">
                    <span class="g-option-name">${esc(o.nome)}</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <span class="g-option-price ${o.precoCentavos ? '' : 'is-free'}">
                        ${o.precoCentavos ? `+ ${formatarBRL(o.precoCentavos)}` : 'Grátis'}
                      </span>
                      <button type="button" data-del-opt="${gIdx}:${oIdx}" style="border:0; background:none; color:#94a3b8; cursor:pointer; font-size:14px;" title="Remover opção">✕</button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Mini-form para adicionar opção neste grupo -->
              <div style="display:flex; gap:8px; margin-top:8px;">
                <input placeholder="Nome da opção (ex: Maionese extra)" data-new-opt-name="${gIdx}" style="flex:2; height:36px; font-size:13px;">
                <input placeholder="R$ 0,00" data-new-opt-price="${gIdx}" inputmode="numeric" style="flex:1; height:36px; font-size:13px;">
                <button type="button" class="btn-primary" data-add-opt="${gIdx}" style="padding:0 14px; height:36px; font-size:12.5px;">+ Adicionar</button>
              </div>
            `;

            // Máscara no campo de preço da opção inline
            const optPriceInput = card.querySelector(`[data-new-opt-price="${gIdx}"]`);
            if (optPriceInput) mascaraMoeda(optPriceInput);

            // Handler de regra de escolha
            const ruleSelect = card.querySelector(`[data-edit-grp-rule="${gIdx}"]`);
            if (ruleSelect) {
              ruleSelect.onchange = () => {
                const val = ruleSelect.value;
                if (val === 'obrig_1') { g.min = 1; g.max = 1; }
                else if (val === 'obrig_multi') { g.min = 1; g.max = Math.max(2, g.max); }
                else if (val === 'opcional_1') { g.min = 0; g.max = 1; }
                else if (val === 'opcional_multi') { g.min = 0; g.max = Math.max(2, g.max); }
                renderGroups();
              };
            }
            const maxInp = card.querySelector(`[data-edit-grp-max="${gIdx}"]`);
            if (maxInp) {
              maxInp.onchange = () => {
                g.max = Math.max(1, parseInt(maxInp.value, 10) || 1);
                if (g.min > g.max) g.min = g.max;
                renderGroups();
              };
            }

            // Handler para adicionar opção
            card.querySelector(`[data-add-opt="${gIdx}"]`).onclick = () => {
              const nameInp = card.querySelector(`[data-new-opt-name="${gIdx}"]`);
              const optNome = nameInp.value.trim();
              const centavos = parseInt(optPriceInput.dataset.centavos || '0', 10) || 0;
              if (!optNome) return;
              g.opcoes = g.opcoes || [];
              g.opcoes.push({
                id: 'opt_' + idParaSlug(optNome) + '_' + Math.random().toString(36).slice(2, 6),
                nome: optNome,
                precoCentavos: centavos,
                ativo: true,
                maxQuantidade: 1
              });
              renderGroups();
            };

            // Handler para excluir grupo
            card.querySelector(`[data-del-grp="${gIdx}"]`).onclick = () => {
              if (window.confirm(`Excluir o grupo "${g.nome}"?`)) {
                grupos.splice(gIdx, 1);
                renderGroups();
              }
            };

            // Handlers para excluir opções
            card.querySelectorAll('[data-del-opt]').forEach(btn => {
              btn.onclick = () => {
                const [gi, oi] = btn.dataset.delOpt.split(':').map(Number);
                grupos[gi].opcoes.splice(oi, 1);
                renderGroups();
              };
            });

            groupsListEl.append(card);
          });
        }

        renderGroups();

        // Template chips
        modalWrap.querySelectorAll('[data-template]').forEach(btn => {
          btn.onclick = () => {
            const t = btn.dataset.template;
            if (t === 'ponto') {
              grupos.push({
                id: 'grp_ponto_' + Math.random().toString(36).slice(2, 6),
                nome: 'Ponto da Carne',
                min: 1,
                max: 1,
                opcoes: [
                  { id: 'opt_ao_ponto', nome: 'Ao ponto (rosado e suculento no centro)', precoCentavos: 0, ativo: true, maxQuantidade: 1 },
                  { id: 'opt_bem_passado', nome: 'Bem passado', precoCentavos: 0, ativo: true, maxQuantidade: 1 },
                  { id: 'opt_mal_passado', nome: 'Mal passado (centro bem vermelho)', precoCentavos: 0, ativo: true, maxQuantidade: 1 }
                ]
              });
            } else if (t === 'molhos') {
              grupos.push({
                id: 'grp_molhos_' + Math.random().toString(36).slice(2, 6),
                nome: 'Molhos da Casa',
                min: 0,
                max: 2,
                opcoes: [
                  { id: 'opt_maio_verde', nome: 'Maionese Verde Especial', precoCentavos: 0, ativo: true, maxQuantidade: 1 },
                  { id: 'opt_barbecue', nome: 'Barbecue Defumado', precoCentavos: 0, ativo: true, maxQuantidade: 1 },
                  { id: 'opt_molho_casa', nome: 'Molho da Casa Secreto', precoCentavos: 0, ativo: true, maxQuantidade: 1 }
                ]
              });
            } else if (t === 'adicionais') {
              grupos.push({
                id: 'grp_adicionais_' + Math.random().toString(36).slice(2, 6),
                nome: 'Adicionais Extras',
                min: 0,
                max: 5,
                opcoes: [
                  { id: 'opt_bacon', nome: 'Bacon em Fatias Crocante', precoCentavos: 400, ativo: true, maxQuantidade: 2 },
                  { id: 'opt_cheddar', nome: 'Cheddar Cremoso Extra', precoCentavos: 350, ativo: true, maxQuantidade: 2 },
                  { id: 'opt_burger', nome: 'Hambúrguer 160g Extra', precoCentavos: 800, ativo: true, maxQuantidade: 2 },
                  { id: 'opt_cebola', nome: 'Cebola Caramelizada', precoCentavos: 300, ativo: true, maxQuantidade: 1 }
                ]
              });
            } else if (t === 'queijo') {
              grupos.push({
                id: 'grp_queijo_' + Math.random().toString(36).slice(2, 6),
                nome: 'Escolha do Queijo',
                min: 1,
                max: 1,
                opcoes: [
                  { id: 'opt_q_cheddar', nome: 'Queijo Cheddar Inglês', precoCentavos: 0, ativo: true, maxQuantidade: 1 },
                  { id: 'opt_q_prato', nome: 'Queijo Prato Especial', precoCentavos: 0, ativo: true, maxQuantidade: 1 },
                  { id: 'opt_q_mussarela', nome: 'Queijo Muçarela Derretido', precoCentavos: 0, ativo: true, maxQuantidade: 1 }
                ]
              });
            }
            renderGroups();
          };
        });

        // Adicionar grupo personalizado
        addGroupBtn.onclick = () => {
          const nomeInp = modalWrap.querySelector('#g-new-grp-nome');
          const tipoSel = modalWrap.querySelector('#g-new-grp-tipo');
          const maxInp = modalWrap.querySelector('#g-new-grp-max');
          const gNome = nomeInp.value.trim();
          if (!gNome) return;
          const maxVal = Math.max(1, parseInt(maxInp.value, 10) || 1);
          let minVal = 0;
          let finalMax = maxVal;
          if (tipoSel.value === 'obrig_1') { minVal = 1; finalMax = 1; }
          else if (tipoSel.value === 'obrig_multi') { minVal = 1; finalMax = Math.max(2, maxVal); }
          else if (tipoSel.value === 'opcional_1') { minVal = 0; finalMax = 1; }
          else if (tipoSel.value === 'opcional_multi') { minVal = 0; finalMax = Math.max(2, maxVal); }

          grupos.push({
            id: 'grp_' + idParaSlug(gNome) + '_' + Math.random().toString(36).slice(2, 6),
            nome: gNome,
            min: minVal,
            max: finalMax,
            opcoes: []
          });
          nomeInp.value = '';
          renderGroups();
        };

        // Salvar Opções do Produto
        saveBtn.onclick = async () => {
          if (busy || uncertain) return;
          busy = true;
          saveBtn.disabled = true;
          resultEl.textContent = 'Salvando opções e adicionais deste produto…';
          try {
            const sanitizedGrupos = grupos.map(g => ({
              id: String(g.id || 'grp_' + idParaSlug(g.nome) + '_' + Math.random().toString(36).slice(2, 6)).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80),
              nome: String(g.nome || 'Opções').trim().slice(0, 80),
              min: Math.max(0, Math.min(20, Math.round(Number(g.min) || 0))),
              max: Math.max(1, Math.min(20, Math.round(Number(g.max) || 1))),
              opcoes: (g.opcoes || []).map(o => ({
                id: String(o.id || 'opt_' + idParaSlug(o.nome) + '_' + Math.random().toString(36).slice(2, 6)).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80),
                nome: String(o.nome || 'Opção').trim().slice(0, 80),
                precoCentavos: Math.max(0, Math.min(1000000, Math.round(Number(o.precoCentavos) || 0))),
                ativo: o.ativo !== false,
                maxQuantidade: Math.max(1, Math.min(10, Math.round(Number(o.maxQuantidade) || 1)))
              }))
            }));

            let comboClean = undefined;
            if (p.combo && p.combo.ativo) {
              const rawPreco = p.combo.precoCentavos !== undefined ? Number(p.combo.precoCentavos) : (Number(p.combo.preco || 0) * (Number(p.combo.preco) < 100 ? 100 : 1));
              comboClean = {
                ativo: true,
                precoCentavos: Math.round(rawPreco),
                preco: Math.round(rawPreco),
                fixos: Array.isArray(p.combo.fixos) ? p.combo.fixos : [],
                bebidas: Array.isArray(p.combo.bebidas) ? p.combo.bebidas : []
              };
            }

            await s.call('salvarProdutoCardapioV2', {
              lojaId,
              versao: data.versao,
              produtoId: p.id,
              nome: p.nome,
              categoria: p.categoria || '',
              descricao: (p.descricao || '').replace(/[\r\n]+/g, ' ').trim(),
              imagemUrl: p.imagemUrl || '',
              precoCentavos: Math.round(Number(p.precoCentavos) || 0),
              ativo: p.ativo !== false,
              esgotado: p.esgotado === true,
              ...(comboClean ? { combo: comboClean } : {}),
              grupos: sanitizedGrupos
            });
            uncertain = true;
            await load(false);
            draw();
            say('Opções e adicionais do produto salvos com sucesso!', 'success');
            fechar();
          } catch (err) {
            resultEl.textContent = 'Erro ao salvar opções: ' + (err.message || 'Tente novamente.');
            saveBtn.disabled = false;
          } finally {
            busy = false;
          }
        };
      }
    }
  });

  return () => { disposed = true; epoch++; draftGuard?.dispose(); unsubscribe(); };
}

function idParaSlug(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'item';
}
