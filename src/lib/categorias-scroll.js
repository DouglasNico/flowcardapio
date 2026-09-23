/** Mantém a categoria sincronizada com a leitura, sem deslocar a página ao atualizar a aba. */
export function acompanharCategorias(root, { aoAtivar, movimentoReduzido = () => false } = {}) {
  const nav = root.querySelector('.cats');
  const header = root.querySelector('.store-head');
  if (!nav || !header) return () => {};
  const itens = [...nav.querySelectorAll('[data-cat]')].map(botao => ({
    botao, secao: root.querySelector(`[id="${CSS.escape(botao.dataset.cat)}"]`)
  })).filter(item => item.secao);
  if (!itens.length) return () => {};
  let frame = 0, encerrado = false;
  function ativar(item) {
    const mudou = !item.botao.classList.contains('on');
    itens.forEach(({botao}) => {
      const ativo = botao === item.botao;
      botao.classList.toggle('on', ativo);
      if (ativo) botao.setAttribute('aria-current', 'location');
      else botao.removeAttribute('aria-current');
    });
    aoAtivar?.(item.botao.dataset.cat);
    if (mudou) {
      const b = item.botao.getBoundingClientRect(), n = nav.getBoundingClientRect();
      if (b.left < n.left || b.right > n.right) nav.scrollTo({
        left: nav.scrollLeft + b.left - n.left - (nav.clientWidth - b.width) / 2,
        behavior: movimentoReduzido() ? 'auto' : 'smooth'
      });
    }
  }
  function atualizar() {
    frame = 0;
    if (encerrado || !nav.isConnected || root.querySelector('.sheet') || document.querySelector('#prod-overlay')) return;
    const limite = header.getBoundingClientRect().bottom + 24;
    let atual = itens[0];
    for (const item of itens) if (item.secao.getBoundingClientRect().top <= limite) atual = item;
    const pagina = document.scrollingElement;
    if (pagina && window.scrollY > 1 && pagina.scrollHeight > window.innerHeight + 2 && window.scrollY + window.innerHeight >= pagina.scrollHeight - 2) atual = itens.at(-1);
    ativar(atual);
  }
  function agendar() { if (!encerrado && !frame) frame = requestAnimationFrame(atualizar); }
  function clicar(event) {
    const botao = event.target.closest('[data-cat]');
    const item = itens.find(i => i.botao === botao);
    if (!item) return;
    ativar(item);
    window.scrollTo({top:Math.max(0,window.scrollY + item.secao.getBoundingClientRect().top - header.offsetHeight - 12),behavior:movimentoReduzido() ? 'auto' : 'smooth'});
    agendar();
  }
  nav.addEventListener('click', clicar);
  window.addEventListener('scroll', agendar, {passive:true});
  window.addEventListener('resize', agendar);
  const observer = new ResizeObserver(agendar);
  observer.observe(header); itens.forEach(i => observer.observe(i.secao));
  agendar();
  return () => {
    encerrado = true; cancelAnimationFrame(frame); observer.disconnect();
    nav.removeEventListener('click', clicar);
    window.removeEventListener('scroll', agendar); window.removeEventListener('resize', agendar);
  };
}
