const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function renderContatoGestao(host, initial, changed, save) {
  host.innerHTML = `<form class="g-form g-contact-form"><h2>Contato da loja</h2><p>Estes dados aparecem no cardápio do cliente. Use apenas o telefone e o endereço comercial que deseja divulgar.</p><label>Telefone comercial<input name="contatoTelefone" type="tel" maxlength="25" value="${esc(initial.contato.telefone)}" placeholder="Telefone comercial com DDD"></label><label>Endereço comercial<input name="contatoEndereco" maxlength="200" value="${esc(initial.contato.endereco)}" placeholder="Informe o endereço comercial"></label><p>Deixe o campo vazio para retirar a informação do cardápio.</p><button class="btn-primary" type="submit">Salvar contato</button><p class="g-result" role="status"></p></form>`;
  const form = host.querySelector('form');
  const capture = () => ({ versao: initial.versao, contato: { telefone: form.elements.contatoTelefone.value.trim(), endereco: form.elements.contatoEndereco.value.trim() } });
  form.oninput = () => changed(capture());
  form.onsubmit = async event => {
    event.preventDefault(); const draft = capture(), result = form.querySelector('.g-result'); changed(draft);
    const digits = draft.contato.telefone.replace(/\D/g, '');
    if (!/^[+\d\s().-]*$/.test(draft.contato.telefone) || (digits && !/^\d{10,15}$/.test(digits))) { result.textContent = 'Informe um telefone com DDD, entre 10 e 15 dígitos.'; return; }
    await save(draft, result);
  };
}
