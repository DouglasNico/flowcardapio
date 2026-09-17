export const PREFIXO_CHAVE = "LIC-FLOW-";

export function soNumeroChave(valor) {
  return String(valor || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^LIC-?FLOW-?/, "");
}

export function normalizarChave(valor) {
  const n = soNumeroChave(valor);
  return n ? PREFIXO_CHAVE + n : "";
}
