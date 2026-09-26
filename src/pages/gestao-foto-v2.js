import { esc } from "../lib/format.js";
import { htmlFoto, normalizarEnquadramento } from "../lib/foto.js";
import { abrirEditorFoto } from "./painel-foto.js";
import "../lib/foto.css";
import "./painel-foto.css";

export function validarFotoV2(value) {
  if (!value) return;
  let url;
  try { url = new URL(value); } catch { throw Error('URL de foto inválida.'); }
  if (value.length > 2048 || url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw Error('URL de imagem inválida.');
  }
}

export function renderFotoGestao(container, initialUrl = '', onUpload = null, initialEnquadramento = null, productName = '') {
  let currentUrl = initialUrl || '';
  let currentEnquadramento = normalizarEnquadramento(initialEnquadramento);

  const wrapper = document.createElement('div');
  wrapper.className = 'g-photo-box';

  wrapper.innerHTML = `
    <label class="g-field-label">Foto do Produto</label>
    <div class="g-photo-dropzone ${currentUrl ? 'has-image' : ''}" id="g-photo-dropzone">
      <div class="g-photo-preview-wrap ${currentUrl ? 'has-image' : 'is-empty'}">
        <div class="g-photo-previa-box ${currentUrl ? '' : 'is-hidden'}">
          ${currentUrl ? htmlFoto({ fotoUrl: currentUrl, fotoEnquadramento: currentEnquadramento }) : ''}
        </div>
        <div class="g-photo-empty ${currentUrl ? 'is-hidden' : ''}">
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
      <input type="hidden" name="imagemUrl" value="${esc(currentUrl)}">
      <input type="hidden" name="fotoEnquadramento" value="${currentEnquadramento ? esc(JSON.stringify(currentEnquadramento)) : ''}">

      <div class="g-photo-btn-row">
        <button type="button" class="btn-primary g-btn-pick-photo">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
          <span class="g-photo-btn-label">${currentUrl ? 'Trocar Foto' : 'Escolher Foto'}</span>
        </button>
        <button type="button" class="btn-ghost g-btn-adjust-photo ${currentUrl ? '' : 'is-hidden'}" title="Ajustar enquadramento e zoom">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Ajustar Foto</span>
        </button>
        <button type="button" class="btn-ghost g-btn-remove-photo ${currentUrl ? '' : 'is-hidden'}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <span>Remover Foto</span>
        </button>
      </div>
      <p class="g-photo-status" role="status"></p>
    </div>
  `;

  container.append(wrapper);

  const fileInput = wrapper.querySelector('.g-photo-file-input');
  const hiddenInput = wrapper.querySelector('[name=imagemUrl]');
  const hiddenEnquadramento = wrapper.querySelector('[name=fotoEnquadramento]');
  const pickBtn = wrapper.querySelector('.g-btn-pick-photo');
  const adjustBtn = wrapper.querySelector('.g-btn-adjust-photo');
  const removeBtn = wrapper.querySelector('.g-btn-remove-photo');
  const emptyEl = wrapper.querySelector('.g-photo-empty');
  const previaBox = wrapper.querySelector('.g-photo-previa-box');
  const previewWrap = wrapper.querySelector('.g-photo-preview-wrap');
  const status = wrapper.querySelector('.g-photo-status');
  const dropzone = wrapper.querySelector('#g-photo-dropzone');

  pickBtn.onclick = () => fileInput.click();
  emptyEl.onclick = () => fileInput.click();

  adjustBtn.onclick = () => {
    if (!currentUrl) return;
    const prodNome = productName || document.querySelector('#g-prod-nome')?.value || 'Produto';
    abrirEditorFoto({
      nome: prodNome,
      fotoUrl: currentUrl,
      enquadramento: currentEnquadramento,
      onSave: novoAjuste => {
        currentEnquadramento = novoAjuste;
        hiddenEnquadramento.value = JSON.stringify(novoAjuste);
        previaBox.innerHTML = htmlFoto({ fotoUrl: currentUrl, fotoEnquadramento: currentEnquadramento });
        hiddenEnquadramento.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  };

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
      currentUrl = ev.target.result;
      previaBox.innerHTML = htmlFoto({ fotoUrl: currentUrl, fotoEnquadramento: currentEnquadramento });
      previaBox.classList.remove('is-hidden');
      emptyEl.classList.add('is-hidden');
      previewWrap.classList.add('has-image');
      previewWrap.classList.remove('is-empty');
      dropzone.classList.add('has-image');
      adjustBtn.classList.remove('is-hidden');
      removeBtn.classList.remove('is-hidden');
      const label = pickBtn.querySelector('.g-photo-btn-label');
      if (label) label.textContent = 'Trocar Foto';
    };
    reader.readAsDataURL(file);

    if (onUpload) {
      status.textContent = 'Enviando imagem…';
      status.dataset.tone = 'info';
      pickBtn.disabled = true;
      try {
        const uploadedUrl = await onUpload(file);
        currentUrl = uploadedUrl;
        hiddenInput.value = uploadedUrl;
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        previaBox.innerHTML = htmlFoto({ fotoUrl: currentUrl, fotoEnquadramento: currentEnquadramento });
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
    currentUrl = '';
    hiddenInput.value = '';
    hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
    previaBox.innerHTML = '';
    previaBox.classList.add('is-hidden');
    emptyEl.classList.remove('is-hidden');
    previewWrap.classList.remove('has-image');
    previewWrap.classList.add('is-empty');
    dropzone.classList.remove('has-image');
    adjustBtn.classList.add('is-hidden');
    removeBtn.classList.add('is-hidden');
    const label = pickBtn.querySelector('.g-photo-btn-label');
    if (label) label.textContent = 'Escolher Foto';
    status.textContent = 'Foto removida.';
    status.dataset.tone = 'info';
    fileInput.value = '';
  };
}
