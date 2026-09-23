export const formatarCep = valor => String(valor || '').replace(/\D/g,'').slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2');

// Só envia o CEP. Número e complemento permanecem sob controle da loja.
export function ligarBuscaCep({input, campos, status, aoPreencher}) {
  let controller, ultimo = '';
  input.value = formatarCep(input.value);
  const pesquisar = async () => {
    input.value = formatarCep(input.value);
    const cep = input.value.replace(/\D/g,'');
    if (cep.length === 8 && cep === ultimo) return;
    controller?.abort();
    input.removeAttribute('aria-busy');
    if (cep.length !== 8) { ultimo = ''; status.textContent = 'Digite os 8 números do CEP para buscar o endereço.'; return; }
    ultimo = cep;
    const request = controller = new AbortController();
    const inicial = Object.fromEntries(Object.entries(campos).map(([k,el])=>[k,el.value]));
    status.textContent = 'Buscando endereço…';
    input.setAttribute('aria-busy','true');
    const timer = setTimeout(()=>request.abort(),8000);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`,{signal:request.signal,referrerPolicy:'no-referrer'});
      if (!response.ok) throw new Error('Consulta indisponível');
      const data = await response.json();
      if (!input.isConnected || controller !== request || input.value.replace(/\D/g,'') !== cep) return;
      if (data.erro) { ultimo=''; status.textContent='CEP não encontrado. Confira o número ou preencha o endereço manualmente.'; return; }
      const endereco = {rua:data.logradouro,bairro:data.bairro,cidade:data.localidade,uf:data.uf};
      for (const [k,valor] of Object.entries(endereco)) {
        if (typeof valor === 'string' && campos[k].value === inicial[k]) campos[k].value = valor;
      }
      status.textContent = data.logradouro ? 'Endereço encontrado. Confira os dados e informe o número.' : 'Cidade encontrada. Complete rua, bairro e número.';
      aoPreencher();
    } catch {
      if (input.isConnected && controller === request) { ultimo=''; status.textContent='Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.'; }
    } finally {
      clearTimeout(timer);
      if (controller === request) input.removeAttribute('aria-busy');
    }
  };
  input.addEventListener('input',pesquisar);
  input.addEventListener('blur',()=>{if(!ultimo) pesquisar();});
  return ()=>{controller?.abort();controller=null;};
}
