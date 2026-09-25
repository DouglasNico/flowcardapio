// Hosting is opt-in and pinned to one HTTPS origin; emulator mode never falls back.
export function resolverAmbienteV2(env, page) {
  if (env.VITE_AMBIENTE_TESTE === 'true') {
    if (!env.DEV || !['localhost', '127.0.0.1'].includes(page.hostname)) throw Error('Ambiente de teste requer servidor local.');
    return { local: true, firebase: { apiKey: 'demo-flowpdv-key', projectId: 'demo-flowpdv', appId: 'flowpdv-v2-test' } };
  }
  if (env.DEV && ['localhost', '127.0.0.1'].includes(page.hostname)) {
    return { local: false, firebase: {
      apiKey: 'AIzaSyBn1tl0IBQoWZBmunYtRSb-i74Yhe5OAFg',
      authDomain: 'aplicativo-pdv.firebaseapp.com', projectId: 'aplicativo-pdv',
      storageBucket: 'aplicativo-pdv.firebasestorage.app', messagingSenderId: '892832112899',
      appId: '1:892832112899:web:ee49b0ea26a76211680936'
    } };
  }
  const origemPadrao = env.VITE_V2_ORIGEM || 'https://flowpdv.app.br/';
  const habilitado = env.VITE_V2_HOSPEDADO === 'true' || (typeof page !== 'undefined' && page.protocol === 'https:' && (page.hostname === 'flowpdv.app.br' || page.hostname.endsWith('.vercel.app')));
  if (!habilitado) throw Error('A V2 ainda não foi habilitada neste ambiente.');
  let origin;
  try { origin = new URL(origemPadrao); } catch { throw Error('Endereço da V2 não configurado.'); }
  const ehOrigemAutorizada = origin.origin === page.origin || (page.protocol === 'https:' && (page.hostname === 'flowpdv.app.br' || page.hostname.endsWith('.vercel.app')));
  if (origin.protocol !== 'https:' || !ehOrigemAutorizada || origin.href !== origin.origin + '/' || origin.username || origin.password) throw Error('Endereço não autorizado para a V2.');
  return { local: false, firebase: {
    apiKey: 'AIzaSyBn1tl0IBQoWZBmunYtRSb-i74Yhe5OAFg',
    authDomain: 'aplicativo-pdv.firebaseapp.com', projectId: 'aplicativo-pdv',
    storageBucket: 'aplicativo-pdv.firebasestorage.app', messagingSenderId: '892832112899',
    appId: '1:892832112899:web:ee49b0ea26a76211680936'
  } };
}
