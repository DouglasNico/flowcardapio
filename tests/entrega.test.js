import test from 'node:test';
import assert from 'node:assert/strict';
import {telefoneFormatado, enderecoTexto, validarEntrega, entregaPublica, calcularEntrega} from '../shared/entrega.js';
import handler from '../api/criar-pedido.js';
const delivery={ativo:true,bairros:[{id:'centro',nome:'Centro',taxaCentavos:750,repasseCentavos:500}]};
const cliente={bairroId:'centro',nome:'Cliente teste',telefone:'(19) 99863-2127',rua:'Rua de teste',numero:'10'};
test('contato formata fixo, celular e DDI e compõe endereço sem perder campos',()=>{
 assert.equal(telefoneFormatado('5519998632127'),'(19) 99863-2127');assert.equal(telefoneFormatado('1933334444'),'(19) 3333-4444');
 assert.equal(enderecoTexto({rua:'Rua A',numero:'10',bairro:'Centro',cidade:'Campinas',uf:'sp'}),'Rua A, 10 · Centro · Campinas - SP');
});
test('configuração recusa taxa negativa, duplicata e ativação sem bairros',()=>{
 assert.throws(()=>validarEntrega({ativo:true,bairros:[]}));assert.throws(()=>validarEntrega({bairros:[{id:'a',nome:'Centro',taxaCentavos:-1}]}));
 assert.throws(()=>validarEntrega({bairros:[...delivery.bairros,{id:'b',nome:'CÉNTRO',taxaCentavos:0}]}));
 assert.equal(validarEntrega({ativo:false}).ativo,false);
});
test('repasse não é público e entrega exige região e identificação',()=>{
 assert.equal(entregaPublica(delivery).bairros[0].repasseCentavos,undefined);
 assert.equal(calcularEntrega(delivery,{...cliente,taxaEntrega:0}).taxaEntrega,7.5);
 assert.throws(()=>calcularEntrega(delivery,{...cliente,bairroId:'fora'}));assert.throws(()=>calcularEntrega(delivery,{...cliente,telefone:'19'}));
});
const enc=v=>v===null?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{doubleValue:v}:Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
const dec=v=>'mapValue'in v?Object.fromEntries(Object.entries(v.mapValue.fields).map(([k,x])=>[k,dec(x)])):'arrayValue'in v?v.arrayValue.values.map(dec):v.stringValue??v.booleanValue??v.doubleValue??(v.integerValue!==undefined?Number(v.integerValue):null);
async function request(t,extra={},existing=null){const writes=[];const original=global.fetch;
 global.fetch=async(url,options={})=>{
  if(String(url).includes('signInWithPassword'))return {ok:true,json:async()=>({idToken:'fixture'})};
  if(options.method==='POST'){writes.push({url:String(url),data:dec({mapValue:JSON.parse(options.body)})});return {ok:true,json:async()=>({})};}
  let data=null;
  if(String(url).includes('/cardapio_publico/'))data={nome:'Teste',produtos:[{id:'p1',nome:'Lanche',preco:20,grupos:[]}]};
  else if(String(url).includes('/cardapio_config/'))data={delivery,enderecoDetalhado:{cidade:'Campinas',uf:'SP'},pedidoMinimoValor:15};
  else if(existing)data=existing;
  return data?{ok:true,status:200,json:async()=>({fields:enc(data).mapValue.fields})}:{status:404};
 };
 t.after(()=>{global.fetch=original});
 let response;const res={setHeader(){},status(code){this.code=code;return this},json(body){response={code:this.code,body};return this}};
 await handler({method:'POST',body:{chave:'LIC-FLOW-123456',tipo:'delivery',entrega:cliente,idempotencyKey:'fixture-123456',itens:[{id:'p1',quantidade:2}],...extra}},res);
 return {...response,writes};
}
test('API calcula taxa no servidor, preserva repasse privado e não grava endereço no documento público',async t=>{
 const r=await request(t,{taxaEntrega:0,total:1});assert.equal(r.code,200);assert.equal(r.body.pedido.total,47.5);assert.equal(r.body.pedido.repasseMotoboy,undefined);assert.equal(r.body.pedido.cliente,undefined);
 assert.equal(r.writes[0].data.repasseMotoboy,5);assert.equal(r.writes[0].data.endereco.bairro,'Centro');assert.equal(r.writes[1].data.cliente,undefined);assert.equal(r.writes[1].data.endereco,undefined);assert.equal(r.writes[1].data.taxaEntrega,7.5);
});
test('API recusa bairro fora da área sem criar pedido',async t=>{const r=await request(t,{entrega:{...cliente,bairroId:'fora'}});assert.equal(r.code,400);assert.equal(r.writes.length,0)});
test('retirada continua sem taxa',async t=>{const r=await request(t,{tipo:'retirada'});assert.equal(r.code,200);assert.equal(r.body.pedido.total,40);assert.equal(r.writes[0].data.repasseMotoboy,undefined)});
test('reenvio idempotente não cria outro pedido nem revela repasse',async t=>{const r=await request(t,{}, {tipo:'delivery',total:47.5,repasseMotoboy:5,cliente:{nome:'teste'}});assert.equal(r.code,200);assert.equal(r.body.reused,true);assert.equal(r.body.pedido.repasseMotoboy,undefined);assert.equal(r.writes.length,0)});
