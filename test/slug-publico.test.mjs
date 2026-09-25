import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugPublicoValido, slugV2DaChave } from '../src/lib/slug-publico.js';

test('slugPublicoValido aceita burger-teste e rejeita licença/reservados', () => {
  assert.equal(slugPublicoValido('burger-teste'), true);
  assert.equal(slugPublicoValido('le-burgers-hamburgueria'), true);
  assert.equal(slugPublicoValido('LIC-FLOW-937278'), false);
  assert.equal(slugPublicoValido('937278'), false);
  assert.equal(slugPublicoValido('painel'), false);
  assert.equal(slugPublicoValido('v2'), false);
  assert.equal(slugPublicoValido('-x'), false);
});

test('slugV2DaChave usa integracaoPdv ou fallback do piloto BURGER', () => {
  assert.equal(slugV2DaChave('LIC-FLOW-937278', { integracaoPdv: { motor: 'v2', slug: 'burger-teste' } }), 'burger-teste');
  assert.equal(slugV2DaChave('LIC-FLOW-937278', {}), 'burger-teste');
  assert.equal(slugV2DaChave('LIC-FLOW-000001', {}), '');
});
