const assert=require('assert/strict');
module.exports=async({js,wait})=>{
 await js("document.querySelector('#busca').value='inexistente';document.querySelector('#busca').dispatchEvent(new Event('input'))");assert.match(await js("document.querySelector('#lista').textContent"),/Nenhum produto encontrado/);
 await js("document.querySelector('#catalogo-limpar').click();document.querySelector('#catalogo-categoria').value='Bebidas';document.querySelector('#catalogo-categoria').dispatchEvent(new Event('change'))");assert.equal(await js("document.querySelectorAll('.prod-card').length"),2);
 await js("document.querySelector('#catalogo-situacao').value='oculto';document.querySelector('#catalogo-situacao').dispatchEvent(new Event('change'))");assert.equal(await js("document.querySelector('.prod-card').dataset.id"),'4');
 await js("document.querySelector('#catalogo-limpar').click();fixture.failSave=true;document.querySelector('[data-id=\"1\"] [data-visivel]').click()");await wait("document.querySelector('[data-id=\"1\"] [data-save-state]').textContent.includes('Não foi salvo')");assert.equal(await js("document.querySelector('[data-id=\"1\"] [data-visivel]').checked"),true);assert.equal(await js('fixture.overlays[1].visivel'),true);
 await js("const d=document.querySelector('[data-id=\"1\"] [data-desc]');d.value='Nova descrição';d.dispatchEvent(new Event('input'));document.querySelector('[data-id=\"1\"] [data-save-desc]').click()");await wait("document.querySelector('[data-id=\"1\"] [data-save-state]').textContent.includes('Não foi salvo') && !document.querySelector('[data-id=\"1\"] [data-save-desc]').disabled");
 assert.equal(await js("document.querySelector('#btn-publicar').disabled"),true);assert.equal(await js("document.querySelector('[data-id=\"1\"] [data-desc]').value"),'Nova descrição');
 await js("fixture.failSave=false;document.querySelector('[data-id=\"1\"] [data-save-desc]').click()");await wait("fixture.overlays[1].descricao==='Nova descrição' && !document.querySelector('#btn-publicar').disabled");
 await js("document.querySelector('[data-id=\"1\"] [data-visivel]').click()");await wait("!fixture.overlays[1].visivel && document.querySelector('#btn-publicar').textContent.includes('(2)')");
 await js("fixture.failLoad=true;window.recarregar()");await wait("!!document.querySelector('#catalogo-retry')");assert.equal(await js("document.querySelector('#btn-publicar')"),null);
 await js("fixture.failLoad=false;document.querySelector('#catalogo-retry').click()");await wait("document.querySelectorAll('.prod-card').length===4");
 console.log('FILTROS E SALVAMENTO PASS: falha não altera estado confirmado, descrição preservada, publicação bloqueada até salvar e carregamento retomável.');
};
