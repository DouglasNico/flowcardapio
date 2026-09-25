import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciarAcompanhamento, INTERVALO_ACOMPANHAMENTO_MS } from '../src/lib/acompanhamento-v2.js';
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(consultar = async () => ({status:'novo'})) {
  const documento = new EventTarget(); documento.hidden = false;
  const timers = new Map(), updates = [], errors = []; let id=0, calls=0;
  const stop = iniciarAcompanhamento({ documento,
    consultar: () => { calls++; return consultar(); },
    atualizar: p => updates.push(p), erro: e => errors.push(e),
    agendar: (fn, ms) => { assert.equal(ms,30000); timers.set(++id, fn); return id; },
    cancelar: id => timers.delete(id) });
  return {stop, timers, updates, errors, get calls(){return calls;},
    visible(value) { documento.hidden = !value; documento.dispatchEvent(new Event('visibilitychange')); },
    fire(){const [id,fn] = timers.entries().next().value; timers.delete(id); fn();} };
}
test('30 segundos, pausa oculta e consulta ao voltar; cleanup remove listener', async () => {
  assert.equal(INTERVALO_ACOMPANHAMENTO_MS,30000);
  const f=fixture(); await flush(); assert.equal(f.calls,1); assert.equal(f.timers.size,1);
  f.fire(); await flush(); assert.equal(f.calls,2);
  f.visible(false); assert.equal(f.timers.size,0);
  f.visible(true); await flush(); assert.equal(f.calls,3); assert.equal(f.timers.size,1);
  f.stop(); f.visible(false); f.visible(true); await flush(); assert.equal(f.calls,3); assert.equal(f.timers.size,0);
});
test('trocar visibilidade durante consulta nao sobrepoe requisicoes', async () => {
  let resolve; const f=fixture(() => new Promise(r=>{resolve=r;}));
  f.visible(false); f.visible(true); assert.equal(f.calls,1);
  resolve({status:'novo'}); await flush(); assert.equal(f.timers.size,1); f.stop();
});
test('resposta tardia depois de sair nao atualiza tela nem reagenda', async () => {
  let resolve; const f=fixture(() => new Promise(r=>{resolve=r;})); f.stop();
  resolve({status:'novo'}); await flush(); assert.equal(f.updates.length,0); assert.equal(f.timers.size,0);
});
test('cancelado ou entregue pago encerram; entregue pendente continua', async () => {
  for(const [pedido, expected] of [[{status:'cancelado'},0],[{status:'entregue',pagamento:'pago'},0],[{status:'entregue',pagamento:'pendente'},1]]) {
    const f=fixture(async()=>pedido); await flush(); assert.equal(f.calls,1); assert.equal(f.timers.size,expected);
    if(!expected){f.visible(false);f.visible(true);assert.equal(f.calls,1);} f.stop();
  }
});
test('falha permite nova tentativa, e resposta oculta nao agenda', async () => {
  const f=fixture(async()=>{throw Error('offline');}); await flush(); assert.equal(f.errors.length,1); assert.equal(f.timers.size,1); f.stop();
  let resolve; const g=fixture(()=>new Promise(r=>{resolve=r;})); g.visible(false); resolve({status:'novo'});
  await flush(); assert.equal(g.timers.size,0); g.stop();
});
