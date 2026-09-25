import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase.js";

let cachePublico = { chave: "", at: 0, data: null };

export async function lerCardapioPublico(chave) {
  if (cachePublico.chave === chave && Date.now() - cachePublico.at < 5000 && cachePublico.data) {
    return cachePublico.data;
  }
  const snap = await getDoc(doc(db, "cardapio_publico", chave));
  const data = snap.exists() ? (snap.data() || null) : null;
  cachePublico = { chave, at: Date.now(), data };
  return data;
}

export function invalidarCardapioPublico() {
  cachePublico = { chave: "", at: 0, data: null };
}

export function escutarPedidosLoja(chave, onData, onError) {
  return onSnapshot(
    collection(db, "backups_lojas", chave, "pedidos"),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.hasPendingWrites) return;
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
  if(pedidoId.startsWith('V2-')){
    const token=new URLSearchParams(location.search).get('acompanhamento');
    let stopped=false,executando=false,timer;
    const tick=async()=>{if(stopped||executando||document.hidden)return;executando=true;try{
      const r=await fetch('/api/acompanhar-integrado',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:AbortSignal.timeout(15000)});
      const p=await r.json();if(!r.ok)throw Error(p.error||'Não foi possível acompanhar o pedido.');
      if(!stopped){onData(p);if(p.status==='cancelado'||(p.status==='entregue'&&p.pagamento==='pago')){stop();return;}}
    }catch(e){if(!stopped)onError?.(e);}finally{executando=false;if(!stopped&&!document.hidden)timer=setTimeout(tick,30000);}};
    const visible=()=>{clearTimeout(timer);if(!document.hidden)void tick();};
    const stop=()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
    document.addEventListener('visibilitychange',visible);void tick();return stop;
  }
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
  const resp = await fetch("/api/criar-pedido", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(data.error || "Falha ao enviar o pedido.");
    err.code = data.code;
    throw err;
  }
  return data;
}
