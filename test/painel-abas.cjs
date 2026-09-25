const fs=require('fs'),path=require('path'),assert=require('assert/strict');
module.exports=async({js,wait,win,out,before})=>{
 await js(`fixture.pedidos=[{id:'PED-10001',tipo:'mesa',numeroMesa:12,status:'novo',total:29.9,itens:[{nome:'Hambúrguer da casa com queijo artesanal',quantidade:1,preco:29.9}]},{id:'PED-10002',tipo:'loja',status:'em_preparo',total:18,itens:[{nome:'Batata rústica com alecrim',quantidade:1,preco:18}]}];fixture.emitPedidos()`);
 for(const aba of ['loja','pedidos','qr']){
 await js(`document.querySelector('[data-aba="${aba}"]').click();window.scrollTo(0,0)`);
 if(aba==='qr')await wait("!!document.querySelector('#qr-loja-art img')");
 for(const width of [1366,768,390]){win.setContentSize(width,900);await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');win.webContents.invalidate();await new Promise(r=>setTimeout(r,120));fs.writeFileSync(path.join(out,`${before?'antes':'depois'}-${aba}-${width}.png`),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());if(!before)assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true,aba+' overflow '+width);}
 }
 if(!before)await require('./painel-abas-fluxo.cjs')({js,wait});
};
