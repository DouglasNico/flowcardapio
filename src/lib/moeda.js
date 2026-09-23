import {brl} from './format.js';

export function centavosDoCampo(valor) {
  if (String(valor).includes('-')) return NaN;
  return Number(String(valor).replace(/\D/g,'') || 0);
}

export function centavosColados(valor) {
  const texto = String(valor).replace(/R\$/gi,'').replace(/\s/g,'');
  if (!/^[\d.,]+$/.test(texto)) return NaN;
  const decimal = texto.includes(',') ? texto.replace(/\./g,'').replace(',','.') : /^\d+\.\d{1,2}$/.test(texto) ? texto : texto.replace(/\./g,'');
  const reais = Number(decimal);
  return Number.isFinite(reais) ? Math.round(reais * 100) : NaN;
}

export function ligarCampoReais(input) {
  const formatar = centavos => {
    input.setCustomValidity(Number.isFinite(centavos) && centavos >= 0 && centavos <= 1000000 ? '' : 'Informe um valor entre R$ 0,00 e R$ 10.000,00.');
    if (Number.isFinite(centavos)) input.value = brl(centavos / 100);
  };
  input.addEventListener('input',()=>formatar(centavosDoCampo(input.value)));
  input.addEventListener('paste',event=>{
    event.preventDefault();
    const valor = centavosColados(event.clipboardData.getData('text'));
    formatar(valor);
    if (Number.isFinite(valor)) input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
