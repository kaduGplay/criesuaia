import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCustomer,amountCents,createPayment,webhook,gatewayClient} from '../lib/payments.js';
test('campos opcionais omitidos e valores em centavos',()=>{assert.deepEqual(parseCustomer({name:'Teste',email:'test@example.test',phone:'',document:''}),{name:'Teste',email:'test@example.test'});assert.equal(amountCents(19.89),1989);assert.throws(()=>amountCents(0));assert.throws(()=>amountCents(true));assert.throws(()=>parseCustomer({name:'x'}));assert.throws(()=>parseCustomer({name:'Teste',email:'invalido'}))});
test('dados ausentes usam o padrão do dono e dados do lead são normalizados',()=>{
 const env={VOIDPAY_FALLBACK_EMAIL:'owner@example.test',VOIDPAY_FALLBACK_PHONE:'(11) 90000-0000',VOIDPAY_FALLBACK_DOCUMENT:'529.982.247-25'};
 assert.deepEqual(gatewayClient({name:'Teste'},env),{name:'Teste',email:'owner@example.test',phone:'11900000000',document:'52998224725'});
 assert.deepEqual(gatewayClient({name:'Teste',email:'lead@example.test',phone:'(21) 98765-4321',document:'111.444.777-35'},env),{name:'Teste',email:'lead@example.test',phone:'21987654321',document:'11144477735'});
 assert.equal(gatewayClient({name:'Teste',phone:'123',document:'111.111.111-11'},env).document,'52998224725');
 assert.throws(()=>gatewayClient({name:'Teste'},{}),/VOIDPAY_FALLBACK/);
});
test('cobrança não chama gateway com ambiente incompleto',async()=>{delete process.env.VOIDPAY_PUBLIC_KEY;await assert.rejects(createPayment({name:'Teste',email:'test@example.test',sid:'test'}),/Configure as chaves/)});
test('webhook rejeita eventos inválidos',async()=>{await assert.rejects(webhook({event:'UNKNOWN'}),/Evento inválido/)});
test('PIX, repetição, webhook e persistência com Supabase simulado',async()=>{
 const fetchOriginal=global.fetch,store=new Map();let issued=0;
 process.env.VOIDPAY_PUBLIC_KEY='fixture';process.env.VOIDPAY_SECRET_KEY='fixture';process.env.VOIDPAY_CALLBACK_URL='https://example.test/api/voidpay/webhook';process.env.SUPABASE_URL='https://database.example.test';process.env.SUPABASE_SECRET_KEY='sb_secret_fixture';
 process.env.VOIDPAY_FALLBACK_EMAIL='owner@example.test';process.env.VOIDPAY_FALLBACK_PHONE='11900000000';process.env.VOIDPAY_FALLBACK_DOCUMENT='52998224725';
 global.fetch=async(url,opts)=>{
  if(url.includes('voidpayments')){issued++;const p=JSON.parse(opts.body);assert.equal(p.amount,28.79);assert.equal(opts.headers['User-Agent'],'CrieSuaIA-Checkout/1.0');assert.deepEqual(p.client,{name:'Teste',email:'test@example.test',phone:'11900000000',document:'52998224725'});return Response.json({status:'OK',transactionId:'tx-1',webhookToken:'test-token',pix:{code:'fixture-code'}})}
  const {p_operation:cmd,p_keys:keys,p_values:values}=JSON.parse(opts.body);let result;
  assert.equal(opts.headers.apikey,'sb_secret_fixture');
  if(cmd==='GET')result=store.get(keys[0])??null;
  else if(cmd==='CLAIM'){if(store.has(keys[0]))result=null;else{store.set(keys[0],values[0]);result='OK'}}
  else if(cmd==='SET'){store.set(keys[0],values[0]);result='OK'}
  else if(cmd==='SAVE'){store.set(keys[0],values[0]);store.set(keys[1],values[1]);result=1}
  else if(cmd==='PAID'){const order=JSON.parse(store.get(keys[0]));result=order.status==='paid'?0:1;order.status='paid';store.set(keys[0],JSON.stringify(order))}
  return Response.json(result);
 };
 try{
  const body={name:'Teste',email:'test@example.test',sid:'session',bumps:['chamadadevoz']};
  const order=await createPayment(body);assert.equal(order.amount,2879);assert.equal(order.pixCode,'fixture-code');assert.ok(!order.token);
  assert.deepEqual(await createPayment(body),order);assert.equal(issued,1);
  const event={event:'TRANSACTION_PAID',token:'test-token',transaction:{id:'tx-1',identifier:order.hash,status:'COMPLETED',paymentMethod:'PIX',currency:'BRL',amount:28.79},client:{email:'test@example.test',phone:'+5511900000000'},orderItems:[],trackProps:{},offerCode:'',checkoutUrl:'',subscription:null};
  await assert.rejects(webhook({...event,token:'forged'}),/Token inválido/);
  await assert.rejects(webhook({...event,transaction:{...event.transaction,amount:0.01}}),/divergente/);
  assert.equal((await webhook(event)).duplicate,false);const queued=JSON.parse(store.get('pix:meta:event:'+order.hash)).event.user_data;assert.ok(queued.em&&!queued.ph);assert.equal((await webhook(event)).duplicate,true);
 }finally{global.fetch=fetchOriginal;for(const name of ['VOIDPAY_PUBLIC_KEY','VOIDPAY_SECRET_KEY','VOIDPAY_CALLBACK_URL','SUPABASE_URL','SUPABASE_SECRET_KEY','VOIDPAY_FALLBACK_EMAIL','VOIDPAY_FALLBACK_PHONE','VOIDPAY_FALLBACK_DOCUMENT'])delete process.env[name]}
});

test('e-mail ausente interrompe cobrança antes de qualquer envio',async()=>{
 const original=global.fetch;let called=false;global.fetch=async()=>{called=true;throw Error('unexpected')};
 try{await assert.rejects(createPayment({name:'Cliente Teste',email:'',sid:'session'}),e=>e.field==='email'&&e.status===400);assert.equal(called,false)}finally{global.fetch=original}
});
