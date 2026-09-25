export function validarFotoV2(value) {
  if (!value) return;
  let url;
  try { url = new URL(value); } catch { throw Error('URL de foto inválida.'); }
  if (value.length > 2048 || url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw Error('URL de imagem inválida.');
  }
}

export function renderFotoGestao(container, initialUrl = '', onUpload = null) {
  const wrapper = document.createElement('div');
  wrapper.className = 'g-photo-box';

  wrapper.innerHTML = `
    <label class="g-field-label">Foto do Produto</label>
    <div class="g-photo-dropzone" id="g-photo-dropzone">
      <div class="g-photo-preview-wrap ${initialUrl ? 'has-image' : 'is-empty'}">
        <img src="${initialUrl || ''}" alt="Foto do produto" class="g-photo-img ${initialUrl ? '' : 'is-hidden'}">
        <div class="g-photo-empty ${initialUrl ? 'is-hidden' : ''}">
          <div class="g-photo-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2"></rect>
              <circle cx="8.5" cy="10" r="1.5"></circle>
              <path d="M21 16l-5.5-5.5L7 19"></path>
            </svg>
          </div>
          <strong>Escolher foto do produto</strong>
          <small>Tire uma foto no celular ou envie do computador (JPG, PNG ou WebP até 5MB)</small>
        </div>
      </div>

      <input type="file" class="g-photo-file-input" accept="image/jpeg,image/png,image/webp" hidden>
      <input type="hidden" name="imagemUrl" value="${initialUrl || ''}">

      <div class="g-photo-btn-row">
        <button type="button" class="btn-primary g-btn-pick-photo">
          <span>📷</span>
          <span>${initialUrl ? 'Trocar Foto' : 'Escolher Foto'}</span>
        </button>
        <button type="button" class="btn-ghost g-btn-remove-photo ${initialUrl ? '' : 'is-hidden'}" style="color:#ef4444;">
          <span>🗑️</span>
          <span>Remover Foto</span>
        </button>
      </div>
      <p class="g-photo-status" role="status"></p>
    </div>
  `;

  container.append(wrapper);

  const fileInput = wrapper.querySelector('.g-photo-file-input');
  const hiddenInput = wrapper.querySelector('[name=imagemUrl]');
  const pickBtn = wrapper.querySelector('.g-btn-pick-photo');
  const removeBtn = wrapper.querySelector('.g-btn-remove-photo');
  const imgEl = wrapper.querySelector('.g-photo-img');
  const emptyEl = wrapper.querySelector('.g-photo-empty');
  const previewWrap = wrapper.querySelector('.g-photo-preview-wrap');
  const status = wrapper.querySelector('.g-photo-status');
  const dropzone = wrapper.querySelector('#g-photo-dropzone');

  pickBtn.onclick = () => fileInput.click();
  previewWrap.onclick = () => fileInput.click();

  // Drag & drop support
  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.add('is-dragging');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, e => {
      e.preventDefault();
      dropzone.classList.remove('is-dragging');
    });
  });
  dropzone.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  });

  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    if (file) processFile(file);
  };

  async function processFile(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      status.textContent = 'Formato inválido. Escolha uma imagem JPG, PNG ou WebP.';
      status.dataset.tone = 'error';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      status.textContent = 'Imagem muito grande. O tamanho máximo é 5 MB.';
      status.dataset.tone = 'error';
      return;
    }

    // Instant local preview
    const reader = new FileReader();
    reader.onload = ev => {
      imgEl.src = ev.target.result;
      imgEl.classList.remove('is-hidden');
      emptyEl.classList.add('is-hidden');
      previewWrap.classList.add('has-image');
      previewWrap.classList.remove('is-empty');
      removeBtn.classList.remove('is-hidden');
      pickBtn.querySelector('span:last-child').textContent = 'Trocar Foto';
    };
    reader.readAsDataURL(file);

    if (onUpload) {
      status.textContent = 'Enviando imagem…';
      status.dataset.tone = 'info';
      pickBtn.disabled = true;
      try {
        const uploadedUrl = await onUpload(file);
        hiddenInput.value = uploadedUrl;
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        status.textContent = 'Foto pronta para salvar!';
        status.dataset.tone = 'success';
      } catch (err) {
        status.textContent = err.message || 'Erro ao enviar foto. Tente novamente.';
        status.dataset.tone = 'error';
      } finally {
        pickBtn.disabled = false;
        fileInput.value = '';
      }
    }
  }

  removeBtn.onclick = () => {
    hiddenInput.value = '';
    hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
    imgEl.src = '';
    imgEl.classList.add('is-hidden');
    emptyEl.classList.remove('is-hidden');
    previewWrap.classList.remove('has-image');
    previewWrap.classList.add('is-empty');
    removeBtn.classList.add('is-hidden');
    pickBtn.querySelector('span:last-child').textContent = 'Escolher Foto';
    status.textContent = 'Foto removida.';
    status.dataset.tone = 'info';
    fileInput.value = '';
  };
}
