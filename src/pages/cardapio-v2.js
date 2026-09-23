import { catalogoV2, enviarV2, acompanharV2, cotarV2 } from '../lib/v2.js';
import { esc, brl } from '../lib/format.js';
import './cardapio-v2.css';
import { iniciarAcompanhamento } from '../lib/acompanhamento-v2.js';

export async function renderCardapioV2(app, atendimento = null) {
  document.body.className = "is-cardapio-v2";
  const parts = atendimento ? ['', atendimento.slug, atendimento.mesaId, null] : location.pathname.match(/^\/v2\/([a-z0-9-]+)(?:\/mesa\/([A-Za-z0-9_-]+)|\/(delivery))?\/?$/);
  if (!parts) { app.textContent = 'Endereço do cardápio inválido.'; return; }
  const [, slug, mesaId, deliveryRoute] = parts, delivery = !!deliveryRoute, scope = `${atendimento?.prefixo || ''}${slug}:${mesaId || (delivery ? 'delivery' : 'retirada')}`;
  const key = type => `v2:${type}:${scope}`;
  let disposed = false, stopTracking = () => {}, busy = false, catalog, cart, confirmed;
  let deliveryData = {}, quote = null, categoria = '';
  const produtosOrdenados = () => catalog.produtos.filter(p=>p.ativo).sort((a,b)=>(a.ordem||0)-(b.ordem||0)||a.nome.localeCompare(b.nome,'pt-BR'));
  const foto = p => typeof p.imagemUrl==='string' && /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\//.test(p.imagemUrl) ? `<img src="${esc(p.imagemUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" width="640" height="360" style="max-width:100%;height:auto;max-height:180px;object-fit:contain">` : '';
  const read = type => JSON.parse(localStorage.getItem(key(type)) || 'null');
  const money = value => brl(value / 100);
  app.innerHTML = '<main class="v2-menu"><p>Carregando cardápio…</p></main>';
  try {
    cart = read('carrinho') || []; confirmed = read('confirmado');
    try { catalog = atendimento?.catalogo || await catalogoV2(slug); }
    catch (error) {
      if (!confirmed && !read('pendente')) throw error;
      catalog = { produtos: [], publicado: false, pausado: true, versao: read('pendente')?.body?.catalogoVersao || 0 };
    }
  }
  catch (error) { app.innerHTML = `<main class="v2-menu"><h1>Cardápio indisponível</h1><p>${esc(error.message)}</p><button onclick="location.reload()">Tentar novamente</button></main>`; return; }
  function status(text, error = false) {
    const node = app.querySelector('#v2-message'); if (!node) return;
    node.textContent = text; node.dataset.error = String(error);
  }
  function product(id) { return catalog.produtos.find(p => p.id === id); }
  function unit(line) {
    const p = product(line.produtoId); if (!p || !p.ativo || p.esgotado) return null;
    let total = p.precoCentavos;
    for (const o of line.opcoes) { const option = p.grupos.find(g => g.id === o.grupoId)?.opcoes.find(x => x.id === o.opcaoId && x.ativo); if (!option) return null; total += option.precoCentavos * o.quantidade; }
    return total;
  }
  async function action(fn) {
    if (busy) return; busy = true; app.dataset.busy = 'true';
    app.querySelectorAll('button').forEach(b => b.disabled = true);
    const fields = app.querySelector('#v2-delivery-fields'); if (fields) fields.disabled = true;
    try { await fn(); } catch (error) { if (delivery && !read('pendente')) quote = null; paint(); status(error.message || 'Não foi possível concluir. Tente novamente para recuperar o mesmo envio.', true); }
    finally { busy = false; app.dataset.busy = 'false'; app.querySelectorAll('button[data-enabled="true"]').forEach(b => b.disabled = false); const fields = app.querySelector('#v2-delivery-fields'); if(fields) fields.disabled = !!read('pendente'); }
  }
  function deliveryForm(pending, paused) {
    const fields = [
      ['nome','Nome de quem recebe','name',80],['telefone','Telefone com DDD','tel-national',25],['cep','CEP','postal-code',9],
      ['logradouro','Rua ou avenida','address-line1',120],['numero','Número (ou s/n)','off',20],['complemento','Complemento (opcional)','address-line2',120],
      ['bairro','Bairro','address-level3',80],['cidade','Cidade','address-level2',80],['uf','UF','address-level1',2]
    ];
    const data = pending?.body?.entrega || deliveryData;
    return `<form id="v2-delivery-form"><fieldset id="v2-delivery-fields" ${pending ? 'disabled' : ''}><legend>Onde vamos entregar?</legend><div class="v2-address-grid">${fields.map(([name,label,autocomplete,max])=>`<label for="v2-${name}">${label}<input id="v2-${name}" name="${name}" maxlength="${max}" autocomplete="${autocomplete}" ${name==='telefone'?'type="tel" inputmode="tel"':name==='cep'?'inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}"':''} ${name==='complemento'?'':'required'} value="${esc(data[name] || '')}"></label>`).join('')}</div></fieldset><button id="v2-quote" data-enabled="${!pending && !paused && !!cart.length}" ${pending || paused || !cart.length ? 'disabled' : ''}>Calcular entrega</button></form>
      <div id="v2-quote-summary" role="status" aria-live="polite">${quote ? `<p>Entrega: ${money(quote.taxaEntregaCentavos)}</p><p>Prazo estimado: ${quote.prazoMinutos} minutos</p><p class="v2-grand-total">Total com entrega: ${money(quote.totalCentavos)}</p><p>Confira o endereço e o total antes de confirmar.</p>` : '<p>Preencha o endereço e calcule a entrega antes de confirmar.</p>'}</div>`;
  }
  function paint() {
    if (disposed) return;
    const pending = read('pendente');
    const paused = catalog.pausado || (delivery ? catalog.canais?.delivery !== true : catalog.canais && (mesaId ? !catalog.canais.mesas : !catalog.canais.retirada));
    app.innerHTML = `<main class="v2-menu"><header class="v2-store-head"><img class="v2-brand" src="/logos/FlowPDV-horizontal-claro.png" alt="FlowPDV"><p class="v2-environment">Ambiente de teste</p><h1>${esc(catalog.nome || 'Cardápio')}</h1>${catalog.contato?.endereco ? `<p class="v2-store-contact">${esc(catalog.contato.endereco)}</p>` : ''}${/^[0-9]{10,15}$/.test(catalog.contato?.telefone || '') ? `<a class="v2-store-contact" href="tel:${catalog.contato.telefone}">Telefone: ${esc(catalog.contato.telefone)}</a>` : ''}<p>${mesaId ? 'Pedido na mesa' : delivery ? 'Entrega no seu endereço' : 'Retirada no balcão'}</p>${!mesaId && !pending && !confirmed ? `<nav aria-label="Forma de receber">${catalog.canais?.retirada !== false ? `<a href="/v2/${esc(slug)}" ${!delivery?'aria-current="page"':''}>Retirada</a>` : ''}${catalog.canais?.delivery ? `<a href="/v2/${esc(slug)}/delivery" ${delivery?'aria-current="page"':''}>Delivery</a>` : ''}</nav>` : ''}</header>
      <p id="v2-message" role="status" aria-live="polite">${confirmed ? 'Pedido confirmado. Acompanhe o andamento abaixo.' : pending ? 'Há um envio sem confirmação. Consulte o resultado antes de montar outro pedido.' : paused ? 'Este canal está pausado para novos pedidos. Você pode consultar um envio pendente.' : 'Escolha seus produtos e adicionais.'}</p>
      <div id="v2-confirmation"></div>
      ${confirmed ? '' : `<div class="v2-columns"><section><h2>Cardápio</h2><label for="v2-category">Categoria</label><select id="v2-category"><option value="">Todas as categorias</option>${[...new Set(catalog.produtos.filter(p=>p.ativo).map(p=>p.categoria||'Outros'))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(c=>`<option value="${esc(c)}" ${categoria===c?'selected':''}>${esc(c)}</option>`).join('')}</select>${produtosOrdenados().map(p => `<form class="v2-product" data-product="${esc(p.id)}" data-category="${esc(p.categoria||'Outros')}" ${categoria&&categoria!==(p.categoria||'Outros')?'hidden':''}>${foto(p)}<h3>${esc(p.nome)}</h3>${p.descricao?`<p>${esc(p.descricao)}</p>`:''}<strong>${money(p.precoCentavos)}</strong>
        ${p.esgotado ? '<p class="v2-soldout">Indisponível</p>' : `<details class="v2-customize"><summary>Escolher produto <span aria-hidden="true">+</span></summary>${(p.grupos || []).map(g => `<fieldset><legend>${esc(g.nome)} • escolha de ${g.min} a ${g.max}</legend>${g.opcoes.filter(o => o.ativo).map(o => `<label>${esc(o.nome)} (${money(o.precoCentavos)})<input type="number" data-group="${esc(g.id)}" data-option="${esc(o.id)}" min="0" max="${o.maxQuantidade || 1}" value="0" aria-label="Quantidade de ${esc(o.nome)}"></label>`).join('')}</fieldset>`).join('')}
        <label>Quantidade<input name="quantidade" type="number" min="1" max="99" value="1" required></label><label>Observação<input name="observacao" maxlength="180" placeholder="Ex.: sem cebola"></label>
        <button data-enabled="${!pending && !paused}" ${pending || paused ? 'disabled' : ''}>Adicionar ao pedido</button></details>`}</form>`).join('')}</section>
        <aside><h2>Seu pedido</h2>${cart.length ? "" : '<p class="v2-cart-empty">Seu pedido começa aqui. Escolha um produto e personalize do seu jeito.</p>'}${cart.map((line, i) => `<article><strong>${line.quantidade}× ${esc(product(line.produtoId)?.nome || 'Produto indisponível')}</strong><p>${unit(line) === null ? 'Revise este item' : money(unit(line) * line.quantidade)}</p><p>${esc(line.observacao)}</p>${line.opcoes.map(o => `<small>${o.quantidade}× ${esc(product(line.produtoId)?.grupos.find(g => g.id === o.grupoId)?.opcoes.find(x => x.id === o.opcaoId)?.nome || 'Opção indisponível')}</small>`).join('')}<button data-remove="${i}" data-enabled="${!pending}" ${pending ? 'disabled' : ''}>Remover</button></article>`).join('')}
        <p><strong>${delivery?'Produtos':'Total'}: ${money(cart.reduce((sum, line) => sum + (unit(line) || 0) * line.quantidade, 0))}</strong></p>
        ${delivery ? deliveryForm(pending, paused) : ''}
        <button id="v2-send" data-enabled="${!!pending || (!!cart.length && !paused && cart.every(l => unit(l) !== null) && (!delivery || !!quote))}" ${!pending && (!cart.length || paused || cart.some(l => unit(l) === null) || (delivery && !quote)) ? 'disabled' : ''}>${pending ? 'Consultar envio pendente' : delivery ? 'Confirmar pedido de delivery' : 'Enviar pedido'}</button>
        <button id="v2-refresh" data-enabled="${!pending}" ${pending ? 'disabled' : ''}>Atualizar cardápio</button></aside></div>`}</main>`;
    const seletorCategoria=app.querySelector('#v2-category');
    if(seletorCategoria)seletorCategoria.onchange=()=>{categoria=seletorCategoria.value;app.querySelectorAll('[data-product]').forEach(form=>form.hidden=!!categoria&&form.dataset.category!==categoria);};
    app.querySelectorAll('[data-product] img').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;},{once:true}));
    for (const form of app.querySelectorAll('[data-product]')) form.addEventListener('submit', e => {
      e.preventDefault(); if (busy || read('pendente') || paused) return;
      try {
        const p = product(form.dataset.product), opcoes = [...form.querySelectorAll('[data-option]')].filter(el => Number(el.value) > 0).map(el => ({ grupoId: el.dataset.group, opcaoId: el.dataset.option, quantidade: Number(el.value) }));
        for (const g of p.grupos || []) { const count = opcoes.filter(o => o.grupoId === g.id).reduce((n, o) => n + o.quantidade, 0); if (count < g.min || count > g.max) throw new Error(`Revise as escolhas de ${g.nome}.`); }
        const next = [...cart, { produtoId: p.id, quantidade: Number(form.elements.quantidade.value), observacao: form.elements.observacao.value.trim(), opcoes }];
        localStorage.setItem(key('carrinho'), JSON.stringify(next)); cart = next; quote = null; paint(); status('Produto adicionado.');
      } catch (error) { status(error.message, true); }
    });
    app.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { if (busy || read('pendente')) return; const next = cart.filter((_, i) => i !== Number(button.dataset.remove)); localStorage.setItem(key('carrinho'), JSON.stringify(next)); cart = next; quote = null; paint(); }));
    const form = app.querySelector('#v2-delivery-form');
    form?.addEventListener('input', () => {
      if (busy || read('pendente')) return;
      deliveryData = Object.fromEntries(new FormData(form)); quote = null;
      app.querySelector('#v2-quote-summary').textContent = 'Endereço alterado. Calcule a entrega novamente.';
      const send = app.querySelector('#v2-send'); send.disabled = true; send.dataset.enabled = 'false';
    });
    form?.addEventListener('submit', event => {
      event.preventDefault(); if (busy || read('pendente') || paused || !cart.length) return;
      deliveryData = Object.fromEntries(new FormData(form));
      action(async () => { quote = await cotarV2({ slug, catalogoVersao: catalog.versao, cep: deliveryData.cep, itens: cart }); paint(); status('Entrega calculada. Confira endereço e total para confirmar.'); app.querySelector('#v2-send').scrollIntoView({block:'nearest'}); });
    });
    app.querySelector('#v2-refresh')?.addEventListener('click', () => location.reload());
    app.querySelector('#v2-send')?.addEventListener('click', () => action(async () => {
      if (delivery && !read('pendente') && !quote) throw new Error('Calcule a entrega antes de confirmar.');
      status('Enviando. Aguarde a confirmação…');
      confirmed = await (atendimento?.enviar || enviarV2)(scope, { slug, tipo: delivery ? 'delivery' : mesaId ? 'mesa' : 'retirada', mesaId: mesaId || null, catalogoVersao: catalog.versao, itens: cart,
        ...(delivery ? { entrega: deliveryData, cotacao: quote } : {}) });
      cart = []; deliveryData = {}; quote = null; paint(); beginTracking();
    }));
    if (confirmed) showOrder(confirmed);
  }
  function showOrder(order) {
    const labels = { novo: 'Pedido recebido', em_preparo: 'Em preparo', pronto: 'Pronto', saiu_entrega: 'Saiu para entrega', entregue: 'Entregue', cancelado: 'Cancelado' };
    const panel = app.querySelector('#v2-confirmation'); if (!panel) return;
    panel.innerHTML = `<section class="v2-product"><h2>${esc(labels[order.status] || order.status)}</h2><p>Pedido ${esc(order.pedidoId.slice(-6).toUpperCase())}</p>${order.itens.map(line => `<p>${line.quantidade}× ${esc(line.nome)} — ${money(line.totalCentavos)}</p>`).join('')}${order.tipo==='delivery'?`<p>Taxa de entrega: ${money(order.taxaEntregaCentavos)}</p><p>Prazo estimado: ${order.prazoMinutos} minutos</p>`:''}<strong>Total: ${money(order.totalCentavos)}</strong><p id="v2-tracking-state">Consultando situação atual…</p><button id="v2-new" data-enabled="true">Fazer outro pedido</button></section>`;
    app.querySelector('#v2-new').addEventListener('click', () => { if (busy) return; stopTracking(); localStorage.removeItem(key('confirmado')); confirmed = null; paint(); });
  }
  function beginTracking() {
    stopTracking(); const token = confirmed?.acompanhamentoToken;
    if (!token || disposed) return;
    stopTracking = iniciarAcompanhamento({
      consultar: () => acompanharV2(token),
      atualizar: current => {
        if (disposed || confirmed?.acompanhamentoToken !== token) return;
        confirmed = { ...current, acompanhamentoToken: token };
        localStorage.setItem(key('confirmado'), JSON.stringify(confirmed)); showOrder(confirmed);
        const node = app.querySelector('#v2-tracking-state');
        if (node) node.textContent = 'Situação atualizada.';
      },
      erro: () => {
        const node = app.querySelector('#v2-tracking-state');
        if (node) node.textContent = 'Sem atualização no momento. Exibindo a última confirmação recebida.';
      }
    });
  }
  paint(); if (confirmed) beginTracking();
  return () => { disposed = true; stopTracking(); };
}
