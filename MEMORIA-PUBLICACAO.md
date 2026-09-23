
# Publicacao frontend — 23/09/2026
Usuario autorizou publicar todos os sites. Publicar reconstrucao do painel e cardapio existentes (rotas legadas) e fontes V2 protegidas por opt-in. Nao habilitar VITE_V2_HOSPEDADO, nao implantar Functions/regras/indices nem criar loja remota nesta rodada. /gestao-v2 segue informando ambiente nao habilitado ate preparar backend. Build de producao executado; testes completos ficam para amanha. Segredos, fixtures e arquivos locais functions/.env nao entram no commit.

## 23/09/2026 — SVG restantes
`src/lib/icons.js`: SVGs de fechar/alimentos/bebidas/hambúrguer. `src/pages/painel-grupos.js`: fechar editor/opção usa SVG. `src/lib/grupos.js`: fallback de categorias usa SVG em lugar de emoji. As demais interfaces do cardápio já usavam o conjunto `ico`; site oficial também já usa SVG.
Validação: `npm run build` aprovado (aviso existente de chunk >500KB). Nenhuma mudança em API, dados, autenticação, regras ou ativação do backend V2.
