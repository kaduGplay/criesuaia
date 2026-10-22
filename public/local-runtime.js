(() => {
  const fetchLocal = window.fetch.bind(window);
  window.fetch = function(input, options) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.hostname === 'geoapi.info') {
      const country = location.pathname.startsWith('/mexico') ? 'MX' : location.pathname.startsWith('/argentina') ? 'AR' : 'BR';
      return Promise.resolve(new Response(JSON.stringify({location:{country}}), {headers:{'Content-Type':'application/json'}}));
    }
    if (url.origin !== location.origin && !/(^|\.)facebook\.(com|net)$/.test(url.hostname)) {
      return Promise.resolve(new Response(null, {status:204}));
    }
    return fetchLocal(input, options);
  };
  const sendBeacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = (url, data) => {
    try {
      const target = new URL(url, location.href);
      // Meta, this site's own funnel tracking and Vercel Web Analytics may send beacons; other trackers stay blocked.
      if (/(^|\.)facebook\.(com|net)$/.test(target.hostname) || (target.origin === location.origin && (target.pathname === '/api/track' || target.pathname.startsWith('/_vercel/insights/')))) return sendBeacon(url, data);
    } catch {}
    return true;
  };
})();
