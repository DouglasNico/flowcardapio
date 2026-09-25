// Fixture persistente apenas nos emuladores locais; não cria contas em produção.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const admin = require('../../flowpdv-sistema/adega-pdv-gestao/functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'demo-flowpdv' });
(async () => {
  const db = admin.firestore(), email = 'gerente@flowpdv.test', password = 'FlowPDV-Local-2026';
  let user;
  try { user = await admin.auth().getUserByEmail(email); await admin.auth().updateUser(user.uid, { password, emailVerified: true, disabled: false }); }
  catch (error) { if (error.code !== 'auth/user-not-found') throw error; user = await admin.auth().createUser({ email, password, emailVerified: true }); }
  const lojaId = 'demonstracao-gestao', slug = lojaId;
  const shop = db.doc(`lojas_v2/${lojaId}`);
  if (!(await shop.get()).exists) {
    await shop.set({ ativo: true, nome: 'Casa do Sabor · demonstração', slug, configVersao: 0, segmento: 'lanchonete', modulos: { cardapio: true, mesas: true, retirada: true, garcom: false }, contato: { telefone: '', endereco: '' } });
    await db.doc(`rotas_publicas_v2/${slug}`).set({ lojaId });
    await db.doc(`catalogos_publicos_v2/${slug}`).set({ nome: 'Casa do Sabor · demonstração', publicado: false, publicacaoManual: true, versao: 0, produtos: [
      { id: 'burger', nome: 'Burger da casa', categoria: 'Hambúrgueres', descricao: 'Pão macio, hambúrguer e queijo.', precoCentavos: 2990, ativo: true, esgotado: false, grupos: [] },
      { id: 'batata', nome: 'Batata crocante', categoria: 'Acompanhamentos', descricao: 'Porção individual.', precoCentavos: 1590, ativo: true, esgotado: false, grupos: [] },
      { id: 'suco', nome: 'Suco de laranja', categoria: 'Bebidas', descricao: 'Copo de 300 ml.', precoCentavos: 950, ativo: true, esgotado: false, grupos: [] }
    ] });
    await shop.collection('mesas').doc('mesa-demo').set({ nome: 'Mesa 1', comandaPdvId: 'MESA-1', ativo: true });
  }
  await shop.collection('membros').doc(user.uid).set({ ativo: true, papel: 'gerente', tipo: 'usuario' });
  console.log('Preview local pronto: http://127.0.0.1:53700/gestao-v2 | loja demonstracao-gestao | gerente@flowpdv.test | senha FlowPDV-Local-2026');
  await admin.app().delete();
})().catch(error => { console.error(error.message); process.exitCode = 1; });
