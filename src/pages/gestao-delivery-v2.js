import { renderHorariosGestao } from './gestao-horarios-v2.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderDeliveryGestao(host, initial, changed, save) {
  const draft = structuredClone(initial);
  const config = draft.delivery;
  host.innerHTML = `<form class="g-form g-delivery"><h2>Entrega em domicílio</h2><label class="g-check"><input name="deliveryAtivo" type="checkbox" ${config.ativo ? 'checked' : ''}>Receber pedidos de delivery</label><label>Pedido mínimo (R$)<input name="minimo" type="number" min="0" max="10000" step="0.01" required value="${esc(draft.minimo ?? (config.pedidoMinimoCentavos / 100).toFixed(2))}"></label><section><h3>Regiões de entrega</h3><p>Defina a faixa de CEP, a taxa e o prazo de cada região.</p><div class="g-regions"></div><button type="button" class="btn-ghost" id="g-add-region">Adicionar região</button></section><section class="g-schedule"></section><button class="btn-primary" type="submit">Salvar delivery</button><p class="g-result" role="status"></p></form>`;
  const form = host.querySelector('form'), regions = host.querySelector('.g-regions'), result = host.querySelector('.g-result');
  const capture = () => {
    config.ativo = form.elements.deliveryAtivo.checked;
    draft.minimo = form.elements.minimo.value;
    config.regioes = [...regions.children].map(row => ({ id: row.dataset.id, nome: row.querySelector('[name=regiaoNome]').value, cepInicial: row.querySelector('[name=cepInicial]').value, cepFinal: row.querySelector('[name=cepFinal]').value, taxa: row.querySelector('[name=taxa]').value, prazo: row.querySelector('[name=prazo]').value }));
    draft.agenda = agenda.snapshot(); changed(structuredClone(draft));
  };
  const agenda = renderHorariosGestao(host.querySelector('.g-schedule'), config.horarios, draft.agenda, () => capture());
  function add(region) {
    const row = document.createElement('fieldset'); row.className = 'g-region'; row.dataset.id = region.id;
    row.innerHTML = `<legend>Região de entrega</legend><label>Nome da região<input name="regiaoNome" required maxlength="80" value="${esc(region.nome)}" placeholder="Nome da região atendida"></label><div class="g-delivery-pair"><label>CEP inicial<input name="cepInicial" required inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" maxlength="9" value="${esc(region.cepInicial)}" placeholder="CEP com oito dígitos"></label><label>CEP final<input name="cepFinal" required inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" maxlength="9" value="${esc(region.cepFinal)}" placeholder="CEP com oito dígitos"></label><label>Taxa de entrega (R$)<input name="taxa" type="number" min="0" max="1000" step="0.01" required value="${esc(region.taxa ?? (region.taxaCentavos / 100).toFixed(2))}"></label><label>Prazo (minutos)<input name="prazo" type="number" min="1" max="1440" step="1" required value="${esc(region.prazo ?? region.prazoMinutos)}"></label></div><button type="button" class="btn-ghost g-remove-region">Remover região</button>`;
    row.querySelector('button').onclick = () => { row.remove(); capture(); updateAdd(); };
    regions.append(row);
  }
  const updateAdd = () => { form.querySelector('#g-add-region').disabled = regions.children.length >= 50; };
  config.regioes.forEach(add); updateAdd();
  form.oninput = capture;
  form.querySelector('#g-add-region').onclick = () => { if (regions.children.length >= 50) return; add({ id: crypto.randomUUID(), nome: '', cepInicial: '', cepFinal: '', taxaCentavos: 0, prazoMinutos: 45 }); capture(); updateAdd(); regions.lastElementChild.querySelector('input').focus(); };
  form.onsubmit = async event => {
    event.preventDefault(); capture();
    const delivery = { ...config, pedidoMinimoCentavos: Math.round(Number(draft.minimo) * 100), regioes: config.regioes.map(r => ({ id: r.id, nome: r.nome.trim(), cepInicial: r.cepInicial.replace('-', ''), cepFinal: r.cepFinal.replace('-', ''), taxaCentavos: Math.round(Number(r.taxa) * 100), prazoMinutos: Number(r.prazo) })) };
    try { delivery.horarios = agenda.value(); } catch (e) { result.textContent = e.message; return; }
    const sorted = [...delivery.regioes].sort((a, b) => a.cepInicial.localeCompare(b.cepInicial));
    let error = '';
    if (delivery.ativo && !sorted.length) error = 'Adicione uma região antes de ativar o delivery.';
    else if (sorted.some(r => !r.nome)) error = 'Informe o nome de cada região.';
    else if (sorted.some(r => r.cepInicial > r.cepFinal)) error = 'O CEP final deve ser maior ou igual ao CEP inicial.';
    else if (sorted.some((r, i) => i && r.cepInicial <= sorted[i - 1].cepFinal)) error = 'As faixas de CEP não podem se sobrepor. Ajuste as regiões.';
    if (error) { result.textContent = error; return; }
    await save({ versao: draft.versao, delivery }, result);
  };
}
