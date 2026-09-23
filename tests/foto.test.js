import test from "node:test";
import assert from "node:assert/strict";
import { normalizarEnquadramento, htmlFoto } from "../src/lib/foto.js";

test("fotos antigas mantêm recorte central; metadados inválidos têm limites seguros", () => {
  assert.deepEqual(normalizarEnquadramento(), { modo: "preencher", zoom: 1, x: 50, y: 50 });
  assert.deepEqual(normalizarEnquadramento({ modo: "outro", zoom: 10, x: -80, y: 200 }),
    { modo: "preencher", zoom: 3, x: 0, y: 100 });
  assert.deepEqual(normalizarEnquadramento({ zoom: NaN, x: Infinity, y: "url(x)" }), normalizarEnquadramento());
});

test("foto inteira não herda zoom ou posição que cortem o produto", () => {
  assert.deepEqual(normalizarEnquadramento({ modo: "inteira", zoom: 3, x: 0, y: 100 }),
    { modo: "inteira", zoom: 1, x: 50, y: 50 });
});

test("fundo usa a mesma imagem sem transformar o arquivo original", () => {
  const produto = { fotoUrl: "https://example.com/original.jpg?a=1&b=2", fotoEnquadramento: { modo: "inteira" } };
  const original = structuredClone(produto);
  const html = htmlFoto(produto);
  assert.equal((html.match(/src="https:\/\/example.com\/original.jpg\?a=1&amp;b=2"/g) || []).length, 2);
  assert.match(html, /class="foto-fundo"/);
  assert.deepEqual(produto, original);
  assert.doesNotMatch(htmlFoto({ ...produto, fotoEnquadramento: { modo: "preencher", zoom: 1.5, x: 30, y: 60 } }), /class="foto-fundo"/);
});

test("URL não pode quebrar os atributos HTML", () => {
  const html = htmlFoto({ fotoUrl: 'foto.jpg" onerror="alert(1)' });
  assert.doesNotMatch(html, /src="foto.jpg" onerror=/);
  assert.match(html, /&quot;/);
});
