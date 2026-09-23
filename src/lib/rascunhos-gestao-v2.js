const kinds = ['g-edit', 'g-shop', 'g-delivery', 'g-table-form', 'g-addon-form', 'g-contact-form'];
export function protegerRascunhosGestao(root, working = () => false) {
  const dirty = new Set();
  const mark = event => {
    const form = event.target.closest('form');
    const kind = kinds.find(name => form?.classList.contains(name));
    if (kind) dirty.add(kind);
  };
  const structural = event => {
    if (event.target.closest('#g-add-region,.g-remove-region,#g-add-period,.g-period button')) mark(event);
  };
  const pending = () => dirty.size > 0;
  const beforeUnload = event => {
    if (!pending() && !working()) return;
    event.preventDefault(); event.returnValue = '';
  };
  root.addEventListener('input', mark); root.addEventListener('change', mark); root.addEventListener('click', structural);
  window.addEventListener('beforeunload', beforeUnload);
  return {
    pending,
    clear: kind => { if (kind) dirty.delete(kind); else dirty.clear(); },
    dispose() { root.removeEventListener('input', mark); root.removeEventListener('change', mark); root.removeEventListener('click', structural); window.removeEventListener('beforeunload', beforeUnload); }
  };
}
