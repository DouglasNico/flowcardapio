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
import { SLUG_POR_CHAVE_V2 } from './slug-publico.js';

export async function catalogoV2(slug) {
  const s = ambienteV2();
  const snapshot = await getDocFromServer(doc(s.db, 'catalogos_publicos_v2', slug));
  if (!snapshot.exists()) throw new Error('Cardápio não encontrado.');
  const data = snapshot.data();

  // Enriquecer com dados em tempo real configurados no painel (horários, tempo de entrega, endereço, contato, logo)
  const chave = data.chaveLicenca || Object.entries(SLUG_POR_CHAVE_V2).find(([, v]) => v === slug)?.[0];
  if (chave) {
    try {
      const pubSnap = await getDocFromServer(doc(s.db, 'cardapio_publico', chave));
      if (pubSnap.exists()) {
        const pub = pubSnap.data();
        const produtosMesclados = (data.produtos || []).map(p => {
          const pubP = pub.produtos?.find(x => x.id === p.id);
          if (!pubP) return p;

          let grupos = p.grupos;
          if ((!grupos || !grupos.length) && pubP.grupos?.length) {
            grupos = pubP.grupos.map(g => ({
              id: g.id,
              nome: g.nome,
              tipo: g.tipo || (g.max === 1 ? 'single' : 'multi'),
              min: g.min ?? 0,
              max: g.max ?? 1,
              precoCentavos: Math.round((Number(g.precoGrupo) || 0) * 100),
              inclusoNome: g.inclusoNome || '',
              opcoes: (g.opcoes || []).map(o => ({
                id: o.id,
                nome: o.nome,
                descricao: o.descricao || '',
                precoCentavos: o.precoCentavos != null ? o.precoCentavos : Math.round((Number(o.preco) || 0) * 100),
                ativo: o.ativo !== false,
                maxQuantidade: o.maxQuantidade || (g.tipo === 'single' ? 1 : 10)
              }))
            }));
          }

          return {
            ...p,
            descricao: p.descricao || pubP.descricao || '',
            imagemUrl: p.imagemUrl || pubP.fotoUrl || '',
            grupos: grupos || p.grupos || []
          };
        });

        return {
          ...data,
          produtos: produtosMesclados,
          horarioTexto: pub.horarioTexto || data.horarioTexto,
          entregaTexto: pub.entregaTexto || data.entregaTexto,
          endereco: pub.endereco || data.endereco,
          whatsapp: pub.whatsapp || data.whatsapp,
          telefone: pub.whatsapp || data.telefone,
          pedidoMinimoTexto: pub.pedidoMinimoTexto || data.pedidoMinimoTexto,
          logoUrl: pub.logoUrl || data.logoUrl,
          logotipoUrl: pub.logoUrl || data.logotipoUrl,
          pausado: pub.pausado !== undefined ? pub.pausado : data.pausado,
        };
      }
    } catch { /* fallback seguro com dados existentes */ }
  }
  return data;
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
