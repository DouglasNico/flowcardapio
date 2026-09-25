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
  if(route?.motor!=='v2' || !route.slug || !Number.isSafeInteger(route.catalogoVersao)) {
    throw Object.assign(new Error('Rota integrada inválida. Consulte a loja.'),{status:412});
  }
  const tipo = String(body.tipo || 'retirada').toLowerCase();
  if(!['retirada', 'delivery', 'mesa'].includes(tipo)) {
    throw Object.assign(new Error('Tipo de atendimento inválido.'),{status:400});
  }
  if(!Array.isArray(body.itens)||!body.itens.length) throw Object.assign(new Error('Pedido sem itens.'),{status:400});
  const itens=body.itens.map(i=>{
    const p=publico.produtos.find(p=>String(p.id)===String(i.id));
    if(!p)throw Object.assign(new Error('Produto indisponível.'),{status:412});
    const opcoes = Array.isArray(i.opcoes) ? i.opcoes : (Array.isArray(i.extras) ? i.extras : []);
    return {
      produtoId:String(i.id),
      quantidade:Number(i.quantidade),
      observacao:String(i.observacao||''),
      opcoes,
      precoEsperadoCentavos:i.precoEsperadoCentavos??Math.round(Number(p.preco)*100)
    };
  });

  const payload = {
    slug: route.slug,
    requestId: createHash('sha256').update(idem).digest('hex'),
    tipo,
    mesaId: body.mesaId || null,
    catalogoVersao: route.catalogoVersao,
    itens,
    ...(body.entrega ? { entrega: body.entrega, cotacao: body.cotacao } : {}),
    ...(body.contato ? { contato: body.contato } : {})
  };

  const result=await chamarPedidoV2('criarPedidoPublicoV2', payload, token, request);
  const pedido=respostaPedidoV2(result,{chave,nomeLoja:publico.nome,token:result.acompanhamentoToken});
  return {ok:true,reused:result.reutilizado,id:pedido.id,pedido};
}
