import { catalogoV2, enviarV2, acompanharV2, cotarV2 } from '../lib/v2.js';
import { esc, brl } from '../lib/format.js';
import { formatarTelefone, mascaraTelefone } from '../lib/moeda.js';
import './cardapio-v2.css';
import { iniciarAcompanhamento } from '../lib/acompanhamento-v2.js';
import { precoOferta, comporCombo, centavos } from '../../shared/ofertas.js';
import { ico } from '../lib/icons.js';

function parseRotaCardapioV2(pathname, atendimento) {
  if (atendimento?.slug) {
    return {
      slug: atendimento.slug,
      mesaId: atendimento.mesaId || null,
      delivery: !!atendimento.delivery,
      base: atendimento.prefixo === '/v2' ? '/v2' : ''
    };
  }
  const v2 = pathname.match(/^\/v2\/([a-z0-9-]+)(?:\/mesa\/([A-Za-z0-9_-]+)|\/(delivery))?\/?$/);
  if (v2) return { slug: v2[1], mesaId: v2[2] || null, delivery: !!v2[3], base: '/v2' };
  const apex = pathname.match(/^\/([a-z0-9-]+)(?:\/mesa\/([A-Za-z0-9_-]+)|\/(delivery))?\/?$/);
  if (apex && !['painel', 'gestao', 'gestao-v2', 'admin', 'cadastro', 'v2', 'api', 'assets', 'logos'].includes(apex[1])) {
    return { slug: apex[1], mesaId: apex[2] || null, delivery: !!apex[3], base: '' };
  }
  return null;
}

function iniciais(nome) {
  const p = String(nome || "L").trim().split(/\s+/).slice(0, 2);
  return p.map((x) => x[0] || "").join("").toUpperCase() || "L";
}

export async function renderCardapioV2(app, atendimento = null) {
  document.body.className = "is-cardapio-v2";
  const rota = parseRotaCardapioV2(location.pathname, atendimento);
  if (!rota) { 
    app.textContent = 'Endereço do cardápio inválido.'; 
    return; 
  }
  const { slug, mesaId, delivery, base } = rota;
  
  let disposed = false;
  let stopTracking = () => {};
  let busy = false;
  let catalog;
  let cart;
  let confirmed;
  let deliveryData = {};
  let pickupData = {};
  let quote = null;
  let categoriaAtiva = '';
  let termoBusca = '';
  let buscaAberta = false;
  let infoModalAberta = false;
  let infoModalEntrando = false;
  let toastTimer = null;
  
  // Modalidade de atendimento na sacola: 'delivery' ou 'retirada'
  let modalidadeSacola = delivery ? 'delivery' : 'retirada';
  
  // Estados interativos Impeccable
  let produtoModal = null;
  let produtoModalEntrando = false;
  let modalEstado = {
    variante: 'individual',
    bebidaId: '',
    opcoes: [],
    quantidade: 1,
    observacao: ''
  };
  let carrinhoAberto = false;
  let carrinhoEntrando = false;
  let confirmandoLimparCarrinho = false;

  const scopeParaTipo = tipo => `${slug}:${mesaId || tipo}`;
  const key = (type, tipo = modalidadeSacola) => `v2:${type}:${scopeParaTipo(tipo)}`;

  const read = (type, tipo = modalidadeSacola) => JSON.parse(localStorage.getItem(key(type, tipo)) || 'null');
  const money = value => brl(value / 100);
  const ofertaProduto = p => ({ ...p, preco: p.precoCentavos / 100 });
  const precoProduto = (p, variante = 'individual') => precoOferta(ofertaProduto(p), variante);

  function showToast(mensagem, tipo = 'success') {
    const wrap = app.querySelector('#v2-toast-wrap');
    if (!wrap) return;
    const icon = tipo === 'success' ? ico.checkCircle : (tipo === 'error' ? ico.close : ico.info);
    wrap.classList.remove('is-visible');
    void wrap.offsetWidth;
    wrap.innerHTML = `
      <div class="v2-toast v2-toast--${tipo}">
        <span class="v2-toast-icon">${icon}</span>
        <span class="v2-toast-msg">${esc(mensagem)}</span>
      </div>
    `;
    wrap.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      wrap.classList.remove('is-visible');
    }, 2800);
  }

  const exibirPreco = p => {
    const temVariacao = p.combo?.ativo || (p.grupos && p.grupos.length > 0);
    const o = precoProduto(p);
    return `
      ${temVariacao ? '<span class="v2-price-from">A partir de</span>' : ''}
      <div style="display:flex; align-items:center; gap:6px;">
        ${o.promocao ? `<span class="v2-offer-original">${brl(o.normal)}</span> ` : ''}
        <strong>${brl(o.preco)}</strong>
      </div>
    `;
  };

  const product = id => catalog?.produtos?.find(p => p.id === id);

  function unit(line) {
    const p = product(line.produtoId);
    if (!p || !p.ativo || p.esgotado) return null;
    let total;
    try {
      if (line.variante === 'combo') comporCombo(ofertaProduto(p), line.bebidaId);
      total = centavos(precoProduto(p, line.variante || 'individual').preco);
    } catch {
      return null;
    }
    for (const o of (line.opcoes || [])) {
      const option = p.grupos?.find(g => g.id === o.grupoId)?.opcoes?.find(x => x.id === o.opcaoId && x.ativo);
      if (!option) return null;
      total += option.precoCentavos * o.quantidade;
    }
    return total;
  }

  const prioridadeCategoria = nome => {
    const n = String(nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (/lanche|burger|hamburg|sanduiche|pizza|hot\s*dog|pastel|prato|massa|combo|refeicao/.test(n)) return 10;
    if (/porcao|porco|acompanhamento|entrada|petisco|salgado|frita|batata/.test(n)) return 20;
    if (/sobremesa|doce|acai|sorvete|torta|bolo/.test(n)) return 30;
    if (/bebida|refrigerante|cerveja|chopp|agua|vinho|destilado|drink/.test(n)) return 40;
    if (/suco|shake|vitamina/.test(n)) return 50;
    return 80;
  };

  const produtosOrdenados = () => {
    return (catalog?.produtos || [])
      .filter(p => p.ativo)
      .sort((a, b) => {
        const catA = prioridadeCategoria(a.categoria);
        const catB = prioridadeCategoria(b.categoria);
        if (catA !== catB) return catA - catB;
        if ((a.ordem || 0) !== (b.ordem || 0)) return (a.ordem || 0) - (b.ordem || 0);
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });
  };

  const urlFoto = p => {
    const u = p?.imagemUrl || p?.fotoUrl;
    if (typeof u === 'string' && u.length > 5) return u;
    return null;
  };

  const foto = p => {
    const u = urlFoto(p);
    if (u) {
      return `<img src="${esc(u)}" alt="${esc(p.nome)}" loading="lazy" referrerpolicy="no-referrer" class="v2-prod-card-img">`;
    }
    return `<div class="v2-prod-card-ph" aria-hidden="true">${ico.food}</div>`;
  };

  const fotoModal = p => {
    const u = urlFoto(p);
    if (u) {
      return `<img src="${esc(u)}" alt="${esc(p.nome)}" class="v2-modal-hero">`;
    }
    return '';
  };

  const fotoCart = p => {
    const u = urlFoto(p);
    if (u) {
      return `<img src="${esc(u)}" alt="${esc(p?.nome || '')}" class="v2-cart-item-thumb">`;
    }
    return `<div class="v2-cart-item-thumb v2-cart-item-thumb--ph" aria-hidden="true">${ico.food}</div>`;
  };

  const resumoCombo = line => {
    if (line.variante !== 'combo') return '';
    try {
      return 'Combo: ' + comporCombo(ofertaProduto(product(line.produtoId)), line.bebidaId)
        .slice(1)
        .map(c => `${c.quantidade} × ${c.nome} (incluso)`)
        .join(', ');
    } catch {
      return 'Combo indisponível. Remova este item e escolha novamente.';
    }
  };

  // Renderiza Skeleton inicial
  app.innerHTML = `
    <main class="v2-menu-container v2-skeleton-wrapper" aria-busy="true" aria-label="Carregando cardápio">
      <div class="v2-store-head">
        <div style="display:flex; gap:16px; align-items:center;">
          <div class="v2-skeleton" style="width:72px; height:72px; border-radius:14px;"></div>
          <div style="flex:1;">
            <div class="v2-skeleton" style="width:90px; height:20px; border-radius:12px; margin-bottom:8px;"></div>
            <div class="v2-skeleton" style="width:min(260px, 80%); height:28px; border-radius:6px; margin-bottom:8px;"></div>
            <div class="v2-skeleton" style="width:160px; height:14px; border-radius:4px;"></div>
          </div>
        </div>
      </div>
      <div style="padding:14px 24px; display:flex; gap:8px;">
        <div class="v2-skeleton" style="width:75px; height:32px; border-radius:20px;"></div>
        <div class="v2-skeleton" style="width:95px; height:32px; border-radius:20px;"></div>
        <div class="v2-skeleton" style="width:85px; height:32px; border-radius:20px;"></div>
      </div>
      <div style="padding:24px; display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
        ${[1, 2, 3, 4].map(() => `
          <div style="display:flex; gap:14px; padding:16px; border:1px solid #ebd9c8; border-radius:14px; background:#fff;">
            <div style="flex:1;">
              <div class="v2-skeleton" style="width:70%; height:18px; border-radius:4px; margin-bottom:8px;"></div>
              <div class="v2-skeleton" style="width:90%; height:12px; border-radius:4px; margin-bottom:6px;"></div>
              <div class="v2-skeleton" style="width:50%; height:12px; border-radius:4px; margin-bottom:14px;"></div>
              <div class="v2-skeleton" style="width:70px; height:18px; border-radius:4px;"></div>
            </div>
            <div class="v2-skeleton" style="width:104px; height:104px; border-radius:10px; flex-shrink:0;"></div>
          </div>
        `).join('')}
      </div>
    </main>
  `;

  try {
    cart = read('carrinho', 'retirada') || read('carrinho', 'delivery') || [];
    confirmed = read('confirmado');
    try {
      catalog = atendimento?.catalogo || await catalogoV2(slug);
    } catch (error) {
      if (!confirmed && !read('pendente')) throw error;
      catalog = { produtos: [], publicado: false, pausado: true, versao: read('pendente')?.body?.catalogoVersao || 0 };
    }

    if (catalog.canais?.delivery && !catalog.canais?.retirada) {
      modalidadeSacola = 'delivery';
    }
  } catch (error) {
    app.innerHTML = `
      <main class="v2-menu-container" style="padding: 40px 24px; text-align: center;">
        <h1>Cardápio indisponível</h1>
        <p style="color: var(--v2-text-muted); margin-bottom: 24px;">${esc(error.message)}</p>
        <button class="v2-modal-submit-btn" style="max-width: 240px; margin: 0 auto; justify-content: center;" onclick="location.reload()">Tentar novamente</button>
      </main>
    `;
    return;
  }

  function status(text, error = false) {
    const node = app.querySelector('#v2-message');
    if (!node) return;
    node.textContent = text;
    node.dataset.error = String(error);
  }

  async function revisarPrecos() {
    if (read('pendente', modalidadeSacola)) return;
    if (!atendimento) catalog = await catalogoV2(slug);
    if (!atendimento && (catalog.pausado || !catalog.publicado)) throw new Error('A loja pausou os pedidos.');
    const revised = cart.map(line => {
      const precoEsperadoCentavos = unit(line);
      if (precoEsperadoCentavos === null) throw new Error('Um item ficou indisponível. Remova-o antes de continuar.');
      return { ...line, precoEsperadoCentavos };
    });
    if (revised.some((line, i) => line.precoEsperadoCentavos !== cart[i].precoEsperadoCentavos)) {
      localStorage.setItem(key('carrinho', modalidadeSacola), JSON.stringify(revised));
      cart = revised;
      quote = null;
      throw new Error('O preço foi atualizado. Confira o novo total e confirme novamente.');
    }
  }

  async function action(fn) {
    if (busy) return;
    busy = true;
    app.dataset.busy = 'true';
    app.querySelectorAll('button').forEach(b => b.disabled = true);
    const fields = app.querySelector('#v2-delivery-fields');
    if (fields) fields.disabled = true;
    try {
      await fn();
    } catch (error) {
      if (modalidadeSacola === 'delivery' && !read('pendente', 'delivery')) quote = null;
      paint();
      showToast(error.message || 'Não foi possível concluir. Tente novamente.', 'error');
    } finally {
      busy = false;
      app.dataset.busy = 'false';
      app.querySelectorAll('button').forEach(b => b.disabled = false);
      const fields = app.querySelector('#v2-delivery-fields');
      if (fields) fields.disabled = !!read('pendente', modalidadeSacola);
    }
  }

  let buscandoCep = false;
  async function consultarViaCep(cepStr) {
    const cepLimpo = String(cepStr || '').replace(/\D/g, '');
    if (cepLimpo.length !== 8) return null;
    buscandoCep = true;
    const cepInput = app.querySelector('#v2-cep');
    if (cepInput) cepInput.setAttribute('aria-busy', 'true');
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { referrerPolicy: 'no-referrer' });
      if (!resp.ok) throw new Error('Falha na consulta');
      const data = await resp.json();
      if (data && !data.erro) {
        deliveryData.cep = cepLimpo.replace(/^(\d{5})(\d{3})$/, '$1-$2');
        deliveryData.logradouro = data.logradouro || deliveryData.logradouro || '';
        deliveryData.bairro = data.bairro || deliveryData.bairro || '';
        deliveryData.cidade = data.localidade || deliveryData.cidade || '';
        deliveryData.uf = data.uf || deliveryData.uf || '';

        const ruaEl = app.querySelector('#v2-logradouro');
        const bairroEl = app.querySelector('#v2-bairro');
        const cidadeEl = app.querySelector('#v2-cidade');
        const ufEl = app.querySelector('#v2-uf');
        const cepEl = app.querySelector('#v2-cep');
        const numEl = app.querySelector('#v2-numero');
        if (ruaEl) ruaEl.value = deliveryData.logradouro;
        if (bairroEl) bairroEl.value = deliveryData.bairro;
        if (cidadeEl) cidadeEl.value = deliveryData.cidade;
        if (ufEl) ufEl.value = deliveryData.uf;
        if (cepEl) cepEl.value = deliveryData.cep;
        if (numEl && !numEl.value) numEl.focus();

        showToast('Endereço preenchido com sucesso!', 'success');

        if (cart.length && !read('pendente', 'delivery')) {
          try {
            await revisarPrecos();
            quote = await cotarV2({ slug, catalogoVersao: catalog.versao, cep: deliveryData.cep, itens: cart });
            const summary = app.querySelector('#v2-quote-summary');
            if (summary) {
              summary.innerHTML = `
                <p style="margin: 0 0 4px;">${ico.motorcycle} Taxa de Entrega: <strong>${money(quote.taxaEntregaCentavos)}</strong></p>
                <p style="margin: 0 0 4px;">${ico.clock} Prazo estimado: <strong>${quote.prazoMinutos} minutos</strong></p>
                <p style="margin: 0; color: var(--v2-primary); font-weight: 800;">Total c/ entrega: ${money(quote.totalCentavos)}</p>
              `;
            }
            const totalTxt = app.querySelector('.v2-summary-line.total strong');
            if (totalTxt) totalTxt.textContent = money(quote.totalCentavos);
            const taxaTxt = app.querySelector('#v2-taxa-display');
            if (taxaTxt) taxaTxt.textContent = money(quote.taxaEntregaCentavos);
          } catch (e) {
            console.warn('Erro ao cotar frete:', e);
          }
        }
        return data;
      } else {
        showToast('CEP não encontrado. Preencha seu endereço manualmente.', 'error');
        return null;
      }
    } catch (e) {
      console.warn('Erro ViaCEP:', e);
      return null;
    } finally {
      buscandoCep = false;
      if (cepInput) cepInput.removeAttribute('aria-busy');
    }
  }

  function storeInfoModalHtml() {
    if (!infoModalAberta) return '';
    const tempoEntrega = catalog.entregaTexto || catalog.tempoEntrega || catalog.delivery?.prazoTexto || (catalog.delivery?.prazoMinutos ? `${catalog.delivery.prazoMinutos} min` : null);
    const horarioFuncionamento = catalog.horarioTexto || catalog.horariosTexto || catalog.funcionamento;
    const enderecoLoja = catalog.endereco || catalog.contato?.endereco;
    const telRaw = catalog.whatsapp || catalog.telefone || catalog.contato?.telefone;
    const telDigitos = String(telRaw || '').replace(/\D/g, '');
    const telFormatado = telDigitos.length === 11 
      ? `(${telDigitos.slice(0, 2)}) ${telDigitos.slice(2, 7)}-${telDigitos.slice(7)}` 
      : (telDigitos.length === 10 ? `(${telDigitos.slice(0, 2)}) ${telDigitos.slice(2, 6)}-${telDigitos.slice(6)}` : telRaw);

    const storeLogo = catalog.logotipoUrl || catalog.logoUrl;
    const minPedido = catalog.pedidoMinimoTexto;
    const temMinimo = minPedido && !/^sem pedido m[ií]nimo/i.test(minPedido);
    const temRetirada = catalog.canais?.retirada !== false;
    const temDelivery = catalog.canais?.delivery === true;

    return `
      <div class="v2-modal-backdrop is-open ${infoModalEntrando ? 'is-entering' : ''}" id="v2-info-backdrop">
        <div class="v2-modal-sheet v2-info-sheet" role="dialog" aria-modal="true" aria-labelledby="v2-info-title">
          <div class="v2-info-header">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="v2-info-header-icon">${ico.info}</span>
              <h2 class="v2-info-header-title" id="v2-info-title">Informações da Loja</h2>
            </div>
            <button type="button" class="v2-modal-close-btn" style="position:static;" id="v2-info-close" aria-label="Fechar">${ico.close}</button>
          </div>
          <div class="v2-info-body">
            <div class="v2-info-store-card">
              ${storeLogo ? `<img src="${esc(storeLogo)}" alt="${esc(catalog.nome)}" class="v2-info-store-logo">` : `<div class="v2-info-store-logo v2-info-store-logo--initials">${iniciais(catalog.nome)}</div>`}
              <div class="v2-info-store-meta">
                <h3 class="v2-info-store-name">${esc(catalog.nome || 'Cardápio Digital')}</h3>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:4px;">
                  <span class="v2-status-badge ${catalog.pausado ? 'is-paused' : 'is-open'}" style="font-size:11px; padding:3px 9px;">
                    <span class="v2-status-dot ${catalog.pausado ? 'is-closed' : ''}"></span>
                    ${catalog.pausado ? 'Fechado no momento' : 'Aberto agora'}
                  </span>
                  ${temMinimo ? `<span class="v2-channel-badge" style="font-size:11px; padding:3px 9px;">${ico.tag} Mínimo: ${esc(minPedido)}</span>` : ''}
                </div>
              </div>
            </div>

            <div class="v2-info-list">
              <div class="v2-info-row">
                <div class="v2-info-badge v2-info-badge--amber">${ico.clock}</div>
                <div class="v2-info-row-content">
                  <div class="v2-info-label">Horário de Funcionamento</div>
                  <div class="v2-info-val">${esc(horarioFuncionamento || 'Terça a Domingo · 18:00 às 23:00')}</div>
                </div>
              </div>

              <div class="v2-info-row">
                <div class="v2-info-badge v2-info-badge--blue">${ico.motorcycle}</div>
                <div class="v2-info-row-content">
                  <div class="v2-info-label">Formas de Atendimento & Prazos</div>
                  <div class="v2-info-val">
                    ${(temDelivery && temRetirada) ? 'Entrega em domicílio e Retirada no balcão' : temDelivery ? 'Apenas Entrega' : 'Apenas Retirada'}
                    ${tempoEntrega ? `<span style="display:block; color:var(--v2-text-muted); font-size:12.5px; font-weight:600; margin-top:2px;">Tempo estimado: <strong>${esc(tempoEntrega)}</strong></span>` : ''}
                  </div>
                </div>
              </div>

              ${enderecoLoja ? `
                <div class="v2-info-row">
                  <div class="v2-info-badge v2-info-badge--emerald">${ico.mapPin}</div>
                  <div class="v2-info-row-content">
                    <div class="v2-info-label">Endereço da Loja</div>
                    <div class="v2-info-val">${esc(enderecoLoja)}</div>
                    <a href="https://maps.google.com/?q=${encodeURIComponent(enderecoLoja)}" target="_blank" rel="noopener" class="v2-info-map-link">
                      ${ico.external} Ver rota no Google Maps
                    </a>
                  </div>
                </div>
              ` : ''}

              <div class="v2-info-row">
                <div class="v2-info-badge v2-info-badge--purple">${ico.tag}</div>
                <div class="v2-info-row-content">
                  <div class="v2-info-label">Formas de Pagamento Aceitas</div>
                  <div class="v2-info-val">Pix, Cartão de Crédito, Cartão de Débito e Dinheiro</div>
                </div>
              </div>
            </div>

            ${telDigitos.length >= 10 ? `
              <div class="v2-info-footer">
                <a class="v2-info-wa-btn" href="https://wa.me/55${telDigitos}" target="_blank" rel="noopener">
                  ${ico.wa}
                  <span>Conversar no WhatsApp (${esc(telFormatado)})</span>
                </a>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function pickupFormHtml(pending) {
    return `
      <div class="v2-pickup-box">
        <div class="v2-delivery-legend">${ico.store} Dados para retirada no balcão</div>
        <div class="v2-form-row">
          <label class="v2-form-label" for="v2-pickup-nome">Nome de quem vai retirar *</label>
          <input id="v2-pickup-nome" class="v2-form-input" name="nome" maxlength="60" autocomplete="name" required placeholder="Ex.: Douglas" value="${esc(pickupData.nome || '')}">
        </div>
        <div class="v2-form-row">
          <label class="v2-form-label" for="v2-pickup-tel">WhatsApp com DDD *</label>
          <input id="v2-pickup-tel" class="v2-form-input" name="telefone" maxlength="15" type="tel" inputmode="numeric" autocomplete="tel" required placeholder="(11) 99999-9999" value="${esc(formatarTelefone(pickupData.telefone || ''))}">
        </div>
      </div>
    `;
  }

  function deliveryFormHtml(pending, paused) {
    const data = pending?.body?.entrega || deliveryData;
    return `
      <div class="v2-delivery-box">
        <div class="v2-delivery-legend">${ico.motorcycle} Endereço para entrega</div>
        <fieldset id="v2-delivery-fields" style="border:0; padding:0; margin:0;" ${pending ? 'disabled' : ''}>
          <div class="v2-form-row">
            <label class="v2-form-label" for="v2-nome">Nome de quem recebe *</label>
            <input id="v2-nome" class="v2-form-input" name="nome" maxlength="60" autocomplete="name" required placeholder="Seu nome" value="${esc(data.nome || '')}">
          </div>
          <div class="v2-form-row">
            <label class="v2-form-label" for="v2-telefone">WhatsApp com DDD *</label>
            <input id="v2-telefone" class="v2-form-input" name="telefone" maxlength="15" type="tel" inputmode="numeric" autocomplete="tel" required placeholder="(11) 99999-9999" value="${esc(formatarTelefone(data.telefone || ''))}">
          </div>
          <div class="v2-form-row">
            <label class="v2-form-label" for="v2-cep">CEP * <span style="font-size:11px; font-weight:500; color:var(--v2-text-muted);">(busca endereço e frete automáticos)</span></label>
            <input id="v2-cep" class="v2-form-input" name="cep" maxlength="9" inputmode="numeric" placeholder="00000-000" pattern="[0-9]{5}-?[0-9]{3}" required value="${esc(data.cep || '')}">
          </div>
          <div class="v2-form-row">
            <label class="v2-form-label" for="v2-logradouro">Rua ou avenida *</label>
            <input id="v2-logradouro" class="v2-form-input" name="logradouro" maxlength="120" autocomplete="address-line1" required placeholder="Nome da rua" value="${esc(data.logradouro || '')}">
          </div>
          <div class="v2-form-grid-2">
            <div class="v2-form-row">
              <label class="v2-form-label" for="v2-numero">Número *</label>
              <input id="v2-numero" class="v2-form-input" name="numero" maxlength="15" required placeholder="Número" value="${esc(data.numero || '')}">
            </div>
            <div class="v2-form-row">
              <label class="v2-form-label" for="v2-complemento">Complemento (opcional)</label>
              <input id="v2-complemento" class="v2-form-input" name="complemento" maxlength="100" autocomplete="address-line2" placeholder="Bloco, apto, ref." value="${esc(data.complemento || '')}">
            </div>
          </div>
          <div class="v2-form-grid-3">
            <div class="v2-form-row v2-form-row--bairro">
              <label class="v2-form-label" for="v2-bairro">Bairro *</label>
              <input id="v2-bairro" class="v2-form-input" name="bairro" maxlength="80" autocomplete="address-level3" required placeholder="Bairro" value="${esc(data.bairro || '')}">
            </div>
            <div class="v2-form-row v2-form-row--cidade">
              <label class="v2-form-label" for="v2-cidade">Cidade *</label>
              <input id="v2-cidade" class="v2-form-input" name="cidade" maxlength="80" autocomplete="address-level2" required placeholder="Cidade" value="${esc(data.cidade || '')}">
            </div>
            <div class="v2-form-row v2-form-row--uf">
              <label class="v2-form-label" for="v2-uf">UF *</label>
              <input id="v2-uf" class="v2-form-input" name="uf" maxlength="2" autocomplete="address-level1" required value="${esc(data.uf || '')}">
            </div>
          </div>
        </fieldset>
        <div id="v2-quote-summary" class="v2-quote-summary-box">
          ${quote ? `
            <p style="margin: 0 0 4px;">${ico.motorcycle} Taxa de Entrega: <strong>${money(quote.taxaEntregaCentavos)}</strong></p>
            <p style="margin: 0 0 4px;">${ico.clock} Prazo estimado: <strong>${quote.prazoMinutos} minutos</strong></p>
            <p style="margin: 0; color: var(--v2-primary); font-weight: 800;">Total c/ entrega: ${money(quote.totalCentavos)}</p>
          ` : '<p style="margin:0;">Digite seu CEP para preencher o endereço e simular o frete.</p>'}
        </div>
      </div>
    `;
  }

  function calcularPrecoModal(p) {
    if (!p) return 0;
    let base = centavos(precoProduto(p, modalEstado.variante).preco);
    for (const o of modalEstado.opcoes) {
      const opt = p.grupos?.find(g => g.id === o.grupoId)?.opcoes?.find(x => x.id === o.opcaoId);
      if (opt && o.quantidade > 0) {
        base += (opt.precoCentavos || 0) * o.quantidade;
      }
    }
    return base * modalEstado.quantidade;
  }

  function validarModal(p) {
    if (!p) return { valido: false, msg: '' };
    if (modalEstado.variante === 'combo') {
      if (p.combo?.bebidas?.length && !modalEstado.bebidaId) {
        return { valido: false, msg: 'Escolha a bebida do combo' };
      }
    }
    for (const g of (p.grupos || [])) {
      const selecionados = modalEstado.opcoes
        .filter(o => o.grupoId === g.id)
        .reduce((sum, o) => sum + o.quantidade, 0);
      if (selecionados < (g.min || 0)) {
        return { valido: false, msg: `Escolha pelo menos ${g.min} em "${g.nome}"` };
      }
      if (g.max && selecionados > g.max) {
        return { valido: false, msg: `Máximo de ${g.max} em "${g.nome}" excedido` };
      }
    }
    return { valido: true, msg: '' };
  }

  function modalHtml(p) {
    if (!p) return '';
    const temCombo = p.combo?.ativo;
    const isCombo = modalEstado.variante === 'combo';
    const precoCalc = calcularPrecoModal(p);
    const validacao = validarModal(p);

    const fixosTexto = (p.combo?.fixos || []).map(f => `${f.quantidade} × ${f.nome}`).join(', ');
    const inclusosLinha = fixosTexto 
      ? `1 × ${esc(p.nome)} + ${esc(fixosTexto)} + Bebida à sua escolha`
      : `1 × ${esc(p.nome)} + Bebida à sua escolha`;

    return `
      <div class="v2-modal-backdrop is-open ${produtoModalEntrando ? 'is-entering' : ''}" id="v2-modal-backdrop">
        <div class="v2-modal-sheet" role="dialog" aria-modal="true" aria-labelledby="v2-modal-title">
          <button type="button" class="v2-modal-close-btn" id="v2-modal-close" aria-label="Fechar">${ico.close}</button>
          ${fotoModal(p)}
          <div class="v2-modal-body">
            <h2 class="v2-modal-title" id="v2-modal-title">${esc(p.nome)}</h2>
            ${p.descricao ? `<p class="v2-modal-desc">${esc(p.descricao)}</p>` : ''}

            ${temCombo ? `
              <div class="v2-combo-box">
                <div class="v2-combo-legend">Escolha sua opção:</div>
                <div class="v2-combo-variants">
                  <div class="v2-variant-card ${!isCombo ? 'selected' : ''}" data-set-variant="individual">
                    <span class="v2-variant-title">Individual</span>
                    <span class="v2-variant-price">${brl(precoProduto(p, 'individual').preco)}</span>
                  </div>
                  <div class="v2-variant-card ${isCombo ? 'selected' : ''}" data-set-variant="combo">
                    <span class="v2-variant-title">Combo</span>
                    <span class="v2-variant-price">${brl(precoProduto(p, 'combo').preco)}</span>
                  </div>
                </div>
                ${isCombo ? `
                  <div class="v2-combo-details">
                    <p class="v2-combo-inclusos">
                      <strong>Itens inclusos:</strong> ${inclusosLinha}.
                    </p>
                    <label class="v2-form-label" for="v2-combo-bebida" style="font-weight: 750; color: #854d0e;">
                      ${ico.drink} Escolha a bebida inclusa:
                    </label>
                    <select id="v2-combo-bebida" class="v2-combo-beverage-select" required>
                      <option value="">Selecione uma bebida...</option>
                      ${(p.combo.bebidas || []).map(b => `
                        <option value="${esc(b.produtoId)}" ${modalEstado.bebidaId === b.produtoId ? 'selected' : ''}>
                          ${esc(b.nome)} (inclusa no combo)
                        </option>
                      `).join('')}
                    </select>
                  </div>
                ` : ''}
              </div>
            ` : ''}

            <!-- Grupos de Opcionais/Adicionais/Ponto da Carne configurados no Painel -->
            ${(p.grupos || []).map(g => {
              const selecionados = modalEstado.opcoes
                .filter(o => o.grupoId === g.id)
                .reduce((sum, o) => sum + o.quantidade, 0);
              const atingiuMax = g.max && selecionados >= g.max;
              const isRequired = (g.min || 0) > 0;
              const badgeText = isRequired 
                ? (g.min === g.max ? `Escolha ${g.min}` : `Escolha de ${g.min} a ${g.max}`)
                : (g.max ? `Até ${g.max}` : 'Opcional');

              return `
                <div class="v2-group-card">
                  <div class="v2-group-header">
                    <div>
                      <div class="v2-group-name">${esc(g.nome)}</div>
                      <small style="color:var(--v2-text-muted); font-size:11.5px;">${selecionados} de ${g.max || 'ilimitados'} selecionados</small>
                    </div>
                    <span class="v2-group-badge ${isRequired && selecionados < g.min ? 'required' : ''}">
                      ${badgeText}
                    </span>
                  </div>
                  <div class="v2-group-options">
                    ${(g.opcoes || []).filter(o => o.ativo).map(o => {
                      const curOpt = modalEstado.opcoes.find(x => x.grupoId === g.id && x.opcaoId === o.id);
                      const qtd = curOpt ? curOpt.quantidade : 0;
                      const podeAdd = !atingiuMax && (!o.maxQuantidade || qtd < o.maxQuantidade);

                      return `
                        <div class="v2-option-row">
                          <div class="v2-option-info">
                            <div class="v2-option-name">${esc(o.nome)}</div>
                            ${o.precoCentavos ? `<div class="v2-option-price">+ ${money(o.precoCentavos)}</div>` : '<div style="font-size:11.5px; color:#15803d; font-weight:700;">Grátis</div>'}
                          </div>
                          <div class="v2-stepper">
                            <button type="button" class="v2-stepper-btn" data-step-opt="-1" data-group-id="${esc(g.id)}" data-opt-id="${esc(o.id)}" ${qtd <= 0 ? 'disabled' : ''} aria-label="Diminuir">
                              −
                            </button>
                            <span class="v2-stepper-value">${qtd}</span>
                            <button type="button" class="v2-stepper-btn" data-step-opt="1" data-group-id="${esc(g.id)}" data-opt-id="${esc(o.id)}" ${!podeAdd ? 'disabled' : ''} aria-label="Aumentar">
                              +
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}

            <div class="v2-obs-section">
              <label class="v2-obs-label" for="v2-modal-obs">Alguma observação?</label>
              <input id="v2-modal-obs" class="v2-obs-input" maxlength="180" placeholder="Ex.: sem cebola, maionese à parte, carne bem passada..." value="${esc(modalEstado.observacao)}">
            </div>
          </div>

          <div class="v2-modal-footer">
            <div class="v2-modal-qty">
              <button type="button" class="v2-modal-qty-btn" id="v2-modal-qty-dec" ${modalEstado.quantidade <= 1 ? 'disabled' : ''}>−</button>
              <span class="v2-modal-qty-val">${modalEstado.quantidade}</span>
              <button type="button" class="v2-modal-qty-btn" id="v2-modal-qty-inc">+</button>
            </div>
            <button type="button" class="v2-modal-submit-btn" id="v2-modal-add" ${!validacao.valido ? 'disabled' : ''}>
              <span>${validacao.valido ? 'Adicionar ao pedido' : validacao.msg}</span>
              <span>${money(precoCalc)}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function cartModalHtml(pending, paused) {
    const totalProdutos = cart.reduce((sum, line) => sum + (unit(line) || 0) * line.quantidade, 0);
    const totalQtd = cart.reduce((s, i) => s + i.quantidade, 0);
    const isDelivery = modalidadeSacola === 'delivery';
    const totalGeral = isDelivery && quote ? quote.totalCentavos : totalProdutos;
    
    const temRetirada = catalog.canais?.retirada !== false;
    const temDelivery = catalog.canais?.delivery === true;

    return `
      <div class="v2-cart-backdrop ${carrinhoAberto ? 'is-open' : ''} ${carrinhoEntrando ? 'is-entering' : ''}" id="v2-cart-backdrop">
        <div class="v2-cart-modal" role="dialog" aria-modal="true" aria-labelledby="v2-cart-title">
          <div class="v2-cart-head">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="v2-cart-head-icon" style="color:var(--v2-primary); display:flex; align-items:center;">${ico.bag}</span>
              <h2 class="v2-cart-title" id="v2-cart-title" style="margin:0; font-size:17px; font-weight:800;">Revisando Pedido (${totalQtd})</h2>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${cart.length ? `
                <button type="button" class="v2-cart-clear-btn" id="v2-cart-clear" aria-label="Esvaziar carrinho" title="Limpar todos os itens">
                  ${ico.trash} <span>Limpar</span>
                </button>
              ` : ''}
              <button type="button" class="v2-modal-close-btn" style="position:static;" id="v2-cart-close" aria-label="Fechar sacola">${ico.close}</button>
            </div>
          </div>
          <div class="v2-cart-body">
            ${confirmandoLimparCarrinho ? `
              <div class="v2-cart-confirm-bar" id="v2-cart-confirm-bar">
                <div class="v2-cart-confirm-info">
                  <div class="v2-cart-confirm-badge">${ico.trash}</div>
                  <div>
                    <strong class="v2-cart-confirm-title">Deseja limpar todos os itens?</strong>
                    <p class="v2-cart-confirm-desc">Os ${totalQtd} produtos adicionados serão removidos da sua sacola.</p>
                  </div>
                </div>
                <div class="v2-cart-confirm-btns">
                  <button type="button" class="v2-cart-confirm-btn v2-cart-confirm-btn--cancel" id="v2-clear-cancel">Cancelar</button>
                  <button type="button" class="v2-cart-confirm-btn v2-cart-confirm-btn--danger" id="v2-clear-confirm">Sim, esvaziar</button>
                </div>
              </div>
            ` : ''}
            ${!cart.length ? `
              <div style="text-align: center; padding: 48px 16px; color: var(--v2-text-muted);">
                <div style="width: 52px; height: 52px; margin: 0 auto 12px; color: var(--v2-text-dim); display:flex; align-items:center; justify-content:center;">${ico.bag}</div>
                <h3 style="margin: 0 0 6px; color: var(--v2-text); font-size: 17px;">Sua sacola está vazia</h3>
                <p style="font-size: 13px; margin: 0;">Escolha um produto e personalize do seu jeito!</p>
              </div>
            ` : `
              <div class="v2-cart-items-list">
                ${cart.map((line, i) => {
                  const p = product(line.produtoId);
                  const precoLinha = unit(line);
                  return `
                    <div class="v2-cart-item">
                      <div class="v2-cart-item-row">
                        ${fotoCart(p)}
                        <div class="v2-cart-item-content">
                          <div class="v2-cart-item-header">
                            <div class="v2-cart-item-title">${esc(p?.nome || 'Produto indisponível')}</div>
                            <button type="button" class="v2-cart-remove-link" data-cart-remove="${i}" title="Remover item">
                              ${ico.trash} Remover
                            </button>
                          </div>
                          ${line.variante === 'combo' ? `<div class="v2-cart-item-meta" style="color:#b45309; font-weight:700;">${esc(resumoCombo(line))}</div>` : ''}
                          ${(line.opcoes || []).map(o => {
                            const opt = p?.grupos?.find(g => g.id === o.grupoId)?.opcoes?.find(x => x.id === o.opcaoId);
                            return opt ? `<div class="v2-cart-item-meta">+ ${o.quantidade}× ${esc(opt.nome)}</div>` : '';
                          }).join('')}
                          ${line.observacao ? `<div class="v2-cart-item-meta" style="font-style:italic;">Obs: "${esc(line.observacao)}"</div>` : ''}
                          
                          <div class="v2-cart-item-bottom">
                            <div class="v2-stepper">
                              <button type="button" class="v2-stepper-btn" data-cart-step="-1" data-index="${i}" aria-label="Diminuir">
                                −
                              </button>
                              <span class="v2-stepper-value">${line.quantidade}</span>
                              <button type="button" class="v2-stepper-btn" data-cart-step="1" data-index="${i}" aria-label="Aumentar">
                                +
                              </button>
                            </div>
                            <div class="v2-cart-item-price">
                              ${precoLinha === null ? '<span style="color:var(--v2-danger)">Indisponível</span>' : money(precoLinha * line.quantidade)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Escolha de Como Receber: no final do carrinho antes de finalizar -->
              ${!mesaId && (temRetirada && temDelivery) ? `
                <div class="v2-fulfillment-selector">
                  <button type="button" class="v2-fulfillment-tab ${isDelivery ? 'active' : ''}" data-set-sacola-modalidade="delivery">
                    ${ico.motorcycle} <span>Entrega</span>
                  </button>
                  <button type="button" class="v2-fulfillment-tab ${!isDelivery ? 'active' : ''}" data-set-sacola-modalidade="retirada">
                    ${ico.store} <span>Retirada</span>
                  </button>
                </div>
              ` : ''}

              <!-- Formulário conforme a escolha -->
              ${isDelivery ? deliveryFormHtml(pending, paused) : pickupFormHtml(pending)}
            `}
          </div>

          ${cart.length ? `
            <div class="v2-cart-footer">
              <div class="v2-summary-line">
                <span>Subtotal dos itens</span>
                <strong>${money(totalProdutos)}</strong>
              </div>
              ${isDelivery ? `
                <div class="v2-summary-line">
                  <span>Taxa de entrega</span>
                  <strong id="v2-taxa-display">${quote ? money(quote.taxaEntregaCentavos) : 'A calcular'}</strong>
                </div>
              ` : ''}
              <div class="v2-summary-line total">
                <span>Total a pagar</span>
                <strong style="color: var(--v2-primary); font-size: 20px;">${money(totalGeral)}</strong>
              </div>
              <button type="button" class="v2-cart-submit-btn" id="v2-send">
                ${pending ? 'Consultar envio pendente' : 'Enviar pedido'}
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function paint() {
    if (disposed) return;
    const isAnyModalOpen = Boolean(infoModalAberta || produtoModal || carrinhoAberto);
    document.documentElement.classList.toggle('v2-modal-open', isAnyModalOpen);
    document.body.classList.toggle('v2-modal-open', isAnyModalOpen);

    const prevCartScroll = app.querySelector('.v2-cart-body')?.scrollTop || 0;
    const pending = read('pendente', modalidadeSacola);
    const paused = catalog.pausado || (modalidadeSacola === 'delivery' ? catalog.canais?.delivery !== true : catalog.canais && (mesaId ? !catalog.canais.mesas : !catalog.canais.retirada));

    const prods = produtosOrdenados();
    const categorias = [...new Set(prods.map(p => p.categoria || 'Outros'))].sort((a, b) => {
      const pA = prioridadeCategoria(a);
      const pB = prioridadeCategoria(b);
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b, 'pt-BR');
    });

    const maisPedidos = prods
      .filter(p => !p.esgotado && (p.combo?.ativo || urlFoto(p) || p.ordem <= 4))
      .slice(0, 8);

    const prodsFiltrados = prods.filter(p => {
      if (categoriaAtiva && (p.categoria || 'Outros') !== categoriaAtiva) return false;
      if (termoBusca.trim()) {
        const t = termoBusca.toLowerCase().trim();
        const matchNome = (p.nome || '').toLowerCase().includes(t);
        const matchDesc = (p.descricao || '').toLowerCase().includes(t);
        const matchCat = (p.categoria || '').toLowerCase().includes(t);
        if (!matchNome && !matchDesc && !matchCat) return false;
      }
      return true;
    });
    
    const qtdTotalCart = cart.reduce((sum, line) => sum + line.quantidade, 0);
    const valorTotalCart = cart.reduce((sum, line) => sum + (unit(line) || 0) * line.quantidade, 0);

    const temRetirada = catalog.canais?.retirada !== false;
    const temDelivery = catalog.canais?.delivery === true;

    const tempoEntrega = catalog.entregaTexto || catalog.tempoEntrega || catalog.delivery?.prazoTexto || (catalog.delivery?.prazoMinutos ? `${catalog.delivery.prazoMinutos} min` : null);
    const horarioFuncionamento = catalog.horarioTexto || catalog.horariosTexto || catalog.funcionamento;
    const enderecoLoja = catalog.endereco || catalog.contato?.endereco;
    const telRaw = catalog.whatsapp || catalog.telefone || catalog.contato?.telefone;
    const telDigitos = String(telRaw || '').replace(/\D/g, '');
    const telFormatado = telDigitos.length === 11 
      ? `(${telDigitos.slice(0, 2)}) ${telDigitos.slice(2, 7)}-${telDigitos.slice(7)}` 
      : (telDigitos.length === 10 ? `(${telDigitos.slice(0, 2)}) ${telDigitos.slice(2, 6)}-${telDigitos.slice(6)}` : telRaw);

    const storeLogo = catalog.logotipoUrl || catalog.logoUrl;
    const minPedido = catalog.pedidoMinimoTexto;
    const temMinimo = minPedido && !/^sem pedido m[ií]nimo/i.test(minPedido);

    app.innerHTML = `
      <main class="v2-menu-container">
        <!-- Cabeçalho da Loja -->
        <header class="v2-store-head">
          <div class="v2-header-top-row">
            <div class="v2-store-brand-row">
              ${storeLogo ? `<img class="v2-store-logo" src="${esc(storeLogo)}" alt="${esc(catalog.nome)}">` : `<div class="v2-store-logo v2-store-logo--initials">${iniciais(catalog.nome)}</div>`}
              <div class="v2-store-info">
                <div class="v2-store-title-row">
                  <h1 class="v2-store-title">${esc(catalog.nome || 'Cardápio Digital')}</h1>
                  <div class="v2-store-badges">
                    <span class="v2-status-badge ${paused ? 'is-paused' : 'is-open'}">
                      <span class="v2-status-dot ${paused ? 'is-closed' : ''}"></span>
                      ${paused ? 'Fechado' : 'Aberto agora'}
                    </span>
                    ${mesaId 
                      ? `<span class="v2-channel-badge">${ico.table} Mesa ${esc(mesaId)}</span>` 
                      : (temDelivery && temRetirada)
                        ? `<span class="v2-channel-badge">${ico.motorcycle} Entrega & ${ico.store} Retirada</span>`
                        : temDelivery 
                          ? `<span class="v2-channel-badge">${ico.motorcycle} Entrega</span>` 
                          : `<span class="v2-channel-badge">${ico.store} Retirada</span>`
                    }
                    ${tempoEntrega ? `<span class="v2-channel-badge">${ico.clock} ${esc(tempoEntrega)}</span>` : ''}
                    <button type="button" class="v2-store-info-btn" id="v2-open-info">${ico.info} Informações da loja ▾</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2 Ícones de Ação no Topo Direito (Lupa e WhatsApp Oficial) -->
            <div class="v2-header-actions">
              <button type="button" class="v2-header-icon-btn ${buscaAberta ? 'is-active' : ''}" id="v2-search-toggle" aria-label="Buscar produtos" title="Buscar no cardápio">
                ${ico.search}
              </button>
              ${telDigitos.length >= 10 ? `
                <a class="v2-header-icon-btn v2-header-icon-btn--wa" href="https://wa.me/55${telDigitos}" target="_blank" rel="noopener" aria-label="WhatsApp da loja" title="Conversar no WhatsApp (${esc(telFormatado)})">
                  ${ico.wa}
                </a>
              ` : ''}
            </div>
          </div>

          <!-- Campo de Busca Deslizante acionado pela Lupa -->
          ${buscaAberta ? `
            <div class="v2-search-bar-wrap">
              <div class="v2-search-input-box">
                <span class="v2-search-icon">${ico.search}</span>
                <input type="search" id="v2-search-input" class="v2-search-input" placeholder="Buscar no cardápio (ex: burger, coca, pizza)..." value="${esc(termoBusca)}" autofocus autocomplete="off">
                ${termoBusca ? `<button type="button" class="v2-search-clear-btn" id="v2-search-clear" aria-label="Limpar busca">${ico.close}</button>` : ''}
              </div>
            </div>
          ` : ''}
        </header>

        <p id="v2-message" role="status" aria-live="polite" style="margin: 12px 24px;"></p>
        <div id="v2-confirmation"></div>

        ${confirmed ? '' : `
          <!-- Barra de Categorias Horizontal Deslizante -->
          <div class="v2-category-nav-wrapper">
            <div class="v2-category-scroller">
              <button type="button" class="v2-cat-chip ${!categoriaAtiva ? 'active' : ''}" data-cat="">
                ${ico.utensils} Todos os Itens
              </button>
              ${categorias.map(c => `
                <button type="button" class="v2-cat-chip ${categoriaAtiva === c ? 'active' : ''}" data-cat="${esc(c)}">
                  ${esc(c)}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Carrossel Mais Pedidos -->
          ${!termoBusca && !categoriaAtiva && maisPedidos.length > 0 ? `
            <section class="v2-bestsellers-section">
              <div class="v2-bestsellers-header">
                <h2 class="v2-bestsellers-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Mais Pedidos
                </h2>
                <div class="v2-carousel-nav-header">
                  <button type="button" class="v2-carousel-arrow v2-carousel-arrow--prev is-hidden" id="v2-carousel-prev" aria-label="Rolar para a esquerda">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <button type="button" class="v2-carousel-arrow v2-carousel-arrow--next" id="v2-carousel-next" aria-label="Rolar para a direita">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </div>
              </div>
              <div class="v2-carousel-outer">
                <div class="v2-bestsellers-carousel" id="v2-bestsellers-carousel">
                  ${maisPedidos.map(p => {
                    const preco = precoProduto(p);
                    const temVariacao = p.combo?.ativo || (p.grupos && p.grupos.length > 0);
                    const u = urlFoto(p);
                    return `
                      <article class="v2-bestseller-card" data-open-product="${esc(p.id)}">
                        <div class="v2-bestseller-media">
                          ${u ? `<img src="${esc(u)}" alt="${esc(p.nome)}" class="v2-bestseller-img" loading="lazy">` : `<div class="v2-bestseller-ph">${ico.burger}</div>`}
                        </div>
                        <h3 class="v2-bestseller-name">${esc(p.nome)}</h3>
                        <div class="v2-bestseller-bottom">
                          <div class="v2-bestseller-price-wrap">
                            ${temVariacao ? '<span class="v2-price-from">A partir de</span>' : ''}
                            <span class="v2-bestseller-price">${brl(preco.preco)}</span>
                          </div>
                          <button type="button" class="v2-bestseller-add-btn" data-open-product="${esc(p.id)}" aria-label="Adicionar ${esc(p.nome)}">
                            ${ico.plus}
                          </button>
                        </div>
                      </article>
                    `;
                  }).join('')}
                </div>
              </div>
            </section>
          ` : ''}

          <!-- Catálogo de Produtos -->
          <section class="v2-catalog-body">
            <h2 class="v2-section-title">
              ${termoBusca ? `Resultados para "${esc(termoBusca)}"` : (categoriaAtiva ? esc(categoriaAtiva) : 'Destaques do Cardápio')}
              <span style="font-size: 13px; font-weight: 600; color: var(--v2-text-muted);">(${prodsFiltrados.length} itens)</span>
            </h2>
            <div class="v2-products-grid">
              ${prodsFiltrados.map(p => {
                const temCombo = p.combo?.ativo;
                const preco = precoProduto(p);
                return `
                  <article class="v2-prod-card ${p.esgotado ? 'is-soldout' : ''}" data-open-product="${esc(p.id)}">
                    <div class="v2-prod-card-body">
                      <div class="v2-prod-card-tags">
                        ${temCombo ? `<span class="v2-tag v2-tag--combo">COMBO DISPONÍVEL</span>` : ''}
                        ${preco.promocao ? `<span class="v2-tag v2-tag--promo">PROMO</span>` : ''}
                      </div>
                      <h3 class="v2-prod-card-name">${esc(p.nome)}</h3>
                      ${p.descricao ? `<p class="v2-prod-card-desc">${esc(p.descricao)}</p>` : ''}
                      <div class="v2-prod-card-price">
                        ${exibirPreco(p)}
                      </div>
                    </div>
                    <div class="v2-prod-card-media">
                      ${foto(p)}
                      ${p.esgotado ? `<span class="v2-soldout-label">Esgotado</span>` : `
                        <button type="button" class="v2-prod-add-btn" aria-label="Adicionar ${esc(p.nome)}" data-open-product="${esc(p.id)}">
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M7 1v12M1 7h12"/></svg>
                        </button>
                      `}
                    </div>
                  </article>
                `;
              }).join('')}
            </div>
          </section>

          <!-- Barra Flutuante de Carrinho -->
          <div class="v2-floating-cart-bar ${qtdTotalCart > 0 && !carrinhoAberto ? 'is-visible' : ''}" id="v2-floating-cart">
            <div class="v2-cart-badge">
              <span class="v2-cart-count-badge">${qtdTotalCart}</span>
              <span class="v2-cart-total-txt">${money(valorTotalCart)}</span>
            </div>
            <div class="v2-cart-action-txt">
              Revisar pedido <span>→</span>
            </div>
          </div>
        `}

        <!-- Modal do Produto -->
        ${produtoModal ? modalHtml(produtoModal) : ''}

        <!-- Modal da Sacola de Compras -->
        ${cartModalHtml(pending, paused)}

        <!-- Modal de Informações da Loja -->
        ${storeInfoModalHtml()}

        <!-- Container do Toast Notificação -->
        <div id="v2-toast-wrap" class="v2-toast-wrap" aria-live="polite"></div>
      </main>
    `;

    infoModalEntrando = false;
    produtoModalEntrando = false;
    carrinhoEntrando = false;

    const newCartBody = app.querySelector('.v2-cart-body');
    if (newCartBody && prevCartScroll > 0) {
      newCartBody.scrollTop = prevCartScroll;
    }

    setupEventListeners(pending, paused);
  }

  function setupEventListeners(pending, paused) {
    // 1. Filtro de Categorias com Centralização Suave ao Clicar
    app.querySelectorAll('.v2-cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        categoriaAtiva = chip.dataset.cat || '';
        paint();
        requestAnimationFrame(() => {
          const scroller = app.querySelector('.v2-category-scroller');
          const activeChip = app.querySelector('.v2-cat-chip.active');
          if (scroller && activeChip) {
            const targetLeft = activeChip.offsetLeft - (scroller.clientWidth / 2) + (activeChip.clientWidth / 2);
            scroller.scrollTo({
              left: Math.max(0, targetLeft),
              behavior: 'smooth'
            });
          }
        });
      });
    });

    // 2. Busca de Produtos (Toggle, Input, Limpar)
    const searchToggle = app.querySelector('#v2-search-toggle');
    if (searchToggle) {
      searchToggle.addEventListener('click', () => {
        buscaAberta = !buscaAberta;
        if (!buscaAberta) termoBusca = '';
        paint();
        if (buscaAberta) {
          requestAnimationFrame(() => {
            app.querySelector('#v2-search-input')?.focus();
          });
        }
      });
    }

    const searchInput = app.querySelector('#v2-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        termoBusca = e.target.value;
        paint();
        requestAnimationFrame(() => {
          const inp = app.querySelector('#v2-search-input');
          if (inp) {
            inp.focus();
            inp.setSelectionRange(inp.value.length, inp.value.length);
          }
        });
      });
    }

    const searchClear = app.querySelector('#v2-search-clear');
    if (searchClear) {
      searchClear.addEventListener('click', () => {
        termoBusca = '';
        paint();
      });
    }

    // 3. Modal de Informações da Loja
    const openInfoBtn = app.querySelector('#v2-open-info');
    if (openInfoBtn) {
      openInfoBtn.addEventListener('click', () => {
        infoModalAberta = true;
        infoModalEntrando = true;
        paint();
      });
    }

    const closeInfoBtn = app.querySelector('#v2-info-close');
    const infoBackdrop = app.querySelector('#v2-info-backdrop');
    if (closeInfoBtn) {
      closeInfoBtn.addEventListener('click', () => {
        infoModalAberta = false;
        infoModalEntrando = false;
        paint();
      });
    }
    if (infoBackdrop) {
      infoBackdrop.addEventListener('click', e => {
        if (e.target === infoBackdrop) {
          infoModalAberta = false;
          paint();
        }
      });
      infoBackdrop.addEventListener('touchmove', e => {
        if (e.target === infoBackdrop) e.preventDefault();
      }, { passive: false });
    }

    // 4. Abertura do Modal de Produto OU Adição Direta na Sacola para itens simples (ex: água, refri lata)
    app.querySelectorAll('[data-open-product]').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('button') && !e.target.closest('[data-open-product]')) return;
        const pId = el.dataset.openProduct;
        const p = product(pId);
        if (!p || p.esgotado) return;

        const temOpcoes = p.combo?.ativo || (p.grupos && p.grupos.length > 0);
        if (!temOpcoes) {
          const itemExistente = cart.find(line => line.produtoId === p.id && line.variante !== 'combo' && (!line.opcoes || !line.opcoes.length) && !line.observacao);
          if (itemExistente) {
            itemExistente.quantidade++;
          } else {
            const line = {
              linhaId: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
              produtoId: p.id,
              quantidade: 1,
              observacao: '',
              opcoes: [],
              variante: 'individual'
            };
            line.precoEsperadoCentavos = unit(line);
            cart.push(line);
          }
          localStorage.setItem(key('carrinho', modalidadeSacola), JSON.stringify(cart));
          quote = null;
          paint();
          showToast(`Adicionou ${p.nome} no carrinho`, 'success');
          return;
        }

        produtoModal = p;
        produtoModalEntrando = true;
        modalEstado = {
          variante: p.combo?.ativo ? 'combo' : 'individual',
          bebidaId: p.combo?.bebidas?.[0]?.produtoId || '',
          opcoes: [],
          quantidade: 1,
          observacao: ''
        };
        paint();
      });
    });

    // 5. Fechamento do Modal de Produto
    const modalClose = app.querySelector('#v2-modal-close');
    const modalBackdrop = app.querySelector('#v2-modal-backdrop');
    if (modalClose) {
      modalClose.addEventListener('click', fecharModal);
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', e => {
        if (e.target === modalBackdrop) fecharModal();
      });
      modalBackdrop.addEventListener('touchmove', e => {
        if (e.target === modalBackdrop) e.preventDefault();
      }, { passive: false });
    }

    function fecharModal() {
      produtoModal = null;
      produtoModalEntrando = false;
      paint();
    }

    // 6. Interações no Modal de Produto
    if (produtoModal) {
      app.querySelectorAll('[data-set-variant]').forEach(btn => {
        btn.addEventListener('click', () => {
          modalEstado.variante = btn.dataset.setVariant;
          paint();
        });
      });

      const selectBebida = app.querySelector('#v2-combo-bebida');
      if (selectBebida) {
        selectBebida.addEventListener('change', () => {
          modalEstado.bebidaId = selectBebida.value;
          paint();
        });
      }

      app.querySelectorAll('[data-step-opt]').forEach(btn => {
        btn.addEventListener('click', () => {
          const delta = Number(btn.dataset.stepOpt);
          const gId = btn.dataset.groupId;
          const oId = btn.dataset.optId;
          const g = produtoModal.grupos?.find(x => x.id === gId);
          const opt = g?.opcoes?.find(x => x.id === oId);
          if (!g || !opt) return;

          let item = modalEstado.opcoes.find(x => x.grupoId === gId && x.opcaoId === oId);
          if (!item) {
            item = { grupoId: gId, opcaoId: oId, quantidade: 0 };
            modalEstado.opcoes.push(item);
          }

          const novoValor = Math.max(0, item.quantidade + delta);
          if (opt.maxQuantidade && novoValor > opt.maxQuantidade) return;
          item.quantidade = novoValor;
          modalEstado.opcoes = modalEstado.opcoes.filter(x => x.quantidade > 0);
          paint();
        });
      });

      const decBtn = app.querySelector('#v2-modal-qty-dec');
      const incBtn = app.querySelector('#v2-modal-qty-inc');
      if (decBtn) {
        decBtn.addEventListener('click', () => {
          if (modalEstado.quantidade > 1) {
            modalEstado.quantidade--;
            paint();
          }
        });
      }
      if (incBtn) {
        incBtn.addEventListener('click', () => {
          if (modalEstado.quantidade < 99) {
            modalEstado.quantidade++;
            paint();
          }
        });
      }

      const obsInput = app.querySelector('#v2-modal-obs');
      if (obsInput) {
        obsInput.addEventListener('input', () => {
          modalEstado.observacao = obsInput.value;
        });
      }

      const addBtn = app.querySelector('#v2-modal-add');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          const validacao = validarModal(produtoModal);
          if (!validacao.valido) {
            showToast(validacao.msg, 'error');
            return;
          }

          const line = {
            linhaId: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
            produtoId: produtoModal.id,
            quantidade: modalEstado.quantidade,
            observacao: modalEstado.observacao.trim(),
            opcoes: modalEstado.opcoes.slice(),
            variante: modalEstado.variante,
            ...(modalEstado.variante === 'combo' ? { bebidaId: modalEstado.bebidaId } : {})
          };
          line.precoEsperadoCentavos = unit(line);
          
          cart.push(line);
          localStorage.setItem(key('carrinho', modalidadeSacola), JSON.stringify(cart));
          quote = null;
          const nomeAdicionado = produtoModal.nome;
          produtoModal = null;
          document.body.classList.remove('v2-modal-open');
          paint();
          showToast(`Adicionou ${nomeAdicionado} no carrinho`, 'success');
        });
      }
    }

    // 7. Abertura e Fechamento da Sacola (Modal de Checkout)
    const floatingCart = app.querySelector('#v2-floating-cart');
    if (floatingCart) {
      floatingCart.addEventListener('click', () => {
        carrinhoAberto = true;
        carrinhoEntrando = true;
        confirmandoLimparCarrinho = false;
        paint();
      });
    }

    const cartClose = app.querySelector('#v2-cart-close');
    const cartBackdrop = app.querySelector('#v2-cart-backdrop');
    if (cartClose) {
      cartClose.addEventListener('click', fecharSacola);
    }
    if (cartBackdrop) {
      cartBackdrop.addEventListener('click', e => {
        if (e.target === cartBackdrop) fecharSacola();
      });
      cartBackdrop.addEventListener('touchmove', e => {
        if (e.target === cartBackdrop) e.preventDefault();
      }, { passive: false });
    }

    function fecharSacola() {
      carrinhoAberto = false;
      carrinhoEntrando = false;
      confirmandoLimparCarrinho = false;
      paint();
    }

    // Botão Limpar Carrinho e Barra de Confirmação Segura (in-place sem re-render)
    function toggleConfirmacaoLimpar(mostrar) {
      confirmandoLimparCarrinho = mostrar;
      const cartBody = app.querySelector('.v2-cart-body');
      if (!cartBody) return;

      const confirmBarExistente = cartBody.querySelector('#v2-cart-confirm-bar');
      if (mostrar) {
        if (!confirmBarExistente) {
          const totalQtd = cart.reduce((s, i) => s + i.quantidade, 0);
          const barDiv = document.createElement('div');
          barDiv.className = 'v2-cart-confirm-bar';
          barDiv.id = 'v2-cart-confirm-bar';
          barDiv.innerHTML = `
            <div class="v2-cart-confirm-info">
              <div class="v2-cart-confirm-badge">${ico.trash}</div>
              <div>
                <strong class="v2-cart-confirm-title">Deseja limpar todos os itens?</strong>
                <p class="v2-cart-confirm-desc">Os ${totalQtd} produtos adicionados serão removidos da sua sacola.</p>
              </div>
            </div>
            <div class="v2-cart-confirm-btns">
              <button type="button" class="v2-cart-confirm-btn v2-cart-confirm-btn--cancel" id="v2-clear-cancel">Cancelar</button>
              <button type="button" class="v2-cart-confirm-btn v2-cart-confirm-btn--danger" id="v2-clear-confirm">Sim, esvaziar</button>
            </div>
          `;
          cartBody.prepend(barDiv);
          cartBody.scrollTo({ top: 0, behavior: 'smooth' });

          barDiv.querySelector('#v2-clear-cancel').addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            toggleConfirmacaoLimpar(false);
          });

          barDiv.querySelector('#v2-clear-confirm').addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            executarLimpezaCarrinho();
          });
        }
      } else {
        if (confirmBarExistente) {
          confirmBarExistente.remove();
        }
      }
    }

    function executarLimpezaCarrinho() {
      confirmandoLimparCarrinho = false;
      cart = [];
      localStorage.removeItem(key('carrinho', 'retirada'));
      localStorage.removeItem(key('carrinho', 'delivery'));
      localStorage.removeItem(key('carrinho', modalidadeSacola));
      quote = null;

      const cartModal = app.querySelector('.v2-cart-modal');
      if (cartModal) {
        const titleEl = cartModal.querySelector('#v2-cart-title');
        if (titleEl) titleEl.textContent = 'Revisando Pedido (0)';

        const clearBtn = cartModal.querySelector('#v2-cart-clear');
        if (clearBtn) clearBtn.remove();

        const cartBody = cartModal.querySelector('.v2-cart-body');
        if (cartBody) {
          cartBody.innerHTML = `
            <div style="text-align: center; padding: 48px 16px; color: var(--v2-text-muted);">
              <div style="width: 52px; height: 52px; margin: 0 auto 12px; color: var(--v2-text-dim); display:flex; align-items:center; justify-content:center;">${ico.bag}</div>
              <h3 style="margin: 0 0 6px; color: var(--v2-text); font-size: 17px;">Sua sacola está vazia</h3>
              <p style="font-size: 13px; margin: 0;">Escolha um produto e personalize do seu jeito!</p>
            </div>
          `;
        }

        const cartFooter = cartModal.querySelector('.v2-cart-footer');
        if (cartFooter) cartFooter.remove();
      }

      const floatingBar = app.querySelector('#v2-floating-cart');
      if (floatingBar) {
        floatingBar.classList.remove('is-visible');
        const countBadge = floatingBar.querySelector('.v2-cart-count-badge');
        if (countBadge) countBadge.textContent = '0';
        const totalTxt = floatingBar.querySelector('.v2-cart-total-txt');
        if (totalTxt) totalTxt.textContent = money(0);
      }

      showToast('Sacola esvaziada com sucesso!', 'info');
    }

    const clearCartBtn = app.querySelector('#v2-cart-clear');
    if (clearCartBtn) {
      clearCartBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggleConfirmacaoLimpar(true);
      });
    }

    const clearCancelBtn = app.querySelector('#v2-clear-cancel');
    if (clearCancelBtn) {
      clearCancelBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggleConfirmacaoLimpar(false);
      });
    }

    const clearConfirmBtn = app.querySelector('#v2-clear-confirm');
    if (clearConfirmBtn) {
      clearConfirmBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        executarLimpezaCarrinho();
      });
    }

    // Botões de navegação no Carrossel Mais Pedidos nos cantos
    const carouselEl = app.querySelector('#v2-bestsellers-carousel');
    const carouselPrev = app.querySelector('#v2-carousel-prev');
    const carouselNext = app.querySelector('#v2-carousel-next');

    if (carouselEl && carouselPrev && carouselNext) {
      const checkArrows = () => {
        const maxScroll = carouselEl.scrollWidth - carouselEl.clientWidth - 10;
        carouselPrev.classList.toggle('is-hidden', carouselEl.scrollLeft <= 10);
        carouselNext.classList.toggle('is-hidden', carouselEl.scrollLeft >= maxScroll);
      };

      carouselPrev.addEventListener('click', e => {
        e.stopPropagation();
        carouselEl.scrollBy({ left: -320, behavior: 'smooth' });
      });

      carouselNext.addEventListener('click', e => {
        e.stopPropagation();
        carouselEl.scrollBy({ left: 320, behavior: 'smooth' });
      });

      carouselEl.addEventListener('scroll', checkArrows, { passive: true });
      requestAnimationFrame(checkArrows);
    }

    // Alternar Modalidade na Sacola (Delivery vs Retirada)
    app.querySelectorAll('[data-set-sacola-modalidade]').forEach(btn => {
      btn.addEventListener('click', () => {
        modalidadeSacola = btn.dataset.setSacolaModalidade;
        quote = null;
        paint();
      });
    });

    // Controles dentro da Sacola (+, -, remover)
    app.querySelectorAll('[data-cart-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        const delta = Number(btn.dataset.cartStep);
        if (isNaN(idx) || !cart[idx]) return;

        if (delta === -1 && cart[idx].quantidade <= 1) {
          cart.splice(idx, 1);
        } else {
          cart[idx].quantidade += delta;
        }

        localStorage.setItem(key('carrinho', modalidadeSacola), JSON.stringify(cart));
        quote = null;
        if (cart.length === 0) {
          executarLimpezaCarrinho();
        } else {
          paint();
        }
      });
    });

    app.querySelectorAll('[data-cart-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.cartRemove);
        if (isNaN(idx) || !cart[idx]) return;
        cart.splice(idx, 1);
        localStorage.setItem(key('carrinho', modalidadeSacola), JSON.stringify(cart));
        quote = null;
        if (cart.length === 0) {
          executarLimpezaCarrinho();
        } else {
          paint();
        }
      });
    });

    // 8. Formulários de Atendimento (Entrega e Retirada)
    const formEntrega = app.querySelector('#v2-delivery-fields');
    if (formEntrega) {
      formEntrega.addEventListener('input', e => {
        if (busy || read('pendente', 'delivery')) return;
        if (e.target.name === 'cep') {
          let digits = e.target.value.replace(/\D/g, '');
          if (digits.length > 5) {
            e.target.value = digits.slice(0, 5) + '-' + digits.slice(5, 8);
          }
          deliveryData.cep = e.target.value;
          if (digits.length === 8) {
            consultarViaCep(digits);
          }
        } else if (e.target.name !== 'telefone') {
          deliveryData[e.target.name] = e.target.value;
        }
      });
    }

    const telEntrega = app.querySelector('#v2-telefone');
    if (telEntrega) {
      mascaraTelefone(telEntrega, val => {
        deliveryData.telefone = val;
      });
    }

    const pickupNome = app.querySelector('#v2-pickup-nome');
    const pickupTel = app.querySelector('#v2-pickup-tel');
    if (pickupNome) {
      pickupNome.addEventListener('input', () => {
        pickupData.nome = pickupNome.value;
      });
    }
    if (pickupTel) {
      mascaraTelefone(pickupTel, val => {
        pickupData.telefone = val;
      });
    }

    // 9. Envio do Pedido (Validação com mensagens ao clicar)
    const sendBtn = app.querySelector('#v2-send');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        action(async () => {
          if (!cart.length) {
            showToast('Sua sacola está vazia!', 'error');
            return;
          }
          const isDelivery = modalidadeSacola === 'delivery';
          if (!isDelivery) {
            const nome = (pickupData.nome || '').trim();
            if (nome.length < 2) {
              showToast('Por favor, informe seu nome para a retirada.', 'error');
              app.querySelector('#v2-pickup-nome')?.focus();
              return;
            }
            const telDigits = String(pickupData.telefone || '').replace(/\D/g, '');
            if (telDigits.length < 10 || telDigits.length > 11) {
              showToast('Por favor, informe um WhatsApp válido com DDD (Ex.: 11 99999-9999).', 'error');
              app.querySelector('#v2-pickup-tel')?.focus();
              return;
            }
          } else {
            const nome = (deliveryData.nome || '').trim();
            if (nome.length < 2) {
              showToast('Por favor, informe seu nome para entrega.', 'error');
              app.querySelector('#v2-nome')?.focus();
              return;
            }
            const telDigits = String(deliveryData.telefone || '').replace(/\D/g, '');
            if (telDigits.length < 10 || telDigits.length > 11) {
              showToast('Por favor, informe um WhatsApp válido com DDD (Ex.: 11 99999-9999).', 'error');
              app.querySelector('#v2-telefone')?.focus();
              return;
            }
            const cepLimpo = String(deliveryData.cep || '').replace(/\D/g, '');
            if (cepLimpo.length !== 8) {
              showToast('Por favor, informe um CEP válido com 8 números.', 'error');
              app.querySelector('#v2-cep')?.focus();
              return;
            }
            if (!deliveryData.logradouro?.trim()) {
              showToast('Por favor, informe a rua ou avenida para entrega.', 'error');
              app.querySelector('#v2-logradouro')?.focus();
              return;
            }
            if (!deliveryData.numero?.trim()) {
              showToast('Por favor, informe o número da residência.', 'error');
              app.querySelector('#v2-numero')?.focus();
              return;
            }
            if (!quote && !read('pendente', 'delivery')) {
              showToast('Calculando taxa de entrega...', 'info');
              await consultarViaCep(cepLimpo);
              if (!quote) {
                throw new Error('Não foi possível calcular o frete para este endereço.');
              }
            }
          }

          await revisarPrecos();
          status('Enviando seu pedido ao restaurante...');
          confirmed = await (atendimento?.enviar || enviarV2)(scopeParaTipo(modalidadeSacola), {
            slug,
            tipo: mesaId ? 'mesa' : modalidadeSacola,
            mesaId: mesaId || null,
            catalogoVersao: catalog.versao,
            itens: cart,
            ...(isDelivery ? { entrega: deliveryData, cotacao: quote } : { contato: pickupData })
          });
          cart = [];
          deliveryData = {};
          pickupData = {};
          quote = null;
          carrinhoAberto = false;
          document.body.classList.remove('v2-modal-open');
          paint();
          beginTracking();
          showToast('Pedido enviado com sucesso!', 'success');
        });
      });
    }

    // Se já tiver pedido confirmado, exibe o painel de status
    if (confirmed) showOrder(confirmed);
  }

  function showOrder(order) {
    const isDelivery = order.tipo === 'delivery';
    const isCancelado = order.status === 'cancelado';
    
    // Configuração dos 4 passos da esteira
    const steps = isDelivery ? [
      { key: 'novo', title: 'Recebido', subtitle: 'Pela cozinha', icon: ico.checkCircle },
      { key: 'em_preparo', title: 'Na Cozinha', subtitle: 'Em preparo', icon: ico.food },
      { key: 'saiu_entrega', title: 'A Caminho', subtitle: 'Com motoboy', icon: ico.motorcycle },
      { key: 'entregue', title: 'Entregue', subtitle: 'Concluído', icon: ico.check }
    ] : [
      { key: 'novo', title: 'Recebido', subtitle: 'Pela cozinha', icon: ico.checkCircle },
      { key: 'em_preparo', title: 'Na Cozinha', subtitle: 'Em preparo', icon: ico.food },
      { key: 'pronto', title: 'No Balcão', subtitle: 'Pronto p/ retirar', icon: ico.store },
      { key: 'entregue', title: 'Entregue', subtitle: 'Concluído', icon: ico.check }
    ];

    let activeStepIdx = 0;
    if (order.status === 'em_preparo') {
      activeStepIdx = 1;
    } else if (order.status === 'pronto') {
      activeStepIdx = 2;
    } else if (order.status === 'saiu_entrega') {
      activeStepIdx = 2;
    } else if (order.status === 'entregue') {
      activeStepIdx = 3;
    }

    const progressPercent = activeStepIdx === 0 ? 12 : activeStepIdx === 1 ? 40 : activeStepIdx === 2 ? 72 : 100;

    let headlineTitle = 'Pedido Recebido!';
    let headlineDesc = 'A cozinha já recebeu seu pedido e vai iniciar o preparo em instantes.';
    let headlineIcon = '👨‍🍳';

    if (order.status === 'em_preparo') {
      headlineTitle = 'Seu pedido está na cozinha!';
      headlineDesc = 'O restaurante está preparando tudo com todo o carinho e cuidado.';
      headlineIcon = '🔥';
    } else if (order.status === 'pronto') {
      if (isDelivery) {
        headlineTitle = 'Pedido embalado e pronto!';
        headlineDesc = 'Finalizado na cozinha e aguardando a saída com o entregador.';
        headlineIcon = '📦';
      } else {
        headlineTitle = 'Pronto para Retirada no Balcão!';
        headlineDesc = 'Seu pedido já está quentinho te esperando na loja. Pode vir retirar!';
        headlineIcon = '🛍️';
      }
    } else if (order.status === 'saiu_entrega') {
      headlineTitle = 'Saiu para Entrega!';
      headlineDesc = 'O entregador já está a caminho com seu pedido. Fique de olho na campainha ou interfone!';
      headlineIcon = '🛵';
    } else if (order.status === 'entregue') {
      headlineTitle = 'Pedido Entregue com Sucesso!';
      headlineDesc = 'Aproveite a sua refeição e bom apetite! Obrigado pela preferência.';
      headlineIcon = '🎉';
    } else if (isCancelado) {
      headlineTitle = 'Pedido Cancelado';
      headlineDesc = 'Este pedido foi cancelado pelo estabelecimento. Fale conosco no botão abaixo.';
      headlineIcon = '❌';
    }

    const telRaw = catalog?.whatsapp || catalog?.telefone || catalog?.contato?.telefone;
    const telDigitos = String(telRaw || '').replace(/\D/g, '');
    const waMsg = encodeURIComponent(`Olá! Fiz o pedido #${order.pedidoId.slice(-6).toUpperCase()} no cardápio digital e gostaria de acompanhar.`);
    const waLink = telDigitos.length >= 10 ? `https://wa.me/55${telDigitos}?text=${waMsg}` : '';

    const panel = app.querySelector('#v2-confirmation');
    if (!panel) return;

    panel.innerHTML = `
      <section class="v2-tracker-card">
        <!-- Cabeçalho de Status em Tempo Real -->
        <div class="v2-tracker-header">
          <div class="v2-tracker-status-top">
            <div class="v2-tracker-live-pill">
              <span class="v2-tracker-live-dot"></span>
              <span id="v2-tracking-state">Acompanhamento em tempo real</span>
            </div>
            <span class="v2-tracker-order-id">#${esc(order.pedidoId.slice(-6).toUpperCase())}</span>
          </div>

          <div class="v2-tracker-headline-box">
            <div class="v2-tracker-headline-icon">${headlineIcon}</div>
            <div>
              <h2 class="v2-tracker-headline-title">${headlineTitle}</h2>
              <p class="v2-tracker-headline-desc">${headlineDesc}</p>
            </div>
          </div>

          ${isDelivery && order.prazoMinutos ? `
            <div class="v2-tracker-eta-badge">
              ${ico.clock}
              <span>Previsão de entrega: <strong>~${order.prazoMinutos} minutos</strong></span>
            </div>
          ` : ''}
        </div>

        <!-- Esteira Visual com 4 Etapas (Pipeline) -->
        ${isCancelado ? `
          <div class="v2-tracker-cancelled-box">
            <div class="v2-tracker-cancelled-icon">⚠️</div>
            <div class="v2-tracker-cancelled-text">
              <strong>Atenção: Pedido Cancelado</strong>
              <p>O restaurante precisou cancelar este pedido. Por favor, chame no WhatsApp para esclarecimentos.</p>
            </div>
          </div>
        ` : `
          <div class="v2-stepper-wrap">
            <div class="v2-stepper-track-bg">
              <div class="v2-stepper-track-fill" style="width: ${progressPercent}%;"></div>
            </div>
            <div class="v2-stepper-nodes">
              ${steps.map((st, idx) => `
                <div class="v2-stepper-node ${idx < activeStepIdx ? 'is-done' : ''} ${idx === activeStepIdx ? 'is-active' : ''}">
                  <div class="v2-stepper-circle">
                    ${idx < activeStepIdx ? ico.check : st.icon}
                  </div>
                  <span class="v2-stepper-title">${st.title}</span>
                  <span class="v2-stepper-subtitle">${st.subtitle}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `}

        <!-- Botão Direto para Falar com o Restaurante via WhatsApp -->
        ${waLink ? `
          <a href="${waLink}" target="_blank" rel="noopener" class="v2-tracker-wa-card">
            <div class="v2-tracker-wa-icon">${ico.wa}</div>
            <div class="v2-tracker-wa-body">
              <strong>Falar com o Restaurante</strong>
              <span>Tirar dúvidas ou acompanhar pelo WhatsApp</span>
            </div>
            <span class="v2-tracker-wa-arrow">→</span>
          </a>
        ` : ''}

        <!-- Detalhes e Resumo do Pedido -->
        <div class="v2-tracker-details">
          <div class="v2-tracker-details-header">
            <div class="v2-tracker-details-title">
              ${ico.orders} <span>Itens do Pedido</span>
            </div>
            <span class="v2-tracker-modalidade-badge ${isDelivery ? 'delivery' : 'retirada'}">
              ${isDelivery ? `${ico.motorcycle} Entrega` : `${ico.store} Retirada no balcão`}
            </span>
          </div>

          <div class="v2-tracker-items-list">
            ${order.itens.map(line => `
              <div class="v2-tracker-item-row">
                <div class="v2-tracker-item-info">
                  <span class="v2-tracker-item-qty">${line.quantidade}×</span>
                  <div>
                    <strong class="v2-tracker-item-name">${esc(line.nome)}</strong>
                    ${line.opcoes?.length ? `
                      <div class="v2-tracker-item-sub">
                        ${line.opcoes.map(o => esc(o.nome)).join(', ')}
                      </div>
                    ` : ''}
                    ${line.componentes?.length ? `
                      <div class="v2-tracker-item-sub">
                        ${line.componentes.map(c => esc(c.nome)).join(' + ')}
                      </div>
                    ` : ''}
                  </div>
                </div>
                <span class="v2-tracker-item-price">${money(line.totalCentavos)}</span>
              </div>
            `).join('')}
          </div>

          <div class="v2-tracker-totals">
            ${isDelivery ? `
              <div class="v2-tracker-total-line">
                <span>Subtotal dos itens</span>
                <span>${money(order.subtotalCentavos || (order.totalCentavos - (order.taxaEntregaCentavos || 0)))}</span>
              </div>
              <div class="v2-tracker-total-line">
                <span>Taxa de entrega</span>
                <span>${order.taxaEntregaCentavos ? money(order.taxaEntregaCentavos) : 'Grátis'}</span>
              </div>
            ` : ''}
            <div class="v2-tracker-total-line total">
              <span>Total</span>
              <span class="v2-tracker-grand-total">${money(order.totalCentavos)}</span>
            </div>
            <div class="v2-tracker-payment-badge">
              ${order.pagamento === 'pago' ? '✅ Pagamento Confirmado' : '💳 Pagamento na Entrega / Retirada'}
            </div>
          </div>
        </div>

        <!-- Botão Novo Pedido -->
        <button type="button" id="v2-new" class="v2-tracker-btn-reset">
          ${ico.bag} <span>Fazer outro pedido</span>
        </button>
      </section>
    `;

    app.querySelector('#v2-new')?.addEventListener('click', () => {
      if (busy) return;
      stopTracking();
      localStorage.removeItem(key('confirmado', modalidadeSacola));
      confirmed = null;
      paint();
    });
  }

  function beginTracking() {
    stopTracking();
    const token = confirmed?.acompanhamentoToken;
    if (!token || disposed) return;
    stopTracking = iniciarAcompanhamento({
      consultar: () => acompanharV2(token),
      atualizar: current => {
        if (disposed || confirmed?.acompanhamentoToken !== token) return;
        confirmed = { ...current, acompanhamentoToken: token };
        localStorage.setItem(key('confirmado', modalidadeSacola), JSON.stringify(confirmed));
        showOrder(confirmed);
        const node = app.querySelector('#v2-tracking-state');
        if (node) node.textContent = 'Situação atualizada em tempo real.';
      },
      erro: () => {
        const node = app.querySelector('#v2-tracking-state');
        if (node) node.textContent = 'Sem atualização no momento. Exibindo a última confirmação recebida.';
      }
    });
  }

  // Fechar qualquer modal aberto com a tecla ESC
  const onKeyDownEsc = e => {
    if (e.key === 'Escape') {
      if (infoModalAberta) {
        infoModalAberta = false;
        paint();
      } else if (produtoModal) {
        produtoModal = null;
        document.body.classList.remove('v2-modal-open');
        paint();
      } else if (carrinhoAberto) {
        carrinhoAberto = false;
        document.body.classList.remove('v2-modal-open');
        paint();
      }
    }
  };
  window.addEventListener('keydown', onKeyDownEsc);

  paint();
  if (confirmed) beginTracking();
  return () => {
    disposed = true;
    document.documentElement.classList.remove('v2-modal-open');
    document.body.classList.remove('v2-modal-open');
    stopTracking();
    window.removeEventListener('keydown', onKeyDownEsc);
  };
}
