import {json,preflight} from './_lib.js';
import {chamarPedidoV2,respostaPedidoV2} from './_pedido-v2.js';
export default async function handler(req,res){
  if(preflight(req,res))return;
  if(req.method!=='POST')return json(res,405,{error:'Use POST.'});
  const token=req.body?.token;
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return json(res,404,{error:'Acompanhamento indisponível.'});
  try{return json(res,200,respostaPedidoV2(await chamarPedidoV2('acompanharPedidoPublicoV2',{token}),{chave:'LIC-FLOW-937278',nomeLoja:'BURGER TESTE',token}));}
  catch(e){return json(res,e.status||503,{error:e.message});}
}
