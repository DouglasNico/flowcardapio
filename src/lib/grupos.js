import { precoOferta, centavos } from "../../shared/ofertas.js";
import { ico } from "./icons.js";
export function novoId(prefixo = "id") {
  return `${prefixo}-${Math.random().toString(36).slice(2, 9)}`;
}

function chaveGrupo(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pesoGrupo(nome) {
  const n = chaveGrupo(nome);
  if (n.includes("combo")) return 10;
  if (n.includes("ponto")) return 20;
  if (n.includes("molho")) return 30;
  if (n.includes("adicional")) return 40;
  return 80;
}

export function ordenarGrupos(grupos) {
  if (!Array.isArray(grupos)) return [];
  return grupos
    .map((g, i) => ({ g, i }))
    .sort((a, b) => {
      const da = pesoGrupo(a.g && a.g.nome);
      const db = pesoGrupo(b.g && b.g.nome);
      return da - db || a.i - b.i;
    })
    .map((x) => x.g);
}

export function sanitizarGrupos(grupos) {
  if (!Array.isArray(grupos)) return [];
  const limpos = grupos.slice(0, 16).map((g, gi) => {
    const tipo = String(g && g.tipo) === "single" ? "single" : "multi";
    let min = Math.max(0, Math.min(20, parseInt(g && g.min, 10) || 0));
    let max = Math.max(0, Math.min(20, parseInt(g && g.max, 10) || 0));
    if (tipo === "single") {
      max = 1;
      if (min > 1) min = 1;
    }
    if (max < min) max = min;
    const opcoes = (Array.isArray(g && g.opcoes) ? g.opcoes : []).slice(0, 50).map((o, oi) => ({
      id: String((o && o.id) || `o${gi}-${oi}`).slice(0, 48),
      nome: String((o && o.nome) || "").trim().slice(0, 80),
      descricao: String((o && o.descricao) || "").trim().slice(0, 80),
      preco: Math.max(0, Math.round((Number(o && o.preco) || 0) * 100) / 100)
    })).filter((o) => o.nome);
    return {
      id: String((g && g.id) || `g${gi + 1}`).slice(0, 48),
      nome: String((g && g.nome) || "Opções").trim().slice(0, 60),
      min,
      max,
      tipo,
      precoGrupo: Math.max(0, Math.round((Number(g && g.precoGrupo) || 0) * 100) / 100),
      inclusoNome: String((g && g.inclusoNome) || "").trim().slice(0, 40),
      opcoes
    };
  }).filter((g) => g.nome && g.opcoes.length);
  return ordenarGrupos(limpos);
}

export function precoBase(prod) {
  return precoOferta(prod || {preco:0}).preco;
}

export function precoMinimo(prod) {
  let extra = 0;
  for (const g of sanitizarGrupos(prod && prod.grupos)) {
    if (g.min <= 0) continue;
    const sorted = [...g.opcoes].sort((a, b) => a.preco - b.preco);
    extra += g.precoGrupo + sorted.slice(0, g.min).reduce((s, o) => s + o.preco, 0);
  }
  return precoBase(prod) + extra;
}

export function mostraAPartirDe(prod) {
  return sanitizarGrupos(prod && prod.grupos).some((g) => (
    (g.min > 0 && (g.precoGrupo > 0 || g.opcoes.some((o) => o.preco > 0)))
    || (g.min <= 0 && g.opcoes.some((o) => o.preco > 0))
  ));
}

export function acharOpcao(prod, grupoId, opcaoId) {
  const g = sanitizarGrupos(prod && prod.grupos).find((x) => String(x.id) === String(grupoId));
  if (!g) return null;
  const o = g.opcoes.find((x) => String(x.id) === String(opcaoId));
  if (!o) return null;
  return { grupo: g, opcao: o };
}

export function qtdNoGrupo(extras, grupoId) {
  return (extras || [])
    .filter((e) => String(e.grupoId) === String(grupoId))
    .reduce((s, e) => s + Math.max(0, Number(e.quantidade) || 0), 0);
}

export function qtdOpcao(extras, grupoId, opcaoId) {
  const hit = (extras || []).find((e) => (
    String(e.grupoId) === String(grupoId) && String(e.opcaoId) === String(opcaoId)
  ));
  return hit ? Math.max(0, Number(hit.quantidade) || 0) : 0;
}

export function precoExtras(prod, extras) {
  let total = 0;
  const cobrouGrupo = new Set();
  for (const e of extras || []) {
    const hit = acharOpcao(prod, e.grupoId, e.opcaoId);
    if (!hit) continue;
    const q = Math.max(0, Math.min(99, Number(e.quantidade) || 0));
    total += hit.opcao.preco * q;
    if (hit.grupo.precoGrupo && !cobrouGrupo.has(hit.grupo.id)) {
      total += hit.grupo.precoGrupo;
      cobrouGrupo.add(hit.grupo.id);
    }
  }
  return total;
}

export function totalExtrasLinha(prod, extras) {
  return precoExtras(prod, extras);
}

export function precoLinha(prod, extras, quantidade, variante = 'individual') {
  const q = Math.max(1, Number(quantidade) || 1);
  return (centavos(precoOferta(prod, variante).preco) + centavos(precoExtras(prod, extras))) * q / 100;
}

export function validarExtras(prod, extrasIn) {
  const grupos = sanitizarGrupos(prod && prod.grupos);
  const extras = Array.isArray(extrasIn) ? extrasIn : [];
  const resolvidos = [];
  const porGrupo = {};
  for (const raw of extras) {
    const hit = acharOpcao(prod, raw && raw.grupoId, raw && raw.opcaoId);
    if (!hit) {
      const err = new Error("Uma opção do item não está mais disponível.");
      err.status = 412;
      throw err;
    }
    const quantidade = Math.max(1, Math.min(99, parseInt(raw.quantidade, 10) || 1));
    porGrupo[hit.grupo.id] = (porGrupo[hit.grupo.id] || 0) + quantidade;
    if (hit.grupo.tipo === "single" && porGrupo[hit.grupo.id] > 1) {
      const err = new Error(`Escolha apenas uma opção em ${hit.grupo.nome}.`);
      err.status = 400;
      throw err;
    }
    resolvidos.push({
      grupoId: hit.grupo.id,
      grupoNome: hit.grupo.nome,
      opcaoId: hit.opcao.id,
      nome: hit.opcao.nome,
      preco: hit.opcao.preco,
      quantidade
    });
  }
  for (const g of grupos) {
    const n = porGrupo[g.id] || 0;
    if (n < g.min) {
      const err = new Error(g.min === 1
        ? `Escolha uma opção em ${g.nome}.`
        : `Escolha ${g.min} opções em ${g.nome}.`);
      err.status = 400;
      throw err;
    }
    if (g.max > 0 && n > g.max) {
      const err = new Error(`No máximo ${g.max} ${g.max === 1 ? "opção" : "opções"} em ${g.nome}.`);
      err.status = 400;
      throw err;
    }
  }
  return resolvidos;
}

export function textoExtras(extras) {
  return (extras || []).map((e) => {
    const q = Number(e.quantidade) || 1;
    const nome = e.nome || "";
    return q > 1 ? `${q}× ${nome}` : nome;
  }).filter(Boolean).join(", ");
}

export function iconeCategoria(nome) {
  const c = String(nome || "").toLowerCase();
  if (c.includes("lanche") || c.includes("sandu") || c.includes("burger") || c.includes("hambur")) return ico.burger;
  if (c.includes("pizza")) return ico.food;
  if (c.includes("hot") || c.includes("dog")) return ico.food;
  if (c.includes("porç") || c.includes("porc") || c.includes("petisc") || c.includes("frita")) return ico.food;
  if (c.includes("sobremes") || c.includes("sorvete") || c.includes("açaí") || c.includes("acai")) return ico.food;
  if (c.includes("adicion") || c.includes("extra") || c.includes("complem")) return ico.food;
  if (c.includes("combo") || c.includes("kit") || c.includes("promo")) return ico.bag;
  if (c.includes("suco")) return ico.drink;
  if (c.includes("cerveja") || c.includes("chopp")) return ico.drink;
  if (c.includes("bebida") || c.includes("refri") || c.includes("água") || c.includes("agua")) return ico.drink;
  return ico.food;
}

export function idCategoria(nome) {
  return `cat-${String(nome || "geral").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`.replace(/-+$/g, "");
}
