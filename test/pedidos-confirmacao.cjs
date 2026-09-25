const assert=require('assert/strict'),path=require('path');
(async()=>{
 const esbuild=require(path.resolve('../flowpdv-sistema/adega-pdv-gestao/node_modules/esbuild'));
 const result=await esbuild.build({entryPoints:['src/lib/pedidos.js'],bundle:true,format:'cjs',write:false,plugins:[{name:'firestore-fixture',setup(b){b.onResolve({filter:/firebase\/firestore|\/firebase\.js$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='firebase/firestore'?`export const collection=(...a)=>a;export const doc=()=>{};export const getDoc=()=>{};export const updateDoc=()=>{};export const onSnapshot=(ref,options,cb)=>{globalThis.snapshotCallback=cb;globalThis.snapshotOptions=options;return()=>{}};`:'export const db={};'}));}}]});
 const mod={exports:{}};new Function('module','exports',result.outputFiles[0].text)(mod,mod.exports);
 const values=[];mod.exports.escutarPedidosLoja('TESTE',v=>values.push(v),()=>{});
 const snapshot={metadata:{hasPendingWrites:true},docs:[{id:'1',data:()=>({status:'em_preparo'})}]};globalThis.snapshotCallback(snapshot);assert.equal(values.length,0);
 globalThis.snapshotCallback({...snapshot,metadata:{hasPendingWrites:false}});assert.equal(values.length,1);assert.equal(values[0][0].status,'em_preparo');assert.equal(globalThis.snapshotOptions.includeMetadataChanges,true);
 console.log('SNAPSHOT PASS: escrita local pendente ignorada; confirmação recebida.');
})().catch(e=>{console.error(e);process.exitCode=1});
