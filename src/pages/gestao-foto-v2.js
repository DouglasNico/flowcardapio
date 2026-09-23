export function validarFotoV2(value) {
  if (!value) return;
  let url; try { url = new URL(value); } catch { throw Error('Informe o link HTTPS de uma imagem hospedada no Cloudinary.'); }
  if (value.length > 2048 || url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port || url.search || url.hash || !/^\/[^/]+\/image\/upload\/.+/.test(url.pathname)) throw Error('Use um link HTTPS de imagem do Cloudinary, sem parâmetros ou credenciais.');
}
export function renderFotoGestao(form, value, upload = null) {
  const section = document.createElement('section'); section.className = 'g-photo-editor';
  section.innerHTML = '<h3>Foto do produto</h3><label>Link da foto no Cloudinary<input name="imagemUrl" type="url" maxlength="2048" placeholder="Cole o link HTTPS da foto já hospedada"></label><p>Envie JPG, PNG ou WebP de até 5 MB, ou cole um link. Após o envio, salve o produto para aplicar a foto.</p><input class="g-photo-file" type="file" accept="image/jpeg,image/png,image/webp" hidden><div class="g-photo-actions"><button type="button" class="btn-primary g-photo-upload">Adicionar ou trocar foto</button><button type="button" class="btn-ghost g-photo-preview">Visualizar foto</button><button type="button" class="btn-ghost g-photo-remove">Remover foto do produto</button></div><p class="g-photo-status" role="status"></p><div class="g-photo-image"></div>';
  form.insertBefore(section, form.querySelector('button'));
  const input = section.querySelector('[name=imagemUrl]'), status = section.querySelector('.g-photo-status'), preview = section.querySelector('.g-photo-image'); input.value = value || '';
  let generation = 0;
  const fileInput = section.querySelector('.g-photo-file'), uploadButton = section.querySelector('.g-photo-upload');
  if (!upload) { uploadButton.disabled = true; status.textContent = 'Salve o produto antes de enviar um arquivo.'; }
  uploadButton.onclick = () => { if (upload) fileInput.click(); };
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0]; if (!file || !upload) return;
    status.textContent = 'Enviando foto…';
    try {
      const url = await upload(file);
      if (!section.isConnected) return;
      input.value = url; input.dispatchEvent(new Event('input', { bubbles: true }));
      status.textContent = 'Foto enviada. Salve o produto para aplicar a alteração.';
    } catch (e) { if (section.isConnected) status.textContent = e.message || 'Não foi possível enviar a foto. Tente novamente.'; }
    finally { fileInput.value = ''; }
  };
  input.addEventListener('input', () => { generation++; preview.replaceChildren(); status.textContent = ''; });
  section.querySelector('.g-photo-remove').onclick = () => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); status.textContent = 'Foto retirada do rascunho. Salve o produto para confirmar.'; };
  section.querySelector('.g-photo-preview').onclick = () => {
    preview.replaceChildren(); const current = ++generation;
    try { validarFotoV2(input.value.trim()); if (!input.value.trim()) throw Error('Adicione o link de uma foto para visualizar.'); }
    catch (e) { status.textContent = e.message; return; }
    status.textContent = 'Carregando foto…'; const img = new Image(); img.alt = 'Prévia da foto do produto'; img.referrerPolicy = 'no-referrer';
    img.onload = () => { if (generation !== current || !section.isConnected) return; preview.append(img); status.textContent = 'Prévia da foto. Salve o produto para confirmar o vínculo.'; };
    img.onerror = () => { if (generation === current && section.isConnected) status.textContent = 'Não foi possível carregar a foto. Confira o link e a conexão.'; }; img.src = input.value.trim();
  };
}
