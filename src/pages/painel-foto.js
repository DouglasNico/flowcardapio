import { esc, erroAmigavel } from "../lib/format.js";
import { ico } from "../lib/icons.js";
import { htmlFoto, normalizarEnquadramento, estiloEnquadramento } from "../lib/foto.js";
import "./painel-foto.css";

export function abrirEditorFoto({ nome, fotoUrl, enquadramento, onSave, onClose }) {
  const anterior = document.activeElement;
  const html = document.documentElement;
  const jaTravado = html.classList.contains("is-locked");
  const gapAnterior = html.style.getPropertyValue("--lock-gap");
  const dialog = document.createElement("dialog");
  dialog.className = "editor-foto";
  dialog.setAttribute("aria-labelledby", "editor-foto-titulo");
  let ajuste = normalizarEnquadramento(enquadramento);
  let recorte = ajuste.modo === "preencher" ? { ...ajuste } : normalizarEnquadramento();
  let comFundo = ajuste.modo === "inteira" ? { ...ajuste } : normalizarEnquadramento({ modo: "inteira" });
  let salvando = false, pronta = false, arraste = null;
  dialog.innerHTML = `
    <header class="editor-foto-top"><h2 id="editor-foto-titulo" title="Ajustar foto - ${esc(nome)}"><span>Ajustar foto -</span> <span class="editor-foto-nome">${esc(nome)}</span></h2>
      <button type="button" class="btn-ghost" data-fechar aria-label="Fechar ajuste da foto">${ico.close}</button></header>
    <div class="editor-foto-body">
      <fieldset class="foto-modos" aria-label="Como mostrar a foto">
        <label><input type="radio" name="foto-modo" value="inteira"> <span><b>Foto inteira</b><small>Bordas com fundo desfocado</small></span></label>
        <label><input type="radio" name="foto-modo" value="preencher"> <span><b>Preencher espaço</b><small>Recorte com zoom e posição</small></span></label>
      </fieldset>
      <div class="foto-previas">
        <figure><figcaption>No carrossel (Mais pedidos)</figcaption><div class="foto-previa foto-previa-ampla" data-previa></div></figure>
        <figure><figcaption>Na lista de produtos</figcaption><div class="foto-previa foto-previa-quadrada" data-previa></div></figure>
      </div>
      <p class="foto-dica" data-dica></p>
      <fieldset class="foto-controles"><legend>Zoom e posição</legend>
        <label>Zoom <output data-valor="zoom"></output><input type="range" data-ajuste="zoom" aria-label="Zoom da foto" min="1" max="3" step="0.01"></label>
        <label>Horizontal <output data-valor="x"></output><input type="range" data-ajuste="x" aria-label="Posição horizontal" min="0" max="100" step="1"></label>
        <label>Vertical <output data-valor="y"></output><input type="range" data-ajuste="y" aria-label="Posição vertical" min="0" max="100" step="1"></label>
      </fieldset>
      <button type="button" class="btn-ghost" data-reset>Restaurar enquadramento</button>
      <p class="foto-erro" role="alert" data-erro></p>
    </div>
    <footer class="editor-foto-foot"><button type="button" class="btn-ghost" data-cancelar>Cancelar</button><button type="button" class="btn-primary" data-salvar disabled>Salvar enquadramento</button></footer>`;
  document.body.append(dialog);
  if (!jaTravado) {
    const gap = CSS.supports("scrollbar-gutter: stable") ? 0 : Math.max(0, innerWidth - html.clientWidth);
    html.style.setProperty("--lock-gap", `${gap}px`);
    html.classList.add("is-locked");
    document.body.classList.add("is-locked");
  }

  function atualizar(recriar = false) {
    const inteira = ajuste.modo === "inteira";
    dialog.querySelectorAll("[data-previa]").forEach(pre => {
      if (recriar) pre.innerHTML = htmlFoto({ fotoUrl, fotoEnquadramento: ajuste });
      else pre.firstElementChild.style.cssText = estiloEnquadramento(ajuste);
      pre.classList.toggle("pode-arrastar", !salvando);
    });
    dialog.querySelectorAll("[name=foto-modo]").forEach(input => input.checked = input.value === ajuste.modo);
    dialog.querySelector(".foto-controles").disabled = salvando;
    dialog.querySelectorAll("[data-ajuste]").forEach(input => {
      const key = input.dataset.ajuste;
      input.disabled = salvando;
      input.value = ajuste[key];
      const texto = key === "zoom" ? `${ajuste.zoom.toFixed(2).replace(".", ",")}×` : `${Math.round(ajuste[key])}%`;
      dialog.querySelector(`[data-valor="${key}"]`).textContent = texto;
      input.setAttribute("aria-valuetext", texto);
    });
    dialog.querySelector("[data-dica]").textContent = inteira
      ? "Arraste a foto ou use zoom e posição. O fundo desfocado é mantido; as prévias mostram o recorte final."
      : "Arraste a foto em uma prévia ou use os controles para ajustar o recorte.";
  }
  atualizar(true);
  // Observe a separate image: changing the preview mode must not reset loading state.
  const fonte = new Image();
  fonte.onload = () => { pronta = true; dialog.querySelector("[data-salvar]").disabled = salvando; };
  fonte.onerror = () => { dialog.querySelector("[data-erro]").textContent = "Não foi possível carregar a foto. Feche e tente novamente."; };
  fonte.src = fotoUrl;

  dialog.querySelectorAll("[name=foto-modo]").forEach(input => input.onchange = () => {
    if (ajuste.modo === "preencher") recorte = { ...ajuste };
    else comFundo = { ...ajuste };
    ajuste = normalizarEnquadramento(input.value === "inteira" ? comFundo : recorte);
    atualizar(true);
  });
  dialog.querySelectorAll("[data-ajuste]").forEach(input => input.oninput = () => {
    ajuste = normalizarEnquadramento({ ...ajuste, [input.dataset.ajuste]: Number(input.value) });
    atualizar();
  });
  dialog.querySelector("[data-reset]").onclick = () => {
    ajuste = normalizarEnquadramento({ modo: ajuste.modo });
    atualizar();
  };
  dialog.querySelectorAll("[data-previa]").forEach(pre => {
    pre.onpointerdown = ev => {
      if (salvando || !pronta || ev.button !== 0) return;
      const rect = pre.getBoundingClientRect();
      const escala = Math.max(rect.width / fonte.naturalWidth, rect.height / fonte.naturalHeight) * ajuste.zoom;
      arraste = { id: ev.pointerId, px: ev.clientX, py: ev.clientY, x: ajuste.x, y: ajuste.y,
        inteira: ajuste.modo === "inteira", frameW: rect.width, frameH: rect.height,
        largura: fonte.naturalWidth * escala - rect.width, altura: fonte.naturalHeight * escala - rect.height };
      pre.setPointerCapture(ev.pointerId);
    };
    pre.onpointermove = ev => {
      if (!arraste || arraste.id !== ev.pointerId || salvando) return;
      const dx = ev.clientX - arraste.px, dy = ev.clientY - arraste.py;
      ajuste = normalizarEnquadramento({ ...ajuste,
        x: arraste.inteira ? arraste.x + dx / arraste.frameW * 100
          : arraste.largura > 1 ? arraste.x - dx / arraste.largura * 100 : ajuste.x,
        y: arraste.inteira ? arraste.y + dy / arraste.frameH * 100
          : arraste.altura > 1 ? arraste.y - dy / arraste.altura * 100 : ajuste.y });
      atualizar();
    };
    pre.onpointerup = pre.onpointercancel = pre.onlostpointercapture = () => { arraste = null; };
  });

  const fechar = () => { if (!salvando) dialog.close(); };
  dialog.querySelector("[data-fechar]").onclick = fechar;
  dialog.querySelector("[data-cancelar]").onclick = fechar;
  dialog.addEventListener("cancel", ev => { if (salvando) ev.preventDefault(); });
  dialog.addEventListener("close", () => {
    fonte.onload = fonte.onerror = null;
    if (!jaTravado) {
      html.classList.remove("is-locked"); document.body.classList.remove("is-locked");
      if (gapAnterior) html.style.setProperty("--lock-gap", gapAnterior); else html.style.removeProperty("--lock-gap");
    }
    dialog.remove();
    if (anterior?.isConnected) anterior.focus({ preventScroll: true });
    else onClose?.();
  }, { once: true });
  dialog.querySelector("[data-salvar]").onclick = async () => {
    if (salvando || !pronta) return;
    salvando = true;
    dialog.setAttribute("aria-busy", "true");
    dialog.querySelector("[data-erro]").textContent = "";
    dialog.querySelectorAll("button,input").forEach(el => el.disabled = true);
    dialog.querySelector("[data-salvar]").textContent = "Salvando…";
    try {
      await onSave(normalizarEnquadramento(ajuste));
      salvando = false; dialog.close();
    } catch (err) {
      salvando = false;
      dialog.removeAttribute("aria-busy");
      dialog.querySelectorAll("button,input").forEach(el => el.disabled = false);
      dialog.querySelector("[data-salvar]").textContent = "Salvar enquadramento";
      dialog.querySelector("[data-erro]").textContent = erroAmigavel(err);
      atualizar();
    }
  };
  dialog.showModal();
  dialog.querySelector("[name=foto-modo]:checked").focus({ preventScroll: true });
}
