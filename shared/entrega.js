const text = (value, max = 100) => String(value ?? '').trim().slice(0, max);
export function telefoneDigitos(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  return digits.slice(0,11);
}
export function telefoneFormatado(value) {
  const d = telefoneDigitos(value);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const n = d.slice(2), corte = n.length > 8 ? 5 : 4;
  return `(${d.slice(0,2)}) ${n.slice(0,corte)}${n.length > corte ? '-'+n.slice(corte) : ''}`;
}
export function enderecoEstruturado(value = {}) {
  return Object.fromEntries(['rua','numero','complemento','bairro','cidade','uf','cep'].map(k=>[k,text(value[k],k==='uf'?2:k==='cep'?9:100)]));
}
export function enderecoTexto(value) {
  const e = enderecoEstruturado(value);
  return [[e.rua,e.numero,e.complemento].filter(Boolean).join(', '),e.bairro,[e.cidade,e.uf.toUpperCase()].filter(Boolean).join(' - '),e.cep].filter(Boolean).join(' · ');
}
function centavos(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10000) throw new Error('Informe valores de entrega entre R$ 0 e R$ 10.000.');
  return Math.round(n * 100);
}
export function validarEntrega(config = {}) {
  const bairros = Array.isArray(config.bairros) ? config.bairros : [];
  if (bairros.length > 100) throw new Error('Cadastre até 100 bairros.');
  const seen = new Set();
  const rows = bairros.map((b,idx) => {
    const nome = text(b.nome,80), key = nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if (!nome) throw new Error(`Preencha o nome do bairro ${idx+1}.`);
    if (seen.has(key)) throw new Error(`O bairro ${nome} está repetido.`);
    seen.add(key);
    return {id:text(b.id,60)||`bairro-${idx}`,nome,taxaCentavos:centavos(Number(b.taxaCentavos)/100),repasseCentavos:centavos(Number(b.repasseCentavos||0)/100)};
  });
  if (new Set(rows.map(b=>b.id)).size !== rows.length) throw new Error('Os bairros precisam de identificadores distintos.');
  if (config.ativo && !rows.length) throw new Error('Cadastre pelo menos um bairro para ativar as entregas.');
  return {ativo:config.ativo === true,bairros:rows};
}
export function entregaPublica(config) {
  const e = validarEntrega(config);
  return {ativo:e.ativo,bairros:e.bairros.map(({id,nome,taxaCentavos})=>({id,nome,taxaCentavos}))};
}
export function calcularEntrega(config, pedido) {
  const e = validarEntrega(config);
  if (!e.ativo) throw new Error('A loja não está recebendo pedidos para entrega.');
  const bairro = e.bairros.find(b=>b.id===pedido?.bairroId);
  if (!bairro) throw new Error('Selecione um bairro atendido pela loja.');
  const cliente = {nome:text(pedido.nome,80),telefone:telefoneDigitos(pedido.telefone)};
  const endereco = {rua:text(pedido.rua),numero:text(pedido.numero,15),complemento:text(pedido.complemento),bairro:bairro.nome};
  if (!cliente.nome || ![10,11].includes(cliente.telefone.length) || !endereco.rua || !endereco.numero) throw new Error('Preencha nome, WhatsApp com DDD, rua e número para a entrega.');
  return {cliente,endereco,bairroId:bairro.id,taxaEntrega:bairro.taxaCentavos/100,repasseMotoboy:bairro.repasseCentavos/100};
}
