const RESERVADOS = new Set(["painel", "gestao", "gestao-v2", "admin", "cadastro", "v2", "api", "assets", "logos", "favicon.ico"]);
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;
const LIC_SEGMENT_RE = /^(?:lic-?flow-)?(\d+)$/i;

/** Piloto BURGER: fallback se cardapio_publico.integracaoPdv tiver sido sobrescrito. */
export const SLUG_POR_CHAVE_V2 = Object.freeze({
  "LIC-FLOW-937278": "burger-teste"
});

export function slugPublicoValido(valor) {
  const slug = String(valor || "").toLowerCase();
  return SLUG_RE.test(slug) && !RESERVADOS.has(slug) && !LIC_SEGMENT_RE.test(slug);
}

export function ehSegmentoLicenca(segmento) {
  return LIC_SEGMENT_RE.test(String(segmento || ""));
}

export function slugV2DaChave(chave, publico) {
  const rota = publico?.integracaoPdv;
  if (rota?.motor === "v2" && slugPublicoValido(rota.slug)) return String(rota.slug).toLowerCase();
  const fallback = SLUG_POR_CHAVE_V2[chave];
  return slugPublicoValido(fallback) ? fallback : "";
}
