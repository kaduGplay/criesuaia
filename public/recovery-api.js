(() => {
  const originalFetch = window.fetch.bind(window);
  let characterCatalog;
  const choices = {
    '10':['asiatica','latina','europeia','afro'],
    '3':['normal','fitness','magra','plus-size'],
    '7':['liso','trancas','franja','cacheado','coque','curto','longo','rabo-cavalo','maria-chiquinha'],
    '8':['preto','castanho','loiro','cinza','ruivo','azul','roxo','verde','rosa']
  };
  const defaults = {'10':'latina','3':'normal','7':'longo','8':'castanho'};
  // Body types of the "Defina a silhueta" step mapped to the closest catalog body.
  const bodyAliases = {curvilinea:'normal', atletica:'fitness', musculosa:'fitness', voluptuosa:'plus-size', magra:'magra'};
  async function recoverCharacter(input, options) {
    const body = options?.body ?? (input instanceof Request ? await input.clone().text() : '{}');
    const answers = {...(JSON.parse(body || '{}').answers || {})};
    answers['3'] = bodyAliases[answers['3']] ?? answers['3'];
    characterCatalog ||= originalFetch('/api/personagens.json').then(r => {
      if (!r.ok) throw new Error('Character catalog unavailable');
      return r.json();
    }).catch(error => { characterCatalog = null; throw error; });
    const catalog = await characterCatalog;
    const key = ['10','3','7','8'].map(id => choices[id].includes(answers[id]) ? answers[id] : defaults[id]).join('|');
    const result = catalog[key];
    if (!result?.image) throw new Error('Character unavailable');
    return new Response(JSON.stringify(result), {headers:{'Content-Type':'application/json'}});
  }
  window.fetch = function(input, options) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/personagem') return recoverCharacter(input, options);
      if (url.pathname === '/api/checkout' || url.pathname === '/api/track') return originalFetch(input, options);
      if (url.pathname === '/api/checkout' && url.searchParams.get('op') === 'products') {
        return originalFetch('/api/catalogo.json', {cache:'no-store'});
      }
      return Promise.resolve(new Response(JSON.stringify({
        erro:'Serviço ainda não reconectado nesta cópia recuperada. É necessário configurar um novo provedor.',
        code:'RECOVERY_BACKEND_NOT_CONFIGURED'
      }), {status:503, headers:{'Content-Type':'application/json'}}));
    }
    return originalFetch(input, options);
  };
})();
