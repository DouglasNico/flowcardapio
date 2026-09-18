import {
  emailDaLoja,
  firebaseConfig,
  json,
  normalizarChave,
  preflight,
  senhaDaLoja
} from "./_lib.js";
import { textoExtras, totalExtrasLinha, validarExtras } from "./grupos.js";

const PROJECT = firebaseConfig.projectId;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function encodeValue(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") return { mapValue: { fields: encodeFields(v) } };
  return { stringValue: String(v) };
}

function encodeFields(obj) {
  const fields = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v === undefined) return;
    fields[k] = encodeValue(v);
  });
  return fields;
}

function decodeValue(node) {
  if (!node) return null;
  if ("nullValue" in node) return null;
  if ("booleanValue" in node) return node.booleanValue;
  if ("integerValue" in node) return Number(node.integerValue);
  if ("doubleValue" in node) return node.doubleValue;
  if ("stringValue" in node) return node.stringValue;
  if ("arrayValue" in node) return (node.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in node) return decodeFields(node.mapValue.fields);
  return null;
}

function decodeFields(fields) {
  const out = {};
  Object.entries(fields || {}).forEach(([k, v]) => { out[k] = decodeValue(v); });
  return out;
}

async function entrarComoLoja(chave) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailDaLoja(chave),
        password: senhaDaLoja(chave),
        returnSecureToken: true
      })
    }
  );
  const data = await resp.json();
  if (!resp.ok || !data.idToken) {
    const err = new Error((data.error && data.error.message) || "Não foi possível autenticar a loja.");
    err.status = 401;
    throw err;
  }
  return data.idToken;
}

async function getDocRest(path, token) {
  const resp = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (resp.status === 404) return null;
  const data = await resp.json();
  if (!resp.ok) throw new Error((data.error && data.error.message) || "Falha ao ler o Firestore.");
  return decodeFields(data.fields);
}

async function createDocRest(path, documentId, obj, token) {
  const url = `${BASE}/${path}?documentId=${encodeURIComponent(documentId)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields: encodeFields(obj) })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error((data.error && data.error.message) || "Falha ao gravar o pedido.");
  return data;
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Use POST." });

  try {
    const chave = normalizarChave(req.body && req.body.chave);
    if (!chave) return json(res, 400, { error: "Informe a chave da loja." });

    const tipo = String((req.body && req.body.tipo) || "mesa").toLowerCase() === "retirada"
      ? "retirada"
      : "mesa";
    const numeroMesa = parseInt(req.body && req.body.numeroMesa, 10);
    if (tipo === "mesa" && (!Number.isFinite(numeroMesa) || numeroMesa < 1)) {
      return json(res, 400, { error: "Informe o número da mesa." });
    }

    let idem = String((req.body && req.body.idempotencyKey) || "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (idem.length < 8) idem = crypto.randomUUID();
    idem = idem.slice(0, 80);
    const pedidoId = `PED-${idem}`;

    const token = await entrarComoLoja(chave);
    const chavePath = encodeURIComponent(chave);
    const existente = await getDocRest(`backups_lojas/${chavePath}/pedidos/${encodeURIComponent(pedidoId)}`, token);
    if (existente) {
      return json(res, 200, { ok: true, reused: true, id: pedidoId, pedido: { id: pedidoId, ...existente } });
    }

    const publico = await getDocRest(`cardapio_publico/${chavePath}`, token);
    if (!publico) return json(res, 412, { error: "Cardápio ainda não publicado." });
    if (publico.pausado) return json(res, 412, { error: "Cardápio fechado no momento." });

    const mapa = new Map((publico.produtos || []).map((p) => [String(p.id), p]));
    const itensIn = Array.isArray(req.body && req.body.itens) ? req.body.itens : [];
    if (!itensIn.length) return json(res, 400, { error: "Pedido sem itens." });
    if (itensIn.length > 50) return json(res, 400, { error: "Pedido grande demais." });

    const itens = [];
    let total = 0;
    for (const raw of itensIn) {
      const prod = mapa.get(String(raw && raw.id));
      if (!prod || prod.esgotado) {
        return json(res, 412, { error: "Um item não está mais disponível." });
      }
      const quantidade = Math.max(1, Math.min(99, parseFloat(raw.quantidade) || 0));
      if (!quantidade) return json(res, 400, { error: "Quantidade inválida." });
      let extras;
      try {
        extras = validarExtras(prod, raw && raw.extras);
      } catch (err) {
        return json(res, err.status || 400, { error: err.message || "Opções inválidas." });
      }
      const extrasTotal = totalExtrasLinha(prod, extras);
      const preco = Number(prod.preco) || 0;
      const precoUnitario = preco + extrasTotal;
      const observacao = String((raw && raw.observacao) || "").slice(0, 180);
      const detalhe = textoExtras(extras);
      itens.push({
        id: String(prod.id),
        nome: prod.nome,
        quantidade,
        preco,
        extras,
        extrasTotal,
        precoUnitario,
        observacao,
        detalhe,
        origemPedidoId: pedidoId
      });
      total += precoUnitario * quantidade;
    }

    const agora = new Date().toISOString();
    const pedido = {
      chaveLicenca: chave,
      tipo,
      numeroMesa: tipo === "mesa" ? numeroMesa : null,
      itens,
      total,
      status: "novo",
      pagamento: "na_caixa",
      origem: "cardapio",
      nomeLoja: String(publico.nome || ""),
      at: agora,
      atualizadoEm: agora
    };
    const publicoPedido = {
      chaveLicenca: chave,
      tipo,
      numeroMesa: pedido.numeroMesa,
      status: "novo",
      total,
      nomeLoja: pedido.nomeLoja,
      itens: itens.map((i) => ({
        nome: i.nome,
        quantidade: i.quantidade,
        detalhe: i.detalhe || "",
        observacao: i.observacao || ""
      })),
      at: agora,
      atualizadoEm: agora
    };

    await createDocRest(`backups_lojas/${chavePath}/pedidos`, pedidoId, pedido, token);
    await createDocRest("cardapio_pedidos", pedidoId, publicoPedido, token);
    return json(res, 200, { ok: true, reused: false, id: pedidoId, pedido: { id: pedidoId, ...pedido } });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || "Falha ao criar o pedido." });
  }
}
