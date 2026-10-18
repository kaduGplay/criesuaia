import {createHash,randomUUID} from 'node:crypto';
import {PaymentError,paymentStore,parseCustomer,amountCents,confirmPaid} from './payments.js';
import catalogMx from './catalog-mx.json' with {type:'json'};
export {catalogMx};
// Mexico (/mexico): charges in MXN through LiberPay, by SPEI (bank transfer, seconds) or OXXO (cash, hours).
const DEPOSIT_URL='https://api.liberpay.pro/payments/deposit',TOKEN_URL='https://api.liberpay.pro/auth/token';
const SHOP_URL='https://criesuaia.vercel.app/mexico';
const buyerMessages={'Informe seu nome.':'Escribe tu nombre.','Informe um e-mail válido.':'Escribe un correo válido.'};
function mxCustomer(body){
 try{return parseCustomer(body)}
 catch(error){if(error instanceof PaymentError)throw new PaymentError(buyerMessages[error.message]||'Datos inválidos.',error.status,error.field);throw error}
}
// The secret key is not a Bearer token: POST /auth/token exchanges client_id + client_secret for a
// short-lived one, reused until shortly before it expires. LiberPay also only accepts allow-listed IPs.
// Vercel's outgoing IPs change, so LIBERPAY_PROXY_URL can route LiberPay calls through a proxy with a
// fixed IP (the one to allow-list in the LiberPay portal).
async function lpFetch(url,options){
 const proxy=process.env.LIBERPAY_PROXY_URL;
 if(!proxy)return fetch(url,options);
 const {fetch:proxied,ProxyAgent}=await import('undici');
 return proxied(url,{...options,dispatcher:new ProxyAgent(proxy)});
}
let cachedToken=null;
async function liberpayToken(force=false){
 if(!force&&cachedToken&&cachedToken.expires>Date.now()+60000)return cachedToken.value;
 let r,d={};
 try{r=await lpFetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({client_id:process.env.LIBERPAY_CLIENT_ID,client_secret:process.env.LIBERPAY_CLIENT_SECRET}),signal:AbortSignal.timeout(10000)});d=await r.json().catch(()=>({}))}
 catch{return {error:'sem resposta'}}
 const value=d.access_token||d.token||d.data?.access_token||d.data?.token;
 if(!r.ok||typeof value!=='string')return {error:`login HTTP ${r.status} ${d.error||d.message||''}`.trim()};
 cachedToken={value,expires:Date.now()+(Number(d.expires_in||d.data?.expires_in)||3000)*1000};
 return value;
}
async function sendDeposit(payload){
 for(let attempt=1;attempt<=3;attempt++){
  const token=await liberpayToken(attempt>1&&cachedToken===null);
  if(typeof token!=='string')return {status:403,detail:token.error};
  let r;
  try{r=await lpFetch(DEPOSIT_URL,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)})}
  catch{continue}
  if(r.status===401){cachedToken=null;continue}
  if(r.ok)return {result:await r.json().catch(()=>null)};
  if(r.status>=500||r.status===408||r.status===429)continue;
  return {status:r.status,detail:(await r.text().catch(()=>'')).slice(0,300)};
 }
 return {retryable:true};
}
function depositError(outcome){
 if(outcome.retryable)return new PaymentError('El banco tardó en responder. Toca GENERAR MI PAGO de nuevo.',503);
 if(outcome.status===422)return new PaymentError('No pudimos generar tu pago con este monto. Intenta de nuevo en unos minutos.',502);
 return new PaymentError('No pudimos generar tu pago ahora. Toca GENERAR MI PAGO de nuevo.',502);
}
export async function createMxPayment(body,kind='main'){
 const client=mxCustomer(body);
 if(typeof body.sid!=='string'||!body.sid||body.sid.length>200)throw new PaymentError('Sesión inválida.');
 const bumps=kind==='main'?(body.bumps??[]):[];
 if(!Array.isArray(bumps)||bumps.some(x=>typeof x!=='string'||!Object.hasOwn(catalogMx.bumps,x))||new Set(bumps).size!==bumps.length)throw new PaymentError('Oferta inválida.');
 const upsell=kind==='upsell'?(body.upsell??'vip'):null;
 if(upsell!==null&&(typeof upsell!=='string'||!Object.hasOwn(catalogMx.upsells,upsell)))throw new PaymentError('Oferta inválida.');
 // Upsells are one-click, so they always use SPEI (instant); OXXO only on the main purchase.
 const method=kind==='main'&&body.method==='oxxo'?'oxxo':'spei';
 const items=kind==='main'?[['main',catalogMx.main],...bumps.slice().sort().map(k=>[k,catalogMx.bumps[k]])]:[[upsell,catalogMx.upsells[upsell]]];
 const amount=items.reduce((a,[,p])=>a+p.price,0);
 if(!process.env.LIBERPAY_CLIENT_ID||!process.env.LIBERPAY_CLIENT_SECRET)throw new PaymentError('Configura LIBERPAY_CLIENT_ID y LIBERPAY_CLIENT_SECRET en Vercel.',503);
 const email=client.email||process.env.LIBERPAY_FALLBACK_EMAIL||process.env.VOIDPAY_FALLBACK_EMAIL;
 if(!email)throw new PaymentError('Configura LIBERPAY_FALLBACK_EMAIL en Vercel.',503);
 const fingerprint=createHash('sha256').update(JSON.stringify(['mx',body.sid,kind,method,bumps.slice().sort(),client,...(upsell?[upsell]:[])])).digest('hex');
 const lock='pix:request:'+fingerprint,hash=randomUUID().replaceAll('-','');
 const acquired=await paymentStore('CLAIM',[lock],[hash]);
 if(!acquired){const old=await paymentStore('GET',[lock]),raw=await paymentStore('GET',['pix:order:'+old]);if(raw){const order=JSON.parse(raw);if(order.response)return order.response}throw new PaymentError('Tu pago todavía se está generando. Espera unos segundos y toca de nuevo.',409)}
 const orderKey='pix:order:'+hash;
 await paymentStore('SET',[orderKey],[JSON.stringify({hash,amount,currency:'MXN',status:'creating'})]);
 const name=client.name.length<3?client.name+' Cliente':client.name;
 const payload={amount:amount/100,external_id:hash,payment_method:method,currency:'MXN',payer:{name,email},
  metadata:{provider:'Crie sua IA',user_email:email,order_id:hash,checkout_url:SHOP_URL,shop_url:SHOP_URL}};
 const outcome=await sendDeposit(payload),q=outcome.result?.qrCodeResponse;
 if(!q||typeof q.transactionId!=='string'||!q.qrcode){
  // A payment reference that was never shown cannot be paid, so the buyer may safely try again.
  await paymentStore('REJECT',[lock,orderKey],[hash,JSON.stringify({hash,amount,currency:'MXN',status:'rejected',reason:[outcome.retryable?'sem resposta da LiberPay':`HTTP ${outcome.status} ${outcome.detail||''}`.trim()]})]);
  console.warn('liberpay não gerou o depósito',{status:outcome.status,retryable:!!outcome.retryable});
  throw depositError(outcome);
 }
 // pixCode carries the CLABE (SPEI) or the OXXO reference: the checkout shows it as text, never as a QR code.
 const response={hash,amount,currency:'MXN',method,pixCode:String(q.qrcode),barcodeUrl:method==='oxxo'&&typeof q.barcodeUrl==='string'?q.barcodeUrl:null,expiresAt:null,status:'pending'};
 const meta={},tracking=body.cliutm;
 if(tracking&&typeof tracking==='object'){
  for(const [from,to]of [['fbp','fbp'],['fbc','fbc'],['clientUserAgent','client_user_agent']])if(typeof tracking[from]==='string')meta[to]=tracking[from].slice(0,500);
  try{const source=new URL(tracking.sourceUrl);if(source.hostname==='criesuaia.vercel.app')meta.source_url=source.origin+source.pathname}catch{}
 }
 const order={hash,amount,currency:'MXN',method,gateway:'liberpay',status:'pending',meta,transactionId:q.transactionId,kind,product:upsell||'main',response};
 await paymentStore('SAVE',[orderKey,'pix:transaction:'+q.transactionId],[JSON.stringify(order),hash]);
 return response;
}
// payment.paid names a LiberPay transaction id that only this server knows (it is never sent to the
// browser); the amount must match the order before it is marked paid.
export async function liberpayWebhook(body){
 if(body?.event!=='payment.paid')return {ok:true,ignored:typeof body?.event==='string'?body.event:null};
 const id=body?.data?.transaction_id;
 if(typeof id!=='string'||!id)throw new PaymentError('Evento inválido.');
 const hash=await paymentStore('GET',['pix:transaction:'+id]);if(!hash)throw new PaymentError('Transação desconhecida.',404);
 const raw=await paymentStore('GET',['pix:order:'+hash]);if(!raw)throw new PaymentError('Pedido desconhecido.',404);
 const order=JSON.parse(raw);
 if(order.gateway!=='liberpay'||body.data.status!=='paid'||amountCents(body.data.amount)!==order.amount)throw new PaymentError('Transação divergente.');
 return confirmPaid(order,hash,body.timestamp,{});
}
