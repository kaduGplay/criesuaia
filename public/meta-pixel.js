(() => {
  // Each country reports to its own pixel; Argentina has none yet, so its pages start no pixel at all.
  const PIXEL_ID = location.pathname.startsWith('/mexico') ? '1641698144409525' : location.pathname.startsWith('/argentina') ? null : '1422813852615307';
  if (!PIXEL_ID) return;
  if (!window.fbq) {
    const fbq = window.fbq = function() { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    window._fbq = fbq; fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
    const script = document.createElement('script'); script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(script);
  }
  window.fbq('init', PIXEL_ID);
  const fetchPayment = window.fetch.bind(window);
  const purchases = new Set();
  function confirmedPurchase(hash, data) {
    if (data?.status !== 'paid' || !Number.isFinite(data.amount) || data.amount <= 0) return;
    const id = 'purchase_' + hash;
    let seen = purchases.has(id);
    try { seen ||= localStorage.getItem('meta_' + id) === 'sent'; } catch {}
    if (seen) return;
    // A Mexican order always reports MXN; the page decides only if the status ever comes without a currency.
    const params = {value:data.amount/100,currency:data.currency||(location.pathname.startsWith('/mexico')?'MXN':'BRL'),order_id:hash,content_type:'product',content_ids:[data.product||(data.kind==='upsell'?'upsell':'main')],num_items:1};
    window.fbq('track', 'Purchase', params, {eventID:id});
    window.fbq('trackCustom', 'PagamentoConfirmado', params, {eventID:'paid_' + hash});
    purchases.add(id);
    try { localStorage.setItem('meta_' + id, 'sent'); } catch {}
  }
  window.fetch = async function(input, options) {
    const response = await fetchPayment(input, options);
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.origin === location.origin && url.pathname === '/api/checkout' && url.searchParams.get('op') === 'status' && response.ok) {
        response.clone().json().then(data => confirmedPurchase(url.searchParams.get('hash'), data)).catch(() => {});
      }
    } catch {}
    return response;
  };
})();
