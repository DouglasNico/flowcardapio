import { createHash } from "crypto";

export const firebaseConfig = {
  apiKey: "AIzaSyBn1tl0IBQoWZBmunYtRSb-i74Yhe5OAFg",
  authDomain: "aplicativo-pdv.firebaseapp.com",
  projectId: "aplicativo-pdv",
  storageBucket: "aplicativo-pdv.firebasestorage.app",
  messagingSenderId: "892832112899",
  appId: "1:892832112899:web:ee49b0ea26a76211680936"
};

export const CLOUD_NAME = "dycwp4ds9";
export const CLOUDINARY_API_KEY = "834215656358838";
export const PRESET = "cardapioflowpdv";
export const DOMINIO_LOJA = "pdv.flowpdv.com.br";
export const SAL_ACESSO = "flowpdv-2026-acesso-loja";

export function json(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.status(status).json(body);
}

export function preflight(req, res) {
  if (req.method !== "OPTIONS") return false;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.status(204).end();
  return true;
}

export function normalizarChave(v) {
  let s = String(v || "").trim().toUpperCase().replace(/\s+/g, "");
  s = s.replace(/^LIC-?FLOW-?/, "");
  return s ? `LIC-FLOW-${s}` : "";
}

export function emailDaLoja(chave) {
  return `loja_${String(chave || "").trim().toLowerCase()}@${DOMINIO_LOJA}`;
}

export function senhaDaLoja(chave) {
  return `${String(chave || "").trim().toUpperCase()}.${SAL_ACESSO}`;
}

export function bearer(req) {
  const h = String(req.headers.authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export async function exigirLojaToken(idToken, chave) {
  if (!idToken) {
    const err = new Error("Faça login na loja.");
    err.status = 401;
    throw err;
  }
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  const data = await resp.json();
  const email = String((data.users && data.users[0] && data.users[0].email) || "").toLowerCase();
  if (!email || email !== emailDaLoja(chave)) {
    const err = new Error("Esta sessão não é desta loja.");
    err.status = 403;
    throw err;
  }
}

export function secretCloudinary() {
  const secret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!secret) {
    const err = new Error("CLOUDINARY_API_SECRET não configurada na Vercel.");
    err.status = 412;
    throw err;
  }
  return secret;
}

export function assinarCloudinary(params, secret) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && String(params[k]) !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + secret).digest("hex");
}

export function publicIdProduto(chave, produtoId) {
  const id = String(produtoId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  if (!id) {
    const err = new Error("produtoId inválido.");
    err.status = 400;
    throw err;
  }
  return `${chave}/produtos/${id}`;
}

export function pastaCloudinary(chave) {
  return `flowpdv/${chave}/produtos`;
}

export function extrairPublicId(valor) {
  let id = String(valor || "").trim();
  if (!id) return "";
  try { id = decodeURIComponent(id); } catch { /* id original */ }
  const m = id.match(/\/(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+?)$/i);
  if (m) id = m[1];
  return id.replace(/\.(jpe?g|png|webp|gif|bmp|avif)$/i, "");
}

export function fotoDaLoja(publicId, chave) {
  const id = extrairPublicId(publicId);
  const loja = String(chave || "");
  if (!id || !loja) return false;
  return id.startsWith(`cardapioflowpdv/${loja}/`)
    || id.startsWith(`${loja}/produtos/`)
    || id.startsWith(`flowpdv/${loja}/`)
    || id.includes(`/${loja}/produtos/`);
}

export function idsDestroy(publicId, chave) {
  const base = extrairPublicId(publicId);
  const ids = [base];
  if (base.startsWith("flowpdv/")) ids.push(base.replace(/^flowpdv\//, ""));
  else if (chave) ids.push(`flowpdv/${base}`);
  return [...new Set(ids.filter(Boolean))];
}
