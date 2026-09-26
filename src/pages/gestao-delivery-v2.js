import { renderHorariosGestao } from './gestao-horarios-v2.js';
import { mascaraMoeda } from '../lib/moeda.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function formatCep(val) {
  const digits = String(val || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return digits.slice(0, 5) + '-' + digits.slice(5);
}

function sanitizeId(id) {
  return String(id || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || ('reg_' + Date.now());
}

export function renderDeliveryGestao(host, initial, changed, save) {
  const draft = structuredClone(initial);
  const config = draft.delivery;

  host.innerHTML = `
    <form class="g-form g-delivery" style="max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
      
      <!-- Cabeçalho com status do Delivery -->
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 20px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
        <div>
          <h2 style="margin: 0 0 6px; font-size: 20px; font-weight: 800; color: var(--navy);">🛵 Entrega em Domicílio (Delivery)</h2>
          <p style="margin: 0; font-size: 13.5px; color: #64748b;">Receba pedidos para entrega diretamente pelo cardápio online com cálculo automático de taxa.</p>
        </div>
        <label style="display: inline-flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; font-weight: 700; font-size: 13.5px; color: var(--navy);">
          <input name="deliveryAtivo" type="checkbox" ${config.ativo ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
          <span id="g-delivery-toggle-text">${config.ativo ? '🟢 Delivery Ativo' : '⚪ Delivery Pausado'}</span>
        </label>
      </div>

      <!-- Pedido Mínimo -->
      <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 20px;">
        <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 800; color: var(--navy);">💰 Pedido Mínimo para Entrega</h3>
        <p style="margin: 0 0 14px; font-size: 13px; color: #64748b;">Valor mínimo em produtos exigido no carrinho para o cliente poder concluir o pedido por delivery (use R$ 0,00 se não houver mínimo).</p>
        <div style="max-width: 260px;">
          <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 700; color: #334155;">
            Valor Mínimo (R$)
            <input name="minimo" type="text" inputmode="numeric" required data-centavos="${draft.minimoCentavos ?? config.pedidoMinimoCentavos ?? 0}" style="height: 42px; padding: 0 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 15px; font-weight: 700; color: var(--navy);">
          </label>
        </div>
      </div>

      <!-- Regiões de Entrega -->
      <section style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
          <div>
            <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 800; color: var(--navy);">📍 Regiões e Taxas de Entrega</h3>
            <p style="margin: 0; font-size: 13px; color: #64748b;">Defina uma taxa única para toda a cidade ou crie regras personalizadas por faixa de CEP.</p>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" id="g-btn-taxa-unica" style="height: 38px; padding: 0 14px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 8px; font-size: 13px; font-weight: 750; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              🚀 Taxa Única (Toda a Cidade)
            </button>
            <button type="button" class="btn-ghost" id="g-add-region" style="height: 38px; padding: 0 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">
              + Adicionar Região por CEP
            </button>
          </div>
        </div>

        <div class="g-regions" style="display: flex; flex-direction: column; gap: 14px;"></div>
      </section>

      <!-- Horários de Atendimento do Delivery -->
      <section class="g-schedule" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 20px;"></section>

      <!-- Barra de Salvamento -->
      <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
        <button class="btn-primary" type="submit" style="height: 44px; padding: 0 24px; font-size: 14px; font-weight: 750; border-radius: 10px; cursor: pointer;">
          Salvar Configurações de Delivery
        </button>
        <p class="g-result" role="status" style="margin: 0; font-size: 13.5px; font-weight: 700; color: #b45309;"></p>
      </div>
    </form>
  `;

  const form = host.querySelector('form');
  const regions = host.querySelector('.g-regions');
  const result = host.querySelector('.g-result');
  const inputMinimo = form.querySelector('[name=minimo]');
  const toggleCheckbox = form.querySelector('[name=deliveryAtivo]');
  const toggleText = host.querySelector('#g-delivery-toggle-text');

  toggleCheckbox.onchange = () => {
    toggleText.textContent = toggleCheckbox.checked ? '🟢 Delivery Ativo' : '⚪ Delivery Pausado';
    capture();
  };

  mascaraMoeda(inputMinimo, centavos => {
    draft.minimoCentavos = centavos;
    capture();
  });

  const capture = () => {
    config.ativo = form.elements.deliveryAtivo.checked;
    draft.minimoCentavos = Number(inputMinimo.dataset.centavos || 0);
    config.regioes = [...regions.children].map(row => ({
      id: row.dataset.id,
      nome: row.querySelector('[name=regiaoNome]').value.trim(),
      cepInicial: row.querySelector('[name=cepInicial]').value.trim(),
      cepFinal: row.querySelector('[name=cepFinal]').value.trim(),
      taxaCentavos: Number(row.querySelector('[name=taxa]').dataset.centavos || 0),
      prazo: row.querySelector('[name=prazo]').value
    }));
    draft.agenda = agenda.snapshot();
    changed(structuredClone(draft));
  };

  const agenda = renderHorariosGestao(host.querySelector('.g-schedule'), config.horarios, draft.agenda, () => capture());

  function add(region) {
    const row = document.createElement('div');
    row.className = 'g-region-card';
    const regId = sanitizeId(region.id || crypto.randomUUID());
    row.dataset.id = regId;
    const taxaCent = region.taxaCentavos ?? (region.taxa ? Math.round(Number(region.taxa) * 100) : 0);
    const cepIni = formatCep(region.cepInicial || '00000000');
    const cepFim = formatCep(region.cepFinal || '99999999');
    const isGlobal = (cepIni.replace('-', '') === '00000000' && cepFim.replace('-', '') === '99999999');

    row.style.cssText = 'background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.2s;';

    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">📍</span>
          <strong class="g-region-title" style="font-size: 14.5px; color: var(--navy);">${esc(region.nome || 'Nova Região de Entrega')}</strong>
          ${isGlobal ? '<span style="font-size: 11px; font-weight: 750; background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 9999px;">Toda a Cidade</span>' : ''}
        </div>
        <button type="button" class="g-remove-region" style="background: transparent; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 700; cursor: pointer;">
          Remover região
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
        <label style="display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 700; color: #475569;">
          Nome da Região
          <input name="regiaoNome" required maxlength="80" value="${esc(region.nome)}" placeholder="Ex: Toda a Cidade ou Bairro Centro" style="height: 38px; padding: 0 10px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13.5px; color: var(--navy); background: #ffffff;">
        </label>
        
        <label style="display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 700; color: #475569;">
          Taxa de Entrega (R$)
          <input name="taxa" type="text" inputmode="numeric" required data-centavos="${taxaCent}" style="height: 38px; padding: 0 10px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13.5px; font-weight: 700; color: var(--navy); background: #ffffff;">
        </label>

        <label style="display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 700; color: #475569;">
          Prazo Estimado (minutos)
          <input name="prazo" type="number" min="1" max="1440" step="1" required value="${esc(region.prazo ?? region.prazoMinutos ?? 45)}" placeholder="Ex: 45" style="height: 38px; padding: 0 10px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13.5px; color: var(--navy); background: #ffffff;">
        </label>

        <label style="display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 700; color: #475569;">
          CEP Inicial
          <input name="cepInicial" required inputmode="numeric" maxlength="9" value="${esc(cepIni)}" placeholder="00000-000" style="height: 38px; padding: 0 10px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13.5px; font-family: monospace; color: var(--navy); background: #ffffff;">
        </label>

        <label style="display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; font-weight: 700; color: #475569;">
          CEP Final
          <input name="cepFinal" required inputmode="numeric" maxlength="9" value="${esc(cepFim)}" placeholder="99999-999" style="height: 38px; padding: 0 10px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 13.5px; font-family: monospace; color: var(--navy); background: #ffffff;">
        </label>
      </div>
    `;

    const nameInput = row.querySelector('[name=regiaoNome]');
    const taxaInput = row.querySelector('[name=taxa]');
    const cepIniInput = row.querySelector('[name=cepInicial]');
    const cepFimInput = row.querySelector('[name=cepFinal]');
    const titleEl = row.querySelector('.g-region-title');

    nameInput.addEventListener('input', () => {
      titleEl.textContent = nameInput.value.trim() || 'Nova Região de Entrega';
      capture();
    });

    cepIniInput.addEventListener('input', () => {
      cepIniInput.value = formatCep(cepIniInput.value);
      capture();
    });

    cepFimInput.addEventListener('input', () => {
      cepFimInput.value = formatCep(cepFimInput.value);
      capture();
    });

    mascaraMoeda(taxaInput, () => capture());

    row.querySelector('.g-remove-region').onclick = () => {
      row.remove();
      capture();
      updateAdd();
    };

    regions.append(row);
  }

  const updateAdd = () => {
    form.querySelector('#g-add-region').disabled = regions.children.length >= 50;
  };

  config.regioes.forEach(add);
  updateAdd();

  form.oninput = capture;

  // Botão Taxa Única (Toda a Cidade)
  host.querySelector('#g-btn-taxa-unica').onclick = () => {
    if (regions.children.length > 0) {
      if (!window.confirm('Deseja substituir as regiões atuais por uma Taxa Única para toda a cidade?')) return;
    }
    regions.replaceChildren();
    add({
      id: 'reg_toda_cidade',
      nome: 'Toda a Cidade',
      cepInicial: '00000000',
      cepFinal: '99999999',
      taxaCentavos: 500, // R$ 5,00 padrão
      prazoMinutos: 45
    });
    capture();
    updateAdd();
  };

  form.querySelector('#g-add-region').onclick = () => {
    if (regions.children.length >= 50) return;
    add({
      id: 'reg_' + Date.now(),
      nome: '',
      cepInicial: '00000000',
      cepFinal: '99999999',
      taxaCentavos: 500,
      prazoMinutos: 45
    });
    capture();
    updateAdd();
    regions.lastElementChild.querySelector('input').focus();
  };

  form.onsubmit = async event => {
    event.preventDefault();
    capture();

    const delivery = {
      ...config,
      pedidoMinimoCentavos: draft.minimoCentavos ?? 0,
      regioes: config.regioes.map(r => ({
        id: sanitizeId(r.id),
        nome: r.nome.trim(),
        cepInicial: r.cepInicial.replace(/\D/g, ''),
        cepFinal: r.cepFinal.replace(/\D/g, ''),
        taxaCentavos: Number(r.taxaCentavos || 0),
        prazoMinutos: Number(r.prazo || 45)
      }))
    };

    try {
      delivery.horarios = agenda.value();
    } catch (e) {
      result.textContent = e.message;
      return;
    }

    const sorted = [...delivery.regioes].sort((a, b) => a.cepInicial.localeCompare(b.cepInicial));
    let error = '';

    if (delivery.ativo && !sorted.length) {
      error = 'Adicione pelo menos uma região de entrega antes de ativar o delivery.';
    } else if (sorted.some(r => !r.nome)) {
      error = 'Informe o nome de cada região de entrega.';
    } else if (sorted.some(r => r.cepInicial.length !== 8 || r.cepFinal.length !== 8)) {
      error = 'Os CEPs de todas as regiões devem conter 8 dígitos.';
    } else if (sorted.some(r => r.cepInicial > r.cepFinal)) {
      error = 'O CEP final deve ser maior ou igual ao CEP inicial.';
    } else if (sorted.some((r, i) => i && r.cepInicial <= sorted[i - 1].cepFinal)) {
      error = 'As faixas de CEP não podem se sobrepor. Ajuste as regiões.';
    }

    if (error) {
      result.textContent = error;
      result.style.color = '#dc2626';
      return;
    }

    result.textContent = 'Salvando configurações de delivery…';
    result.style.color = '#0284c7';

    try {
      await save({ versao: draft.versao, delivery }, result);
      result.textContent = '✅ Configurações de delivery salvas com sucesso!';
      result.style.color = '#16a34a';
    } catch (err) {
      result.textContent = err.message || 'Erro ao salvar delivery.';
      result.style.color = '#dc2626';
    }
  };
}
