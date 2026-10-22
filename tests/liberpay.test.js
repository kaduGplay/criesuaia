import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMxPayment,liberpayWebhook,catalogMx} from '../lib/liberpay.js';
import {status} from '../lib/payments.js';

const env={LIBERPAY_CLIENT_ID:'fixture-client',LIBERPAY_CLIENT_SECRET:'fixture-secret',VOIDPAY_FALLBACK_EMAIL:'owner@example.test',SUPABASE_URL:'https://database.example.test',SUPABASE_SECRET_KEY:'sb_secret_fixture'};
function fakeServices(gateway){
 const store=new Map(),deposits=[];
 global.fetch=async(url,opts)=>{
  if(url.endsWith('/auth/token')){const c=JSON.parse(opts.body);assert.deepEqual(c,{client_id:'fixture-client',client_secret:'fixture-secret'});return Response.json({access_token:'fixture-token',expires_in:3600})}
  if(url.includes('liberpay')){const p=JSON.parse(opts.body);assert.equal(opts.headers.Authorization,'Bearer fixture-token');deposits.push(p);return gateway(p,deposits.length)}
  const {p_operation:cmd,p_keys:keys,p_values:values}=JSON.parse(opts.body);let result=null;
  if(cmd==='GET')result=store.get(keys[0])??null;
  else if(cmd==='CLAIM'){if(!store.has(keys[0])){store.set(keys[0],values[0]);result='OK'}}
  else if(cmd==='SET'){store.set(keys[0],values[0]);result='OK'}
  else if(cmd==='SAVE'){store.set(keys[0],values[0]);store.set(keys[1],values[1]);result=1}
  else if(cmd==='REJECT'){store.set(keys[1],values[1]);if(store.get(keys[0])===values[0])store.delete(keys[0]);result=1}
  else if(cmd==='PAID'){const o=JSON.parse(store.get(keys[0]));result=o.status==='paid'?0:1;o.status='paid';store.set(keys[0],JSON.stringify(o))}
  return Response.json(result);
 };
 return {store,deposits};
}
const deposit=(p,n)=>Response.json({message:'Deposit created successfully.',qrCodeResponse:{transactionId:'tx-'+n,status:'pending',amount:p.amount,qrcode:p.payment_method==='spei'?'684180417019567955':'8203650002620292',instructionText:'texto',...(p.payment_method==='oxxo'?{barcodeUrl:'https://static.example.test/barcode.png'}:{})}},{status:201});

test('México: SPEI e OXXO em pesos, upsell sempre por SPEI e sem cobrança duplicada',async()=>{
 const fetchOriginal=global.fetch;Object.assign(process.env,env);const {deposits}=fakeServices(deposit);
 try{
  const base={name:'Juan',email:'',sid:'mx-1'};
  const spei=await createMxPayment(base);
  assert.deepEqual([deposits[0].amount,deposits[0].currency,deposits[0].payment_method,deposits[0].payer.email,deposits[0].external_id],[99,'MXN','spei','owner@example.test',spei.hash]);
  assert.equal(deposits[0].metadata.order_id,spei.hash);
  assert.deepEqual([spei.method,spei.pixCode,spei.barcodeUrl,spei.currency,spei.amount],['spei','684180417019567955',null,'MXN',catalogMx.main.price]);
  assert.deepEqual(await createMxPayment(base),spei);assert.equal(deposits.length,1);
  const oxxo=await createMxPayment({...base,sid:'mx-2',method:'oxxo',bumps:['chamadadevoz']});
  assert.deepEqual([deposits[1].payment_method,deposits[1].amount,oxxo.barcodeUrl],['oxxo',138,'https://static.example.test/barcode.png']);
  await createMxPayment({...base,sid:'mx-3',method:'oxxo',upsell:'video'},'upsell');
  assert.deepEqual([deposits[2].payment_method,deposits[2].amount],['spei',69]);
  assert.equal(deposits.at(-1).payer.name,'Juan');
  await createMxPayment({name:'Lu',email:'',sid:'mx-4'});assert.equal(deposits.at(-1).payer.name,'Lu Cliente');
  await assert.rejects(createMxPayment({name:'',email:'',sid:'mx-5'}),/Escribe tu nombre/);
 }finally{global.fetch=fetchOriginal;for(const k of Object.keys(env))delete process.env[k]}
});

test('México: recusa da LiberPay explica em espanhol e libera nova tentativa',async()=>{
 const fetchOriginal=global.fetch;Object.assign(process.env,env);let refuse=true;
 const {store}=fakeServices((p,n)=>refuse?new Response('{"message":"min ticket"}',{status:422}):deposit(p,n));
 try{
  await assert.rejects(createMxPayment({name:'Juan',email:'',sid:'mx-r'}),e=>e.status===502&&/No pudimos generar tu pago/.test(e.message));
  assert.ok([...store.values()].some(v=>v.includes('"status":"rejected"')&&v.includes('HTTP 422')));
  refuse=false;assert.equal((await createMxPayment({name:'Juan',email:'',sid:'mx-r'})).method,'spei');
 }finally{global.fetch=fetchOriginal;for(const k of Object.keys(env))delete process.env[k]}
});

test('México: payment.paid confirma só a transação e o valor certos',async()=>{
 const fetchOriginal=global.fetch;Object.assign(process.env,env);const {store}=fakeServices(deposit);
 try{
  const order=await createMxPayment({name:'Juan',email:'',sid:'mx-w'});
  assert.deepEqual(await liberpayWebhook({event:'payment.created',data:{transaction_id:'tx-1'}}),{ok:true,ignored:'payment.created'});
  await assert.rejects(liberpayWebhook({event:'payment.paid',data:{transaction_id:'tx-1',status:'paid',amount:1}}),/divergente/);
  await assert.rejects(liberpayWebhook({event:'payment.paid',data:{transaction_id:'tx-nao',status:'paid',amount:99}}),/desconhecida/);
  assert.equal((await status(order.hash)).status,'pending');
  assert.equal((await liberpayWebhook({event:'payment.paid',data:{transaction_id:'tx-1',status:'paid',amount:99,net_amount:92.5,end_to_end:'E1'},timestamp:'2026-10-18T22:26:14.000Z'})).duplicate,false);
  assert.deepEqual(await status(order.hash),{status:'paid',amount:9900,kind:'main',product:'main',currency:'MXN'});
  const event=JSON.parse(store.get('pix:meta:event:'+order.hash)).event;assert.equal(event.custom_data.currency,'MXN');assert.equal(event.custom_data.value,99);
  assert.equal((await liberpayWebhook({event:'payment.paid',data:{transaction_id:'tx-1',status:'paid',amount:99}})).duplicate,true);
 }finally{global.fetch=fetchOriginal;for(const k of Object.keys(env))delete process.env[k]}
});

test('México: venda em clichat.tech vai ao Facebook com a página certa',async()=>{
 const fetchOriginal=global.fetch;Object.assign(process.env,env);const {store}=fakeServices(deposit);
 try{
  const r=await createMxPayment({name:'Juan',email:'',sid:'mx-d',cliutm:{sourceUrl:'https://www.clichat.tech/mexico?utm_source=fb',fbp:'fb.1.1.1'}});
  assert.equal(JSON.parse(store.get('pix:order:'+r.hash)).meta.source_url,'https://www.clichat.tech/mexico');
  const fora=await createMxPayment({name:'Juan',email:'',sid:'mx-e',cliutm:{sourceUrl:'https://outro-site.example/mexico'}});
  assert.equal(JSON.parse(store.get('pix:order:'+fora.hash)).meta.source_url,undefined);
 }finally{global.fetch=fetchOriginal;for(const k of Object.keys(env))delete process.env[k]}
});

test('México: e-mail do comprador vai para a LiberPay e fica no pedido; adicionais viram upsell',async()=>{
 const fetchOriginal=global.fetch;Object.assign(process.env,env);const {store,deposits}=fakeServices(deposit);
 try{
  const r=await createMxPayment({name:'Juan Pérez',email:'juan@ejemplo.mx',sid:'mx-mail'});
  assert.equal(deposits[0].payer.email,'juan@ejemplo.mx');assert.equal(JSON.parse(store.get('pix:order:'+r.hash)).email,'juan@ejemplo.mx');
  const v=await createMxPayment({name:'Juan Pérez',email:'juan@ejemplo.mx',sid:'mx-mail',upsell:'chamadadevoz'},'upsell');
  assert.deepEqual([deposits[1].amount,deposits[1].payment_method,v.amount],[39,'spei',3900]);
  await createMxPayment({name:'Juan Pérez',email:'juan@ejemplo.mx',sid:'mx-mail',upsell:'segundaparceira'},'upsell');assert.equal(deposits[2].amount,39);
  await assert.rejects(createMxPayment({name:'Juan',email:'no-es-correo',sid:'mx-mail2'}),/correo válido/);
 }finally{global.fetch=fetchOriginal;for(const k of Object.keys(env))delete process.env[k]}
});

test('WhatsApp do upsell fica no pedido no formato internacional (México e Argentina)',async()=>{
 const fetchOriginal=global.fetch;Object.assign(process.env,env,{LIBERPAY_AR_CLIENT_ID:'fixture-client',LIBERPAY_AR_CLIENT_SECRET:'fixture-secret'});const {store}=fakeServices(deposit);
 try{
  const {createArPayment}=await import('../lib/liberpay.js');
  for(const [fn,phone,want] of [[createMxPayment,'55 1234 5678','+525512345678'],[createMxPayment,'+52 1 222 123 4567','+522221234567'],[createArPayment,'11 2345-6789','+5491123456789'],[createArPayment,'0351 234-5678','+5493512345678']]){
   const r=await fn({name:'Juan Pérez',email:'',phone,sid:'tel-'+want,upsell:'whatsapp'},'upsell');
   assert.equal(JSON.parse(store.get('pix:order:'+r.hash)).phone,want);
  }
 }finally{global.fetch=fetchOriginal;for(const k of [...Object.keys(env),'LIBERPAY_AR_CLIENT_ID','LIBERPAY_AR_CLIENT_SECRET'])delete process.env[k]}
});
