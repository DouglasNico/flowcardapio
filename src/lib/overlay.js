import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { auth, db, CLOUDINARY_CLOUD, CLOUDINARY_PRESET } from "./firebase.js";
import { carregarBackupLoja, precoProduto, produtoAtivo } from "./backup.js";
import { nomeDaLoja } from "./auth.js";
import { sanitizarGrupos } from "./grupos.js";
import { soDigitos } from "./format.js";

const CAMPOS_PUBLICOS = [
  "pausado",
  "whatsapp",
  "horarioTexto",
  "entregaTexto",
  "pedidoMinimoTexto",
  "endereco"
];

async function apiLoja(path, chave, extra = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Faça login na loja.");
  const token = await user.getIdToken();
  const resp = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ chave, ...extra })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "Falha na API do cardápio.");
  return data;
}

export async function lerConfig(chave) {
  const snap = await getDoc(doc(db, "cardapio_config", chave));
  return snap.exists() ? (snap.data() || {}) : {};
}

export async function salvarConfig(chave, patch) {
  const agora = new Date().toISOString();
  await setDoc(doc(db, "cardapio_config", chave), {
    ...patch,
    atualizadoEm: agora
  }, { merge: true });
  const pubRef = doc(db, "cardapio_publico", chave);
  const pub = await getDoc(pubRef);
  if (!pub.exists()) return;
  const next = { atualizadoEm: agora };
  CAMPOS_PUBLICOS.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(patch, k)) next[k] = patch[k];
  });
  if (Object.keys(next).length > 1) {
    await setDoc(pubRef, next, { merge: true });
  }
}

export async function listarOverlays(chave) {
  const snaps = await getDocs(collection(db, "cardapio_config", chave, "produtos"));
  const mapa = {};
  snaps.forEach((s) => { mapa[s.id] = s.data() || {}; });
  return mapa;
}

export async function salvarOverlay(chave, produtoId, patch) {
  const ref = doc(db, "cardapio_config", chave, "produtos", String(produtoId));
  await setDoc(ref, {
    ...patch,
    atualizadoEm: new Date().toISOString()
  }, { merge: true });
}

export async function publicarCardapio(chave) {
  const [backup, overlays, config, licSnap] = await Promise.all([
    carregarBackupLoja(chave),
    listarOverlays(chave),
    lerConfig(chave),
    getDoc(doc(db, "licencas", chave))
  ]);
  const licenca = licSnap.exists() ? (licSnap.data() || {}) : {};
  const publicados = [];
  (backup.produtos || []).forEach((p) => {
    if (!produtoAtivo(p) || !p.id) return;
    const ov = overlays[p.id] || {};
    if (!ov.visivel) return;
    publicados.push({
      id: String(p.id),
      nome: String(p.nome || p.descricao || "").trim(),
      preco: precoProduto(p),
      categoria: String(p.categoria || "Geral"),
      descricao: String(ov.descricao || "").slice(0, 400),
      fotoUrl: String(ov.fotoUrl || ""),
      esgotado: Boolean(ov.esgotado),
      destaque: Boolean(ov.destaque),
      idade18: Boolean(ov.idade18),
      grupos: sanitizarGrupos(ov.grupos),
      unidade: String(p.unidade || p.un || "UN")
    });
  });
  const cfgLoja = backup.config || {};
  await setDoc(doc(db, "cardapio_publico", chave), {
    chave,
    nome: nomeDaLoja(licenca),
    logoUrl: String(licenca.logoUrl || cfgLoja.logoUrl || ""),
    pausado: Boolean(config.pausado),
    taxaServico: Number(config.taxaServico) === 0 ? 0 : (Number(config.taxaServico) || 10),
    whatsapp: soDigitos(config.whatsapp || cfgLoja.whatsapp || licenca.whatsapp || licenca.whatsApp || ""),
    horarioTexto: String(config.horarioTexto || "").slice(0, 80),
    entregaTexto: String(config.entregaTexto || "").slice(0, 80),
    pedidoMinimoTexto: String(config.pedidoMinimoTexto != null ? config.pedidoMinimoTexto : "Sem pedido mínimo").slice(0, 60),
    endereco: String(config.endereco || licenca.endereco || licenca.cidade || "").slice(0, 120),
    produtos: publicados,
    publicadoEm: new Date().toISOString()
  });
  return { ok: true, total: publicados.length };
}

export async function assinarUpload(chave, produtoId) {
  return apiLoja("/api/assinar-upload", chave, { produtoId });
}

export async function enviarFotoCloudinary(file, assinatura) {
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", assinatura.apiKey);
  body.append("timestamp", String(assinatura.timestamp));
  body.append("signature", assinatura.signature);
  body.append("public_id", assinatura.publicId);
  if (assinatura.assetFolder) body.append("asset_folder", assinatura.assetFolder);
  body.append("overwrite", "true");
  body.append("invalidate", "true");
  body.append("upload_preset", CLOUDINARY_PRESET);
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;
  const resp = await fetch(url, { method: "POST", body });
  const json = await resp.json();
  if (!resp.ok || json.error) {
    throw new Error((json.error && json.error.message) || "Falha no upload da foto.");
  }
  return json;
}

export async function removerFoto(chave, produtoId, publicId) {
  try {
    await apiLoja("/api/remover-foto", chave, { publicId });
  } catch {
    // Cloudinary às vezes responde General Error; a foto some do painel mesmo assim.
  }
  await updateDoc(doc(db, "cardapio_config", chave, "produtos", String(produtoId)), {
    fotoUrl: "",
    fotoPublicId: "",
    atualizadoEm: new Date().toISOString()
  }).catch(async () => {
    await setDoc(doc(db, "cardapio_config", chave, "produtos", String(produtoId)), {
      fotoUrl: "",
      fotoPublicId: "",
      atualizadoEm: new Date().toISOString()
    }, { merge: true });
  });
  return { ok: true };
}

export async function apagarOverlay(chave, produtoId) {
  await deleteDoc(doc(db, "cardapio_config", chave, "produtos", String(produtoId)));
}
