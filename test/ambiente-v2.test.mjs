import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverAmbienteV2 as resolve } from '../src/lib/ambiente-v2.js';

const hostedPdv = { VITE_V2_HOSPEDADO: 'true', VITE_V2_ORIGEM: 'https://pdv.flowpdv.com.br' };
const hostedApex = { VITE_V2_HOSPEDADO: 'true', VITE_V2_ORIGEM: 'https://flowpdv.app.br/' };

test('hosted requires explicit flag and exact HTTPS origin', () => {
  const page = new URL(hostedPdv.VITE_V2_ORIGEM);
  assert.throws(() => resolve({}, page));
  assert.equal(resolve(hostedPdv, page).firebase.projectId, 'aplicativo-pdv');
  assert.equal(resolve(hostedPdv, page).local, false);
  for (const address of ['http://pdv.flowpdv.com.br', 'https://outro.example', 'http://localhost:53700']) assert.throws(() => resolve(hostedPdv, new URL(address)));
  for (const address of ['https://pdv.flowpdv.com.br/path', 'https://pdv.flowpdv.com.br?x=1', 'https://user:pass@pdv.flowpdv.com.br']) assert.throws(() => resolve({ ...hostedPdv, VITE_V2_ORIGEM: address }, page));
});

test('hosted accepts flowpdv.app.br production origin', () => {
  const page = new URL('https://flowpdv.app.br/');
  assert.equal(resolve(hostedApex, page).firebase.projectId, 'aplicativo-pdv');
  assert.equal(resolve(hostedApex, page).local, false);
  assert.throws(() => resolve(hostedApex, new URL('https://cardapio.flowpdv.com.br/')));
  assert.throws(() => resolve(hostedApex, new URL('https://www.flowpdv.app.br/')));
});

test('emulator mode cannot fall back to remote, even with hosted enabled', () => {
  const env = { ...hostedPdv, DEV: true, VITE_AMBIENTE_TESTE: 'true' };
  assert.equal(resolve(env, new URL('http://localhost:53700')).firebase.projectId, 'demo-flowpdv');
  assert.throws(() => resolve(env, new URL(hostedPdv.VITE_V2_ORIGEM)));
  assert.throws(() => resolve({ ...env, DEV: false }, new URL('http://localhost:53700')));
});
