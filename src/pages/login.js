import { loginGestor } from "../lib/auth.js";
import { soNumeroChave } from "../lib/chave.js";
import { erroAmigavel } from "../lib/format.js";
import { ico } from "../lib/icons.js";

export function renderLogin(app) {
  document.body.className = "is-painel";
  app.innerHTML = `
    <main class="login-page">
      <form class="login-card" id="form-login">
        <img src="/logos/FlowPDV-vertical-escuro.png" alt="FlowPDV">
        <h1>Painel do <span>cardápio</span></h1>
        <p class="sub">Entre com a chave da loja e a senha do gestor</p>
        <div class="login-error" id="login-error"></div>
        <div class="field">
          <label for="login-chave">Chave da licença</label>
          <div class="chave-row">
            <span>LIC-FLOW-</span>
            <input id="login-chave" inputmode="numeric" autocomplete="off" maxlength="16" required placeholder="000000">
          </div>
        </div>
        <div class="field">
          <label for="login-pin">Senha do gestor</label>
          <div class="pin-wrap">
            <input id="login-pin" type="password" required maxlength="8" autocomplete="current-password" placeholder="••••">
            <button type="button" id="btn-ver-pin" aria-label="Mostrar senha">${ico.eye}</button>
          </div>
        </div>
        <label class="remember"><input type="checkbox" id="login-lembrar" checked> Manter conectado</label>
        <button class="btn-primary" id="btn-entrar" type="submit">Entrar</button>
      </form>
    </main>
  `;

  const chaveEl = app.querySelector("#login-chave");
  const pinEl = app.querySelector("#login-pin");
  const errEl = app.querySelector("#login-error");
  const btn = app.querySelector("#btn-entrar");

  const limparChave = () => {
    const v = soNumeroChave(chaveEl.value);
    if (chaveEl.value !== v) chaveEl.value = v;
  };
  chaveEl.addEventListener("input", limparChave);
  chaveEl.addEventListener("blur", limparChave);

  app.querySelector("#btn-ver-pin").addEventListener("click", () => {
    pinEl.type = pinEl.type === "password" ? "text" : "password";
  });

  app.querySelector("#form-login").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    errEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Entrando...";
    try {
      await loginGestor(chaveEl.value, pinEl.value, app.querySelector("#login-lembrar").checked);
      history.replaceState({}, "", "/painel");
      window.dispatchEvent(new Event("flowpdv:route"));
    } catch (err) {
      errEl.textContent = erroAmigavel(err);
      errEl.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });
}
