import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCustomer,amountCents,createPayment,webhook} from '../lib/payments.js';
test('campos opcionais omitidos e valores em centavos',()=>{assert.deepEqual(parseCustomer({name:'Teste',email:'test@example.test',phone:'',document:''}),{name:'Teste',email:'test@example.test'});assert.equal(amountCents(19.89),1989);assert.throws(()=>amountCents(0));assert.throws(()=>amountCents(true));assert.throws(()=>parseCustomer({name:'x'}))});
test('cobrança não chama gateway com ambiente incompleto',async()=>{delete process.env.VOIDPAY_PUBLIC_KEY;await assert.rejects(createPayment({name:'Teste',email:'test@example.test',sid:'test'}),/Configure as chaves/)});
test('webhook rejeita eventos inválidos',async()=>{await assert.rejects(webhook({event:'UNKNOWN'}),/Evento inválido/)});
test('PIX, repetição, webhook e persistência com Redis simulado',async()=>{
 const fetchOriginal=global.fetch,store=new Map();let issued=0;
 process.env.VOIDPAY_PUBLIC_KEY='fixture';process.env.VOIDPAY_SECRET_KEY='fixture';process.env.VOIDPAY_CALLBACK_URL='https://example.test/api/voidpay/webhook';process.env.UPSTASH_REDIS_REST_URL='https://redis.example.test';process.env.UPSTASH_REDIS_REST_TOKEN='fixture';
 global.fetch=async(url,opts)=>{
  if(url.includes('voidpayments')){issued++;const p=JSON.parse(opts.body);assert.equal(p.amount,28.79);assert.equal(opts.headers['User-Agent'],'CrieSuaIA-Checkout/1.0');return Response.json({status:'OK',transactionId:'tx-1',webhookToken:'test-token',pix:{code:'fixture-code'}})}
  const [cmd,...args]=JSON.parse(opts.body);let result;
  if(cmd==='GET')result=store.get(args[0])??null;
  else if(cmd==='SET'){if(args[2]==='NX'&&store.has(args[0]))result=null;else{store.set(args[0],args[1]);result='OK'}}
  else if(cmd==='EVAL'){
   const [script,num,...rest]=args;
   if(num===2){store.set(rest[0],rest[2]);store.set(rest[1],rest[3]);result=1}
   else{const order=JSON.parse(store.get(rest[0]));result=order.status==='paid'?0:1;order.status='paid';store.set(rest[0],JSON.stringify(order))}
  }
  return Response.json({result});
 };
 try{
  const body={name:'Teste',email:'test@example.test',sid:'session',bumps:['chamadadevoz']};
  const order=await createPayment(body);assert.equal(order.amount,2879);assert.equal(order.pixCode,'fixture-code');assert.ok(!order.token);
  assert.deepEqual(await createPayment(body),order);assert.equal(issued,1);
  const event={event:'TRANSACTION_PAID',token:'test-token',transaction:{id:'tx-1',identifier:order.hash,status:'COMPLETED',paymentMethod:'PIX',currency:'BRL',amount:28.79},client:{},orderItems:[],trackProps:{},offerCode:'',checkoutUrl:'',subscription:null};
  await assert.rejects(webhook({...event,token:'forged'}),/Token inválido/);
  await assert.rejects(webhook({...event,transaction:{...event.transaction,amount:0.01}}),/divergente/);
  assert.equal((await webhook(event)).duplicate,false);assert.equal((await webhook(event)).duplicate,true);
 }finally{global.fetch=fetchOriginal;for(const name of ['VOIDPAY_PUBLIC_KEY','VOIDPAY_SECRET_KEY','VOIDPAY_CALLBACK_URL','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])delete process.env[name]}
});
