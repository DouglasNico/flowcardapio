export function esc(valor) {
  return String(valor || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

export function brl(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function erroAmigavel(err) {
  const msg = String((err && err.message) || err || "Erro inesperado.");
  if (msg.includes("not-found") || msg.includes("functions/not-found")) {
    return "As Functions do cardápio ainda não foram publicadas no Firebase.";
  }
  if (msg.includes("permission-denied") || msg.includes("Missing or insufficient")) {
    return "Sem permissão. Publique as regras do Firestore do cardápio ou entre de novo.";
  }
  if (msg.includes("auth/unauthorized-domain")) {
    return "Adicione este domínio em Authentication → Authorized domains no Firebase.";
  }
  return msg.replace(/^Firebase:\s*/i, "").replace(/\s*\(.*\)$/, "");
}

export function originPublico() {
  return window.location.origin.replace(/\/$/, "");
}
