// Browser manager/customer + real local callable pipeline. Never contacts production.
const path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const pdv = path.resolve(__dirname, '../../flowpdv-sistema/adega-pdv-gestao');
if (!process.env.CATALOGO_BROWSER) {
  const env = { ...process.env, CATALOGO_BROWSER: '1' }; delete env.ELECTRON_RUN_AS_NODE;
  const r = require('node:child_process').spawnSync(require(path.join(pdv, 'node_modules/electron')), [__filename], { env, stdio: 'inherit', timeout: 150000 });
  if (r.error) throw r.error; process.exit(r.status ?? 1);
}
const { app, BrowserWindow, session } = require('electron');
app.setPath('userData', require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(), 'flowpdv-fluxo-')));
// Keep the main process alive until fixture cleanup and the explicit exit code.
app.on('window-all-closed', () => {});
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const admin = require(path.join(pdv, 'functions/node_modules/firebase-admin'));
admin.initializeApp({ projectId: 'demo-flowpdv' });
const db = admin.firestore(), id = 'fluxo-' + randomUUID(), base = `lojas_v2/${id}`, accounts = [], clients = [];
const local = require('node:module').createRequire(path.resolve(pdv, '../output/local-tools/package.json'));
const { initializeApp, deleteApp } = local('firebase/app');
const { getAuth, connectAuthEmulator, signInAnonymously } = local('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = local('firebase/functions');
async function terminal(role) {
  const client = initializeApp({ projectId: 'demo-flowpdv', apiKey: 'demo-key' }, randomUUID()); clients.push(client);
  const auth = getAuth(client); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await signInAnonymously(auth); const uid = auth.currentUser.uid; accounts.push(uid);
  await db.doc(`terminais_v2/${uid}`).set({ ativo: true, papel: role, lojaId: id });
  await db.doc(`${base}/membros/${uid}`).set({ ativo: true, papel: role, tipo: 'terminal' });
  const fn = getFunctions(client, 'us-central1'); connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  return (name, data) => httpsCallable(fn, name)(data).then(r => r.data);
}
const browser = () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, contextIsolation: true, backgroundThrottling: false } });
  const js = code => win.webContents.executeJavaScript(code);
  const wait = async code => { for (let i=0;i<250;i++) { if(await js(code))return;await new Promise(r=>setTimeout(r,100)); } throw Error(`Timeout ${code}: ${await js('document.body.innerText')}`); };
  const fill = (selector,value) => js(`document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)};document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('input',{bubbles:true}))`);
  return { win, js, wait, fill, click: selector=>js(`document.querySelector(${JSON.stringify(selector)}).click()`), submit: selector=>js(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`) };
};
app.whenReady().then(async()=>{
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const u=new URL(details.url);callback({cancel:!(['http:','ws:'].includes(u.protocol)&&u.hostname==='127.0.0.1'&&['53700','8080','9099','5001'].includes(u.port))&&!['data:','blob:','devtools:'].includes(u.protocol)});
  });
  const manager=browser(), customer=browser(), shop=db.doc(base), cat=db.doc(`catalogos_publicos_v2/${id}`);
  try {
    const user=await admin.auth().createUser({email:`${id}@example.test`,password:'TesteLocal123!',emailVerified:true});accounts.push(user.uid);
    await shop.set({nome:'Fluxo fictício',slug:id,ativo:true,configVersao:0,segmento:'lanchonete',modulos:{cardapio:true,mesas:true,retirada:true},cozinha:{kds:true,impressao:false,papelMm:80},caixaV2:{exigirTurno:true},ativacaoOperacionalV2:{schema:1,estado:'habilitada',ambiente:'homologacao',revisao:1}});
    await db.doc(`${base}/membros/${user.uid}`).set({tipo:'usuario',papel:'gerente',ativo:true});
    await db.doc(`rotas_publicas_v2/${id}`).set({lojaId:id});
    // Deliberately omit publicacaoManual: older drafts must not auto-publish on save.
    await cat.set({publicado:false,versao:0,produtos:[]});
    await db.doc(`${base}/mesas/mesa-1`).set({ativo:true,nome:'Mesa 1',comandaPdvId:'MESA-1'});
    await manager.win.loadURL('http://127.0.0.1:53700/gestao-v2');await manager.wait('!!document.querySelector("#g-login")');
    await manager.fill('[name=email]',user.email);await manager.fill('[name=password]','TesteLocal123!');await manager.submit('#g-login');
    await manager.wait('!!document.querySelector("#g-store")');await manager.fill('[name=loja]',id);await manager.submit('#g-store');
    await manager.wait('!!document.querySelector("#g-new-product")');await manager.click('#g-new-product');
    await manager.fill('[name=nome]','Lanche integrado');await manager.fill('[name=preco]','10.00');await manager.fill('[name=categoria]','Lanches');
    await manager.click('#g-publish');await manager.wait('document.querySelector("#g-status").textContent.includes("Salve seus rascunhos")');
    assert.equal((await cat.get()).data().publicado,false);await manager.submit('.g-edit');
    await manager.wait('document.querySelector("#g-status").textContent.includes("Produto salvo")');
    assert.equal((await cat.get()).data().publicado,false);
    const productId=(await cat.get()).data().produtos[0].id;
    // Same authenticated manager service, then refresh the UI version.
    const callManager=async(name,data)=>manager.js(`import('/src/lib/gestao-v2.js').then(m=>m.ambienteGestaoV2()).then(s=>s.call(${JSON.stringify(name)},${JSON.stringify({lojaId:id,versao:(await shop.get()).data().configVersao,...data})}))`);
    await cat.update({publicacaoManual:admin.firestore.FieldValue.delete()});
    const config=(await shop.get()).data();
    await callManager('salvarModulosV2',{segmento:config.segmento,modulos:config.modulos,cozinha:config.cozinha});
    assert.equal((await cat.get()).data().publicado,false);
    await callManager('salvarOpcaoCardapioV2',{produtoId:productId,grupoId:'extras',opcaoId:'bacon',nomeGrupo:'Adicionais',min:1,max:1,nome:'Bacon',ativo:true,precoCentavos:250,maxQuantidade:1});
    await manager.click('#g-reload');await manager.wait('!!document.querySelector("#g-publish") && !document.querySelector("#g-reload").disabled');
    await manager.click('#g-publish');await manager.wait('document.querySelector("#g-operation h3").textContent.includes("disponível")');
    await db.doc(`${base}/estoque/lanche`).set({saldoMili:10000});await db.doc(`${base}/estoque/bacon`).set({saldoMili:10000});
    await db.doc(`${base}/fichas_estoque/${productId}`).set({consumos:[{estoqueId:'lanche',quantidadeMili:1000}],opcoes:[{grupoId:'extras',opcaoId:'bacon',consumos:[{estoqueId:'bacon',quantidadeMili:200}]}]});
    const customerUrl=`http://127.0.0.1:53700/v2/${id}/mesa/mesa-1`;
    await customer.win.loadURL(customerUrl);await customer.wait('!!document.querySelector("[data-product]")');
    await customer.submit('[data-product]');await customer.wait('document.querySelector("#v2-message").dataset.error==="true"');
    await customer.fill('[data-option=bacon]','1');await customer.fill('[name=observacao]','Sem cebola');await customer.submit('[data-product]');
    await customer.wait('!document.querySelector("#v2-send").disabled');
    await customer.js(`const original=Response.prototype.json;Response.prototype.json=async function(...args){const result=await original.apply(this,args);if(this.url.includes('criarPedidoPublicoV2')){Response.prototype.json=original;throw Error('Resposta perdida de teste');}return result;};void 0`);
    await customer.click('#v2-send');await customer.wait('document.querySelector("#v2-send")?.textContent.includes("pendente")');
    await manager.click('#g-pause');await manager.wait('document.querySelector("#g-operation h3").textContent.includes("pausados")');
    assert.equal((await shop.get()).data().cozinha.kds,true);
    await customer.click('#v2-send');await customer.wait('document.querySelector("#v2-confirmation")?.textContent.includes("Pedido recebido")');
    const orders=await db.collection(`${base}/pedidos`).get();assert.equal(orders.size,1);const pedidoId=orders.docs[0].id;
    assert.equal(orders.docs[0].data().totalCentavos,1250);assert.equal(orders.docs[0].data().itens[0].observacao,'Sem cebola');
    const cashier=await terminal('caixa'), kitchen=await terminal('cozinha');
    const received=await cashier('receberPedidoPdvV2',{pedidoId});
    assert.equal((await cashier('receberPedidoPdvV2',{pedidoId})).reutilizado,true);
    for(const [de,para] of [['novo','em_preparo'],['em_preparo','pronto'],['pronto','entregue']])await kitchen('avancarPreparoV2',{pedidoId,de,para});
    const turno={id:randomUUID(),terminalId:'TESTE-INTEGRADO',dataAbertura:new Date().toISOString()};
    await cashier('abrirTurnoCaixaV2',{turno,trocoInicialCentavos:0});
    const account=(await db.doc(`${base}/atendimentos/${received.atendimentoId}`).get()).data();
    const payment={atendimentoId:received.atendimentoId,versao:account.versao,turno,pagamentos:[{forma:'dinheiro',valorCentavos:1250}],recebidoDinheiroCentavos:2000,confirmado:true};
    assert.equal((await cashier('fecharAtendimentoV2',payment)).trocoCentavos,750);
    assert.equal((await cashier('fecharAtendimentoV2',payment)).reutilizado,true);
    assert.equal((await db.collection(`${base}/vendas`).get()).size,1);
    assert.equal((await db.doc(`${base}/estoque/lanche`).get()).data().saldoMili,9000);
    assert.equal((await db.doc(`${base}/estoque/bacon`).get()).data().saldoMili,9800);
    assert.equal((await db.doc(`${base}/pedidos/${pedidoId}`).get()).data().pagamento,'pago');
    await customer.win.loadURL(customerUrl);await customer.wait('document.querySelector("#v2-confirmation")?.textContent.includes("Entregue")');
    await customer.click('#v2-new');await customer.wait('document.querySelector("[data-product] button")?.disabled===true');
    await manager.click('#g-pause');await manager.wait('document.querySelector("#g-operation h3").textContent.includes("disponível")');
    await manager.click('#g-publish');await manager.wait('document.querySelector("#g-operation h3").textContent.includes("fora do ar")');
    assert.equal((await cat.get()).data().publicado,false);
    await customer.win.loadURL(customerUrl);await customer.wait('!document.querySelector("[data-product]") && document.body.innerText.includes("indisponível")');
    console.log('CATALOGO FLUXO PASS: manager creates product; explicit availability; required addon; customer lost-response retry during pause; receive once; kitchen delivered; cash/change/payment once; stock once; resume and withdraw. EMULATORS ONLY.');
  } catch(e) {console.error(e);process.exitCode=1;}
  finally {
    manager.win.destroy();customer.win.destroy();await Promise.all(clients.map(deleteApp));
    await db.recursiveDelete(shop);await cat.delete();await db.doc(`rotas_publicas_v2/${id}`).delete();
    for(const uid of accounts){await db.doc(`terminais_v2/${uid}`).delete();await admin.auth().deleteUser(uid);}
    await admin.app().delete();app.exit(process.exitCode||0);
  }
});
