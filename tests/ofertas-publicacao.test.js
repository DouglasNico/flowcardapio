import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origem = new URL('../src/lib/overlay.js', import.meta.url);
test('salvar oferta é rascunho; publicar lê preço e composição do backup do PDV',async()=>{
  const produto={id:'p',nome:'Lanche',precoVenda:18.9,ofertaCardapio:{precoPromocional:16.9,combo:{ativo:true,preco:30.9,precoPromocional:27.9,fixos:[{produtoId:'batata',quantidade:1}],bebidas:['coca']}}};
  const registros=new Map([['licencas/LOJA',{nome:'Loja teste',modulos:{combos:true}}],['cardapio_config/LOJA/produtos/p',{visivel:true}]]);
  const snap=(id,data)=>({id,exists:()=>data!==undefined,data:()=>data});
  const fixture={db:{},auth:{},CLOUDINARY_CLOUD:'',CLOUDINARY_PRESET:'',
    doc:(_, ...partes)=>partes.join('/'),collection:(_, ...partes)=>partes.join('/'),
    getDoc:async path=>snap(path,registros.get(path)),
    getDocs:async prefix=>[...registros].filter(([path])=>path.startsWith(prefix+'/')).map(([path,data])=>snap(path.split('/').at(-1),data)),
    setDoc:async(path,data,options)=>registros.set(path,options?.merge?{...registros.get(path),...data}:data),updateDoc:async()=>{},deleteDoc:async()=>{},
    carregarBackupLoja:async()=>({produtos:[produto,{id:'batata',nome:'Batata'},{id:'coca',nome:'Coca lata',precoVenda:6}]}),
    precoProduto:p=>p.precoVenda,produtoAtivo:p=>p.ativo!==false,nomeDaLoja:l=>l.nome};
  globalThis.__ofertasPublicacaoFixture=fixture;
  const substituidos=new Set(['firebase/firestore','./firebase.js','./backup.js','./auth.js']);
  let fonte=fs.readFileSync(origem,'utf8').replace(/import\s+(\{[\s\S]*?\})\s+from\s+["']([^"']+)["'];/g,(_,nomes,path)=>substituidos.has(path)?`const ${nomes}=globalThis.__ofertasPublicacaoFixture;`:`import ${nomes} from '${new URL(path,origem).href}';`);
  try {
    const modulo=await import('data:text/javascript;base64,'+Buffer.from(fonte).toString('base64'));
    await modulo.salvarOverlay('LOJA','p',{promocao:true});assert.equal(registros.has('cardapio_publico/LOJA'),false);
    await modulo.publicarCardapio('LOJA');const publicado=registros.get('cardapio_publico/LOJA').produtos[0];
    assert.equal(publicado.preco,18.9);assert.equal(publicado.precoPromocional,16.9);assert.equal(publicado.combo.preco,30.9);assert.equal(publicado.combo.bebidas[0].produtoId,'coca');assert.equal(publicado.combo.bebidas[0].preco,undefined);
    await modulo.salvarOverlay('LOJA','p',{promocao:false});assert.equal(publicado.promocao.ativa,true);
    await modulo.publicarCardapio('LOJA');assert.equal(registros.get('cardapio_publico/LOJA').produtos[0].promocao.ativa,false);
    registros.set('licencas/LOJA',{nome:'Loja teste',modulos:{combos:false}});
    await modulo.publicarCardapio('LOJA');assert.equal(registros.get('cardapio_publico/LOJA').produtos[0].combo,null);
  } finally {delete globalThis.__ofertasPublicacaoFixture;}
});
