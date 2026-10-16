import {purchaseEvent,deliverPurchase} from './meta.js';
import {createHash,randomUUID} from 'node:crypto';
import catalog from './catalog.json' with {type:'json'};
export class PaymentError extends Error {constructor(message,status=400,field=null){super(message);this.status=status;this.field=field}}
export async function paymentStore(operation,keys,values=[]){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url?.startsWith('https://')||!key)throw new PaymentError('Configure o Supabase no servidor da Vercel.',503);
 const headers={'apikey':key,'Content-Type':'application/json'};
 if(!key.startsWith('sb_secret_'))headers.Authorization=`Bearer ${key}`;
 const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/criesuaia_payment_command',{method:'POST',headers,body:JSON.stringify({p_operation:operation,p_keys:keys,p_values:values}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new PaymentError('Armazenamento dos pedidos indisponível.',503);
 return response.json();
}
export {catalog};
export function parseCustomer(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new PaymentError('Dados inválidos.');
 const client={};
 for(const key of ['name','email','phone','document']){
  const value=body[key]??'';if(typeof value!=='string'||value.length>250)throw new PaymentError('Dados inválidos.');
  if(value.trim())client[key]=value.trim();
 }
 if(!client.name||client.name.length<2)throw new PaymentError('Informe seu nome.',400,'name');
 if(!client.email)throw new PaymentError('Informe seu e-mail para gerar o PIX.',400,'email');
 if(!/^\S+@\S+\.\S+$/.test(client.email))throw new PaymentError('Informe um e-mail válido.',400,'email');
 return client;
}
const digits=value=>typeof value==='string'?value.replace(/\D/g,''):'';
function validCpf(cpf){if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return false;for(const size of [9,10]){let sum=0;for(let i=0;i<size;i++)sum+=Number(cpf[i])*(size+1-i);if(sum*10%11%10!==Number(cpf[size]))return false}return true}
// VoidPay requires email, phone and document. Data the lead skips falls back to the owner's, kept only in Vercel env (the repo is public).
export function gatewayClient(client,env=process.env){
 // Autofill adds +55 (or a leading 0); VoidPay only takes DDD + number.
 const result={...client},phone=digits(client.phone).replace(/^(?:55|0)(?=\d{10,11}$)/,''),document=digits(client.document);
 // VoidPay refuses names under 3 characters; the checkout name is often a nickname such as "Zé".
 if(typeof client.name==='string'&&client.name.length<3)result.name=client.name+' Cliente';
 result.email=client.email||env.VOIDPAY_FALLBACK_EMAIL?.trim();
 result.phone=phone.length>=10&&phone.length<=11?phone:digits(env.VOIDPAY_FALLBACK_PHONE);
 result.document=validCpf(document)||document.length===14?document:digits(env.VOIDPAY_FALLBACK_DOCUMENT);
 if(!result.email||!result.phone||!result.document)throw new PaymentError('Configure VOIDPAY_FALLBACK_EMAIL, VOIDPAY_FALLBACK_PHONE e VOIDPAY_FALLBACK_DOCUMENT na Vercel.',503);
 return result;
}
// The owner's fallback data must not be matched to a lead's purchase in Meta.
function leadData(client,env=process.env){
 const result={...client},email=env.VOIDPAY_FALLBACK_EMAIL?.trim().toLowerCase(),phone=digits(env.VOIDPAY_FALLBACK_PHONE);
 if(email&&typeof result.email==='string'&&result.email.trim().toLowerCase()===email)delete result.email;
 if(phone&&digits(result.phone).endsWith(phone))delete result.phone;
 return result;
}
export function amountCents(value){const n=Number(value);if(typeof value==='boolean'||!Number.isFinite(n)||n<=0||Math.abs(n*100-Math.round(n*100))>0.000001)throw new PaymentError('Valor inválido.');return Math.round(n*100)}
const VOIDPAY_RECEIVE='https://dash.voidpayments.com/api/v1/gateway/pix/receive';
const voidpayIssues=data=>(Array.isArray(data?.details)?data.details:[]).flatMap(d=>d?.unionErrors?d.unionErrors.flatMap(u=>u.issues??[]):[d]).map(i=>({path:[].concat(i?.path??[]).join('.'),message:String(i?.message??i?.error?.message??'')}));
// VoidPay sometimes hangs for ~60 s before a 504 while a normal answer takes 1–3 s: give up on a stuck
// attempt and ask again; the buyer only ever sees the code of the attempt that answered.
async function sendPix(payload,client){
 for(let attempt=1;attempt<=4;attempt++){
  let r;
  try{r=await fetch(VOIDPAY_RECEIVE,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','User-Agent':'CrieSuaIA-Checkout/1.0','x-public-key':process.env.VOIDPAY_PUBLIC_KEY,'x-secret-key':process.env.VOIDPAY_SECRET_KEY},body:JSON.stringify({...payload,client}),signal:AbortSignal.timeout(8000)})}
  catch{continue}
  if(r.ok)return {result:await r.json().catch(()=>null)};
  if(r.status>=500||r.status===408||r.status===429)continue;
  return {status:r.status,issues:voidpayIssues(await r.json().catch(()=>null))};
 }
 return {retryable:true};
}
function buyerError(outcome){
 const field=outcome.issues?.find(i=>i.path==='client.name'||i.path==='client.email')?.path;
 if(field==='client.name')return new PaymentError('Confira seu nome e tente de novo.',400,'name');
 if(field==='client.email')return new PaymentError('Confira seu e-mail e tente de novo.',400,'email');
 if(outcome.retryable)return new PaymentError('O banco demorou para responder. Toque em GERAR MEU PIX de novo.',503);
 return new PaymentError('Não conseguimos gerar o PIX agora. Toque em GERAR MEU PIX de novo.',502);
}
export async function createPayment(body,kind='main'){
 const client=parseCustomer(body);
 if(typeof body.sid!=='string'||!body.sid||body.sid.length>200)throw new PaymentError('Sessão inválida.');
 const bumps=kind==='main'?(body.bumps??[]):[];
 if(!Array.isArray(bumps)||bumps.some(x=>typeof x!=='string'||!Object.hasOwn(catalog.bumps,x))||new Set(bumps).size!==bumps.length)throw new PaymentError('Oferta inválida.');
 // Each one-click offer after the payment is its own product and its own charge.
 const upsell=kind==='upsell'?(body.upsell??'vip'):null;
 if(upsell!==null&&(typeof upsell!=='string'||!Object.hasOwn(catalog.upsells,upsell)))throw new PaymentError('Oferta inválida.');
 const items=kind==='main'?[['main',catalog.main],...bumps.slice().sort().map(k=>[k,catalog.bumps[k]])]:[[upsell,catalog.upsells[upsell]]];
 const amount=items.reduce((a,[,p])=>a+p.price,0);
 if(!process.env.VOIDPAY_PUBLIC_KEY||!process.env.VOIDPAY_SECRET_KEY)throw new PaymentError('Configure as chaves VoidPay na Vercel.',503);
 const callback=process.env.VOIDPAY_CALLBACK_URL;
 if(!callback?.startsWith('https://'))throw new PaymentError('Configure a URL HTTPS do webhook na Vercel.',503);
 const customer=gatewayClient(client);
 const fingerprint=createHash('sha256').update(JSON.stringify([body.sid,kind,bumps.slice().sort(),client,...(upsell?[upsell]:[])])).digest('hex');
 const lock='pix:request:'+fingerprint,hash=randomUUID().replaceAll('-','');
 // No expiring lock: an unknown gateway outcome must never trigger a duplicate charge.
 const acquired=await paymentStore('CLAIM',[lock],[hash]);
 if(!acquired){const old=await paymentStore('GET',[lock]),raw=await paymentStore('GET',['pix:order:'+old]);if(raw){const order=JSON.parse(raw);if(order.response)return order.response}throw new PaymentError('Seu PIX ainda está sendo gerado. Aguarde alguns segundos e toque de novo.',409)}
 const orderKey='pix:order:'+hash;
 await paymentStore('SET',[orderKey],[JSON.stringify({hash,amount,status:'creating'})]);
 const payload={identifier:hash,amount:amount/100,client:customer,callbackUrl:callback,
  products:items.map(([id,p])=>({id,name:p.title,quantity:1,price:p.price/100,physical:false})),metadata:{provider:'Crie sua IA',orderId:hash}};
 if(body.utm&&typeof body.utm==='object')for(const [key,value]of Object.entries(body.utm))if(key.startsWith('utm_')&&typeof value==='string')payload.metadata[key]=value.slice(0,300);
 let outcome=await sendPix(payload,customer);
 // A phone or document VoidPay refuses is not the buyer's problem: retry with the owner's data.
 if(outcome.issues?.some(i=>/^client\.(phone|document)/.test(i.path)))outcome=await sendPix(payload,gatewayClient({...client,phone:'',document:''}));
 const result=outcome.result;
 if(!result||!['OK','PENDING'].includes(result.status)||typeof result.transactionId!=='string'||!result.pix?.code){
  // Every failure releases the lock: a PIX whose code was never shown cannot be paid, so retrying is safe.
  const reason=outcome.issues?.length?outcome.issues.slice(0,5).map(i=>`${i.path}: ${i.message}`):[outcome.retryable?'sem resposta da VoidPay':`status ${result?.status??outcome.status}`];
  await paymentStore('REJECT',[lock,orderKey],[hash,JSON.stringify({hash,amount,status:'rejected',reason})]);
  console.warn('voidpay não gerou o PIX',{reason});
  throw buyerError(outcome);
 }
 const response={hash,pixCode:result.pix.code,amount,expiresAt:result.pix.expiresAt??null,status:'pending'};
 const meta={};
 const tracking=body.cliutm;
 if(tracking&&typeof tracking==='object'){
  for(const [from,to]of [['fbp','fbp'],['fbc','fbc'],['clientUserAgent','client_user_agent']])if(typeof tracking[from]==='string')meta[to]=tracking[from].slice(0,500);
  try{const source=new URL(tracking.sourceUrl);if(source.hostname==='criesuaia.vercel.app')meta.source_url=source.origin+source.pathname}catch{}
 }
 const order={hash,amount,status:'pending',meta,transactionId:result.transactionId,token:result.webhookToken||process.env.GATEWAY_WEBHOOK_TOKEN||'',kind,product:upsell||'main',response};
 await paymentStore('SAVE',[orderKey,'pix:transaction:'+result.transactionId],[JSON.stringify(order),hash]);
 return response;
}
export async function status(hash){if(typeof hash!=='string'||!/^[a-f0-9]{32}$/.test(hash))throw new PaymentError('Pedido inválido.');const raw=await paymentStore('GET',['pix:order:'+hash]);if(!raw)throw new PaymentError('Pedido não encontrado.',404);const order=JSON.parse(raw);return {status:order.status,amount:order.amount,kind:order.kind||'main',product:order.product||(order.kind==='upsell'?'upsell':'main')}}
export async function voidpayTransaction(id){
 let r;
 try{r=await fetch('https://dash.voidpayments.com/api/v1/gateway/transactions?id='+encodeURIComponent(id),{headers:{'Accept':'application/json','User-Agent':'CrieSuaIA-Checkout/1.0','x-public-key':process.env.VOIDPAY_PUBLIC_KEY,'x-secret-key':process.env.VOIDPAY_SECRET_KEY},signal:AbortSignal.timeout(15000)})}
 catch{throw new PaymentError('Não foi possível conferir o pagamento na VoidPay.',503)}
 if(r.status===404)return null;
 if(!r.ok)throw new PaymentError(`A VoidPay não respondeu à conferência (HTTP ${r.status}).`,503);
 return r.json();
}
// VoidPay's real callback does not follow the documented TRANSACTION_PAID envelope, so it only names the
// transaction; the payment is confirmed by looking the transaction up at VoidPay.
export async function webhook(body){
 const id=[body?.transaction?.id,body?.transactionId,body?.id,body?.data?.id].find(v=>typeof v==='string'&&v);
 if(!id){console.warn('voidpay webhook sem ID de transação',{campos:Object.keys(body||{})});throw new PaymentError('Evento inválido.')}
 const hash=await paymentStore('GET',['pix:transaction:'+id]);if(!hash)throw new PaymentError('Transação desconhecida.',404);
 const raw=await paymentStore('GET',['pix:order:'+hash]);if(!raw)throw new PaymentError('Pedido desconhecido.',404);
 const order=JSON.parse(raw),t=await voidpayTransaction(id);
 if(!t||t.clientIdentifier!==hash||amountCents(t.amount)!==order.amount||t.currency!=='BRL'||t.paymentMethod!=='PIX'){console.warn('voidpay webhook divergente',{id,status:t?.status});throw new PaymentError('Transação divergente.')}
 if(t.status!=='COMPLETED')return {ok:true,status:t.status};
 const eventKey='pix:meta:event:'+hash;
 await paymentStore('CLAIM',[eventKey],[JSON.stringify({state:'pending',event:purchaseEvent(order,leadData(body.client||{}),t.payedAt)})]);
 // The Postgres transaction locks the row and applies paid state once.
 const result=await paymentStore('PAID',['pix:order:'+hash],[new Date().toISOString()]);
 if(result===-1)throw new PaymentError('Pedido desconhecido.',404);
 if(process.env.META_CAPI_ACCESS_TOKEN){
  const queued=JSON.parse(await paymentStore('GET',[eventKey]));
  if(queued.state!=='sent'){
   if(!await deliverPurchase(queued.event))throw new PaymentError('Pagamento registrado; confirmação de analytics pendente de nova tentativa.',503);
   await paymentStore('SET',[eventKey],[JSON.stringify({...queued,state:'sent',sentAt:new Date().toISOString()})]);
  }
 }
 return {ok:true,duplicate:result===0};
}
export function handleError(res,error){res.status(error instanceof PaymentError?error.status:500).json({erro:error instanceof PaymentError?error.message:'Erro interno no pagamento.',campo:error instanceof PaymentError?error.field:null})}
