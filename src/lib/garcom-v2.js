import { initializeApp } from 'firebase/app';
import { resolverAmbienteV2 } from './ambiente-v2.js';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
let services;
export function ambienteGarcomV2() {
  const config=resolverAmbienteV2(import.meta.env,location);
  if(services)return services;
  const app=initializeApp(config.firebase,'garcom-v2');
  const auth=getAuth(app),fn=getFunctions(app,'us-central1');
  if(config.local){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFunctionsEmulator(fn,'127.0.0.1',5001);}
  return services={auth,call:async(name,data)=>(await httpsCallable(fn,name,{timeout:12000})(data)).data};
}
export async function enviarGarcomV2(uid,scope,body) {
  if(!navigator.locks)throw new Error('Use um navegador atualizado.');
  return navigator.locks.request(`flowpdv-envio:${scope}`,async()=>{
    const s=ambienteGarcomV2();await s.auth.authStateReady();
    if(s.auth.currentUser?.uid!==uid)throw new Error('Sessão mudou. Entre novamente com a mesma conta.');
    const key=type=>`v2:${type}:${scope}`,confirmed=JSON.parse(localStorage.getItem(key('confirmado'))||'null');
    if(confirmed)return confirmed;
    let pending=JSON.parse(localStorage.getItem(key('pendente'))||'null');
    if(pending&&pending.uid!==uid)throw new Error('Envio pertence a outra conta.');
    if(!pending){pending={uid,body:{...body,requestId:crypto.randomUUID()}};localStorage.setItem(key('pendente'),JSON.stringify(pending));}
    try{
      const result=await s.call('criarPedidoGarcomV2',pending.body);
      localStorage.setItem(key('confirmado'),JSON.stringify(result));localStorage.removeItem(key('pendente'));localStorage.removeItem(key('carrinho'));
      return result;
    }catch(error){
      if(['functions/invalid-argument','functions/failed-precondition','functions/not-found'].includes(error.code))localStorage.removeItem(key('pendente'));
      throw error;
    }
  });
}
