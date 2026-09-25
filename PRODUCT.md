# Product
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Gestor da loja administra produtos, disponibilidade, configuração e pedidos; cliente consulta o cardápio e monta seu pedido no celular ou computador. Escopo confirmado pelo usuário em 23/09/2026: refazer painel de gestão e cardápio do cliente.

## Product Purpose
FlowPDV reúne o catálogo publicado pela loja e a operação de pedidos. Priorizar clareza, confiabilidade e rapidez para escolher produtos e operar a loja.

## Capabilities and Constraints
Preservar funcionalidades e tratamentos de falha das fases 16/17. Legado e V2 são implementações diferentes; V2 usa emuladores e não está conectado ao painel legado. Não inventar integrações, indicadores ou dados reais. Publicação suspensa. Rascunhos de configuração/descrição do painel têm limites documentados.

## Brand Commitments
FlowPDV e seus arquivos de logo existentes. Comunicação em português. Usuário pede reconstrução visual ambiciosa, alinhada, com efeitos perceptíveis e sem aparência genérica de IA; autorizou execução direta no código e demonstração das telas funcionando.

## Evidence on Hand
Código dos módulos painel.js, cardapio.js e cardapio-v2.js, logos em public/logos, capturas e testes das fases 16/17. Conteúdo de demonstração é fictício e deve ser identificado.

## Product Principles
- Exibir confirmação somente quando a operação for confirmada.
- Diferenciar operação gerencial e escolha de produtos pelo cliente.
- Tornar estados, preços e ações reconhecíveis em telas pequenas.
- Preservar edição e retomada quando uma operação falhar.
