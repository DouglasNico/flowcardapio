---
name: FlowPDV — catálogo editorial
description: Sistema observado da gestão e dos cardápios legado e V2.
colors:
  admin-ink: "#15253c"
  admin-bg: "#f6f7f9"
  admin-line: "#dfe4eb"
  admin-muted: "#526279"
  admin-action: "#bc4615"
  admin-action-hover: "#a33a0e"
  admin-focus: "#dc784b"
  menu-bg: "#f2eee7"
  paper: "#fffdf9"
  white: "#ffffff"
  menu-ink: "#29332a"
  menu-line: "#e6e1d9"
  menu-muted: "#696259"
  menu-accent: "#c84a17"
  menu-price: "#b13d0d"
  menu-action: "#b84415"
  menu-action-hover: "#a43a0f"
  menu-focus: "#c25222"
  cart-green: "#263a2f"
  v2-cart-paper: "#faf7f0"
  v2-action-hover: "#963910"
  success-ink: "#285743"
  success-bg: "#eef7f1"
  error-ink: "#a42d26"
  error-bg: "#fff1ef"
typography:
  body:
    fontFamily: "Plus Jakarta Sans, Segoe UI, system-ui, sans-serif"
    lineHeight: 1.45
  admin-headline:
    fontSize: "30px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.9px"
  menu-headline:
    fontSize: "30px"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "-1px"
  menu-title:
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-0.2px"
  menu-description:
    fontSize: "12px"
    lineHeight: 1.65
  admin-title:
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.5
  admin-label:
    fontSize: "11px"
    fontWeight: 600
  v2-body:
    fontFamily: "Plus Jakarta Sans, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  v2-headline:
    fontSize: "32px"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "-1px"
rounded:
  chip: "6px"
  field: "7px"
  control: "8px"
  menu-control: "9px"
  media: "10px"
  panel: "12px"
  detail: "14px"
  sheet: "16px 16px 0 0"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  menu-mobile: "22px"
  menu-desktop: "40px"
components:
  admin-primary:
    backgroundColor: "{colors.admin-action}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  admin-primary-hover:
    backgroundColor: "{colors.admin-action-hover}"
  menu-primary:
    backgroundColor: "{colors.menu-action}"
    textColor: "{colors.white}"
    rounded: "{rounded.menu-control}"
    padding: "13px 16px"
  admin-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  admin-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.panel}"
    padding: "20px"
  admin-chip-active:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success-ink}"
    rounded: "{rounded.chip}"
    padding: "6px 8px"
  admin-nav-active:
    backgroundColor: "{colors.white}"
    textColor: "#17283e"
    rounded: "{rounded.control}"
    padding: "14px 15px"
  menu-cart:
    backgroundColor: "{colors.cart-green}"
    textColor: "{colors.white}"
    rounded: "{rounded.media}"
    padding: "10px 18px"
    height: "56px"
    width: "440px"
---

# Design System: FlowPDV — catálogo editorial

## Overview

**Creative North Star: "Catálogo editorial"**

A hierarquia de nomes, imagens, preços e ações organiza uma experiência de compra acolhedora e uma gestão precisa. A gestão usa superfícies claras e navegação azul-marinho; o consumidor usa papel quente, imagens de produto e divisores discretos. A identidade conecta as duas áreas sem apagar suas necessidades diferentes.

Este documento registra decisões da implementação de 23/09/2026, extraídas do CSS. O usuário confirmou escopo e execução direta; cores, composição e hierarquia tipográfica são decisões da equipe, não preferências individuais explicitamente aprovadas. A publicação permanece suspensa. O backend V2 continua separado do legado; sem promessa de integração decorrente do design.

**Key Characteristics:**
- Hierarquia editorial com nomes antes dos metadados.
- Preços tabulares e ações reconhecíveis.
- Superfícies planas, com profundidade reservada a sobreposições.
- Variação explícita entre gestão, consumidor legado e consumidor V2.

**Autoridade:** `src/styles.css` fornece a base compartilhada, inclusive fonte e comportamentos existentes. `src/pages/painel-catalogo.css`, sob `body.is-painel`, é a autoridade visual da gestão; `src/pages/cardapio-design.css`, sob `body.is-menu`, é a autoridade do consumidor legado; `src/pages/cardapio-v2.css`, sob `body.is-cardapio-v2` e `.v2-menu`, é a autoridade do V2. Regras locais posteriores e mais específicas prevalecem; os tokens antigos de raio 20px e laranja vivo da base não substituem esses valores locais. O frontmatter é o catálogo normativo deste documento; a implementação permanece a evidência para alterações futuras. `PRODUCT.md` contém os limites do produto e `.impeccable/direction.md` a direção de superfície.

## Colors

O painel combina tinta azul-marinho com neutros frios; os cardápios combinam papel quente com verde profundo e terracota.

### Primary
- **Terracota operacional:** `admin-action` e `menu-action` distinguem as ações principais das duas superfícies. Os estados de hover têm tokens próprios; V2 usa sua variante mais escura.
- **Terracota editorial:** `menu-accent` identifica seleção de categoria; `menu-price` destaca preços e links ativos.

### Secondary
- **Verde de fechamento:** `cart-green` ancora a barra de carrinho do legado e a identidade substituta da loja.
- **Estados:** `success-*` e `error-*` são observados nos controles de disponibilidade do painel; texto e estado do controle acompanham a cor.

### Neutral
- **Tinta de gestão:** `admin-ink`, `admin-muted`, `admin-bg` e `admin-line` estruturam a operação.
- **Papel de cardápio:** `paper`, `menu-bg`, `menu-ink`, `menu-muted` e `menu-line` estruturam a leitura. O carrinho lateral V2 usa `v2-cart-paper`.

**The Surface Authority Rule.** Aplique os tokens da rota em que o componente vive; sem substituir globalmente a base compartilhada para reproduzir uma única tela.

## Typography

A família compartilhada é Plus Jakarta Sans, seguida de Segoe UI e fontes de sistema. Títulos recebem peso e espaço; metadados recuam. O frontmatter registra os estilos observados, sem inventar uma escala universal para três implementações.

- Gestão: título de página usa `admin-headline`, título de produto `admin-title` e rótulos `admin-label`. O título de página passa a 27px no layout compacto.
- Legado: título da loja usa `menu-headline`, nome de produto `menu-title` e descrição `menu-description`. No celular, esses tamanhos passam respectivamente a 21px, 14px e 11px. Seções usam 23px no desktop e 22px no celular.
- V2: `v2-body` é sua base explícita; `v2-headline` passa a 27px no celular. Títulos de seção usam 22px, nomes de produto 16px.
- Preços de catálogo usam `font-variant-numeric: tabular-nums`. As descrições operacionais da página usam limites de leitura locais, como 65ch.

## Layout

Gestão: coluna lateral de 228px e conteúdo fluido com limite de 1400px. O conteúdo recebe 44px de espaço superior e padding horizontal `clamp(22px,3.2vw,56px)`. Produtos aparecem em duas colunas; em até 1200px, catálogo e pedidos passam a uma coluna e filtros se reorganizam. Em até 800px, navegação vira cabeçalho compacto com abas horizontais; o conteúdo recebe 20px nas laterais e ações principais podem ocupar a largura disponível.

Legado: largura máxima de 1120px, margem interna definida por `menu-desktop` e grade de produtos em duas colunas. Em até 700px, a grade vira lista de uma coluna e a margem usa `menu-mobile`. Destaques têm três posições proporcionais no desktop e trilho horizontal de cartões de 222px no celular. Fotos ficam separadas das legendas. O detalhe é uma sobreposição de até 560px no desktop, com altura limitada; no celular ocupa o viewport. A barra de carrinho limita sua largura a `calc(100vw - 36px)`.

V2: área de até 1120px, 36px de margem interna desktop e 22px mobile. Colunas de catálogo e carrinho usam proporção 1.65:1, com mínimo de 280px para o carrinho e intervalo de 40px. Em até 900px, carrinho volta ao fluxo; em até 600px, os produtos passam a uma coluna. Esses limiares são locais e não devem ser fundidos com os do legado.

## Elevation & Depth

Cartões de gestão e linhas de produtos ficam planos, delimitados por bordas ou separadores. Carrinho flutuante do legado usa `0 10px 24px #15271d26`; detalhe de produto usa `0 24px 70px #15271d30`. A máscara usa `#172b2459`, sem blur. A sombra compartilhada antiga não é a referência para novos cartões dessas rotas.

**The Overlay Depth Rule.** Reserve elevação estrutural às superfícies que se sobrepõem ao conteúdo; mantenha a listagem plana.

## Shapes

Campos têm cantos discretos; controles, imagens e painéis crescem progressivamente na escala `rounded`. Chips do painel mantêm contorno e formas compactas. Imagens de catálogo têm recorte com `object-fit: cover`; ausência de imagem usa o placeholder existente. O legado usa linhas de produto sem raio ou caixa individual. Detalhes de produto deixam de ter cantos arredondados quando ocupam o celular inteiro.

## Components

### Buttons
Primários são terracota com texto branco; gestão usa altura mínima de 44px, legado 46px e V2 44px. Hover muda o preenchimento sem elevação adicional no primário da gestão e do legado. Controles preservam feedback de pressão herdado quando aplicável. Botões indisponíveis mantêm o estado `disabled` e opacidade reduzida. Botões secundários usam contorno discreto e fundo claro.

### Inputs / Fields
Campos claros, contorno visível e texto escuro. Filtros e campos V2 têm altura mínima de 42px; campos de loja usam 44px. Placeholder é informação secundária e não substitui o rótulo. O foco usa contorno de 3px: gestão com afastamento de 3px, legado 4px e V2 3px.

### Navigation
Gestão usa rail azul-marinho, item ativo claro e ícones associados a texto; no mobile as abas ficam na horizontal. Categorias do legado usam texto e linha inferior de 3px. V2 usa links com `aria-current` e linha de 2px. Cada padrão mantém seu próprio contrato de navegação.

### Chips
Chips gerenciais combinam texto, checkbox e estado de cor. Disponível usa verde suave; pausa usa vermelho suave. Evitar interpretar esses valores como convenção universal de todos os estados do backend.

### Cards / Containers
Produtos gerenciais combinam miniatura, nome, preço, categoria e estados. Descrição editável fica em detalhes expansíveis, com feedback de salvamento próximo ao formulário. No consumidor, linhas de produto e legendas externas deixam a imagem e o nome legíveis sem sobreposição de texto.

### Cart / Product detail
A barra do legado mantém quantidade, acesso ao carrinho e total. O detalhe apresenta o nome antes da categoria, com preço e complementos no fluxo. V2 usa carrinho lateral no desktop e seção no fluxo mobile; a semelhança visual não implica backend compartilhado.

Transições observadas são breves: base de 160ms, contornos e botões de 180ms, detalhes de 200ms e imagem de produto de 250ms. `prefers-reduced-motion` remove animações e transições nas três áreas. Não ocultar conteúdo por padrão à espera de animação.

## Do's and Don'ts

### Do:
- **Do** respeitar a autoridade visual e os breakpoints de cada rota.
- **Do** manter nome, preço, estado e ação legíveis antes de metadados secundários.
- **Do** usar imagens reais do catálogo ou o placeholder existente; identificar fixtures de demonstração.
- **Do** preservar foco visível, movimento reduzido e feedback fiel ao resultado da operação.

### Don't:
- **Don't** transformar a semelhança visual entre legado e V2 em promessa de integração.
- **Don't** inventar indicadores, avaliações, texto promocional ou fotografias de produtos reais.
- **Don't** reintroduzir sombras em todos os cartões por herança da base antiga.
- **Don't** tratar a documentação visual como autorização de publicação.

Gestão V2 (/gestao-v2): shell g-shell/g-sidebar reutiliza identidade editorial; lateral 240px acima de900px, navegação horizontal abaixo. Módulos funcionais preservados; teste local separado do mock53663. Evidência e limites na fase19 do sistema.
