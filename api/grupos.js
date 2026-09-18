export function sanitizarGrupos(grupos) {
  if (!Array.isArray(grupos)) return [];
  return grupos.slice(0, 16).map((g, gi) => {
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
}

function acharOpcao(prod, grupoId, opcaoId) {
  const g = sanitizarGrupos(prod && prod.grupos).find((x) => String(x.id) === String(grupoId));
  if (!g) return null;
  const o = g.opcoes.find((x) => String(x.id) === String(opcaoId));
  if (!o) return null;
  return { grupo: g, opcao: o };
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

export function totalExtrasLinha(prod, extras) {
  let total = 0;
  const cobrou = new Set();
  const grupos = sanitizarGrupos(prod && prod.grupos);
  for (const e of extras || []) {
    total += (Number(e.preco) || 0) * (Number(e.quantidade) || 1);
    const g = grupos.find((x) => String(x.id) === String(e.grupoId));
    if (g && g.precoGrupo && !cobrou.has(g.id)) {
      total += g.precoGrupo;
      cobrou.add(g.id);
    }
  }
  return total;
}

export function textoExtras(extras) {
  return (extras || []).map((e) => {
    const q = Number(e.quantidade) || 1;
    const nome = e.nome || "";
    return q > 1 ? `${q}× ${nome}` : nome;
  }).filter(Boolean).join(", ");
}
