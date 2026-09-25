import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encaminharPedidoV2} from '../api/_pedido-v2.js';
const entrada=()=>({chave:'LIC-FLOW-937278',idem:'intencao-estavel',token:'token-ficticio',publico:{nome:'BURGER TESTE',integracaoPdv:{schema:1,motor:'v2',slug:'burger-teste',catalogoVersao:1},produtos:[{id:'x',preco:18.9}]},body:{tipo:'retirada',itens:[{id:'x',quantidade:1,precoEsperadoCentavos:1890}]}});
test('ponte preserva intenção/preço e devolve acompanhamento sem escrever pedido legado',async()=>{
  const calls=[],request=async(url,options)=>{calls.push({url,...options});return {ok:true,json:async()=>({result:{pedidoId:'pedido',tipo:'retirada',status:'novo',totalCentavos:1890,acompanhamentoToken:'a'.repeat(43),reutilizado:calls.length>1,itens:[{nome:'X',quantidade:1,precoUnitarioCentavos:1890,totalCentavos:1890,opcoes:[]}]}})};};
  const first=await encaminharPedidoV2({...entrada(),request}),again=await encaminharPedidoV2({...entrada(),request});
  assert.equal(first.pedido.total,18.9);assert.equal(first.id,'V2-pedido');assert.equal(first.pedido.acompanhamentoV2.length,43);assert.equal(again.reused,true);
  assert.equal(calls[0].body,calls[1].body);assert.ok(calls.every(c=>c.url.endsWith('/criarPedidoPublicoV2')));
});
test('rota inválida, sem itens ou produto indisponível é rejeitado', async () => {
  for (const alterar of [
    x => x.publico.integracaoPdv.motor = 'invalido',
    x => x.body.tipo = 'invalido',
    x => x.body.itens = [],
    x => x.body.itens[0].id = 'inexistente'
  ]) {
    const x = entrada(); alterar(x); let calls = 0;
    await assert.rejects(encaminharPedidoV2({ ...x, request: () => { calls++; } }));
    assert.equal(calls, 0);
  }
});
test('resposta perdida propaga erro e mantém a mesma intenção para tentar de novo',async()=>{
  const x=entrada();let id;
  await assert.rejects(encaminharPedidoV2({...x,request:async(_url,o)=>{id=JSON.parse(o.body).data.requestId;throw Error('conexão perdida');}}),/perdida/);
  await assert.rejects(encaminharPedidoV2({...x,request:async(_url,o)=>{assert.equal(JSON.parse(o.body).data.requestId,id);return {ok:false,status:412,json:async()=>({error:{message:'Loja suspensa'}})};}}),/suspensa/);
});
