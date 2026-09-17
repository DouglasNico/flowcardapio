import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

const PARTES = {
  produtos: { lote: 300, inverter: false }
};

async function lerParte(chave, nome, total) {
  const qtd = Number(total);
  if (!Number.isSafeInteger(qtd) || qtd < 0) return [];
  if (qtd === 0) return [];
  const snaps = await Promise.all(
    Array.from({ length: qtd }, (_, i) =>
      getDoc(doc(db, "backups_lojas", chave, "partes", `${nome}_${i}`))
    )
  );
  const itens = [];
  snaps.forEach((snap) => {
    if (!snap || !snap.exists()) return;
    const dados = snap.data() || {};
    if (Array.isArray(dados.itens)) itens.push(...dados.itens);
  });
  return (PARTES[nome] && PARTES[nome].inverter) ? itens.reverse() : itens;
}

export async function carregarBackupLoja(chave) {
  const snap = await getDoc(doc(db, "backups_lojas", chave));
  if (!snap.exists()) return { produtos: [], categorias: [], config: {} };
  const dados = snap.data() || {};
  if (Array.isArray(dados.produtos) && dados.produtos.length) return dados;
  const manifesto = dados.partes || {};
  const n = manifesto.produtos;
  if (n !== undefined) {
    dados.produtos = await lerParte(chave, "produtos", n);
  }
  return dados;
}

export function precoProduto(produto) {
  const n = parseFloat(produto && (produto.precoVenda || produto.preco || produto.precoUnitario));
  return Number.isFinite(n) ? n : 0;
}

export function produtoAtivo(produto) {
  if (!produto) return false;
  if (produto.ativo === false || produto.excluido === true || produto.inativo === true) return false;
  return Boolean(String(produto.nome || produto.descricao || "").trim());
}
