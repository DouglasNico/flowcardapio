# Login do painel — 23/09/2026

src/pages/login.js e login.css: entrada do lojista em duas áreas inspirada na referência do Master, com marca e apresentação à esquerda, formulário claro à direita. Em celular a marca ocupa faixa compacta acima do formulário. Preservados licença, senha, manter conectado, tratamento de erros e rota /painel. Laranja da ação #ff8120 com texto escuro; estilos limitados à página de login. Toggle da senha atualiza nome acessível.

Validação: build Vite concluído (aviso de bundle acima de 500KB permanece); Chrome local em 1440×900 e 390×844, capturas inspecionadas, botão mostrar senha conferido e cor computada rgb(255,129,32). Sem login real, alteração de autenticação, DNS ou deploy. Preview local na porta 53811. O domínio informado pelo usuário não foi alterado.

Refinamento: título e descrição centralizados sob o logo; lista centralizada como bloco, mantendo itens alinhados entre si (login.css). Prévia Vite atualiza automaticamente.

Publicação autorizada: commit a6e25ec enviado à main, somente login.js, login.css e este registro. Build em worktree isolada aprovado; alterações locais de combos/API/V2 não incluídas. HTTPS flowpdv.app.br respondeu 200 e entregou o novo bundle; login renderizado conferido em Chrome sem autenticação.


Ajuste local de cor solicitado em 23/09: src/pages/login.css troca o fundo verde por azul acinzentado #2c4057 e harmoniza os textos claros (#f8fafc/#d4dfec). Layout e logo preservados. Build aprovado; Chrome em 1440x900 e 390x844 sem overflow, capturas login-azul-desktop/mobile em output/migracao-v2-20260923. Ainda não publicado este ajuste de cor.

Ajuste posterior solicitado: substituído o azul acinzentado pelo fundo exato da entrada do PDV (.login-screen-brand em style.css), compartilhado com a nova entrada do Cliente Mobile. Build local aprovado; publicação pendente.

Publicação concluída: commit 20556eb enviado à main; somente login.css e este registro. Build da revisão isolada aprovado. HTTPS flowpdv.app.br respondeu 200 e Chrome confirmou o fundo azul do PDV. Alterações pendentes de combos/API/V2 não publicadas.
