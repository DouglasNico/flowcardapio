import { initializeApp } from 'firebase/app';
import { resolverAmbienteV2 } from './ambiente-v2.js';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

let services;
export function ambienteV2() {
  const config = resolverAmbienteV2(import.meta.env, location);
  if (services) return services;
  const app = initializeApp(config.firebase, 'consumidor-v2');
  const auth = getAuth(app), db = getFirestore(app), fn = getFunctions(app, 'us-central1');
  if (config.local) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080); connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  }
  services = { auth, db, call: async (name, data) => (await httpsCallable(fn, name, { timeout: 12000 })(data)).data };
  return services;
}
export async function catalogoV2(slug) {
  const s = ambienteV2();
  const snapshot = await getDocFromServer(doc(s.db, 'catalogos_publicos_v2', slug));
  if (!snapshot.exists()) throw new Error('Cardápio não encontrado.');
  return snapshot.data();
}
export async function sessaoConsumidor() {
  const { auth } = ambienteV2(); await auth.authStateReady();
  return auth.currentUser;
}
export async function enviarV2(scope, body) {
  if (!navigator.locks) throw new Error('Use um navegador atualizado para enviar com segurança.');
  return navigator.locks.request(`flowpdv-envio:${scope}`, () => enviarBloqueado(scope, body));
}
async function enviarBloqueado(scope, body) {
  const confirmed = JSON.parse(localStorage.getItem(`v2:confirmado:${scope}`) || 'null');
  if (confirmed) return confirmed;
  const s = ambienteV2(), key = `v2:pendente:${scope}`;
  let pending = JSON.parse(localStorage.getItem(key) || 'null');
  let user = await sessaoConsumidor();
  if (pending && (!user || pending.uid !== user.uid)) throw new Error('A sessão deste envio foi perdida. Consulte a loja antes de fazer outro pedido.');
  if (!user) user = (await signInAnonymously(s.auth)).user;
  if (!pending) {
    pending = { uid: user.uid, body: { ...body, requestId: crypto.randomUUID() } };
    localStorage.setItem(key, JSON.stringify(pending));
  }
  try {
    const result = await s.call('criarPedidoPublicoV2', pending.body);
    // Persistir a confirmação antes de apagar a intenção permite recuperar respostas perdidas.
    localStorage.setItem(`v2:confirmado:${scope}`, JSON.stringify(result));
    localStorage.removeItem(key); localStorage.removeItem(`v2:carrinho:${scope}`);
    return result;
  } catch (error) {
    if (['functions/invalid-argument', 'functions/failed-precondition', 'functions/not-found'].includes(error.code)) localStorage.removeItem(key);
    throw error;
  }
}
export const acompanharV2 = token => ambienteV2().call('acompanharPedidoPublicoV2', { token });
export async function cotarV2(body) {
  const s = ambienteV2(); await s.auth.authStateReady();
  if (!s.auth.currentUser) await signInAnonymously(s.auth);
  return s.call('cotarDeliveryPublicoV2', body);
}
