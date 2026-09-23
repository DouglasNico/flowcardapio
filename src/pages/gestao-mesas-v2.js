import QRCode from 'qrcode';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderMesasGestao(host, data, draft, changed, save) {
  host.innerHTML = '<header class="page-head"><div><h2>Mesas e QR Codes</h2><p>Vincule cada mesa ao seu número no PDV.</p></div><button type="button" class="btn-primary" id="g-new-table">Cadastrar mesa</button></header><p>Os links deste ambiente são locais e não abrem em outro celular. O QR de teste não deve ser distribuído aos clientes.</p><div class="g-table-list"></div><div class="g-table-qr" aria-live="polite"></div><div class="g-table-editor"></div>';
  const list = host.querySelector('.g-table-list'), editor = host.querySelector('.g-table-editor'), qr = host.querySelector('.g-table-qr');
  let current = draft, dirty = Boolean(draft), generation = 0;
  function edit(value) {
    if (dirty && !window.confirm('Descartar as alterações desta mesa para abrir outro cadastro?')) return;
    current = value; dirty = false;
    changed(current);
    editor.innerHTML = `<form class="g-form g-table-form"><h3>${value.nova ? 'Cadastrar mesa' : 'Editar mesa'}</h3><label>Nome da mesa<input name="mesaNome" required maxlength="80" value="${esc(value.nome)}" placeholder="Nome usado no atendimento"></label><label>Número no PDV<input name="mesaNumero" type="number" required min="1" max="9999" step="1" value="${esc(value.numero)}"></label><label class="g-check"><input name="mesaAtiva" type="checkbox" ${value.ativo ? 'checked' : ''}>Mesa ativa</label><button class="btn-primary" type="submit">Salvar mesa</button><p class="g-result" role="status"></p></form>`;
    const form = editor.querySelector('form');
    const capture = () => { current = { ...current, nome: form.elements.mesaNome.value, numero: form.elements.mesaNumero.value, ativo: form.elements.mesaAtiva.checked }; dirty = true; changed(current); };
    form.oninput = capture;
    form.onsubmit = async event => {
      event.preventDefault(); capture(); const result = form.querySelector('.g-result');
      if (!current.nome.trim()) { result.textContent = 'Informe o nome da mesa.'; return; }
      await save({ versao: current.versao, mesaId: current.mesaId, nome: current.nome.trim(), numero: Number(current.numero), ativo: current.ativo }, result);
    };
  }
  for (const mesa of [...data.mesas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))) {
    const row = document.createElement('article'); row.className = 'g-table-row';
    row.innerHTML = `<div><strong>${esc(mesa.nome)}</strong><small>${esc(mesa.comandaPdvId || 'Sem vínculo no PDV')} · ${mesa.ativo ? 'Ativa' : 'Inativa'}</small></div><button class="btn-ghost g-edit-table" type="button">Editar mesa</button>${mesa.ativo ? '<button class="btn-ghost g-show-qr" type="button">Ver QR de teste</button>' : ''}`;
    row.querySelector('.g-edit-table').onclick = () => edit({ mesaId: mesa.id, versao: data.versao, nome: mesa.nome, numero: String(mesa.comandaPdvId || '').replace(/^MESA-/, ''), ativo: mesa.ativo });
    const show = row.querySelector('.g-show-qr');
    if (show) show.onclick = async () => {
      const epoch = ++generation;
      const url = new URL(`/v2/${encodeURIComponent(data.slug)}/mesa/${encodeURIComponent(mesa.id)}`, location.origin).href;
      qr.textContent = 'Gerando QR de teste…';
      try {
        const png = await QRCode.toDataURL(url, { width: 320, margin: 4, errorCorrectionLevel: 'M' });
        if (generation !== epoch || !host.isConnected) return;
        qr.innerHTML = `<h3>${esc(mesa.nome)}</h3><img width="240" height="240" alt="QR de teste da ${esc(mesa.nome)}" src="${png}"><a class="g-table-link" href="${esc(url)}" target="_blank" rel="noopener">Abrir cardápio desta mesa</a><a class="btn-ghost" href="${png}" download="qr-teste-${esc(mesa.id)}.png">Baixar QR de teste</a>`;
      } catch { if (generation === epoch && host.isConnected) qr.textContent = 'Não foi possível gerar o QR. Tente novamente.'; }
    };
    list.append(row);
  }
  if (!data.mesas.length) list.textContent = 'Nenhuma mesa cadastrada. Cadastre a primeira para gerar seu QR.';
  host.querySelector('#g-new-table').onclick = () => edit({ nova: true, mesaId: crypto.randomUUID(), versao: data.versao, nome: '', numero: '', ativo: true });
  if (draft) { dirty = false; edit(draft); dirty = true; }
}
