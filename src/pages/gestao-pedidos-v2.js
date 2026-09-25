const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = value => Number.isSafeInteger(value) ? (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informado';
const states = {
  novo: '🟡 Novo',
  em_preparo: '🟠 Em preparo',
  pronto: '🟢 Pronto',
  saiu_entrega: '🛵 Saiu para entrega',
  entregue: '✅ Entregue',
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

export function renderPedidosGestao(host, options, valid) {
  const read = typeof options === 'function' ? options : options.read;
  const updateStatus = typeof options === 'object' ? options.updateStatus : null;

  host.innerHTML = `
    <header class="page-head">
      <div>
        <h2>Pedidos da Loja</h2>
        <p>Acompanhe e despache pedidos em tempo real direto pelo celular.</p>
      </div>
      <div class="g-orders-toolbar">
        <label class="g-audio-toggle" title="Tocar som quando chegar novo pedido">
          <input type="checkbox" id="g-sound-check" checked>
          <span>🔔 Alerta sonoro</span>
        </label>
        <button type="button" class="btn-ghost g-orders-refresh">Atualizar agora</button>
      </div>
    </header>
    <p class="g-orders-status" role="status"></p>
    <div class="g-orders-list"></div>
    <button type="button" class="btn-ghost g-orders-more" hidden>Carregar mais pedidos</button>
  `;

  const list = host.querySelector('.g-orders-list');
  const status = host.querySelector('.g-orders-status');
  const refresh = host.querySelector('.g-orders-refresh');
  const more = host.querySelector('.g-orders-more');
  const soundCheck = host.querySelector('#g-sound-check');

  let loading = false, loaded = false, cursor = null, count = 0;
  let seenOrderIds = new Set();
  let pollInterval = null;
  const alive = () => valid() && host.isConnected;

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
        list.replaceChildren();
        count = 0;
      }

      let novosPedidosChegaram = false;

      for (const order of page.pedidos) {
        if (!seenOrderIds.has(order.id) && loaded && order.status === 'novo') {
          novosPedidosChegaram = true;
        }
        seenOrderIds.add(order.id);

        if ([...list.children].some(row => row.dataset.id === order.id)) continue;
        const row = document.createElement('article');
        row.className = 'g-order';
        row.dataset.id = order.id;

        const channel = { mesa: 'Mesa', retirada: 'Retirada', delivery: 'Delivery' }[order.tipo] || order.tipo || 'Pedido';
        const channelClass = `g-channel-${order.tipo || 'mesa'}`;
        const date = order.criadoEm ? new Date(order.criadoEm).toLocaleString('pt-BR') : 'Data não informada';
        const statusClass = `g-status-${order.status || 'novo'}`;

        let contatoHtml = '';
        if (order.contato?.nome || order.contato?.telefone) {
          const tel = (order.contato.telefone || '').replace(/\D/g, '');
          const zapLink = tel ? `<a href="https://wa.me/55${tel}" target="_blank" rel="noopener">📱 WhatsApp: ${esc(order.contato.telefone)}</a>` : '';
          contatoHtml = `
            <div class="g-order-customer">
              <strong>Cliente:</strong> ${esc(order.contato.nome || 'Não informado')}
              ${zapLink ? `<br>${zapLink}` : ''}
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
              <small>${esc(date)}</small>
            </div>
            <strong>${money(order.totalCentavos)}</strong>
          </header>
          <div style="margin: 8px 0; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <span class="g-status-badge ${statusClass}">${esc(states[order.status] || order.status || 'Não informado')}</span>
            <small style="color:var(--slate);">Pagamento: <strong>${esc(payments[order.pagamento] || order.pagamento)}</strong></small>
          </div>
          ${contatoHtml}
          <details>
            <summary>Ver itens do pedido (${order.itens.length})</summary>
            <p class="g-order-id">Pedido: <code>${esc(order.id)}</code></p>
            <ul>
              ${order.itens.map(item => `
                <li>
                  ${esc(item.quantidade)} × ${esc(item.nome)}
                  ${item.observacao ? `<br><small style="color:#d97706;">Obs: ${esc(item.observacao)}</small>` : ''}
                  ${Array.isArray(item.opcoes) && item.opcoes.length ? `<br><small style="color:#64748b;">Extras: ${esc(item.opcoes.map(o => o.nome).join(', '))}</small>` : ''}
                  <span>${money(item.totalCentavos)}</span>
                </li>
              `).join('')}
            </ul>
          </details>
          <div class="g-order-actions"></div>
        `;

        const actionsContainer = row.querySelector('.g-order-actions');
        renderActionButtons(actionsContainer, order);

        list.append(row);
        count++;
      }

      if (novosPedidosChegaram && soundCheck?.checked) {
        tocarCampainha();
      }

      cursor = page.proximo;
      more.hidden = !cursor;
      loaded = true;
      if (!isAuto) {
        status.textContent = count ? `${count} ${count === 1 ? 'pedido carregado' : 'pedidos carregados'}.` : 'Nenhum pedido encontrado.';
      }
    } catch (e) {
      if (!alive()) return;
      if (['functions/permission-denied', 'functions/unauthenticated'].includes(e.code)) {
        list.replaceChildren();
        count = 0;
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

  function renderActionButtons(container, order) {
    if (!updateStatus) return;
    container.innerHTML = '';
    const st = order.status;

    if (st === 'novo') {
      const btnAceitar = document.createElement('button');
      btnAceitar.type = 'button';
      btnAceitar.className = 'g-order-btn g-order-btn-primary';
      btnAceitar.textContent = '👨‍🍳 Aceitar e Preparar';
      btnAceitar.onclick = () => mudarStatus(order, 'em_preparo', btnAceitar);
      container.append(btnAceitar);

      const btnRecusar = document.createElement('button');
      btnRecusar.type = 'button';
      btnRecusar.className = 'g-order-btn g-order-btn-cancel';
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
      btnPronto.className = 'g-order-btn g-order-btn-success';
      btnPronto.textContent = '🔔 Marcar como Pronto';
      btnPronto.onclick = () => mudarStatus(order, 'pronto', btnPronto);
      container.append(btnPronto);
    } else if (st === 'pronto') {
      if (order.tipo === 'delivery') {
        const btnSaiu = document.createElement('button');
        btnSaiu.type = 'button';
        btnSaiu.className = 'g-order-btn g-order-btn-warn';
        btnSaiu.textContent = '🛵 Saiu para Entrega';
        btnSaiu.onclick = () => mudarStatus(order, 'saiu_entrega', btnSaiu);
        container.append(btnSaiu);
      } else {
        const btnEntregar = document.createElement('button');
        btnEntregar.type = 'button';
        btnEntregar.className = 'g-order-btn g-order-btn-success';
        btnEntregar.textContent = '✅ Entregar ao Cliente';
        btnEntregar.onclick = () => mudarStatus(order, 'entregue', btnEntregar);
        container.append(btnEntregar);
      }
    } else if (st === 'saiu_entrega') {
      const btnConcluir = document.createElement('button');
      btnConcluir.type = 'button';
      btnConcluir.className = 'g-order-btn g-order-btn-success';
      btnConcluir.textContent = '✅ Confirmar Entrega';
      btnConcluir.onclick = () => mudarStatus(order, 'entregue', btnConcluir);
      container.append(btnConcluir);
    }

    if (order.pagamento !== 'pago' && st !== 'cancelado') {
      const btnPago = document.createElement('button');
      btnPago.type = 'button';
      btnPago.className = 'g-order-btn g-order-btn-pay';
      btnPago.textContent = '💰 Marcar como Pago';
      btnPago.onclick = () => mudarStatus(order, order.status, btnPago, 'pago');
      container.append(btnPago);
    }

    if (!['entregue', 'cancelado'].includes(st) && st !== 'novo') {
      const btnCancelar = document.createElement('button');
      btnCancelar.type = 'button';
      btnCancelar.className = 'g-order-btn g-order-btn-cancel';
      btnCancelar.textContent = 'Cancelar';
      btnCancelar.onclick = () => {
        if (window.confirm('Tem certeza que deseja cancelar este pedido?')) {
          mudarStatus(order, 'cancelado', btnCancelar);
        }
      };
      container.append(btnCancelar);
    }
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
      load(true);
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
