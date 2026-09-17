import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase.js";

export async function lerCardapioPublico(chave) {
  const snap = await getDoc(doc(db, "cardapio_publico", chave));
  if (!snap.exists()) return null;
  return snap.data() || null;
}

export function escutarPedidosLoja(chave, onData, onError) {
  return onSnapshot(
    collection(db, "backups_lojas", chave, "pedidos"),
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      lista.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
      onData(lista);
    },
    onError
  );
}

export async function atualizarStatusPedido(chave, pedidoId, status) {
  const agora = new Date().toISOString();
  await updateDoc(doc(db, "backups_lojas", chave, "pedidos", pedidoId), {
    status,
    atualizadoEm: agora
  });
  try {
    await updateDoc(doc(db, "cardapio_pedidos", pedidoId), {
      status,
      atualizadoEm: agora
    });
  } catch { /* cópia pública pode ainda não existir */ }
}

export function escutarPedidoPublico(pedidoId, onData, onError) {
  return onSnapshot(
    doc(db, "cardapio_pedidos", pedidoId),
    (snap) => {
      if (!snap.exists()) onData(null);
      else onData({ id: snap.id, ...(snap.data() || {}) });
    },
    onError
  );
}

export async function criarPedido(payload) {
  const fn = httpsCallable(functions, "criarPedido");
  const res = await fn(payload);
  return res.data || {};
}
