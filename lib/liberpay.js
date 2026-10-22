import {createHash,randomUUID} from 'node:crypto';
import {PaymentError,paymentStore,parseCustomer,amountCents,confirmPaid,SITE_HOSTS} from './payments.js';
import catalogMx from './catalog-mx.json' with {type:'json'};
import catalogAr from './catalog-ar.json' with {type:'json'};
export {catalogMx,catalogAr};
const DEPOSIT_URL='https://api.liberpay.pro/payments/deposit',TOKEN_URL='https://api.liberpay.pro/auth/token';
// Mexico (/mexico) charges in MXN by SPEI (bank transfer, seconds) or OXXO (cash, hours); Argentina
// (/argentina) in ARS by bank transfer to a CVU (minutes to hours), from a LiberPay account of its own.
// Each speaks to the buyer in its own Spanish (tú in Mexico, vos in Argentina).
const COUNTRIES={
 mx:{catalog:catalogMx,currency:'MXN',shop:'https://www.clichat.tech/mexico',keys:['LIBERPAY_CLIENT_ID','LIBERPAY_CLIENT_SECRET'],
  // Upsells are one-click, so they always use SPEI (instant); OXXO only on the main purchase.
  method:(kind,body)=>kind==='main'&&body.method==='oxxo'?'oxxo':'spei',
  // 10 digits, with +52 (and the old mobile 1) typed or not.
  phone:t=>{if(t.length>10&&t.startsWith('52'))t=t.slice(2);if(t.length===11&&t.startsWith('1'))t=t.slice(1);return t.length===10?'+52'+t:null},
  text:{name:'Escribe tu nombre.',email:'Escribe un correo válido.',session:'Sesión inválida.',busy:'Tu pago todavía se está generando. Espera unos segundos y toca de nuevo.',slow:'El banco tardó en responder. Toca GENERAR MI PAGO de nuevo.',amount:'No pudimos generar tu pago con este monto. Intenta de nuevo en unos minutos.',failed:'No pudimos generar tu pago ahora. Toca GENERAR MI PAGO de nuevo.'}},
 ar:{catalog:catalogAr,currency:'ARS',shop:'https://www.clichat.tech/argentina',keys:['LIBERPAY_AR_CLIENT_ID','LIBERPAY_AR_CLIENT_SECRET'],
  method:()=>'bank_transfer_ar',
  // 10 digits, with +54, the mobile 9 or a leading 0 typed or not.
  phone:t=>{if(t.length>10&&t.startsWith('54'))t=t.slice(2);if(t.length>10&&t.startsWith('9'))t=t.slice(1);if(t.startsWith('0'))t=t.slice(1);return t.length===10?'+549'+t:null},
  text:{name:'Escribí tu nombre.',email:'Escribí un correo válido.',session:'Sesión inválida.',busy:'Tu pago todavía se está generando. Esperá unos segundos y tocá de nuevo.',slow:'El banco tardó en responder. Tocá GENERAR MI PAGO de nuevo.',amount:'No pudimos generar tu pago con este monto. Intentá de nuevo en unos minutos.',failed:'No pudimos generar tu pago ahora. Tocá GENERAR MI PAGO de nuevo.'}},
};
function buyer(body,text){
 try{return parseCustomer(body)}
 catch(error){if(error instanceof PaymentError)throw new PaymentError({'Informe seu nome.':text.name,'Informe um e-mail válido.':text.email}[error.message]||'Datos inválidos.',error.status,error.field);throw error}
}
// The secret key is not a Bearer token: POST /auth/token exchanges client_id + client_secret for a
// short-lived one, reused until shortly before it expires. LiberPay also only accepts allow-listed IPs.
// LiberPay ties the token to the IP that logged in, and Vercel's static IPs are a pool of six that
// changes per connection. One kept-alive connection per instance makes the login and the deposit leave
// through the same IP. LIBERPAY_PROXY_URL can instead route everything through a single fixed-IP proxy.
const nativeFetch=globalThis.fetch;
let lpAgent=null;
async function lpFetch(url,options){
 if(globalThis.fetch!==nativeFetch)return globalThis.fetch(url,options);
 const undici=await import('undici');
 lpAgent||=process.env.LIBERPAY_PROXY_URL?new undici.ProxyAgent(process.env.LIBERPAY_PROXY_URL):new undici.Agent({connections:1,keepAliveTimeout:30000,keepAliveMaxTimeout:60000});
 return undici.fetch(url,{...options,dispatcher:lpAgent});
}
// A fresh login right before each deposit, on the same connection, instead of a token reused later.
async function liberpayToken([id,secret]){
 let r,d={};
 try{r=await lpFetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({client_id:process.env[id],client_secret:process.env[secret]}),signal:AbortSignal.timeout(10000)});d=await r.json().catch(()=>({}))}
 catch{return {error:'sem resposta'}}
 const value=d.access_token||d.token||d.data?.access_token||d.data?.token;
 if(!r.ok||typeof value!=='string')return {error:`login HTTP ${r.status} ${d.error||d.message||''}`.trim()};
 return value;
}
// Every attempt's answer is kept, since a retry after a failed first attempt is refused as a duplicate.
async function sendDeposit(payload,keys){
 const tries=[];
 for(let attempt=1;attempt<=3;attempt++){
  const token=await liberpayToken(keys);
  if(typeof token!=='string')return {status:403,detail:token.error,tries};
  let r;
  try{r=await lpFetch(DEPOSIT_URL,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)})}
  catch{tries.push('sem resposta');continue}
  if(r.ok)return {result:await r.json().catch(()=>null),tries};
  const detail=(await r.text().catch(()=>'')).slice(0,200);
  tries.push(`${r.status} ${detail}`.trim());
  if(r.status===401||r.status>=500||r.status===408||r.status===429)continue;
  return {status:r.status,detail,tries};
 }
 return {retryable:true,tries};
}
function depositError(outcome,text){
 if(outcome.retryable)return new PaymentError(text.slow,503);
 // 422 is either the amount outside the acquirer's limits or the method not enabled in the LiberPay portal.
 if(outcome.status===422&&!/gateway|adquirente/i.test(outcome.detail||''))return new PaymentError(text.amount,502);
 return new PaymentError(text.failed,502);
}
export const createMxPayment=(body,kind)=>createLiberpayPayment('mx',body,kind);
export const createArPayment=(body,kind)=>createLiberpayPayment('ar',body,kind);
async function createLiberpayPayment(site,body,kind='main'){
 const {catalog,currency,shop,keys,text}=COUNTRIES[site];
 const client=buyer(body,text);
 if(typeof body.sid!=='string'||!body.sid||body.sid.length>200)throw new PaymentError(text.session);
 const bumps=kind==='main'?(body.bumps??[]):[];
 if(!Array.isArray(bumps)||bumps.some(x=>typeof x!=='string'||!Object.hasOwn(catalog.bumps,x))||new Set(bumps).size!==bumps.length)throw new PaymentError('Oferta inválida.');
 const upsell=kind==='upsell'?(body.upsell??'vip'):null;
 if(upsell!==null&&(typeof upsell!=='string'||!Object.hasOwn(catalog.upsells,upsell)))throw new PaymentError('Oferta inválida.');
 const method=COUNTRIES[site].method(kind,body);
 const items=kind==='main'?[['main',catalog.main],...bumps.slice().sort().map(k=>[k,catalog.bumps[k]])]:[[upsell,catalog.upsells[upsell]]];
 const amount=items.reduce((a,[,p])=>a+p.price,0);
 if(!process.env[keys[0]]||!process.env[keys[1]])throw new PaymentError(`Configura ${keys.join(' y ')} en Vercel.`,503);
 const email=client.email||process.env.LIBERPAY_FALLBACK_EMAIL||process.env.VOIDPAY_FALLBACK_EMAIL;
 if(!email)throw new PaymentError('Configura LIBERPAY_FALLBACK_EMAIL en Vercel.',503);
 const fingerprint=createHash('sha256').update(JSON.stringify([site,body.sid,kind,method,bumps.slice().sort(),client,...(upsell?[upsell]:[])])).digest('hex');
 const lock='pix:request:'+fingerprint,hash=randomUUID().replaceAll('-','');
 const acquired=await paymentStore('CLAIM',[lock],[hash]);
 if(!acquired){const old=await paymentStore('GET',[lock]),raw=await paymentStore('GET',['pix:order:'+old]);if(raw){const order=JSON.parse(raw);if(order.response)return order.response}throw new PaymentError(text.busy,409)}
 const orderKey='pix:order:'+hash;
 await paymentStore('SET',[orderKey],[JSON.stringify({hash,amount,currency,status:'creating'})]);
 const name=client.name.length<3?client.name+' Cliente':client.name;
 const payload={amount:amount/100,external_id:hash,payment_method:method,currency,payer:{name,email},
  metadata:{provider:'Crie sua IA',user_email:email,order_id:hash,checkout_url:shop,shop_url:shop}};
 const outcome=await sendDeposit(payload,keys),q=outcome.result?.qrCodeResponse;
 if(!q||typeof q.transactionId!=='string'||!q.qrcode){
  // A payment reference that was never shown cannot be paid, so the buyer may safely try again.
  await paymentStore('REJECT',[lock,orderKey],[hash,JSON.stringify({hash,amount,currency,status:'rejected',reason:[outcome.retryable?'sem resposta da LiberPay':outcome.result?'resposta sem dados de pagamento: '+JSON.stringify(outcome.result).slice(0,200):`HTTP ${outcome.status} ${outcome.detail||''}`.trim(),...(outcome.tries||[]).map(t=>'tentativa: '+t)]})]);
  console.warn('liberpay não gerou o depósito',{site,status:outcome.status,retryable:!!outcome.retryable});
  throw depositError(outcome,text);
 }
 // pixCode carries the CLABE (SPEI), the OXXO reference or the CVU: shown as text, never as a QR code.
 const response={hash,amount,currency,method,pixCode:String(q.qrcode),barcodeUrl:method==='oxxo'&&typeof q.barcodeUrl==='string'?q.barcodeUrl:null,expiresAt:null,status:'pending'};
 const meta={},tracking=body.cliutm;
 if(tracking&&typeof tracking==='object'){
  for(const [from,to]of [['fbp','fbp'],['fbc','fbc'],['clientUserAgent','client_user_agent']])if(typeof tracking[from]==='string')meta[to]=tracking[from].slice(0,500);
  try{const source=new URL(tracking.sourceUrl);if(SITE_HOSTS.has(source.hostname))meta.source_url=source.origin+source.pathname}catch{}
 }
 // LiberPay's own payment instructions and field names are kept with the order to support buyers.
 const instruction=typeof q.instructionText==='string'?q.instructionText.slice(0,500):null;
 // The buyer's e-mail and WhatsApp (asked by the WhatsApp upsell) stay with the order, never in the funnel log:
 // they deliver the access and the messages, and reach payments generated and not made.
 const order={hash,amount,currency,method,gateway:'liberpay',status:'pending',meta,transactionId:q.transactionId,kind,product:upsell||'main',response,instruction,liberpayFields:Object.keys(q).slice(0,20),email:client.email||null,phone:client.phone?COUNTRIES[site].phone(client.phone.replace(/\D/g,'')):null};
 await paymentStore('SAVE',[orderKey,'pix:transaction:'+q.transactionId],[JSON.stringify(order),hash]);
 return response;
}
// payment.paid names a LiberPay transaction id that only this server knows (it is never sent to the
// browser); the amount must match the order before it is marked paid.
export async function liberpayWebhook(body){
 // The last call received (event name, field names, status and time only) shows the webhook is registered
 // at LiberPay before the first sale, from payment.created or the portal's test send, whatever its shape.
 const fields=body&&typeof body==='object'?Object.keys(body).slice(0,10):[];
 await paymentStore('SET',['liberpay:webhook:last'],[JSON.stringify({event:typeof body?.event==='string'?body.event.slice(0,40):null,fields,status:typeof body?.data?.status==='string'?body.data.status.slice(0,20):null,at:new Date().toISOString()})]).catch(()=>{});
 if(body?.event!=='payment.paid')return {ok:true,ignored:typeof body?.event==='string'?body.event:null};
 const id=body?.data?.transaction_id;
 if(typeof id!=='string'||!id)throw new PaymentError('Evento inválido.');
 const hash=await paymentStore('GET',['pix:transaction:'+id]);if(!hash)throw new PaymentError('Transação desconhecida.',404);
 const raw=await paymentStore('GET',['pix:order:'+hash]);if(!raw)throw new PaymentError('Pedido desconhecido.',404);
 const order=JSON.parse(raw);
 if(order.gateway!=='liberpay'||body.data.status!=='paid'||amountCents(body.data.amount)!==order.amount)throw new PaymentError('Transação divergente.');
 return confirmPaid(order,hash,body.timestamp,{});
}
