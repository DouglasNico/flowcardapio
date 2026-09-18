import { esc, toast } from "../lib/format.js";
import { novoId, sanitizarGrupos, ordenarGrupos } from "../lib/grupos.js";
import { precoProduto } from "../lib/backup.js";

const TEMPLATES = [
  {
    nome: "Adicionais",
    tipo: "multi",
    min: 0,
    max: 6,
    opcoes: [
      { nome: "Bacon", preco: 4 },
      { nome: "Cheddar", preco: 3 },
      { nome: "Ovo", preco: 2 }
    ]
  },
  {
    nome: "Molhos",
    tipo: "single",
    min: 0,
    max: 1,
    opcoes: [
      { nome: "Barbecue", preco: 0 },
      { nome: "Maionese da casa", preco: 0 },
      { nome: "Sem molho", preco: 0 }
    ]
  },
  {
    nome: "Ponto da carne",
    tipo: "single",
    min: 1,
    max: 1,
    opcoes: [
      { nome: "Mal passada", preco: 0 },
      { nome: "Ao ponto", preco: 0 },
      { nome: "Bem passada", preco: 0 }
    ]
  },
  {
    nome: "Combo",
    tipo: "single",
    min: 0,
    max: 1,
    precoGrupo: 12,
    inclusoNome: "Batata frita",
    opcoes: [
      { nome: "Refrigerante lata", preco: 0 }
    ]
  }
];

function opcaoVazia(extra = {}) {
  return {
    id: extra.id || novoId("o"),
    nome: extra.nome || "",
    descricao: extra.descricao || "",
    preco: Number(extra.preco) || 0
  };
}

function grupoVazio(extra = {}) {
  const opcoes = Array.isArray(extra.opcoes) && extra.opcoes.length
    ? extra.opcoes.map((o) => opcaoVazia(o))
    : [opcaoVazia()];
  return {
    id: extra.id || novoId("g"),
    nome: extra.nome || "",
    tipo: extra.tipo || "multi",
    min: extra.min != null ? extra.min : 0,
    max: extra.max != null ? extra.max : 6,
    precoGrupo: Number(extra.precoGrupo) || 0,
    inclusoNome: extra.inclusoNome || "",
    opcoes
  };
}

export function abrirEditorGrupos({ produto, overlay, produtos, onSave, onClose }) {
  let grupos = JSON.parse(JSON.stringify((overlay && overlay.grupos) || []));
  if (!Array.isArray(grupos)) grupos = [];
  grupos = ordenarGrupos(grupos);

  const wrap = document.createElement("div");
  wrap.className = "modal";
  const html = document.documentElement;
  const gap = Math.max(0, window.innerWidth - html.clientWidth);
  html.style.setProperty("--lock-gap", `${gap}px`);
  html.classList.add("is-locked");
  document.body.classList.add("is-locked");
  document.body.appendChild(wrap);

  function fechar() {
    html.classList.remove("is-locked");
    document.body.classList.remove("is-locked");
    html.style.removeProperty("--lock-gap");
    wrap.remove();
    if (onClose) onClose();
  }

  function lerCampos() {
    wrap.querySelectorAll(".ed-group").forEach((sec) => {
      const gi = Number(sec.dataset.gi);
      if (!grupos[gi]) return;
      const nomeEl = sec.querySelector("[data-nome]");
      const tipoEl = sec.querySelector("[data-tipo]");
      const obrEl = sec.querySelector("[data-obr]");
      grupos[gi].nome = nomeEl ? nomeEl.value : grupos[gi].nome;
      grupos[gi].tipo = tipoEl ? tipoEl.value : grupos[gi].tipo;
      grupos[gi].min = obrEl && obrEl.checked ? 1 : 0;
      grupos[gi].max = grupos[gi].tipo === "single" ? 1 : 6;
      grupos[gi].precoGrupo = Number((sec.querySelector("[data-gpreco]") || {}).value) || 0;
      grupos[gi].inclusoNome = String((sec.querySelector("[data-incluso]") || {}).value || "").trim();
      grupos[gi].opcoes = [...sec.querySelectorAll(".ed-opt")].map((row) => ({
        id: (grupos[gi].opcoes && grupos[gi].opcoes[Number(row.dataset.oi)] && grupos[gi].opcoes[Number(row.dataset.oi)].id) || novoId("o"),
        nome: (row.querySelector("[data-onome]") || {}).value || "",
        descricao: "",
        preco: Number((row.querySelector("[data-opreco]") || {}).value) || 0
      }));
    });
  }

  function htmlGrupos() {
    if (!grupos.length) {
      return `<div class="empty-card"><h2>Nenhuma opção ainda</h2><p>Toca num modelo acima. Já vem bacon, molho ou ponto da carne prontos pra você só ajustar o preço.</p></div>`;
    }
    return grupos.map((g, gi) => `
      <section class="ed-group" data-gi="${gi}">
        <div class="ed-group-top">
          <input data-nome placeholder="Nome do grupo" value="${esc(g.nome)}">
          <button type="button" class="btn-ghost" data-del-g>Remover</button>
        </div>
        <div class="ed-flags">
          <label>Como escolhe
            <select data-tipo>
              <option value="multi" ${g.tipo !== "single" ? "selected" : ""}>Pode marcar várias</option>
              <option value="single" ${g.tipo === "single" ? "selected" : ""}>Só uma</option>
            </select>
          </label>
          <label class="ed-check">
            <input type="checkbox" data-obr ${g.min > 0 ? "checked" : ""}>
            Obrigatório
          </label>
        </div>
        <div class="ed-combo">
          <label>Extra do combo (R$)
            <input type="number" step="0.01" min="0" data-gpreco value="${g.precoGrupo || 0}">
          </label>
          <label>O que entra nesse extra
            <input data-incluso placeholder="Batata frita" value="${esc(g.inclusoNome || "")}">
          </label>
        </div>
        <p class="ed-hint">O extra (batata) soma 1 vez + o preço da bebida. Não mexe no PDV.</p>
        ${(g.opcoes || []).map((o, oi) => `
          <div class="ed-opt" data-oi="${oi}">
            <input data-onome placeholder="Nome da opção" value="${esc(o.nome || "")}">
            <label class="ed-preco">R$ <input type="number" step="0.01" min="0" data-opreco value="${o.preco || 0}"></label>
            <button type="button" class="icon-btn" data-del-o aria-label="Apagar opção">✕</button>
          </div>
        `).join("")}
        <div class="ed-opt-actions">
          <button type="button" class="btn-ghost" data-add-o>+ Opção</button>
          <button type="button" class="btn-ghost" data-imp="adicion">Puxar Adicionais do PDV</button>
          <button type="button" class="btn-ghost" data-imp="bebida0">Puxar Bebidas incluso</button>
          <button type="button" class="btn-ghost" data-imp="bebida">Puxar Bebidas com preço</button>
          <button type="button" class="btn-ghost" data-zero>Zerar preços</button>
        </div>
      </section>
    `).join("");
  }

  function focarCampo(gi, ultimo) {
    const sec = wrap.querySelector(`.ed-group[data-gi="${gi}"]`);
    if (!sec) return;
    const campos = [...sec.querySelectorAll("[data-onome]")];
    const el = ultimo ? campos[campos.length - 1] : campos[0];
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function pintarGrupos(foco) {
    const card = wrap.querySelector(".modal-card");
    const y = card ? card.scrollTop : 0;
    const box = wrap.querySelector("#ed-grupos");
    box.innerHTML = htmlGrupos();
    box.querySelectorAll(".ed-group").forEach((sec) => {
      const gi = Number(sec.dataset.gi);
      sec.querySelector("[data-del-g]").addEventListener("click", () => {
        lerCampos();
        grupos.splice(gi, 1);
        pintarGrupos();
      });
      sec.querySelector("[data-add-o]").addEventListener("click", () => {
        lerCampos();
        grupos[gi].opcoes = grupos[gi].opcoes || [];
        grupos[gi].opcoes.push(opcaoVazia());
        pintarGrupos({ gi, ultimo: true });
      });
      sec.querySelectorAll("[data-imp]").forEach((btn) => {
        btn.addEventListener("click", () => {
          lerCampos();
          const key = btn.dataset.imp;
          const incluso = key === "bebida0";
          const hits = (produtos || []).filter((p) => {
            const c = String(p.categoria || "").toLowerCase();
            if (key === "adicion") return /adicion|extra|complem/.test(c);
            return /bebida|refri|suco|cerveja|água|agua/.test(c);
          });
          if (!hits.length) {
            toast("Não achei produtos nessa categoria no PDV.");
            return;
          }
          grupos[gi].opcoes = grupos[gi].opcoes || [];
          const ja = new Set(grupos[gi].opcoes.map((o) => String(o.nome || "").toLowerCase()));
          let n = 0;
          hits.forEach((p) => {
            const nome = String(p.nome || "").trim();
            if (!nome || ja.has(nome.toLowerCase())) return;
            ja.add(nome.toLowerCase());
            grupos[gi].opcoes.push(opcaoVazia({
              nome,
              preco: incluso ? 0 : precoProduto(p)
            }));
            n += 1;
          });
          toast(incluso
            ? `${n} bebidas inclusas no extra. Não entram na categoria Bebidas.`
            : `${n} itens com o preço do PDV.`);
          pintarGrupos({ gi, ultimo: true });
        });
      });
      const zero = sec.querySelector("[data-zero]");
      if (zero) {
        zero.addEventListener("click", () => {
          lerCampos();
          (grupos[gi].opcoes || []).forEach((o) => { o.preco = 0; });
          toast("Preços deste grupo zerados. Ficam inclusos no extra.");
          pintarGrupos({ gi });
        });
      }
      sec.querySelectorAll("[data-del-o]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const row = btn.closest(".ed-opt");
          lerCampos();
          grupos[gi].opcoes.splice(Number(row.dataset.oi), 1);
          pintarGrupos({ gi });
        });
      });
    });
    if (card) card.scrollTop = y;
    if (foco && foco.gi != null) focarCampo(foco.gi, foco.ultimo);
  }

  wrap.innerHTML = `
    <div class="modal-card" role="dialog" aria-labelledby="ed-titulo">
      <header class="editor-head">
        <div>
          <h2 id="ed-titulo">Opções do item</h2>
          <p>${esc(produto.nome || "")}</p>
        </div>
        <button type="button" class="icon-btn" id="ed-fechar" aria-label="Fechar">✕</button>
      </header>
      <p class="editor-help">Isso aparece quando o cliente toca no lanche. Salvar já atualiza o cardápio público.</p>
      <div class="editor-templates">
        ${TEMPLATES.map((t, i) => `<button type="button" class="btn-ghost" data-tpl="${i}">+ ${esc(t.nome)}</button>`).join("")}
      </div>
      <div id="ed-grupos"></div>
      <button type="button" class="btn-ghost" id="ed-add-g">+ Grupo em branco</button>
      <div class="editor-actions">
        <button type="button" class="btn-ghost" id="ed-cancelar">Cancelar</button>
        <button type="button" class="btn-primary" id="ed-salvar">Salvar no cardápio</button>
      </div>
    </div>
  `;

  wrap.querySelector("#ed-fechar").addEventListener("click", fechar);
  wrap.querySelector("#ed-cancelar").addEventListener("click", fechar);
  wrap.querySelector("#ed-add-g").addEventListener("click", () => {
    lerCampos();
    grupos.push(grupoVazio({ nome: "Novo grupo" }));
    pintarGrupos({ gi: grupos.length - 1 });
  });
  wrap.querySelectorAll("[data-tpl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      lerCampos();
      const tpl = TEMPLATES[Number(btn.dataset.tpl)];
      grupos.push(grupoVazio(tpl));
      grupos = ordenarGrupos(grupos);
      const gi = grupos.findIndex((g) => g.nome === (tpl && tpl.nome));
      pintarGrupos({ gi: gi < 0 ? grupos.length - 1 : gi });
    });
  });
  wrap.querySelector("#ed-salvar").addEventListener("click", async () => {
    lerCampos();
    const limpos = sanitizarGrupos(grupos);
    const digitou = grupos.some((g) => (g.opcoes || []).some((o) => String(o.nome || "").trim()));
    if (!limpos.length && digitou) {
      toast("Cada opção precisa de um nome.");
      return;
    }
    const btnSalvar = wrap.querySelector("#ed-salvar");
    btnSalvar.disabled = true;
    btnSalvar.textContent = "Salvando...";
    try {
      await onSave(limpos);
      fechar();
    } catch (err) {
      toast(String(err.message || err));
      btnSalvar.disabled = false;
      btnSalvar.textContent = "Salvar no cardápio";
    }
  });
  wrap.addEventListener("click", (ev) => { if (ev.target === wrap) fechar(); });
  pintarGrupos();
  return fechar;
}
