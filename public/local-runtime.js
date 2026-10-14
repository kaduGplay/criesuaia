(() => {
  const fetchLocal = window.fetch.bind(window);
  window.fetch = function(input, options) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.hostname === 'geoapi.info') {
      return Promise.resolve(new Response(JSON.stringify({location:{country:'BR'}}), {headers:{'Content-Type':'application/json'}}));
    }
    if (url.origin !== location.origin && !/(^|\.)facebook\.(com|net)$/.test(url.hostname)) {
      return Promise.resolve(new Response(null, {status:204}));
    }
    return fetchLocal(input, options);
  };
  const sendBeacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = (url, data) => {
    try { if (/(^|\.)facebook\.(com|net)$/.test(new URL(url,location.href).hostname)) return sendBeacon(url,data); } catch {}
    return true;
  };
})();