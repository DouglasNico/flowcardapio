import { createHash } from 'node:crypto';
const endpoint = 'https://us-central1-aplicativo-pdv.cloudfunctions.net/';
export async function chamarPedidoV2(nome, data, token, request = fetch) {
  const r = await request(endpoint + nome, {method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({data}),signal:AbortSignal.timeout(15000)});
  const body = await r.json();
  if(!r.ok || body.error){const e=new Error(body.error?.message || 'Recebimento temporariamente indisponível. Tente novamente com o mesmo pedido.');e.status=r.status===400?412:r.status;throw e;}
  if(!body.result)throw new Error('Resposta incompleta do recebimento. Preserve o pedido e tente novamente.');
  return body.result;
}
export function respostaPedidoV2(pedido, {chave, nomeLoja='', token}={}) {
  return {id:`V2-${pedido.pedidoId}`,chaveLicenca:chave,tipo:pedido.tipo,status:pedido.status,pagamento:pedido.pagamento,
    total:pedido.totalCentavos/100,subtotal:(pedido.subtotalCentavos??pedido.totalCentavos)/100,taxaEntrega:(pedido.taxaEntregaCentavos||0)/100,nomeLoja,
    ...(token?{acompanhamentoV2:token}:{}),
    itens:pedido.itens.map(i=>({nome:i.nome,quantidade:i.quantidade,precoUnitario:i.precoUnitarioCentavos/100,total:i.totalCentavos/100,extras:i.opcoes||[]}))};
}
export async function encaminharPedidoV2({chave,publico,body,idem,token,request=fetch}) {
  const route=publico.integracaoPdv;
  if(chave!=='LIC-FLOW-937278' || route?.schema!==1 || route.motor!=='v2' || route.slug!=='burger-teste' || !Number.isSafeInteger(route.catalogoVersao)) throw Object.assign(new Error('Rota integrada inválida. Consulte a loja.'),{status:412});
  if(body.tipo!=='retirada')throw Object.assign(new Error('Este piloto recebe somente pedidos para retirada.'),{status:412});
  if(!Array.isArray(body.itens)||!body.itens.length)throw Object.assign(new Error('Pedido sem itens.'),{status:400});
  const itens=body.itens.map(i=>{
    if((i.variante&&i.variante!=='individual')||(i.extras?.length))throw Object.assign(new Error('Combos e adicionais ainda não foram liberados neste piloto.'),{status:412});
    const p=publico.produtos.find(p=>String(p.id)===String(i.id));
    if(!p)throw Object.assign(new Error('Produto indisponível.'),{status:412});
    return {produtoId:String(i.id),quantidade:Number(i.quantidade),observacao:String(i.observacao||''),opcoes:[],precoEsperadoCentavos:i.precoEsperadoCentavos??Math.round(Number(p.preco)*100)};
  });
  // Mesmo login da loja + mesma intenção sempre resultam no mesmo pedido V2.
  const result=await chamarPedidoV2('criarPedidoPublicoV2',{slug:route.slug,requestId:createHash('sha256').update(idem).digest('hex'),tipo:'retirada',catalogoVersao:route.catalogoVersao,itens},token,request);
  const pedido=respostaPedidoV2(result,{chave,nomeLoja:publico.nome,token:result.acompanhamentoToken});
  return {ok:true,reused:result.reutilizado,id:pedido.id,pedido};
}
