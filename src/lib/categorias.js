// Prioriza os grupos de refeição sem criar categorias que a loja não utiliza.
const normalizar = valor => String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function prioridade(nome) {
  const n = normalizar(nome);
  if (/adiciona|extra|complemento|molho/.test(n)) return 100;
  if (/lanche|hamburg|burger/.test(n)) return 0;
  if (/pizza/.test(n)) return 1;
  if (/bebida|refrigerante|cerveja/.test(n)) return 2;
  if (/suco/.test(n)) return 3;
  if (/porc|petisco/.test(n)) return 4;
  if (/combo/.test(n)) return 5;
  if (/sobremesa|doce|acai|sorvete/.test(n)) return 6;
  if (/bomboni/.test(n)) return 7;
  return 50;
}
export const compararCategorias = (a,b) => prioridade(a)-prioridade(b) || a.localeCompare(b,'pt-BR');
