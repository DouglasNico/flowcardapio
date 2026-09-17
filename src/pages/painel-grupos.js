import { esc, toast } from "../lib/format.js";
import { novoId, sanitizarGrupos } from "../lib/grupos.js";
import { precoProduto } from "../lib/backup.js";

const TEMPLATES = [
  { nome: "Adicionais", tipo: "multi", min: 0, max: 6 },
  { nome: "Molhos", tipo: "single", min: 0, max: 1 },
  { nome: "Ponto da carne", tipo: "single", min: 1, max: 1 },
  { nome: "Combo (batata e bebida)", tipo: "single", min: 0, max: 1 }
];

function grupoVazio(extra = {}) {
  return {
    id: novoId("g"),
    nome: extra.nome || "",
    tipo: extra.tipo || "multi",
    min: extra.min != null ? extra.min : 0,
    max: extra.max != null ? extra.max : 6,
    opcoes: extra.opcoes || []
  };
}

function opcaoVazia(extra = {}) {
  return {
    id: novoId("o"),
    nome: extra.nome || "",
    descricao: extra.descricao || "",
    preco: extra.preco || 0
  };
}

export function abrirEditorGrupos({ produto, overlay, produtos, onSave, onClose }) {
  let grupos = JSON.parse(JSON.stringify((overlay && overlay.grupos) || []));
  if (!grupos.length) grupos = [grupoVazio({ nome: "Adicionais" })];

  const wrap = document.createElement("div");
  wrap.className = "sheet editor-sheet";
  document.body.appendChild(wrap);

  function fechar() {
    wrap.remove();
    if (onClose) onClose();
  }

  function lerCampos() {
    wrap.querySelectorAll(".ed-group").forEach((sec) => {
      const gi = Number(sec.dataset.gi);
      if (!grupos[gi]) return;
      grupos[gi].nome = sec.querySelector("[data-nome]").value;
      grupos[gi].tipo = sec.querySelector("[data-tipo]").value;
      grupos[gi].min = Number(sec.querySelector("[data-min]").value) || 0;
      grupos[gi].max = grupos[gi].tipo === "single" ? 1 : (Number(sec.querySelector("[data-max]").value) || 0);
      grupos[gi].opcoes = [...sec.querySelectorAll(".ed-opt")].map((row) => ({
        id: (grupos[gi].opcoes && grupos[gi].opcoes[Number(row.dataset.oi)] && grupos[gi].opcoes[Number(row.dataset.oi)].id) || novoId("o"),
        nome: row.querySelector("[data-onome]").value,
        descricao: row.querySelector("[data-odesc]").value,
        preco: Number(row.querySelector("[data-opreco]").value) || 0
      }));
    });
  }

  function pintar() {
    wrap.innerHTML = `
      <div class="sheet-card editor-card">
        <div class="sheet-grab"></div>
        <header class="editor-head">
          <div>
            <h2>Opções do item</h2>
            <p>${esc(produto.nome || "")}</p>
          </div>
          <button type="button" class="icon-btn" id="ed-fechar" aria-label="Fechar">✕</button>
        </header>
        <p class="editor-help">O cliente vê isso ao tocar no lanche: adicionais, molho, ponto, combo. O preço na lista vira “A partir de”.</p>
        <div class="editor-templates">
          ${TEMPLATES.map((t, i) => `<button type="button" class="btn-ghost" data-tpl="${i}">+ ${esc(t.nome)}</button>`).join("")}
        </div>
        <div id="ed-grupos"></div>
        <button type="button" class="btn-ghost" id="ed-add-g" style="width:100%;margin:8px 0">+ Novo grupo</button>
        <div class="editor-actions">
          <button type="button" class="btn-ghost" id="ed-cancelar">Cancelar</button>
          <button type="button" class="btn-primary" id="ed-salvar" style="width:auto">Salvar opções</button>
        </div>
      </div>
    `;
    const box = wrap.querySelector("#ed-grupos");
    box.innerHTML = grupos.map((g, gi) => `
      <section class="ed-group" data-gi="${gi}">
        <div class="ed-group-top">
          <input data-nome placeholder="Nome do grupo (ex.: Adicionais)" value="${esc(g.nome)}">
          <button type="button" class="btn-ghost" data-del-g>Remover</button>
        </div>
        <div class="ed-grid">
          <label>Tipo
            <select data-tipo>
              <option value="multi" ${g.tipo !== "single" ? "selected" : ""}>Várias opções</option>
              <option value="single" ${g.tipo === "single" ? "selected" : ""}>Escolher 1</option>
            </select>
          </label>
          <label>Mín.
            <input type="number" min="0" max="20" data-min value="${g.min || 0}">
          </label>
          <label>Máx.
            <input type="number" min="0" max="20" data-max value="${g.tipo === "single" ? 1 : (g.max || 6)}">
          </label>
        </div>
        <div class="ed-import">
          <button type="button" class="btn-ghost" data-imp="adicion">Puxar Adicionais do PDV</button>
          <button type="button" class="btn-ghost" data-imp="bebida">Puxar Bebidas do PDV</button>
        </div>
        ${(g.opcoes || []).map((o, oi) => `
          <div class="ed-opt" data-oi="${oi}">
            <input data-onome placeholder="Opção" value="${esc(o.nome || "")}">
            <input data-odesc placeholder="Detalhe" value="${esc(o.descricao || "")}">
            <input type="number" step="0.01" min="0" data-opreco placeholder="+ R$" value="${o.preco || 0}">
            <button type="button" class="btn-ghost" data-del-o>✕</button>
          </div>
        `).join("")}
        <button type="button" class="btn-ghost" data-add-o>+ Opção</button>
      </section>
    `).join("") || `<p class="empty">Nenhum grupo ainda.</p>`;

    wrap.querySelector("#ed-fechar").addEventListener("click", fechar);
    wrap.querySelector("#ed-cancelar").addEventListener("click", fechar);
    wrap.querySelector("#ed-add-g").addEventListener("click", () => {
      lerCampos();
      grupos.push(grupoVazio({ nome: "Novo grupo" }));
      pintar();
    });
    wrap.querySelectorAll("[data-tpl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        lerCampos();
        grupos.push(grupoVazio(TEMPLATES[Number(btn.dataset.tpl)]));
        pintar();
      });
    });
    wrap.querySelector("#ed-salvar").addEventListener("click", async () => {
      lerCampos();
      const limpos = sanitizarGrupos(grupos);
      wrap.querySelector("#ed-salvar").disabled = true;
      try {
        await onSave(limpos);
        toast(limpos.length ? "Opções salvas. Publique o cardápio para o cliente ver." : "Opções removidas.");
        fechar();
      } catch (err) {
        toast(String(err.message || err));
        wrap.querySelector("#ed-salvar").disabled = false;
      }
    });

    box.querySelectorAll(".ed-group").forEach((sec) => {
      const gi = Number(sec.dataset.gi);
      sec.querySelector("[data-del-g]").addEventListener("click", () => {
        lerCampos();
        grupos.splice(gi, 1);
        pintar();
      });
      sec.querySelector("[data-add-o]").addEventListener("click", () => {
        lerCampos();
        grupos[gi].opcoes = grupos[gi].opcoes || [];
        grupos[gi].opcoes.push(opcaoVazia());
        pintar();
      });
      sec.querySelectorAll("[data-imp]").forEach((btn) => {
        btn.addEventListener("click", () => {
          lerCampos();
          const key = btn.dataset.imp;
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
          hits.forEach((p) => {
            grupos[gi].opcoes.push(opcaoVazia({
              nome: p.nome,
              preco: precoProduto(p)
            }));
          });
          toast(`${hits.length} itens puxados do PDV.`);
          pintar();
        });
      });
      sec.querySelectorAll(".ed-opt").forEach((row) => {
        const oi = Number(row.dataset.oi);
        row.querySelector("[data-del-o]").addEventListener("click", () => {
          lerCampos();
          grupos[gi].opcoes.splice(oi, 1);
          pintar();
        });
      });
    });
  }

  wrap.addEventListener("click", (ev) => { if (ev.target === wrap) fechar(); });
  pintar();
  return fechar;
}
