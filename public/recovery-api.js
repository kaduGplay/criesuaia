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
  // The realistic catalog has no anime characters; anime ones come from the Piskou set in
  // /anime-results/<origem>_<cor>_<corpo>_<seios>_<bumbum>.webp (images only, no video).
  const anime = {
    origin: {asiatica:'asiatica', latina:'latina', europeia:'europeia', afro:'africana'},
    color: {preto:'preto', castanho:'castanho', loiro:'loira'},
    body: {normal:'curvilinea', fitness:'atletica', magra:'magra', 'plus-size':'voluptuosa'},
    breast: {pequenos:'pequenos', medios:'medios', grandes:'grandes', enormes:'xl'},
    butt: {pequena:'pequeno', media:'medio', grande:'grande', enorme:'grande'},
  };
  function animeCharacter(a) {
    const body = anime.body[a['3']] || 'curvilinea';
    // Slim anime bodies only exist with medium breasts.
    const breast = body === 'magra' ? 'medios' : anime.breast[a['4']] || 'medios';
    return {image: `/anime-results/${anime.origin[a['10']] || 'latina'}_${anime.color[a['8']] || 'castanho'}_${body}_${breast}_${anime.butt[a['5']] || 'medio'}.webp`, video: null};
  }
  async function recoverCharacter(input, options) {
    const body = options?.body ?? (input instanceof Request ? await input.clone().text() : '{}');
    const answers = {...(JSON.parse(body || '{}').answers || {})};
    if (answers['0'] === 'anime') return new Response(JSON.stringify(animeCharacter(answers)), {headers:{'Content-Type':'application/json'}});
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
