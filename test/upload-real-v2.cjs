// Opt-in integration: uploads ONLY generated test PNGs and deletes those exact assets.
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const pdv=path.resolve(__dirname,'../../flowpdv-sistema/adega-pdv-gestao');
if(process.env.FLOWPDV_UPLOAD_REAL!=='1')throw Error('Use FLOWPDV_UPLOAD_REAL=1 para homologação externa explícita.');
if(!process.env.UPLOAD_BROWSER){const env={...process.env,UPLOAD_BROWSER:'1'};delete env.ELECTRON_RUN_AS_NODE;const r=require('node:child_process').spawnSync(require(path.join(pdv,'node_modules/electron')),[__filename],{env,stdio:'inherit',timeout:180000});if(r.error)throw r.error;process.exit(r.status??1);}
const {app,BrowserWindow,session}=require('electron');
app.setPath('userData',fs.mkdtempSync(path.join(require('node:os').tmpdir(),'flowpdv-photo-')));app.on('window-all-closed',()=>{});
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099';
const admin=require(path.join(pdv,'functions/node_modules/firebase-admin'));admin.initializeApp({projectId:'demo-flowpdv'});
const db=admin.firestore(),id='upload-test-'+randomUUID(),assets=new Set();let user,failed=false;
const readEnv=file=>Object.fromEntries(fs.readFileSync(file,'utf8').split(/\r?\n/).filter(l=>/^\s*[A-Z_][A-Z0-9_]*=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
const config={...readEnv(path.join(pdv,'functions/.env.local')),...readEnv(path.join(pdv,'functions/.secret.local'))};
app.whenReady().then(async()=>{
  session.defaultSession.webRequest.onBeforeRequest((d,cb)=>{const u=new URL(d.url);cb({cancel:!((u.hostname==='127.0.0.1'&&['53700','8080','9099','5001'].includes(u.port))||(u.protocol==='https:'&&['api.cloudinary.com','res.cloudinary.com'].includes(u.hostname))||['data:','blob:','devtools:'].includes(u.protocol))});});
  const win=new BrowserWindow({show:false,webPreferences:{offscreen:true,backgroundThrottling:false,contextIsolation:true}});
  const js=s=>win.webContents.executeJavaScript(s),wait=async s=>{for(let i=0;i<750;i++){if(await js(s))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timeout: '+s+' | '+await js('document.body.innerText'));};
  const fill=(s,v)=>js(`document.querySelector(${JSON.stringify(s)}).value=${JSON.stringify(v)};document.querySelector(${JSON.stringify(s)}).dispatchEvent(new Event('input',{bubbles:true}))`);
  const cat=db.doc(`catalogos_publicos_v2/${id}`),shop=db.doc(`lojas_v2/${id}`);
  try{
    user=await admin.auth().createUser({email:id+'@example.test',password:'TesteLocal123!',emailVerified:true});
    await shop.set({ativo:true,nome:'Teste de imagem sintética',slug:id,configVersao:0,modulos:{cardapio:true,mesas:true,retirada:true}});
    await shop.collection('membros').doc(user.uid).set({ativo:true,tipo:'usuario',papel:'gerente'});
    await db.doc(`rotas_publicas_v2/${id}`).set({lojaId:id});
    await cat.set({publicado:false,publicacaoManual:true,versao:0,produtos:[{id:'foto',nome:'Produto fictício',precoCentavos:100,ativo:true,esgotado:false,grupos:[]}]});
    await win.loadURL('http://127.0.0.1:53700/gestao-v2');await wait('!!document.querySelector("#g-login")');
    await fill('[name=email]',user.email);await fill('[name=password]','TesteLocal123!');await js('document.querySelector("#g-login").requestSubmit()');
    await wait('!!document.querySelector("#g-store")');await fill('[name=loja]',id);await js('document.querySelector("#g-store").requestSubmit()');await wait('!!document.querySelector(".g-product")');
    // Remember signed IDs before upload, so lost responses still get cleaned up.
    await js(`window.testUploadIds=[];const original=Response.prototype.json;Response.prototype.json=async function(...a){const r=await original.apply(this,a);if(this.url.includes('assinarFotoCardapioV2')&&r.result?.publicId)window.testUploadIds.push(r.result.publicId);return r;};void 0`);
    let previous='';
    for(const color of ['#e67e22','#2454a4']){
      await js('document.querySelector(".g-product").click()');
      await js(`(async()=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d');ctx.fillStyle=${JSON.stringify(color)};ctx.fillRect(0,0,32,32);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const transfer=new DataTransfer();transfer.items.add(new File([blob],'teste-sintetico.png',{type:'image/png'}));const input=document.querySelector('.g-photo-file');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await wait('document.querySelector(".g-photo-status").textContent!=="Enviando foto…"');
      assert.ok(await js('document.querySelector(".g-photo-status").textContent.includes("Foto enviada")'),'Upload não confirmado: '+await js('document.querySelector(".g-photo-status").textContent'));
      const url=await js('document.querySelector("[name=imagemUrl]").value');assert.notEqual(url,previous);
      assert.equal((await cat.get()).data().produtos[0].imagemUrl||'',previous);
      await js('document.querySelector(".g-photo-preview").click()');await wait('!!document.querySelector(".g-photo-image img")');
      await js('document.querySelector(".g-edit").requestSubmit()');await wait('!document.querySelector(".g-edit")');
      assert.equal((await cat.get()).data().produtos[0].imagemUrl,url);previous=url;
    }
    await js('document.querySelector(".g-product").click();document.querySelector(".g-photo-remove").click()');
    assert.equal((await cat.get()).data().produtos[0].imagemUrl,previous);
    await js('document.querySelector(".g-edit").requestSubmit()');await wait('!document.querySelector(".g-edit")');
    assert.equal((await cat.get()).data().produtos[0].imagemUrl,'');assert.equal((await cat.get()).data().publicado,false);
    console.log('UPLOAD REAL PASS: adicionar, visualizar, salvar, trocar e remover vínculo pelo painel; catálogo permanece não publicado.');
  }catch(e){failed=true;console.error(e.message);}
  finally{
    for(const publicId of await js('window.testUploadIds||[]').catch(()=>[]))assets.add(publicId);
    for(const publicId of assets){
      try{
        assert.ok(publicId.startsWith(`flowpdv-v2/${id}/foto/`));
        const timestamp=Math.floor(Date.now()/1000),params={invalidate:'true',public_id:publicId,timestamp};
        const signature=createHash('sha1').update(Object.keys(params).sort().map(k=>`${k}=${params[k]}`).join('&')+config.CLOUDINARY_V2_API_SECRET).digest('hex');
        const response=await fetch(`https://api.cloudinary.com/v1_1/${config.CLOUDINARY_V2_CLOUD_NAME}/image/destroy`,{method:'POST',body:new URLSearchParams({...params,api_key:config.CLOUDINARY_V2_API_KEY,signature}),signal:AbortSignal.timeout(30000)});
        const result=await response.json();assert.ok(response.ok&&['ok','not found'].includes(result.result));
      }catch{failed=true;console.error('Limpeza remota pendente para ativo sintético:',publicId);}
    }
    console.log(`Limpeza dos ativos sintéticos solicitada: ${assets.size}.`);
    await db.recursiveDelete(shop);await cat.delete();await db.doc(`rotas_publicas_v2/${id}`).delete();if(user)await admin.auth().deleteUser(user.uid);
    win.destroy();await admin.app().delete();app.exit(failed?1:0);
  }
});

