# Histórico de Conversa — Cardápio V2 FlowPDV (Antigravity IDE)
**Data:** 25 de Setembro de 2026  
**Projeto:** FlowPDV — Cardápio Digital V2  
**Repositório:** `D:\Desenvolvimento-PDV\flowpdv-cardapio`  
**URL de Produção:** https://flowpdv.app.br/burger-teste  
**Arquivos Principais Modificados:**
- `src/pages/cardapio-v2.js`
- `src/pages/cardapio-v2.css`
- `src/pages/cardapio-design.css`
- `src/lib/icons.js`
- `src/pages/painel.js`

---

## Índice

1. [Análise Inicial do Projeto](#1-análise-inicial-do-projeto)
2. [Configuração de Slug/URL da Loja](#2-configuração-de-slugurl-da-loja)
3. [Skeleton Screen de Carregamento](#3-skeleton-screen-de-carregamento)
4. [Ajuste de Colunas do Estoque (PDV)](#4-ajuste-de-colunas-do-estoque-pdv)
5. [Redesign Completo do Cardápio — Impeccable Design](#5-redesign-completo-do-cardápio--impeccable-design)
6. [Canais de Atendimento (Delivery + Retirada)](#6-canais-de-atendimento-delivery--retirada)
7. [Combo — Individual e Combo](#7-combo--individual-e-combo)
8. [Alinhamento do Botão "+" de Adicionar](#8-alinhamento-do-botão--de-adicionar)
9. [Visual do Carrinho (Sacola de Compras)](#9-visual-do-carrinho-sacola-de-compras)
10. [Posição da Lixeira no Carrinho](#10-posição-da-lixeira-no-carrinho)
11. [Retirada/Delivery só no Final (Sacola)](#11-retiradadelivery-só-no-final-sacola)
12. [Opções e Adicionais no Modal do Produto](#12-opções-e-adicionais-no-modal-do-produto)
13. [Informações da Loja no Cardápio](#13-informações-da-loja-no-cardápio)
14. [Foto do Produto na Sacola + Botão Enviar Pedido](#14-foto-do-produto-na-sacola--botão-enviar-pedido)
15. [Scroll da Sacola ao Trocar Modalidade](#15-scroll-da-sacola-ao-trocar-modalidade)
16. [Adição Direta para Itens Simples (Sem Modal)](#16-adição-direta-para-itens-simples-sem-modal)
17. [Fechar Modais com ESC](#17-fechar-modais-com-esc)
18. [Preço "A partir de" nos Cards](#18-preço-a-partir-de-nos-cards)
19. [Ícones SVG em Todo o Sistema](#19-ícones-svg-em-todo-o-sistema)
20. [WhatsApp Badge + Lupa de Busca](#20-whatsapp-badge--lupa-de-busca)
21. [Aviso de Item Adicionado ao Carrinho (Toast)](#21-aviso-de-item-adicionado-ao-carrinho-toast)
22. [Botão Limpar Carrinho + Campos de Contato](#22-botão-limpar-carrinho--campos-de-contato)
23. [CEP — Consulta ViaCEP](#23-cep--consulta-viacep)
24. [Carrossel "Mais Pedidos"](#24-carrossel-mais-pedidos)
25. [Mobile — Cabeçalho Poluído](#25-mobile--cabeçalho-poluído)
26. [Centralização das Abas de Categoria](#26-centralização-das-abas-de-categoria)
27. [Ícones Estranhos + Toast Visual + Hover da Foto](#27-ícones-estranhos--toast-visual--hover-da-foto)
28. [Destaques — Lanches Primeiro](#28-destaques--lanches-primeiro)
29. [Alinhamento Mobile — Info da Loja](#29-alinhamento-mobile--info-da-loja)
30. [Modal Informações da Loja — Redesign](#30-modal-informações-da-loja--redesign)
31. [Limpar Carrinho + Carrossel < > + CEP Automático + Category Jump Fix](#31-limpar-carrinho--carrossel----cep-automático--category-jump-fix)
32. [Limpar — Mobile Fix](#32-limpar--mobile-fix)
33. [Carrossel — Floating Arrows + Espaço nos Cantos](#33-carrossel--floating-arrows--espaço-nos-cantos)
34. [Confirmação Segura ao Limpar Carrinho](#34-confirmação-segura-ao-limpar-carrinho)
35. [Fix — Piscada do Modal ao Limpar](#35-fix--piscada-do-modal-ao-limpar)

---

## 1. Análise Inicial do Projeto

**Usuário:**
> Analisa esse doc `D:\Desenvolvimento-PDV\flowpdv-sistema\adega-pdv-gestao\docs\HISTORICO-CONVERSA-CURSOR-BURGER-20260923-25.md`
> ve se consegue entender o projeto

**Resposta:**
Analisei detalhadamente o documento de histórico de conversa juntamente com os documentos de integração PDV, roteiros e a estrutura dos repositórios no workspace. O projeto FlowPDV é um ecossistema de PDV para food service que inclui:
- **PDV Desktop (Electron)** — Gestão de estoque, vendas, combos e publicação de catálogo
- **Cardápio Digital (Web/Vercel)** — Interface pública para clientes fazerem pedidos online
- **Painel de Gestão (Web)** — Configurações da loja, cardápio, entregas
- **Site Institucional** — Landing page do FlowPDV
- **App Mobile** — Versão PWA/React Native

O estado do projeto incluía integração já funcional com Firebase, API Vercel para criação de pedidos, e um cardápio V2 em desenvolvimento.

---

## 2. Configuração de Slug/URL da Loja

**Usuário:**
> OP 1: como podemos fazer? deixar na configuração um campo pro cliente por o nome da loja? nome da lanchonete (Lanches Brasil) ai ele coloca lá nas configurações e o site pega /lanches-brasil?
> ou puxar direto do nome cadastrado da empresa?

**Resposta:**
Implementado formato híbrido (padrão iFood/Anota AI/Instagram):
1. Campo próprio nas Configurações da Loja: `Endereço do Cardápio: flowpdv.app.br/ [ lanches-brasil ]`
2. Sugestão automática a partir do nome fantasia da empresa
3. Slug persistido no Firestore como campo `slug` na coleção de licenças
4. Rota dinâmica no Vite/Vercel: `/:slug` resolve para o cardápio da loja

---

## 3. Skeleton Screen de Carregamento

**Usuário:**
> E coloca uns skeleton carregando assim fica feio

**Resposta:**
Implementado Skeleton Screen com animação Shimmer (padrão iFood/Uber Eats):
- **Cabeçalho:** Placeholders com formato do logo/marca, nome da loja, subtítulo e pílulas de navegação de categorias
- **Grade de Produtos:** Cards com espaço para foto e texto simulando o layout final
- **Animação shimmer** com gradiente translúcido que se desloca horizontalmente
- Substituiu o texto cru "Carregando cardápio…" em tela branca

---

## 4. Ajuste de Colunas do Estoque (PDV)

**Usuário:**
> da um respiro nas colunas, ta muito encostada e cortando um pedaço
> pode retirar do tamanho do nome do produto, mas só pra parar de cortar

**Resposta:**
Ajustes realizados na tabela de estoque do PDV:
- **Código de Barras**: Ampliado para `170px` — palavra não corta mais
- **Nome do Produto**: Mínimo `170px` com `width: auto` — libera espaço
- **Categoria**: Ajustado para `125px` com alinhamento centralizado
- **Preço Custo/Venda**: Ajustados com respiro adequado

---

## 5. Redesign Completo do Cardápio — Impeccable Design

**Usuário:**
> melhorou. agora precisamos melhorar nosso cardapio, to achando feio do jeito que ficou
> antes a gente tinha um menuzinho, logo do cliente na frente do nome
> ta faltando umas coisas assim
> o lanche abria um modal com as informações e opcionais etc
> um carrinho bonito
> falta muita coisa
> tem alguma skill que vc consiga utilizar pra estilizar tudo isso?

**Resposta:**
Redesign total aplicando os princípios **Impeccable Design** — eliminando cara de MVP:
- **Cabeçalho Premium**: Logo da loja + nome + badges de status (Aberto/Fechado), tipo de atendimento e tempo de entrega
- **Chips de Categoria**: Navegação horizontal com scroll suave e centralização automática
- **Cards de Produto**: Foto com `object-fit: cover`, nome, descrição, preço formatado, botão "+" flutuante
- **Modal de Produto**: Sheet bottom-up com foto hero, seleção Individual/Combo, steppers de opcionais, campo de observação, botão de adicionar com preço total calculado
- **Sacola (Carrinho)**: Modal bottom-up com lista de itens, foto miniatura, controles de quantidade, subtotal, taxa de entrega e total
- **Toast Notifications**: Avisos animados de sucesso/erro/info
- **WhatsApp Badge**: Ícone SVG discreto no canto superior

---

## 6. Canais de Atendimento (Delivery + Retirada)

**Usuário:**
> e isso ai tambem ta só RETIRADA, ele tem DELIVERY tambem

**Resposta:**
Adicionado suporte completo a ambos os canais:
- Exibição dinâmica baseada na configuração do catálogo (`catalog.canais`)
- Badge no cabeçalho: `🛵 Entrega & 🏪 Retirada`
- Formulários separados na sacola para cada modalidade

---

## 7. Combo — Individual e Combo

**Usuário:**
> Mudar ai, COMBO completo
> tira o completo deixa só Individual | Combo
> Itens incluso: tenta pegar o que o cliente cadastrou no PDV tipo (Lanche + Batata Frita + Bebida)

**Resposta:**
- Nomenclatura ajustada para `Individual | Combo`
- Itens inclusos puxados do cadastro real do PDV (campo `combo.acompanhamento`)
- Exibição do acompanhamento conforme configurado pelo cliente

---

## 8. Alinhamento do Botão "+" de Adicionar

**Usuário:**
> alinha o + que tem dentro da bolinha laranja em cima da foto, ele ta desalinhado la dentro

**Resposta:**
Corrigido o alinhamento do SVG dentro do botão circular com `display: grid; place-items: center;` e dimensões exatas do viewBox do SVG.

---

## 9. Visual do Carrinho (Sacola de Compras)

**Usuário:**
> e não gostei muito do jeito que o carrinho abriu, tem como mudar o visual do carrinho? (sacola)

**Resposta:**
Redesign completo da sacola:
- Modal bottom-sheet com animação `slideUp` suave
- Backdrop com blur e fade-in
- Header com ícone da sacola + contagem de itens
- Lista de itens com foto miniatura, nome, opcionais, stepper de quantidade
- Footer fixo com subtotal, taxa de entrega e total
- Botão de enviar pedido proeminente

---

## 10. Posição da Lixeira no Carrinho

**Usuário:**
> a lixeira ficou em cima do botão (-) menos

**Resposta:**
Reposicionado o botão de remover item para a lateral direita do card, fora da área do stepper (+ / quantidade / −), com ícone SVG de lixeira menor e hover com cor de perigo.

---

## 11. Retirada/Delivery só no Final (Sacola)

**Usuário:**
> coloca o retirar no balcao e entrega delivery só no final de finalizar o carrinho antes do pagamento etc

**Resposta:**
- Removidas as abas de modalidade do topo do cardápio
- Escolha de canal movida para dentro da sacola, antes dos campos de dados
- Abas `🛵 Entrega (Delivery)` e `🏪 Retirada no balcão` dentro do modal
- Formulários condicionais para cada modalidade
- Scroll preservado ao alternar entre abas

---

## 12. Opções e Adicionais no Modal do Produto

**Usuário:**
> nessa tela (modal do lanche) se eu por as opções la no painel tipo Adicionais, etc ponto da carne, ele aparece as escolhas aqui?

**Resposta:**
Sim! Os grupos de opções configurados no painel (Adicionais, Molhos, Ponto da Carne, etc.) são puxados automaticamente do catálogo e exibidos no modal do produto com:
- Stepper de quantidade por opção
- Validação de mínimo/máximo por grupo
- Preço adicional exibido ao lado de cada opção
- Badge "Grátis" para opções sem custo
- Cálculo em tempo real do preço total com todas as opções selecionadas

---

## 13. Informações da Loja no Cardápio

**Usuário:**
> as informações da loja que ta configurado lá no painel, pega aqui?
> Tipo la tem o tempo de entrega, dia de abertura da loja etc

**Resposta:**
Todas as informações cadastradas no painel são sincronizadas em tempo real com o cardápio:
- ⏱️ **Tempo de entrega estimado**: `40–70 min`
- 🕒 **Dias e horários de funcionamento**: `Ter a Dom · 18:00–23:00`
- 📍 **Endereço comercial da loja**
- 💬 **WhatsApp com link direto**
- 🟢 **Status Aberto/Fechado** em tempo real
- **Pedido mínimo** quando configurado

---

## 14. Foto do Produto na Sacola + Botão Enviar Pedido

**Usuário:**
> colocar foto do produto na sacola
> Mudar o nome do botão, Enviar pedido para o balcao ta muito grande só coloca Enviar pedido

**Resposta:**
- Foto miniatura do produto adicionada ao lado esquerdo de cada item na sacola (40×40px, border-radius, object-fit cover)
- Botão renomeado para apenas "Enviar pedido"

---

## 15. Scroll da Sacola ao Trocar Modalidade

**Usuário:**
> Quando eu clico entre Entrega e Retirar balcão o modal sobe pro inicio ai tem que ficar descendo

**Resposta:**
Implementado `prevCartScroll` — ao trocar de aba, a posição de scroll do corpo da sacola é salva antes do `paint()` e restaurada após a re-renderização.

---

## 16. Adição Direta para Itens Simples (Sem Modal)

**Usuário:**
> e tipo agua não precisa abrir o modal pra adicionar
> coloca pra abrir o modal só em coisa q tem (opção configurada no painel)
> Tipo lanche precisa escolher opções, porção etc

**Resposta:**
Implementada lógica condicional:
- Produtos **com grupos de opções** (adicionais, combo, etc.): abrem o modal completo
- Produtos **simples** (sem opções): adicionados direto ao carrinho com 1 toque + toast de confirmação

---

## 17. Fechar Modais com ESC

**Usuário:**
> e todos os modais coloca pra fechar com o ESC tambem

**Resposta:**
Adicionado listener global de `keydown` para `Escape`:
- Fecha modal do produto
- Fecha sacola
- Fecha modal de informações da loja
- Prioridade: fecha o modal mais à frente primeiro

---

## 18. Preço "A partir de" nos Cards

**Usuário:**
> o preço tambem ali ta ex: 18,90
> coloca tipo A partir de 18,90 (pra deixar claro que muda com o combo)

**Resposta:**
Implementada exibição condicional:
- Produtos com combo ativo: `A partir de R$ 18,90`
- Produtos simples: apenas `R$ 18,90`
- Estilo com fonte menor e cor muted para "A partir de"

---

## 19. Ícones SVG em Todo o Sistema

**Usuário:**
> ah e muda tudo esses icones por SVG por favor
> em todo o cardapio / painel / mesa etc
> e la no titulo Sua Sacola, o que acha de por sei la Revisando Pedido?

**Resposta:**
- Todos os ícones substituídos por SVGs inline otimizados (sem dependência de fontes externas)
- Biblioteca centralizada em `src/lib/icons.js`
- Ícones incluem: sacola, lixeira, fechar, lupa, WhatsApp, moto, loja, relógio, info, check, etc.
- Título da sacola alterado para **"Revisando Pedido (N)"** — padrão profissional de apps de delivery

---

## 20. WhatsApp Badge + Lupa de Busca

**Usuário:**
> esse whatsapp ficou muito forte, coloca só um badge com o simbolo do whatsapp em svg ali no canto junto com uma lupa, pro cliente clicar ali abrir um campo de busca ai fica só 2 icones ali em cima mais bonito

**Resposta:**
Implementados 2 botões de ícone no canto superior direito do cabeçalho:
- 🔍 **Lupa**: toggle de campo de busca com filtro em tempo real por nome/descrição/categoria
- 💬 **WhatsApp**: badge verde discreto que abre conversa no número da loja
- Estilo: botões circulares com hover, 38×38px, cor sutil

---

## 21. Aviso de Item Adicionado ao Carrinho (Toast)

**Usuário:**
> e um aviso quando algum item for colocado no carrinho
> tipo agua clico ele ta adicionando direto n avisa tipo "Adicionou Agua no carrinho"

**Resposta:**
Implementado sistema de **Toast Notification**:
- Animação slide-up suave no topo da tela
- Ícone de check + mensagem: `"Água adicionada ao pedido!"`
- Auto-dismiss após 2.5s
- Suporte a tipos: `success`, `error`, `info`
- Posição fixa, não interfere no conteúdo

---

## 22. Botão Limpar Carrinho + Campos de Contato

**Usuário:**
> um botão pra limpar o carrinho
> Botão la em baixo Quando retirada no balcao: Preencha seu nome e whatsapp
> Tira isso vale pro delivery tambem
> Deixa botao unico Enviar pedido
> Essas mensagens tem que ser só quando o cliente clicar sem preencher os dados

**Resposta:**
- Botão "Limpar" com ícone de lixeira adicionado no header da sacola
- Removidas mensagens estáticas de instrução abaixo dos campos
- Validação apenas ao clicar "Enviar pedido" — mostra toast de erro específico para cada campo faltante e foca no campo

---

## 23. CEP — Consulta ViaCEP

**Usuário:**
> digitei cep cliquei em calcular, ele n puxou os dados da rua etc

**Resposta:**
Corrigida e melhorada a integração com ViaCEP:
- Máscara automática `00000-000` no input
- Consulta automática ao digitar 8 dígitos (sem botão)
- Preenchimento de rua, bairro, cidade e UF
- Cálculo automático de frete baseado na distância/bairro configurado
- Tratamento de erros: CEP não encontrado, timeout, falha de rede

---

## 24. Carrossel "Mais Pedidos"

**Usuário:**
> coloca um tipo de carrossel top ali em cima com os Mais pedidos

**Resposta:**
Implementado carrossel horizontal premium:
- Seção "🔥 Mais Pedidos" acima da grade principal
- Cards menores (195px) com scroll horizontal nativo
- Scroll snap para alinhamento automático
- Seleção baseada em produtos com foto, combo ativo ou ordem ≤ 4

---

## 25. Mobile — Cabeçalho Poluído

**Usuário:**
> no mobile ali em cima ficou muito poluido

**Resposta:**
Redesign responsivo do cabeçalho mobile:
- Logo menor + nome em uma linha
- Badges empilhados verticalmente com fonte reduzida
- Botão "Informações da loja ▾" compacto
- Lupa e WhatsApp no canto direito, menor

---

## 26. Centralização das Abas de Categoria

**Usuário:**
> clico na aba ali coloca pra centralizar, ele ir puxando pro lado << >> conforme for clicando

**Resposta:**
Implementado scroll centralizado suave nas abas de categoria:
- Ao clicar em um chip, ele é centralizado horizontalmente no container com `scrollTo({ left: targetLeft, behavior: 'smooth' })`
- Substituído `scrollIntoView()` (causava saltos verticais) por cálculo manual de offset
- Funciona suavemente em mobile e desktop

---

## 27. Ícones Estranhos + Toast Visual + Hover da Foto

**Usuário:**
> os icones tudo estranho
> aviso que foi adicionado no carrinho seco, sem efeito visual, tipo subindo um aviso na tela etc
> mais pedidos cortando ali no final e hover a foto subindo ai corta o contorno dela
> o botão do whatsapp coloca um verde só um pouco mais escuro tbm

**Resposta:**
Múltiplas correções:
- Ícones SVG corrigidos (viewBox, stroke-width, dimensões consistentes)
- Toast redesenhado com animação slide-up + fade, ícone colorido, sombra suave
- Carrossel com padding lateral para não cortar o último card
- Hover da foto limitado com `overflow: hidden` no container do card
- WhatsApp com verde mais escuro (`#128C7E` → `#075E54`)

---

## 28. Destaques — Lanches Primeiro

**Usuário:**
> e outra coisa esses destaques ai tinha que ser os lanches em primeiro, não Agua, coca etc

**Resposta:**
Implementada função `prioridadeCategoria()` para ordenar:
1. Lanches/Hambúrgueres/Burgers (prioridade 1)
2. Pizzas (prioridade 2)
3. Porções (prioridade 3)
4. Combos (prioridade 4)
5. Sobremesas (prioridade 5)
6. Outras categorias (prioridade 10)
7. Bebidas/Sucos/Água (prioridade 15)
8. Adicionais (prioridade 99)

O carrossel "Mais Pedidos" agora prioriza lanches, não bebidas.

---

## 29. Alinhamento Mobile — Info da Loja

**Usuário:**
> e no mobile essas informações da loja, alinha ali em cima junto com aberto e entrega etc
> ta ruim esse alinhamento ai

**Resposta:**
Redesign do bloco de informações no mobile:
- Badges de status, atendimento e tempo de entrega alinhados em `flex-wrap` abaixo do nome da loja
- Botão "Informações da loja ▾" na mesma linha dos badges
- Gap consistente de `6px` entre elementos
- Remoção de margens e paddings desalinhados

---

## 30. Modal Informações da Loja — Redesign

**Usuário:**
> e melhora quando clica em informação da loja olha isso, e o modal aberto ta descendo a pagina de tras

**Resposta:**
- Modal completamente redesenhado com cartões informativos e badges coloridos
- Ícone gigante corrigido com limites de dimensão no CSS
- `body.v2-modal-open` adicionado para travar scroll da página de fundo
- Animação de entrada scoped com classe `.is-entering`

---

## 31. Limpar Carrinho + Carrossel < > + CEP Automático + Category Jump Fix

**Usuário:**
> o botão de Limpar carrinho ta bem escondido e não funciona, da pra melhorar essa parte?
> Os mais pedidos ta cortando falta um botão pro carrossel ir pros lados < >
> um efeito quando clica em Revisar pedido da pagina subir leve
> Tira esse botão só de colocar o CEP ja puxa sozinho
> La no menu pelo celular, eu vou clicando nas abas e ele vem puxando < < < quando ta no final se eu clicar ele fica pulando kk

**Resposta:**
Múltiplas correções implementadas:
1. **Limpar Carrinho**: Botão mais visível no header da sacola, funcional em desktop e mobile
2. **Carrossel**: Botões `<` e `>` floating nos cantos com auto-hide nas extremidades
3. **CEP**: Removido botão "Buscar/Frete", auto-trigger ao digitar 8 dígitos
4. **Category Jump**: Substituído `scrollIntoView()` por `scrollTo()` com cálculo manual — sem salto vertical

---

## 32. Limpar — Mobile Fix

**Usuário:**
> de limpar funcionou no computador, mas no mobile n

**Resposta:**
Corrigido handler de toque no mobile — `window.confirm()` bloqueava em webviews mobile. Substituído por confirmação inline.

---

## 33. Carrossel — Floating Arrows + Espaço nos Cantos

**Usuário:**
> não gostei disso
> tem como criar um espaço ali e por o botão pra mudar a pagina nos cantos? pra n ficar cortado feio assim? e até os botões < > ta estranho desalinhado ta feio
> tenta usar uma skill impeccable pelo menos pra melhorar esses pontos

**Resposta:**
Redesign completo do carrossel "Mais Pedidos":
- Container `.v2-carousel-outer` com `position: relative` e padding lateral
- Setas flutuantes circulares (40×40px) nos cantos verticais centralizados
- Auto-hide com classe `.is-hidden` baseado em posição de scroll
- Padding interno `10px 20px 16px` com `scroll-padding: 0 20px`
- Cards de `195px` sem corte nas bordas

---

## 34. Confirmação Segura ao Limpar Carrinho

**Usuário:**
> e coloca um aviso quando clicar em Limpar carrinho se caso o cliente clicar sem querer n apagar tudo

**Resposta:**
Implementada barra de confirmação inline (`.v2-cart-confirm-bar`):
- Fundo rosa claro com borda rosada
- Badge com ícone de lixeira
- Texto: "Deseja limpar todos os itens? Os N produtos adicionados serão removidos da sua sacola."
- Botões: `Cancelar` (cinza) e `Sim, esvaziar` (vermelho)
- Substitui `window.confirm()` que falhava em mobile

---

## 35. Fix — Piscada do Modal ao Limpar

**Usuário:**
> e verifica, quando clica em limpar ele da uma piscada no modal meio q fecha e abre outro rapido

**Resposta:**
**Causa raiz identificada:**
1. Ao clicar em "Limpar", o script executava `paint()` que destruía toda a árvore DOM (`app.innerHTML`) e recriava o modal do zero
2. CSS base tinha `transform: translateY(100%)` no `.v2-cart-modal`, fazendo o browser calcular o elemento na posição fechada por uma fração de frame antes de aplicar `translateY(0)`

**Solução aplicada:**
1. **Manipulação 100% in-place** — `toggleConfirmacaoLimpar()` e `executarLimpezaCarrinho()` manipulam o DOM diretamente sem chamar `paint()`:
   - Banner inserido com `cartBody.prepend(barDiv)`
   - Cancelar remove o banner com `.remove()`
   - Confirmar atualiza título, remove botão limpar, troca conteúdo do body para "Sacola vazia", remove footer e esconde floating bar
2. **CSS ajustado** — `transform: none` como estado base (em vez de `translateY(100%)`), animação de entrada apenas com `.is-entering`, `transition: none` no backdrop aberto

**Arquivos modificados:**
- `cardapio-v2.js` (linhas 1365–1490)
- `cardapio-v2.css` (linhas 973–1032 e 1514–1573)

---

## Resumo de Deploys

Todos os deploys foram feitos via Vercel (`npx vercel deploy --prod`), com build Vite e alias para `https://flowpdv.app.br`.

| Recurso | Status |
|---------|--------|
| Skeleton Screen | ✅ Publicado |
| Redesign Impeccable | ✅ Publicado |
| Canais Delivery/Retirada | ✅ Publicado |
| Modal de Produto com Opcionais | ✅ Publicado |
| Sacola Redesenhada | ✅ Publicado |
| Toast Notifications | ✅ Publicado |
| WhatsApp + Lupa | ✅ Publicado |
| Carrossel Mais Pedidos | ✅ Publicado |
| CEP Automático (ViaCEP) | ✅ Publicado |
| Confirmação de Limpar | ✅ Publicado |
| Fix Piscada do Modal | ✅ Publicado |

---

## Arquivos Principais

| Arquivo | Função |
|---------|--------|
| `src/pages/cardapio-v2.js` | Lógica completa do cardápio V2 (1772 linhas) |
| `src/pages/cardapio-v2.css` | Estilos Impeccable do cardápio V2 (2390 linhas) |
| `src/lib/icons.js` | Biblioteca centralizada de ícones SVG |
| `src/pages/painel.js` | Painel de gestão da loja |
| `src/pages/cardapio-design.css` | Estilos do cardápio V1 (legado) |
| `api/criar-pedido.js` | API Vercel para criação de pedidos |
| `shared/ofertas.js` | Cálculo de preços e ofertas |

---

## Decisões Técnicas Importantes

1. **Renderização via `paint()` com `app.innerHTML`**: Padrão de SPA vanilla sem framework. Cada `paint()` destrói e recria o DOM inteiro. Funciona bem para a maioria dos casos, mas causa flicker em modais abertos — resolvido com manipulação in-place para ações dentro de modais.

2. **Animações com classe `.is-entering`**: Animações CSS de entrada (slide-up, scale-up) são aplicadas via classe efêmera `.is-entering` que é removida imediatamente após o primeiro render. Isso previne re-execução da animação em re-renders subsequentes.

3. **ViaCEP auto-trigger**: CEP formata automaticamente como `00000-000` e dispara consulta ao ViaCEP ao atingir 8 dígitos, sem botão. Timeout de 8s com cancelamento de consulta anterior.

4. **Prioridade de categorias**: Lanches e hambúrgueres sempre primeiro nos destaques, bebidas no final. Ordem configurável via função `prioridadeCategoria()`.

5. **Responsividade**: Zoom trick `0.8` para viewports entre 993px e 1400px. Media queries em 680px para transição mobile/desktop. Grid com `minmax(0, 1fr)`.

---

*Documento gerado automaticamente a partir do histórico de conversa no Antigravity IDE em 25/09/2026.*
