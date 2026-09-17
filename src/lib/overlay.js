import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, CLOUDINARY_CLOUD, CLOUDINARY_PRESET } from "./firebase.js";

export async function lerConfig(chave) {
  const snap = await getDoc(doc(db, "cardapio_config", chave));
  return snap.exists() ? (snap.data() || {}) : {};
}

export async function salvarConfig(chave, patch) {
  await setDoc(doc(db, "cardapio_config", chave), {
    ...patch,
    atualizadoEm: new Date().toISOString()
  }, { merge: true });
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
  const fn = httpsCallable(functions, "publicarCardapio");
  const res = await fn({ chave });
  return res.data || {};
}

export async function assinarUpload(chave, produtoId) {
  const fn = httpsCallable(functions, "assinarUploadCloudinary");
  const res = await fn({ chave, produtoId });
  return res.data || {};
}

export async function enviarFotoCloudinary(file, assinatura) {
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", assinatura.apiKey);
  body.append("timestamp", String(assinatura.timestamp));
  body.append("signature", assinatura.signature);
  body.append("public_id", assinatura.publicId);
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
  const fn = httpsCallable(functions, "removerFotoCloudinary");
  const res = await fn({ chave, produtoId, publicId });
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
  return res.data || {};
}

export async function apagarOverlay(chave, produtoId) {
  await deleteDoc(doc(db, "cardapio_config", chave, "produtos", String(produtoId)));
}
