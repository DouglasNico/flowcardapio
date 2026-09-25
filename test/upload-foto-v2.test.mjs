import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { enviarFotoGestaoV2 } from '../src/lib/upload-foto-v2.js';
const require = createRequire(import.meta.url);
const { assinaturaUploadV2 } = require('../../flowpdv-sistema/adega-pdv-gestao/functions/upload-cardapio-v2-core.cjs');
const signature = assinaturaUploadV2({ lojaId: 'loja-teste', produtoId: 'produto', cloudName: 'cloud-teste', apiKey: '123', secret: 'segredo-sintetico', timestamp: 1700000000, nonce: 'arquivo' });
const file = new File(['imagem-simulada'], 'foto.png', { type: 'image/png' });
test('assina no servidor e envia campos exatos sem segredo ou sobrescrita', async () => {
  assert.equal(signature.secret, undefined);
  const url = `https://res.cloudinary.com/cloud-teste/image/upload/v1/${signature.publicId}.png`;
  const result = await enviarFotoGestaoV2(file, async () => signature, async (target, options) => {
    assert.equal(target, 'https://api.cloudinary.com/v1_1/cloud-teste/image/upload');
    assert.equal(options.body.get('public_id'), signature.publicId);
    assert.equal(options.body.get('overwrite'), 'false');
    assert.equal(options.body.get('signature'), signature.signature);
    assert.equal(options.body.has('secret'), false);
    return { ok: true, json: async () => ({ secure_url: url, public_id: signature.publicId, resource_type: 'image' }) };
  });
  assert.equal(result, url);
});
test('recusa arquivo inválido antes da assinatura e configuração ausente', async () => {
  await assert.rejects(enviarFotoGestaoV2(new File(['x'], 'x.svg', { type: 'image/svg+xml' }), () => assert.fail('não deve assinar')), /JPG/);
  await assert.rejects(enviarFotoGestaoV2({ type: 'image/png', size: 5242881 }, () => assert.fail('não deve assinar')), /5 MB/);
  assert.throws(() => assinaturaUploadV2({ lojaId: 'loja', produtoId: 'produto' }), /não configurado/);
});
test('não aceita resposta de outra imagem e informa recusa do provedor', async () => {
  await assert.rejects(enviarFotoGestaoV2(file, async () => signature, async () => ({ ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/cloud-teste/image/upload/outro.png', public_id: 'outro', resource_type: 'image' }) })), /não corresponde/);
  await assert.rejects(enviarFotoGestaoV2(file, async () => signature, async () => ({ ok: false, json: async () => ({ error: {} }) })), /recusou/);
});
