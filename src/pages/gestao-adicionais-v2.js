const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function renderAdicionaisGestao(host, data, draft, changed, save) {
  const products = data.catalogo.produtos || [];
  host.innerHTML = '<h2>Adicionais dos produtos</h2><p>Organize as opções em grupos, como acompanhamentos ou ponto da carne.</p><label class="g-search">Produto<select id="g-addon-product"><option value="">Selecione um produto salvo</option></select></label><div class="g-addon-content"></div>';
  const select = host.querySelector('select'), content = host.querySelector('.g-addon-content');
  products.forEach(p => select.add(new Option(p.nome, p.id)));
  let current = draft, dirty = Boolean(draft);
  function open(product, values) {
    select.value = product.id;
    content.innerHTML = '<div class="g-addon-list"></div><button type="button" class="btn-ghost" id="g-new-addon">Adicionar opção</button><div class="g-addon-editor"></div>';
    const list = content.querySelector('.g-addon-list'), editor = content.querySelector('.g-addon-editor');
    for (const group of product.grupos || []) for (const option of group.opcoes || []) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'g-product';
      button.textContent = `${group.nome} · ${option.nome} · ${option.ativo ? 'Ativa' : 'Inativa'}`;
      button.onclick = () => {
        if (dirty && !window.confirm('Descartar o rascunho para editar esta opção?')) return;
        dirty = false;
        edit({ produtoId: product.id, versao: data.versao, grupoId: group.id, opcaoId: option.id, nomeGrupo: group.nome, min: group.min, max: group.max, nome: option.nome, preco: (option.precoCentavos / 100).toFixed(2), maxQuantidade: option.maxQuantidade, ativo: option.ativo, existente: true });
      }; list.append(button);
    }
    const create = () => ({ produtoId: product.id, versao: data.versao, grupoId: crypto.randomUUID(), opcaoId: crypto.randomUUID(), nomeGrupo: '', min: 0, max: 1, nome: '', preco: '0.00', maxQuantidade: 1, ativo: true });
    content.querySelector('#g-new-addon').onclick = () => { if (dirty && !window.confirm('Descartar o rascunho para adicionar outra opção?')) return; dirty = false; edit(create()); };
    function edit(value) {
      current = value; changed(current);
      editor.innerHTML = `<form class="g-form g-addon-form"><h3>${value.existente ? 'Editar opção' : 'Adicionar opção'}</h3>${!value.existente ? `<label>Grupo<select name="grupo"><option value="">Criar novo grupo</option>${(product.grupos || []).map(g => `<option value="${esc(g.id)}" ${value.grupoId === g.id ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select></label>` : ''}<label>Nome do grupo<input name="nomeGrupo" maxlength="80" required value="${esc(value.nomeGrupo)}"></label><div class="g-delivery-pair"><label>Mínimo de escolhas<input name="min" type="number" min="0" max="20" step="1" required value="${esc(value.min)}"></label><label>Máximo de escolhas<input name="max" type="number" min="1" max="20" step="1" required value="${esc(value.max)}"></label></div><p>Nome e limites do grupo valem para todas as opções dele.</p><label>Nome da opção<input name="opcaoNome" maxlength="80" required value="${esc(value.nome)}"></label><label>Preço adicional (R$)<input name="opcaoPreco" type="number" min="0" max="10000" step="0.01" required value="${esc(value.preco)}"></label><label>Quantidade máxima desta opção<input name="maxQuantidade" type="number" min="1" max="10" step="1" required value="${esc(value.maxQuantidade)}"></label><label class="g-check"><input name="opcaoAtiva" type="checkbox" ${value.ativo ? 'checked' : ''}>Opção ativa</label><button type="submit" class="btn-primary">Salvar adicional</button><p class="g-result" role="status"></p></form>`;
      const form = editor.querySelector('form'), f = form.elements;
      const capture = () => { current = { ...current, nomeGrupo: f.nomeGrupo.value, min: f.min.value, max: f.max.value, nome: f.opcaoNome.value, preco: f.opcaoPreco.value, maxQuantidade: f.maxQuantidade.value, ativo: f.opcaoAtiva.checked }; dirty = true; changed(current); };
      form.oninput = capture;
      if (f.grupo) f.grupo.onchange = () => {
        const group = product.grupos.find(g => g.id === f.grupo.value);
        current.grupoId = group?.id || crypto.randomUUID();
        f.nomeGrupo.value = group?.nome || ''; f.min.value = group?.min ?? 0; f.max.value = group?.max ?? 1; capture();
      };
      form.onsubmit = async event => {
        event.preventDefault(); capture(); const result = form.querySelector('.g-result');
        if (!current.nome.trim() || !current.nomeGrupo.trim()) { result.textContent = 'Informe os nomes do grupo e da opção.'; return; }
        if (Number(current.min) > Number(current.max)) { result.textContent = 'O mínimo de escolhas não pode ultrapassar o máximo.'; return; }
        await save({ produtoId: current.produtoId, versao: current.versao, grupoId: current.grupoId, opcaoId: current.opcaoId, nomeGrupo: current.nomeGrupo.trim(), min: Number(current.min), max: Number(current.max), nome: current.nome.trim(), precoCentavos: Math.round(Number(current.preco) * 100), maxQuantidade: Number(current.maxQuantidade), ativo: current.ativo }, result);
      };
    }
    if (values) edit(values);
  }
  select.onchange = () => {
    if (dirty && !window.confirm('Descartar o rascunho para trocar de produto?')) { select.value = current.produtoId; return; }
    dirty = false; current = null; changed(null); content.replaceChildren();
    const p = products.find(p => p.id === select.value); if (p) open(p);
  };
  if (draft) { const p = products.find(p => p.id === draft.produtoId); if (p) open(p, draft); }
}
