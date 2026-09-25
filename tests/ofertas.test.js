import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarOferta, publicarOferta, precoOferta, comporCombo, temPromocao, validarPeriodo } from '../shared/ofertas.js';
import handler from '../api/criar-pedido.js';

const oferta = {precoPromocional:16.9,combo:{ativo:true,preco:30.9,precoPromocional:27.9,fixos:[{produtoId:'batata',quantidade:1}],bebidas:['coca','agua']}};
const produtos = [{id:'lanche',nome:'X-Burger',precoVenda:18.9,ofertaCardapio:oferta},{id:'batata',nome:'Batata pequena'},{id:'coca',nome:'Coca lata',precoVenda:6},{id:'agua',nome:'Água',precoVenda:4}];
const publicado = (ov={promocao:true}) => ({id:'lanche',nome:'X-Burger',preco:18.9,grupos:[],...publicarOferta(produtos[0],ov,produtos,{combos:true})});

test('preço individual, combo total, promoções independentes e bebida sem preço avulso',()=>{
  const p=publicado();
  assert.equal(precoOferta(p).preco,16.9);assert.equal(precoOferta(p,'combo').preco,27.9);
  assert.equal(precoOferta(publicado({promocao:false}),'combo').preco,30.9);
  p.combo.precoPromocional=null;assert.equal(precoOferta(p,'combo').preco,30.9);
  const componentes=comporCombo(p,'coca');
  assert.deepEqual(componentes.map(c=>[c.produtoId,c.quantidade]),[['lanche',1],['batata',1],['coca',1]]);
  assert.equal(p.combo.bebidas[0].preco,undefined);
  assert.throws(()=>comporCombo(p,'bebida-inventada'));assert.throws(()=>comporCombo(p,'coca',false));
});
test('período termina sem republicar e aceita promoção apenas do combo',()=>{
  const p=publicado({promocao:true,promocaoPeriodo:{inicio:'2026-09-23T15:00:00Z',fim:'2026-09-23T16:00:00Z'}});
  assert.equal(temPromocao(p,Date.parse('2026-09-23T14:59:59Z')),false);
  assert.equal(precoOferta(p,'individual',Date.parse('2026-09-23T15:00:00Z')).preco,16.9);
  assert.equal(precoOferta(p,'individual',Date.parse('2026-09-23T16:00:00Z')).preco,18.9);
  p.precoPromocional=null;assert.equal(temPromocao(p,Date.parse('2026-09-23T15:30:00Z')),true);
  assert.throws(()=>validarPeriodo({inicio:'2026-09-24',fim:'2026-09-23'}));
});
test('publicação bloqueia composição quebrada e combo antigo sem apagar adicionais',()=>{
  assert.throws(()=>publicarOferta(produtos[0],{},produtos.filter(p=>p.id!=='batata'),{combos:true}));
  assert.throws(()=>publicado({grupos:[{nome:'Combo com batata'}]}));
  assert.equal(publicado({grupos:[{nome:'Adicionais'}]}).combo.ativo,true);
  assert.equal(publicarOferta(produtos[0],{},produtos,{}).combo,null);
  assert.throws(()=>normalizarOferta({precoPromocional:20},18.9));
  assert.throws(()=>normalizarOferta({combo:{...oferta.combo,bebidas:[]}},18.9));
  assert.deepEqual(normalizarOferta(undefined,18.9),{versao:1,precoPromocional:null,combo:null});
});

const enc=v=>v===null?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{doubleValue:v}:Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
const dec=v=>'mapValue'in v?Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,x])=>[k,dec(x)])):'arrayValue'in v?(v.arrayValue.values||[]).map(dec):v.stringValue??v.booleanValue??v.doubleValue??(v.integerValue!==undefined?Number(v.integerValue):null);
async function pedido({item={},prod=publicado(),liberado=true,existente=null}={}) {
  const writes=[],reads=[];const original=global.fetch;
  global.fetch=async(url,options={})=>{
    const path=String(url);reads.push(path);
    if(path.includes('signInWithPassword'))return {ok:true,json:async()=>({idToken:'fixture'})};
    if(options.method==='POST'){writes.push(dec({mapValue:JSON.parse(options.body)}));return {ok:true,json:async()=>({})};}
    const data=path.includes('/cardapio_publico/')?{nome:'Teste',produtos:[prod]}:path.includes('/licencas/')?{modulos:{combos:liberado}}:existente;
    return data?{ok:true,status:200,json:async()=>({fields:enc(data).mapValue.fields})}:{status:404};
  };
  let result;const res={setHeader(){},status(code){this.code=code;return this},json(body){result={code:this.code,body};return this}};
  try {await handler({method:'POST',body:{chave:'LIC-FLOW-123456',tipo:'retirada',idempotencyKey:'oferta-teste-123',itens:[{id:'lanche',quantidade:2,variante:'combo',bebidaId:'coca',precoEsperadoCentavos:2790,...item}]}},res);}
  finally{global.fetch=original;}
  return {...result,writes,reads};
}
test('API valida valor, composição, licença atual e repetição do pedido',async()=>{
  const r=await pedido();assert.equal(r.code,200);assert.equal(r.body.pedido.total,55.8);
  const item=r.writes[0].itens[0];assert.equal(item.precoNormal,30.9);assert.equal(item.promocaoAplicada,true);assert.equal(item.componentes.length,3);assert.match(item.detalhe,/Coca lata/);
  const revogado=await pedido({liberado:false});assert.equal(revogado.code,412);assert.equal(revogado.writes.length,0);
  const bebida=await pedido({item:{bebidaId:'outra'}});assert.equal(bebida.code,412);assert.equal(bebida.writes.length,0);
  const alterado=await pedido({item:{precoEsperadoCentavos:1}});assert.equal(alterado.code,409);assert.equal(alterado.writes.length,0);
  const negativo=await pedido({item:{quantidade:-1}});assert.equal(negativo.code,400);
  const repetido=await pedido({existente:r.writes[0],liberado:false});assert.equal(repetido.body.reused,true);assert.equal(repetido.writes.length,0);
});
test('API soma adicionais uma vez e preserva o catálogo antigo',async()=>{
  const p=publicado();p.grupos=[{id:'ad',nome:'Adicionais',tipo:'multi',min:0,max:3,precoGrupo:0,opcoes:[{id:'bacon',nome:'Bacon',preco:3}]}];
  const r=await pedido({prod:p,item:{extras:[{grupoId:'ad',opcaoId:'bacon',quantidade:1}],precoEsperadoCentavos:3090}});
  assert.equal(r.code,200);assert.equal(r.body.pedido.total,61.8);
  const antigo=await pedido({prod:{id:'lanche',nome:'Lanche',preco:18.9,grupos:[]},item:{variante:'individual',precoEsperadoCentavos:1890}});
  assert.equal(antigo.code,200);assert.equal(antigo.body.pedido.total,37.8);assert.equal(antigo.reads.some(p=>p.includes('/licencas/')),false);
});
