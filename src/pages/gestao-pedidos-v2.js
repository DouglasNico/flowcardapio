const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = value => Number.isSafeInteger(value) ? (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informado';
const states = {
  novo: '🟡 Novo Pedido',
  em_preparo: '🔵 Em Preparo na Cozinha',
  pronto: '🟢 Pronto p/ Retirada',
  saiu_entrega: '🛵 Saiu para Entrega',
  entregue: '✅ Concluído / Entregue',
  cancelado: '❌ Cancelado'
};
const payments = { pendente: 'Pendente', pago: 'Pago', estornado: 'Estornado' };

function tocarCampainha() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {}
}

export function imprimirComandaPedido(order, storeName = 'FlowPDV') {
  let printArea = document.getElementById('g-print-ticket-area');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'g-print-ticket-area';
    document.body.append(printArea);
  }

  const canal = { mesa: 'MESA / SALÃO', retirada: 'RETIRADA NO BALCÃO', delivery: 'DELIVERY / ENTREGA' }[order.tipo] || (order.tipo || 'PEDIDO').toUpperCase();
  const dateObj = order.criadoEm ? new Date(order.criadoEm) : new Date();
  const dataFormatada = dateObj.toLocaleDateString('pt-BR');
  const horaFormatada = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const clienteNome = order.contato?.nome || 'Consumidor';
  const clienteTel = order.contato?.telefone || '';
  const end = order.entrega?.endereco;

  printArea.innerHTML = `
    <div class="g-thermal-receipt">
      <div class="g-tr-center g-tr-bold" style="font-size:16px;">${esc(storeName)}</div>
      <div class="g-tr-center g-tr-bold" style="font-size:13px; margin:4px 0;">*** ${esc(canal)} ***</div>
      <div class="g-tr-center" style="font-size:12px;">PEDIDO: #${esc(order.id.slice(0, 8).toUpperCase())}</div>
      <div class="g-tr-center" style="font-size:11px;">Data: ${dataFormatada} às ${horaFormatada}</div>
      ${order.mesaNome ? `<div class="g-tr-center g-tr-bold" style="font-size:14px; margin-top:3px;">${esc(order.mesaNome).toUpperCase()}</div>` : ''}

      <div class="g-tr-line">--------------------------------</div>

      <div class="g-tr-section">
        <div><strong>CLIENTE:</strong> ${esc(clienteNome)}</div>
        ${clienteTel ? `<div><strong>CONTATO:</strong> ${esc(clienteTel)}</div>` : ''}
        ${end ? `
          <div style="margin-top:3px;">
            <strong>ENDEREÇO:</strong><br>
            ${esc(end.logradouro || '')}, ${esc(end.numero || 'S/N')}<br>
            ${end.complemento ? `Compl: ${esc(end.complemento)}<br>` : ''}
            Bairro: ${esc(end.bairro || '')}<br>
            ${end.referencia ? `Ref: ${esc(end.referencia)}<br>` : ''}
          </div>
        ` : ''}
      </div>

      <div class="g-tr-line">--------------------------------</div>
      <div class="g-tr-bold" style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span>ITEM / QTD</span>
        <span>VALOR</span>
      </div>

      <div class="g-tr-items">
        ${order.itens.map(item => `
          <div class="g-tr-item">
            <div style="display:flex; justify-content:space-between; font-weight:700;">
              <span>${item.quantidade}x ${esc(item.nome)}</span>
              <span>${money(item.totalCentavos)}</span>
            </div>
            ${item.variante === 'combo' ? `<div class="g-tr-sub"> * COMBO INCLUSO</div>` : ''}
            ${Array.isArray(item.opcoes) && item.opcoes.length ? item.opcoes.map(o => `
              <div class="g-tr-sub"> + ${esc(o.nome)} ${o.precoCentavos ? `(${money(o.precoCentavos)})` : ''}</div>
            `).join('') : ''}
            ${item.observacao ? `
              <div class="g-tr-obs"> OBS: "${esc(item.observacao)}"</div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div class="g-tr-line">--------------------------------</div>

      <div class="g-tr-totals">
        ${order.taxaEntregaCentavos ? `
          <div style="display:flex; justify-content:space-between;">
            <span>Subtotal:</span>
            <span>${money(order.subtotalCentavos || (order.totalCentavos - order.taxaEntregaCentavos))}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Taxa Entrega:</span>
            <span>${money(order.taxaEntregaCentavos)}</span>
          </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:800; margin-top:4px;">
          <span>TOTAL:</span>
          <span>${money(order.totalCentavos)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:2px;">
          <span>PAGAMENTO:</span>
          <span>${esc(payments[order.pagamento] || order.pagamento).toUpperCase()}</span>
        </div>
      </div>

      <div class="g-tr-line">================================</div>
      <div class="g-tr-center" style="font-size:10px; margin-top:6px;">
        FLOWPDV · SISTEMA DE GESTÃO<br>
        Obrigado pela preferência!
      </div>
    </div>
  `;

  setTimeout(() => {
    window.print();
  }, 50);
}

export function renderPedidosGestao(host, options, valid) {
  const read = typeof options === 'function' ? options : options.read;
  const updateStatus = typeof options === 'object' ? options.updateStatus : null;
  const storeName = typeof options === 'object' && options.storeName ? options.storeName : 'FlowPDV';

  host.innerHTML = `
    <header class="page-head">
      <div>
        <h2>Painel de Pedidos</h2>
        <p>Acompanhe e despache pedidos em tempo real direto pela cozinha ou balcão.</p>
      </div>
      <div class="g-orders-toolbar">
        <label class="g-audio-toggle" title="Tocar som quando chegar novo pedido">
          <input type="checkbox" id="g-sound-check" checked>
          <span>🔔 Alerta sonoro</span>
        </label>
        <label class="g-audio-toggle" title="Imprimir automaticamente ao aceitar pedido">
          <input type="checkbox" id="g-autoprint-check">
          <span>🖨️ Auto-imprimir</span>
        </label>
        <button type="button" class="btn-ghost g-orders-refresh" style="height:40px; padding:0 14px;">↻ Atualizar</button>
      </div>
    </header>

    <!-- Pipeline / Kanban Status Tabs -->
    <nav class="g-orders-kanban-nav" id="g-orders-tabs">
      <button type="button" class="g-kanban-tab is-active" data-filter="ativos">
        <span>🔥 Em Andamento</span>
        <span class="g-kanban-badge" id="g-badge-ativos">0</span>
      </button>
      <button type="button" class="g-kanban-tab" data-filter="novo">
        <span>🟡 Novos</span>
        <span class="g-kanban-badge" id="g-badge-novo">0</span>
      </button>
      <button type="button" class="g-kanban-tab" data-filter="em_preparo">
        <span>🔵 Cozinha</span>
        <span class="g-kanban-badge" id="g-badge-preparo">0</span>
      </button>
      <button type="button" class="g-kanban-tab" data-filter="prontos">
        <span>🟢 Prontos / Entrega</span>
        <span class="g-kanban-badge" id="g-badge-prontos">0</span>
      </button>
      <button type="button" class="g-kanban-tab" data-filter="concluidos">
        <span>🏁 Finalizados</span>
        <span class="g-kanban-badge" id="g-badge-concluidos">0</span>
      </button>
      <button type="button" class="g-kanban-tab" data-filter="todos">
        <span>Todos</span>
        <span class="g-kanban-badge" id="g-badge-todos">0</span>
      </button>
    </nav>

    <p class="g-orders-status" role="status"></p>
    <div class="g-orders-list"></div>
    <button type="button" class="btn-ghost g-orders-more" hidden style="margin-top:16px;">Carregar mais pedidos antigos</button>
  `;

  const list = host.querySelector('.g-orders-list');
  const status = host.querySelector('.g-orders-status');
  const refresh = host.querySelector('.g-orders-refresh');
  const more = host.querySelector('.g-orders-more');
  const soundCheck = host.querySelector('#g-sound-check');
  const tabsNav = host.querySelector('#g-orders-tabs');

  let loading = false, loaded = false, cursor = null;
  let allOrders = [];
  let currentFilter = 'ativos';
  let seenOrderIds = new Set();
  let pollInterval = null;
  const alive = () => valid() && host.isConnected;

  tabsNav.querySelectorAll('.g-kanban-tab').forEach(btn => {
    btn.onclick = () => {
      tabsNav.querySelectorAll('.g-kanban-tab').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentFilter = btn.dataset.filter;
      renderOrdersView();
    };
  });

  async function load(reset, isAuto = false) {
    if (loading || !alive()) return;
    loading = true;
    if (!isAuto) {
      refresh.disabled = more.disabled = true;
      status.textContent = 'Consultando pedidos…';
    }
    try {
      const page = await read(reset ? null : cursor);
      if (!alive()) return;
      if (reset) {
        allOrders = [];
      }

      let novosPedidosChegaram = false;

      for (const order of page.pedidos) {
        if (!seenOrderIds.has(order.id) && loaded && order.status === 'novo') {
          novosPedidosChegaram = true;
        }
        seenOrderIds.add(order.id);

        const idx = allOrders.findIndex(o => o.id === order.id);
        if (idx >= 0) allOrders[idx] = order;
        else allOrders.push(order);
      }

      if (novosPedidosChegaram && soundCheck?.checked) {
        tocarCampainha();
      }

      cursor = page.proximo;
      more.hidden = !cursor;
      loaded = true;

      updateBadges();
      renderOrdersView();

      if (!isAuto) {
        status.textContent = allOrders.length ? `${allOrders.length} ${allOrders.length === 1 ? 'pedido sincronizado' : 'pedidos sincronizados'}.` : 'Nenhum pedido encontrado.';
      }
    } catch (e) {
      if (!alive()) return;
      if (['functions/permission-denied', 'functions/unauthenticated'].includes(e.code)) {
        allOrders = [];
        cursor = null;
        more.hidden = true;
        loaded = false;
        status.textContent = 'Acesso não autorizado aos pedidos desta loja.';
      } else if (!isAuto) {
        status.textContent = 'Não foi possível consultar os pedidos. Tente atualizar novamente.';
      }
    } finally {
      loading = false;
      if (alive() && !isAuto) refresh.disabled = more.disabled = false;
    }
  }

  function updateBadges() {
    const counts = {
      ativos: allOrders.filter(o => ['novo', 'em_preparo', 'pronto', 'saiu_entrega'].includes(o.status)).length,
      novo: allOrders.filter(o => o.status === 'novo').length,
      preparo: allOrders.filter(o => o.status === 'em_preparo').length,
      prontos: allOrders.filter(o => ['pronto', 'saiu_entrega'].includes(o.status)).length,
      concluidos: allOrders.filter(o => ['entregue', 'cancelado'].includes(o.status)).length,
      todos: allOrders.length
    };

    host.querySelector('#g-badge-ativos').textContent = counts.ativos;
    host.querySelector('#g-badge-novo').textContent = counts.novo;
    host.querySelector('#g-badge-preparo').textContent = counts.preparo;
    host.querySelector('#g-badge-prontos').textContent = counts.prontos;
    host.querySelector('#g-badge-concluidos').textContent = counts.concluidos;
    host.querySelector('#g-badge-todos').textContent = counts.todos;
  }

  function renderOrdersView() {
    list.replaceChildren();

    const filtered = allOrders.filter(order => {
      const st = order.status;
      if (currentFilter === 'ativos') return ['novo', 'em_preparo', 'pronto', 'saiu_entrega'].includes(st);
      if (currentFilter === 'novo') return st === 'novo';
      if (currentFilter === 'em_preparo') return st === 'em_preparo';
      if (currentFilter === 'prontos') return ['pronto', 'saiu_entrega'].includes(st);
      if (currentFilter === 'concluidos') return ['entregue', 'cancelado'].includes(st);
      return true;
    });

    if (!filtered.length) {
      list.innerHTML = `
        <div style="text-align:center; padding:48px 16px; background:#ffffff; border-radius:14px; border:1px dashed #cbd5e1; color:#64748b;">
          <p style="font-size:16px; font-weight:750; color:var(--navy); margin:0 0 6px;">Nenhum pedido nesta etapa</p>
          <p style="font-size:13px; margin:0;">Novos pedidos entrarão automaticamente aqui com aviso sonoro.</p>
        </div>
      `;
      return;
    }

    for (const order of filtered) {
      const row = document.createElement('article');
      row.className = 'g-order';
      row.dataset.id = order.id;

      const channel = { mesa: 'Mesa', retirada: 'Retirada no Balcão', delivery: 'Entrega (Delivery)' }[order.tipo] || order.tipo || 'Pedido';
      const channelClass = `g-channel-${order.tipo || 'mesa'}`;
      const date = order.criadoEm ? new Date(order.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      const statusClass = `g-status-${order.status || 'novo'}`;

      let contatoHtml = '';
      if (order.contato?.nome || order.contato?.telefone) {
        const tel = (order.contato.telefone || '').replace(/\D/g, '');
        const zapLink = tel ? `<a href="https://wa.me/55${tel}" target="_blank" rel="noopener" style="color:#0284c7; font-weight:600; text-decoration:none;">📱 WhatsApp: ${esc(order.contato.telefone)}</a>` : '';
        const endTxt = order.entrega?.endereco ? `<div style="font-size:12px; color:#475569; margin-top:2px;">📍 ${esc(order.entrega.endereco.logradouro)}, ${esc(order.entrega.endereco.numero)} - ${esc(order.entrega.endereco.bairro)}</div>` : '';
        contatoHtml = `
          <div class="g-order-customer" style="background:#f8fafc; padding:10px 12px; border-radius:8px; margin:8px 0;">
            <div style="font-size:13px; font-weight:700; color:var(--navy);">Cliente: ${esc(order.contato.nome || 'Não informado')}</div>
            ${zapLink ? `<div>${zapLink}</div>` : ''}
            ${endTxt}
          </div>
        `;
      }

      row.innerHTML = `
        <header>
          <div>
            <h3>
              <span class="g-channel-badge ${channelClass}">${esc(channel)}</span>
              ${order.mesaNome ? ' · ' + esc(order.mesaNome) : ''}
            </h3>
            <small style="color:#64748b;">Horário: ${esc(date)} · ID: #${esc(order.id.slice(0, 8))}</small>
          </div>
          <strong style="font-size:18px; color:var(--navy);">${money(order.totalCentavos)}</strong>
        </header>
        <div style="margin: 8px 0; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="g-status-badge ${statusClass}">${esc(states[order.status] || order.status || 'Não informado')}</span>
          <small style="color:var(--slate);">Pagamento: <strong>${esc(payments[order.pagamento] || order.pagamento)}</strong></small>
        </div>
        ${contatoHtml}
        <details open>
          <summary style="font-weight:700; color:var(--navy);">Itens do pedido (${order.itens.length})</summary>
          <ul style="margin:8px 0 0; padding-left:18px;">
            ${order.itens.map(item => `
              <li style="margin-bottom:6px;">
                <strong>${esc(item.quantidade)}×</strong> ${esc(item.nome)}
                ${item.variante === 'combo' ? `<div style="color:#b45309; font-size:11.5px; font-weight:700;">Combo incluso</div>` : ''}
                ${item.observacao ? `<div style="color:#d97706; font-size:12px;">Obs: "${esc(item.observacao)}"</div>` : ''}
                ${Array.isArray(item.opcoes) && item.opcoes.length ? `<div style="color:#64748b; font-size:12px;">Adicionais: ${esc(item.opcoes.map(o => o.nome).join(', '))}</div>` : ''}
                <span style="font-size:12px; color:#64748b;">${money(item.totalCentavos)}</span>
              </li>
            `).join('')}
          </ul>
        </details>
        <div class="g-order-actions-bar"></div>
      `;

      const actionsContainer = row.querySelector('.g-order-actions-bar');
      renderActionButtons(actionsContainer, order);

      list.append(row);
    }
  }

  function renderActionButtons(container, order) {
    if (!updateStatus) return;
    container.innerHTML = '';
    const st = order.status;

    if (st === 'novo') {
      const btnAceitar = document.createElement('button');
      btnAceitar.type = 'button';
      btnAceitar.className = 'g-btn-order-step g-btn-order-step--primary';
      btnAceitar.textContent = '👨‍🍳 Aceitar e Preparar';
      btnAceitar.onclick = () => mudarStatus(order, 'em_preparo', btnAceitar);
      container.append(btnAceitar);

      const btnRecusar = document.createElement('button');
      btnRecusar.type = 'button';
      btnRecusar.className = 'g-btn-order-step g-btn-order-step--danger';
      btnRecusar.textContent = 'Recusar';
      btnRecusar.onclick = () => {
        if (window.confirm('Tem certeza que deseja recusar este pedido?')) {
          mudarStatus(order, 'cancelado', btnRecusar);
        }
      };
      container.append(btnRecusar);
    } else if (st === 'em_preparo') {
      const btnPronto = document.createElement('button');
      btnPronto.type = 'button';
      btnPronto.className = 'g-btn-order-step g-btn-order-step--kitchen';
      btnPronto.textContent = '🔔 Marcar como Pronto';
      btnPronto.onclick = () => mudarStatus(order, 'pronto', btnPronto);
      container.append(btnPronto);
    } else if (st === 'pronto') {
      if (order.tipo === 'delivery') {
        const btnSaiu = document.createElement('button');
        btnSaiu.type = 'button';
        btnSaiu.className = 'g-btn-order-step g-btn-order-step--kitchen';
        btnSaiu.textContent = '🛵 Despachar (Saiu para Entrega)';
        btnSaiu.onclick = () => mudarStatus(order, 'saiu_entrega', btnSaiu);
        container.append(btnSaiu);
      } else {
        const btnEntregar = document.createElement('button');
        btnEntregar.type = 'button';
        btnEntregar.className = 'g-btn-order-step g-btn-order-step--success';
        btnEntregar.textContent = '✅ Entregar ao Cliente';
        btnEntregar.onclick = () => mudarStatus(order, 'entregue', btnEntregar);
        container.append(btnEntregar);
      }
    } else if (st === 'saiu_entrega') {
      const btnConcluir = document.createElement('button');
      btnConcluir.type = 'button';
      btnConcluir.className = 'g-btn-order-step g-btn-order-step--success';
      btnConcluir.textContent = '✅ Confirmar Entrega';
      btnConcluir.onclick = () => mudarStatus(order, 'entregue', btnConcluir);
      container.append(btnConcluir);
    }

    if (order.pagamento !== 'pago' && st !== 'cancelado') {
      const btnPago = document.createElement('button');
      btnPago.type = 'button';
      btnPago.className = 'g-btn-order-step';
      btnPago.style.cssText = 'background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1;';
      btnPago.textContent = '💰 Marcar como Pago';
      btnPago.onclick = () => mudarStatus(order, order.status, btnPago, 'pago');
      container.append(btnPago);
    }

    if (!['entregue', 'cancelado'].includes(st) && st !== 'novo') {
      const btnCancelar = document.createElement('button');
      btnCancelar.type = 'button';
      btnCancelar.className = 'g-btn-order-step g-btn-order-step--danger';
      btnCancelar.textContent = 'Cancelar';
      btnCancelar.onclick = () => {
        if (window.confirm('Tem certeza que deseja cancelar este pedido?')) {
          mudarStatus(order, 'cancelado', btnCancelar);
        }
      };
      container.append(btnCancelar);
    }

    // Botão de Impressão Térmica sempre acessível
    const btnPrint = document.createElement('button');
    btnPrint.type = 'button';
    btnPrint.className = 'g-btn-order-step';
    btnPrint.style.cssText = 'background:#f8fafc; color:#0f172a; border:1px solid #cbd5e1;';
    btnPrint.innerHTML = '🖨️ Imprimir';
    btnPrint.title = 'Imprimir comanda térmica do pedido';
    btnPrint.onclick = () => imprimirComandaPedido(order, storeName);
    container.append(btnPrint);
  }

  async function mudarStatus(order, novoStatus, btnTrigger, novoPagamento = null) {
    if (!updateStatus) return;
    const oldText = btnTrigger.textContent;
    btnTrigger.disabled = true;
    btnTrigger.textContent = 'Salvando…';
    try {
      await updateStatus(order.id, novoStatus, novoPagamento);
      order.status = novoStatus;
      if (novoPagamento) order.pagamento = novoPagamento;
      updateBadges();
      renderOrdersView();

      // Auto-impressão se habilitada
      if (novoStatus === 'em_preparo') {
        const autoCheck = host.querySelector('#g-autoprint-check');
        if (autoCheck?.checked) {
          imprimirComandaPedido(order, storeName);
        }
      }
    } catch (err) {
      alert(err.message || 'Não foi possível alterar o status.');
      btnTrigger.disabled = false;
      btnTrigger.textContent = oldText;
    }
  }

  refresh.onclick = () => load(true);
  more.onclick = () => load(false);

  pollInterval = setInterval(() => {
    if (alive() && !document.hidden && loaded) {
      load(true, true);
    }
  }, 15000);

  return {
    show: () => {
      if (!loaded) load(true);
    },
    destroy: () => {
      clearInterval(pollInterval);
    }
  };
}
