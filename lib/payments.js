import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import catalog from './catalog.json' with {type:'json'};
export class PaymentError extends Error {constructor(message,status=400){super(message);this.status=status}}
export async function redis(...command){
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(!url?.startsWith('https://')||!token)throw new PaymentError('Configure o Redis persistente na Vercel.',503);
 const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new PaymentError('Armazenamento indisponível.',503);
 const data=await r.json();if(data.error)throw new PaymentError('Falha no armazenamento.',503);return data.result;
}
export {catalog};
export function parseCustomer(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new PaymentError('Dados inválidos.');
 const client={};
 for(const key of ['name','email','phone','document']){
  const value=body[key]??'';if(typeof value!=='string'||value.length>250)throw new PaymentError('Dados inválidos.');
  if(value.trim())client[key]=value.trim();
 }
 if(!client.name||client.name.length<2||!/^\S+@\S+\.\S+$/.test(client.email??''))throw new PaymentError('Informe nome e e-mail válidos.');
 return client;
}
export function amountCents(value){const n=Number(value);if(typeof value==='boolean'||!Number.isFinite(n)||n<=0||Math.abs(n*100-Math.round(n*100))>0.000001)throw new PaymentError('Valor inválido.');return Math.round(n*100)}
export async function createPayment(body,kind='main'){
 const client=parseCustomer(body);
 if(typeof body.sid!=='string'||!body.sid||body.sid.length>200)throw new PaymentError('Sessão inválida.');
 const bumps=kind==='main'?(body.bumps??[]):[];
 if(!Array.isArray(bumps)||bumps.some(x=>typeof x!=='string'||!Object.hasOwn(catalog.bumps,x))||new Set(bumps).size!==bumps.length)throw new PaymentError('Oferta inválida.');
 const items=kind==='main'?[['main',catalog.main],...bumps.slice().sort().map(k=>[k,catalog.bumps[k]])]:[['upsell',catalog.upsell]];
 const amount=items.reduce((a,[,p])=>a+p.price,0);
 if(!process.env.VOIDPAY_PUBLIC_KEY||!process.env.VOIDPAY_SECRET_KEY)throw new PaymentError('Configure as chaves VoidPay na Vercel.',503);
 const callback=process.env.VOIDPAY_CALLBACK_URL;
 if(!callback?.startsWith('https://'))throw new PaymentError('Configure a URL HTTPS do webhook na Vercel.',503);
 const fingerprint=createHash('sha256').update(JSON.stringify([body.sid,kind,bumps.slice().sort(),client])).digest('hex');
 const lock='pix:request:'+fingerprint,hash=randomUUID().replaceAll('-','');
 // No expiring lock: an unknown gateway outcome must never trigger a duplicate charge.
 const acquired=await redis('SET',lock,hash,'NX');
 if(!acquired){const old=await redis('GET',lock),raw=await redis('GET','pix:order:'+old);if(raw){const order=JSON.parse(raw);if(order.response)return order.response}throw new PaymentError('Pedido em verificação. Não gere outra cobrança.',409)}
 const orderKey='pix:order:'+hash;
 await redis('SET',orderKey,JSON.stringify({hash,amount,status:'creating'}));
 const payload={identifier:hash,amount:amount/100,client,callbackUrl:callback,
  products:items.map(([id,p])=>({id,name:p.title,quantity:1,price:p.price/100,physical:false})),metadata:{provider:'Crie sua IA',orderId:hash}};
 if(body.utm&&typeof body.utm==='object')for(const [key,value]of Object.entries(body.utm))if(key.startsWith('utm_')&&typeof value==='string')payload.metadata[key]=value.slice(0,300);
 let r;
 try{r=await fetch('https://dash.voidpayments.com/api/v1/gateway/pix/receive',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','User-Agent':'CrieSuaIA-Checkout/1.0','x-public-key':process.env.VOIDPAY_PUBLIC_KEY,'x-secret-key':process.env.VOIDPAY_SECRET_KEY},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)})}
 catch{throw new PaymentError('Falha de conexão. O pedido precisa ser verificado antes de tentar novamente.',502)}
 if(!r.ok){
  if(r.status>=400&&r.status<500&&![408,409].includes(r.status))await redis('EVAL',"redis.call('SET',KEYS[2],ARGV[2]); if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('DEL',KEYS[1]) end; return 1",2,lock,orderKey,hash,JSON.stringify({hash,amount,status:'rejected'}));
  throw new PaymentError(`A VoidPay recusou a requisição (HTTP ${r.status}). Confira os dados e as permissões da API.`,502);
 }
 const result=await r.json();
 if(!['OK','PENDING'].includes(result.status)||typeof result.transactionId!=='string'||!result.pix?.code)throw new PaymentError('Resposta da VoidPay precisa ser verificada.',502);
 const response={hash,pixCode:result.pix.code,amount,expiresAt:result.pix.expiresAt??null,status:'pending'};
 const order={hash,amount,status:'pending',transactionId:result.transactionId,token:result.webhookToken||process.env.GATEWAY_WEBHOOK_TOKEN||'',response};
 await redis('EVAL',"redis.call('SET',KEYS[1],ARGV[1]);redis.call('SET',KEYS[2],ARGV[2]);return 1",2,orderKey,'pix:transaction:'+result.transactionId,JSON.stringify(order),hash);
 return response;
}
export async function status(hash){if(typeof hash!=='string'||!/^[a-f0-9]{32}$/.test(hash))throw new PaymentError('Pedido inválido.');const raw=await redis('GET','pix:order:'+hash);if(!raw)throw new PaymentError('Pedido não encontrado.',404);return {status:JSON.parse(raw).status}}
export async function webhook(body){
 if(body?.event!=='TRANSACTION_PAID'||typeof body.token!=='string'||typeof body.transaction?.id!=='string')throw new PaymentError('Evento inválido.');
 const t=body.transaction,hash=await redis('GET','pix:transaction:'+t.id);if(!hash)throw new PaymentError('Transação desconhecida.',404);
 const raw=await redis('GET','pix:order:'+hash);if(!raw)throw new PaymentError('Pedido desconhecido.',404);
 const order=JSON.parse(raw),expected=Buffer.from(order.token||process.env.GATEWAY_WEBHOOK_TOKEN||''),actual=Buffer.from(body.token);
 if(!expected.length||expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new PaymentError('Token inválido.',401);
 if(t.status!=='COMPLETED'||t.paymentMethod!=='PIX'||t.currency!=='BRL'||amountCents(t.amount)!==order.amount||(t.identifier&&t.identifier!==hash))throw new PaymentError('Transação divergente.');
 if(!body.client||!Array.isArray(body.orderItems)||typeof body.trackProps!=='object'||typeof body.offerCode!=='string'||typeof body.checkoutUrl!=='string'||!Object.hasOwn(body,'subscription'))throw new PaymentError('Payload incompleto.');
 // Atomic compare-and-update preserves paid state on duplicate notifications.
 const result=await redis('EVAL',"local raw=redis.call('GET',KEYS[1]);if not raw then return -1 end;local o=cjson.decode(raw);if o.status=='paid' then return 0 end;o.status='paid';o.paidAt=ARGV[1];redis.call('SET',KEYS[1],cjson.encode(o));return 1",1,'pix:order:'+hash,new Date().toISOString());
 if(result===-1)throw new PaymentError('Pedido desconhecido.',404);return {ok:true,duplicate:result===0};
}
export function handleError(res,error){res.status(error instanceof PaymentError?error.status:500).json({erro:error instanceof PaymentError?error.message:'Erro interno no pagamento.'})}
