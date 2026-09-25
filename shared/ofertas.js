// Contrato de ofertas v1. Espelhado em PDV/src/js/ofertas-core.js; teste compara os arquivos.
export const centavos = valor => {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || n > 1000000) throw new Error('Valor monetário inválido.');
  return Math.round(n * 100);
};
const falhar = mensagem => { throw new Error(mensagem); };
export function normalizarOferta(raw = {}, precoNormal = 0) {
  const promocional = (valor, normal) => {
    if (valor == null || valor === '') return null;
    const n = centavos(valor);
    if (n <= 0 || n >= centavos(normal)) falhar('O preço promocional deve ser maior que zero e menor que o preço normal.');
    return n / 100;
  };
  const result = { versao: 1, precoPromocional: promocional(raw.precoPromocional, precoNormal), combo: null };
  if (raw.combo) {
    const c = raw.combo;
    const preco = centavos(c.preco) / 100;
    if (preco <= 0) falhar('Informe o valor total do combo.');
    const fixos = (Array.isArray(c.fixos) ? c.fixos : []).map(x => {
      const quantidade = Number(x.quantidade);
      if (!x.produtoId || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99) falhar('Confira os acompanhamentos e suas quantidades.');
      return { produtoId: String(x.produtoId), quantidade };
    });
    const bebidas = [...new Set((Array.isArray(c.bebidas) ? c.bebidas : []).map(String))].filter(Boolean);
    if (!bebidas.length) falhar('Selecione pelo menos uma bebida incluída no combo.');
    if (fixos.length > 20 || bebidas.length > 50) falhar('O combo excedeu o limite de componentes.');
    if (new Set(fixos.map(x => x.produtoId)).size !== fixos.length) falhar('Não repita um acompanhamento; ajuste sua quantidade.');
    result.combo = { ativo: c.ativo === true, preco, precoPromocional: promocional(c.precoPromocional, preco), fixos, bebidas };
  }
  return result;
}
export function validarPeriodo(raw = {}) {
  const inicio = raw.inicio || null, fim = raw.fim || null;
  for (const d of [inicio, fim]) if (d && !Number.isFinite(Date.parse(d))) falhar('Data da promoção inválida.');
  if (inicio && fim && Date.parse(inicio) >= Date.parse(fim)) falhar('O término deve ser posterior ao início da promoção.');
  return { inicio, fim };
}
export function promocaoVigente(prod, agora = Date.now()) {
  const p = prod.promocao;
  if (!p?.ativa) return false;
  try { validarPeriodo(p); } catch { return false; }
  return (!p.inicio || agora >= Date.parse(p.inicio)) && (!p.fim || agora < Date.parse(p.fim));
}
export function precoOferta(prod, variante = 'individual', agora = Date.now()) {
  if (!['individual', 'combo'].includes(variante)) falhar('Opção de produto inválida.');
  if (variante === 'combo' && !prod.combo?.ativo) falhar('Este combo não está disponível.');
  const normal = variante === 'combo' ? prod.combo.preco : prod.preco;
  const promo = variante === 'combo' ? prod.combo.precoPromocional : prod.precoPromocional;
  const ativo = promocaoVigente(prod, agora) && promo != null && centavos(promo) > 0 && centavos(promo) < centavos(normal);
  return { normal: centavos(normal) / 100, preco: centavos(ativo ? promo : normal) / 100, promocao: ativo };
}
export function temPromocao(prod, agora = Date.now()) {
  return precoOferta(prod, 'individual', agora).promocao || (prod.combo?.ativo && precoOferta(prod, 'combo', agora).promocao);
}
export function comporCombo(prod, bebidaId, permitido = true) {
  if (!permitido || !prod.combo?.ativo) falhar('Combos não estão disponíveis nesta loja.');
  const bebida = prod.combo.bebidas.find(b => String(b.produtoId) === String(bebidaId));
  if (!bebida) falhar('Escolha uma bebida incluída no combo.');
  return [
    { produtoId: String(prod.id), nome: prod.nome, quantidade: 1 },
    ...prod.combo.fixos.map(x => ({ produtoId: String(x.produtoId), nome: x.nome, quantidade: x.quantidade })),
    { produtoId: String(bebida.produtoId), nome: bebida.nome, quantidade: 1 }
  ];
}
export function publicarOferta(prod, overlay, produtos, modulos = {}) {
  const oferta = normalizarOferta(prod.ofertaCardapio, Number(prod.precoVenda ?? prod.preco) || 0);
  const periodo = validarPeriodo(overlay.promocaoPeriodo);
  const combo = oferta.combo;
  let publicoCombo = null;
  if (combo?.ativo && modulos.combos === true) {
    const catalogo = new Map(produtos.map(p => [String(p.id), p]));
    const componente = id => {
      const p = catalogo.get(String(id));
      if (!p || p.ativo === false || p.excluido || p.inativo || String(p.id) === String(prod.id)) falhar(`Confira os componentes do combo de ${prod.nome}.`);
      if (p.permiteFracionado || String(p.unidade || '').toLowerCase() === 'kg') falhar('Componentes do combo devem ser vendidos por unidade.');
      return { produtoId: String(p.id), nome: String(p.nome || '').slice(0, 160) };
    };
    publicoCombo = { ...combo, fixos: combo.fixos.map(x => ({ ...componente(x.produtoId), quantidade: x.quantidade })), bebidas: combo.bebidas.map(componente) };
    if ((overlay.grupos || []).some(g => /combo/i.test(g.nome || ''))) falhar(`Remova o grupo Combo antigo de ${prod.nome} antes de publicar o combo do PDV. Os outros adicionais podem continuar.`);
  }
  const podePromover = oferta.precoPromocional != null || publicoCombo?.precoPromocional != null;
  if (overlay.promocao && !podePromover) falhar(`Cadastre um preço promocional válido no PDV para ${prod.nome}.`);
  return { ofertasVersao: 1, precoPromocional: oferta.precoPromocional, combo: publicoCombo, promocao: { ativa: Boolean(overlay.promocao && podePromover), ...periodo } };
}
