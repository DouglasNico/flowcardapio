import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, reload } from 'firebase/auth';
import { ambienteGarcomV2, enviarGarcomV2 } from '../lib/garcom-v2.js';
import { renderCardapioV2 } from './cardapio-v2.js';
export async function renderGarcomV2(app) {
  const slug=location.pathname.split('/')[2];let s,epoch=0,disposed=false,clean;
  try{s=ambienteGarcomV2();}catch(e){app.textContent=e.message;return;}
  const reset=()=>{epoch++;clean?.();clean=null;app.replaceChildren();};
  const tokenConvite=()=>new URLSearchParams(location.hash.slice(1)).get('convite');
  const retirarConvite=()=>history.replaceState(null,'',location.pathname+location.search);
  async function render(user) {
    if(disposed)return;reset();const current=epoch;
    const valido=()=>!disposed&&current===epoch;
    if(!user){
      app.innerHTML='<main class="v2-menu"><h1>Acesso do garçom</h1><form id="waiter-login"><label>E-mail<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Senha<input name="password" type="password" autocomplete="current-password" required minlength="6"></label><button>Entrar</button><button id="waiter-signup" type="button">Criar minha conta</button><button id="waiter-reset" type="button">Esqueci minha senha</button></form><p id="waiter-message" role="status"></p></main>';
      const form=app.querySelector('form'),message=app.querySelector('#waiter-message');
      const run=async action=>{
        form.querySelectorAll('button').forEach(b=>b.disabled=true);
        try{await action();}catch{if(valido())message.textContent='Não foi possível concluir. Confira os dados e a conexão. Para conta existente, use Entrar ou Esqueci minha senha.';}
        finally{if(valido())form.querySelectorAll('button').forEach(b=>b.disabled=false);}
      };
      form.onsubmit=event=>{event.preventDefault();run(()=>signInWithEmailAndPassword(s.auth,form.elements.email.value.trim(),form.elements.password.value));};
      app.querySelector('#waiter-signup').onclick=()=>{if(form.reportValidity())run(()=>createUserWithEmailAndPassword(s.auth,form.elements.email.value.trim(),form.elements.password.value));};
      app.querySelector('#waiter-reset').onclick=()=>{
        if(!form.elements.email.reportValidity())return;
        run(async()=>{await sendPasswordResetEmail(s.auth,form.elements.email.value.trim());if(valido())message.textContent='Se houver uma conta para esse e-mail, confira as instruções de recuperação. No teste local, o link fica no emulador de autenticação.';});
      };
      return;
    }
    app.innerHTML='<main class="v2-menu"><h1>Atendimento por garçom</h1><button id="waiter-logout">Sair</button><p id="waiter-message" role="status">Consultando acesso…</p><div id="waiter-tables"></div></main><div id="waiter-order"></div>';
    const message=app.querySelector('#waiter-message'),controls=app.querySelector('#waiter-tables');
    app.querySelector('#waiter-logout').onclick=()=>signOut(s.auth);
    if(!user.emailVerified){
      message.textContent='Confirme seu e-mail antes de aceitar o convite. No teste local, a verificação fica no emulador de autenticação.';
      const enviar=document.createElement('button');enviar.id='waiter-verify-send';enviar.textContent='Enviar verificação';
      const conferir=document.createElement('button');conferir.id='waiter-verify-check';conferir.textContent='Já confirmei meu e-mail';
      enviar.onclick=async()=>{enviar.disabled=true;try{await sendEmailVerification(user);if(valido())message.textContent='Verificação solicitada. Confira o link de teste no emulador.';}catch{if(valido())message.textContent='Não foi possível solicitar a verificação. Tente novamente.';}finally{if(valido())enviar.disabled=false;}};
      conferir.onclick=async()=>{conferir.disabled=true;try{await reload(user);await user.getIdToken(true);if(valido())await render(s.auth.currentUser);}catch{if(valido()){message.textContent='Não foi possível conferir o e-mail. Verifique a conexão.';conferir.disabled=false;}}};
      controls.append(enviar,conferir);return;
    }
    if(tokenConvite()){
      message.textContent=`Conta: ${user.email}. Aceite o convite para atender nesta loja.`;
      const aceitar=document.createElement('button');aceitar.id='waiter-accept-invite';aceitar.textContent='Aceitar convite';
      aceitar.onclick=async()=>{aceitar.disabled=true;try{await s.call('aceitarConviteGarcomV2',{slug,token:tokenConvite()});if(valido()){retirarConvite();await render(s.auth.currentUser);}}catch(e){if(valido()){message.textContent=e.message;aceitar.disabled=false;}}};
      controls.append(aceitar);return;
    }
    try{
      const data=await s.call('consultarAtendimentoGarcomV2',{slug});if(!valido())return;
      message.textContent=data.nome;
      const select=document.createElement('select');select.id='waiter-table';select.setAttribute('aria-label','Mesa');select.add(new Option('Selecione uma mesa',''));
      const adicionar=mesas=>{for(const mesa of mesas)if(![...select.options].some(o=>o.value===mesa.id))select.add(new Option(mesa.nome,mesa.id));};
      adicionar(data.mesas);
      const pendingPrefix=`v2:pendente:garcom:${user.uid}:${slug}:`;
      for(const key of Object.keys(localStorage).filter(k=>k.startsWith(pendingPrefix))){const id=key.slice(pendingPrefix.length);if(![...select.options].some(o=>o.value===id))select.add(new Option(`Recuperar envio da mesa ${id}`,id));}
      controls.append(select);
      let cursor=data.proximaMesa;
      const mais=document.createElement('button');mais.id='waiter-more-tables';mais.textContent='Carregar mais mesas';mais.hidden=!cursor;controls.append(mais);
      mais.onclick=async()=>{mais.disabled=true;try{const page=await s.call('consultarAtendimentoGarcomV2',{slug,apos:cursor});if(!valido())return;adicionar(page.mesas);cursor=page.proximaMesa;mais.hidden=!cursor;data.catalogo=page.catalogo;data.novosPermitidos=page.novosPermitidos;}catch(e){if(valido())message.textContent=e.message;}finally{if(valido())mais.disabled=false;}};
      let tableEpoch=0;
      select.onchange=async()=>{
        const selected=++tableEpoch;clean?.();clean=null;const box=app.querySelector('#waiter-order');box.replaceChildren();if(!select.value)return;
        const cleanup=await renderCardapioV2(box,{slug,mesaId:select.value,prefixo:`garcom:${user.uid}:`,catalogo:{...data.catalogo,publicado:true,pausado:!data.novosPermitidos},enviar:(scope,body)=>enviarGarcomV2(user.uid,scope,body)});
        if(!valido()||selected!==tableEpoch)cleanup?.();else clean=cleanup;
      };
    }catch(e){if(valido())message.textContent=e.message;}
  }
  const stop=onAuthStateChanged(s.auth,render);
  return()=>{disposed=true;stop();reset();};
}
