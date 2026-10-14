(() => {
  const fetchLocal = window.fetch.bind(window);
  window.fetch = function(input, options) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.hostname === 'geoapi.info') {
      return Promise.resolve(new Response(JSON.stringify({location:{country:'BR'}}), {headers:{'Content-Type':'application/json'}}));
    }
    if (url.origin !== location.origin) {
      return Promise.resolve(new Response(null, {status:204}));
    }
    return fetchLocal(input, options);
  };
  navigator.sendBeacon = () => true;
})();