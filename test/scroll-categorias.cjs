const assert=require('assert/strict');
module.exports=async({js,wait,win,url})=>{
 for(const width of [1440,390]){
  win.setContentSize(width,800);await win.loadURL(url+'/cliente');await wait("document.querySelectorAll('[data-cat]').length===4");await js('document.fonts.ready');
  await js('window.scrollTo(0,0)');await wait("document.querySelector('[data-cat].on')?.textContent==='Mais pedidos'");
  for(const name of ['Hambúrgueres','Bebidas']){
   await js(`(()=>{const b=[...document.querySelectorAll('[data-cat]')].find(b=>b.textContent===${JSON.stringify(name)});const el=document.getElementById(b.dataset.cat);window.scrollTo(0,scrollY+el.getBoundingClientRect().top-document.querySelector('.store-head').offsetHeight-12)})()`);
   await wait(`document.querySelector('[data-cat].on')?.textContent===${JSON.stringify(name)}`);
   assert.equal(await js("document.querySelectorAll('[data-cat][aria-current=location]').length"),1);
  }
  await js('window.scrollTo(0,document.documentElement.scrollHeight)');await wait("document.querySelector('[data-cat].on')?.textContent==='Pizzas'");
  await js("document.querySelector('[data-cat]').click()");await wait("scrollY<80 && document.querySelector('[data-cat].on')?.textContent==='Mais pedidos'");
  await js("document.querySelector('#menu-busca').value='zzzinexistente';document.querySelector('#menu-busca').dispatchEvent(new Event('input'))");assert.equal(await js("document.querySelectorAll('[data-cat]').length"),0);
  await js("document.querySelector('#menu-busca').value='';document.querySelector('#menu-busca').dispatchEvent(new Event('input'));window.scrollTo(0,0)");await wait("document.querySelector('[data-cat][aria-current=location]')?.textContent==='Mais pedidos'");
 }
 console.log('SCROLL PASS: desktop/mobile, rolagem para baixo e retorno por clique, última seção e busca.');
};
