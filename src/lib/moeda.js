import { brl } from './format.js';

export function centavosDoCampo(valor) {
  if (String(valor).includes('-')) return NaN;
  return Number(String(valor).replace(/\D/g, '') || 0);
}

export function centavosColados(valor) {
  const texto = String(valor).replace(/R\$/gi, '').replace(/\s/g, '');
  if (!/^[\d.,]+$/.test(texto)) return NaN;
  const decimal = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : /^\d+\.\d{1,2}$/.test(texto) ? texto : texto.replace(/\./g, '');
  const reais = Number(decimal);
  return Number.isFinite(reais) ? Math.round(reais * 100) : NaN;
}

export function ligarCampoReais(input) {
  const formatar = centavos => {
    input.setCustomValidity(Number.isFinite(centavos) && centavos >= 0 && centavos <= 1000000 ? '' : 'Informe um valor entre R$ 0,00 e R$ 10.000,00.');
    if (Number.isFinite(centavos)) input.value = brl(centavos / 100);
  };
  input.addEventListener('input', () => formatar(centavosDoCampo(input.value)));
  input.addEventListener('paste', event => {
    event.preventDefault();
    const valor = centavosColados(event.clipboardData.getData('text'));
    formatar(valor);
    if (Number.isFinite(valor)) input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function formatarBRL(centavos) {
  const n = (Number(centavos) || 0) / 100;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function mascaraMoeda(input, onValue) {
  const atualizar = () => {
    let raw = input.value.replace(/\D/g, '');
    let centavos = parseInt(raw, 10) || 0;
    input.value = formatarBRL(centavos);
    input.dataset.centavos = String(centavos);
    onValue?.(centavos);
  };
  input.addEventListener('input', atualizar);
  let initCentavos = parseInt(input.dataset.centavos ?? '', 10);
  if (isNaN(initCentavos)) {
    const rawDigits = input.value.replace(/\D/g, '');
    initCentavos = parseInt(rawDigits, 10) || 0;
  }
  input.dataset.centavos = String(initCentavos);
  input.value = formatarBRL(initCentavos);
}

export function formatarTelefone(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function mascaraTelefone(input, onValue) {
  const atualizar = () => {
    const limpo = input.value.replace(/\D/g, '').slice(0, 11);
    input.value = formatarTelefone(limpo);
    onValue?.(limpo);
  };
  input.addEventListener('input', atualizar);
  input.value = formatarTelefone(input.value);
}

