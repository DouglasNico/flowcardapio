const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const minute = text => { if (!/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(text)) throw Error('Preencha os horários no formato HH:MM.'); return Number(text.slice(0, 2)) * 60 + Number(text.slice(3)); };

export function renderHorariosGestao(host, existing, raw, changed) {
  const state = raw || { ativo: existing != null, fuso: existing?.fuso || 'America/Sao_Paulo', periodos: (existing?.periodos || []).map(p => ({ dia: p.dia, inicio: clock(p.inicio), fim: clock(p.fim) })) };
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const zones = [...new Set(['America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco', 'America/Noronha', state.fuso])];
  host.innerHTML = `<h3>Horários de delivery</h3><label class="g-check"><input name="horariosAtivos" type="checkbox" ${state.ativo ? 'checked' : ''}>Definir dias e horários</label><p>Sem essa opção, o delivery não tem restrição de horário. Com ela, dias sem períodos ficam fechados. Para atravessar a madrugada, termine às 24:00 e adicione o restante no dia seguinte.</p><fieldset class="g-schedule-fields"><legend>Agenda semanal</legend><label>Fuso horário<select name="fuso">${zones.map(z => `<option ${z === state.fuso ? 'selected' : ''}>${esc(z)}</option>`).join('')}</select></label><div class="g-periods"></div><button class="btn-ghost" type="button" id="g-add-period">Adicionar período</button></fieldset>`;
  const fields = host.querySelector('fieldset'), list = host.querySelector('.g-periods'), enabled = host.querySelector('[name=horariosAtivos]'), addButton = host.querySelector('#g-add-period');
  const snapshot = () => ({ ativo: enabled.checked, fuso: host.querySelector('[name=fuso]').value, periodos: [...list.children].map(row => ({ dia: Number(row.querySelector('[name=dia]').value), inicio: row.querySelector('[name=inicio]').value, fim: row.querySelector('[name=fim]').value })) });
  function update() { fields.hidden = !enabled.checked; fields.disabled = !enabled.checked; addButton.disabled = list.children.length >= 28; }
  function add(period) {
    const row = document.createElement('fieldset'); row.className = 'g-period';
    row.innerHTML = `<legend>Período de atendimento</legend><label>Dia<select name="dia">${days.map((day, i) => `<option value="${i}" ${i === period.dia ? 'selected' : ''}>${day}</option>`).join('')}</select></label><div class="g-delivery-pair"><label>Abre às<input name="inicio" type="time" required value="${esc(period.inicio)}"></label><label>Fecha às<input name="fim" required maxlength="5" pattern="([01][0-9]|2[0-3]):[0-5][0-9]|24:00" placeholder="HH:MM" value="${esc(period.fim)}"></label></div><button class="btn-ghost" type="button">Remover período</button>`;
    row.querySelector('button').onclick = () => { row.remove(); update(); changed(snapshot()); };
    list.append(row);
  }
  state.periodos.forEach(add); update();
  host.addEventListener('input', () => { update(); changed(snapshot()); });
  addButton.onclick = () => { if (list.children.length >= 28) return; add({ dia: 1, inicio: '', fim: '' }); update(); changed(snapshot()); list.lastElementChild.querySelector('select').focus(); };
  return { snapshot, value() {
    const draft = snapshot(); if (!draft.ativo) return null;
    if (!draft.periodos.length) throw Error('Adicione pelo menos um período de delivery ou desative a restrição de horários.');
    const periodos = draft.periodos.map(p => ({ dia: p.dia, inicio: minute(p.inicio), fim: minute(p.fim) })).sort((a, b) => a.dia - b.dia || a.inicio - b.inicio);
    if (periodos.some(p => p.inicio >= p.fim)) throw Error('O fechamento deve ser depois da abertura. Divida a madrugada entre os dois dias.');
    if (periodos.some((p, i) => i && p.dia === periodos[i - 1].dia && p.inicio < periodos[i - 1].fim)) throw Error('Existem horários sobrepostos no mesmo dia. Ajuste os períodos.');
    return { fuso: draft.fuso, periodos };
  } };
}
