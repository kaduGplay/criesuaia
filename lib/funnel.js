// Funnel events sent by the page (navigator.sendBeacon to /api/track). E-mails and names are never stored.
const EVENT = /^[a-z_]{2,40}$/;
const clip = (value, max) => typeof value === 'string' && value ? value.slice(0, max) : null;

export function funnelRow(body, headers = {}) {
 if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
 if (!EVENT.test(body.event ?? '') || typeof body.sid !== 'string' || !body.sid || body.sid.length > 64 || body.wd === true) return null;
 const quiz = body.event === 'question_answered';
 const answer = quiz && body.ans != null ? clip(typeof body.ans === 'string' ? body.ans : JSON.stringify(body.ans), 200) : null;
 const utm = {};
 if (body.utm && typeof body.utm === 'object') for (const [key, value] of Object.entries(body.utm)) if (key.startsWith('utm_') && typeof value === 'string') utm[key] = value.slice(0, 200);
 const meta = body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta) && JSON.stringify(body.meta).length <= 1000 ? body.meta : null;
 const ua = String(headers['user-agent'] || '');
 return {
  sid: body.sid, vid: clip(body.vid, 64), event: body.event,
  qp: Number.isInteger(body.qp) && body.qp >= 0 && body.qp < 100 ? body.qp : null,
  question: quiz ? clip(body.qt, 120) : null, answer, meta, utm: Object.keys(utm).length ? utm : null,
  device: /iphone|ipad/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : /mobile/i.test(ua) ? 'mobile' : 'desktop',
  country: clip(headers['x-vercel-ip-country'], 2),
 };
}

export async function recordFunnelEvent(body, headers) {
 const row = funnelRow(body, headers);
 if (!row) return false;
 const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url?.startsWith('https://') || !key) return false;
 const auth = {'apikey': key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'};
 if (!key.startsWith('sb_secret_')) auth.Authorization = `Bearer ${key}`;
 const response = await fetch(url.replace(/\/$/, '') + '/rest/v1/criesuaia_funnel_events', {method: 'POST', headers: auth, body: JSON.stringify(row), signal: AbortSignal.timeout(5000)});
 return response.ok;
}
