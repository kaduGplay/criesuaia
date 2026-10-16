import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCustomer,amountCents,createPayment,webhook,gatewayClient,status} from '../lib/payments.js';
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
 const fetchOriginal=global.fetch,store=new Map();let issued=0,lookup=null;
 process.env.VOIDPAY_PUBLIC_KEY='fixture';process.env.VOIDPAY_SECRET_KEY='fixture';process.env.VOIDPAY_CALLBACK_URL='https://example.test/api/voidpay/webhook';process.env.SUPABASE_URL='https://database.example.test';process.env.SUPABASE_SECRET_KEY='sb_secret_fixture';
 process.env.VOIDPAY_FALLBACK_EMAIL='owner@example.test';process.env.VOIDPAY_FALLBACK_PHONE='11900000000';process.env.VOIDPAY_FALLBACK_DOCUMENT='52998224725';
 global.fetch=async(url,opts)=>{
  if(url.includes('/gateway/transactions?id=')){assert.equal(opts.headers['x-secret-key'],'fixture');return lookup&&url.endsWith('id=tx-1')?Response.json(lookup):new Response('{}',{status:404})}
  if(url.includes('voidpayments')){issued++;const p=JSON.parse(opts.body);assert.equal(p.amount,28.80);assert.equal(opts.headers['User-Agent'],'CrieSuaIA-Checkout/1.0');assert.deepEqual(p.client,{name:'Teste',email:'test@example.test',phone:'11900000000',document:'52998224725'});return Response.json({status:'OK',transactionId:'tx-1',webhookToken:'test-token',pix:{code:'fixture-code'}})}
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
  const order=await createPayment(body);assert.equal(order.amount,2880);assert.equal(order.pixCode,'fixture-code');assert.ok(!order.token);
  assert.deepEqual(await createPayment(body),order);assert.equal(issued,1);
  // The callback only names the transaction; VoidPay's own record decides whether it is paid.
  const event={transactionId:'tx-1',status:'COMPLETED',client:{email:'test@example.test',phone:'+5511900000000'}};
  const paidStatus=()=>JSON.parse(store.get('pix:order:'+order.hash)).status;
  lookup={id:'tx-1',clientIdentifier:order.hash,amount:28.8,currency:'BRL',paymentMethod:'PIX',status:'PENDING',payedAt:null};
  assert.deepEqual(await webhook(event),{ok:true,status:'PENDING'});assert.equal(paidStatus(),'pending');
  lookup={...lookup,status:'COMPLETED',payedAt:'2026-10-16T13:49:27.717Z',amount:0.01};await assert.rejects(webhook(event),/divergente/);
  lookup={...lookup,amount:28.8,clientIdentifier:'outro-pedido'};await assert.rejects(webhook(event),/divergente/);
  await assert.rejects(webhook({transactionId:'tx-desconhecida'}),/desconhecida/);
  assert.equal(paidStatus(),'pending');
  lookup={...lookup,clientIdentifier:order.hash};
  assert.equal((await webhook(event)).duplicate,false);assert.equal(paidStatus(),'paid');
  const queued=JSON.parse(store.get('pix:meta:event:'+order.hash)).event;assert.ok(queued.user_data.em&&!queued.user_data.ph);assert.equal(queued.event_time,Math.floor(Date.parse(lookup.payedAt)/1000));
  assert.equal((await webhook({transaction:{id:'tx-1'}})).duplicate,true);
 }finally{global.fetch=fetchOriginal;for(const name of ['VOIDPAY_PUBLIC_KEY','VOIDPAY_SECRET_KEY','VOIDPAY_CALLBACK_URL','SUPABASE_URL','SUPABASE_SECRET_KEY','VOIDPAY_FALLBACK_EMAIL','VOIDPAY_FALLBACK_PHONE','VOIDPAY_FALLBACK_DOCUMENT'])delete process.env[name]}
});

test('e-mail ausente interrompe cobrança antes de qualquer envio',async()=>{
 const original=global.fetch;let called=false;global.fetch=async()=>{called=true;throw Error('unexpected')};
 try{await assert.rejects(createPayment({name:'Cliente Teste',email:'',sid:'session'}),e=>e.field==='email'&&e.status===400);assert.equal(called,false)}finally{global.fetch=original}
});

test('cada upsell de 1 clique gera a própria cobrança com o preço do catálogo',async()=>{
 const fetchOriginal=global.fetch,store=new Map(),charged=[];
 const env={VOIDPAY_PUBLIC_KEY:'fixture',VOIDPAY_SECRET_KEY:'fixture',VOIDPAY_CALLBACK_URL:'https://example.test/api/voidpay/webhook',SUPABASE_URL:'https://database.example.test',SUPABASE_SECRET_KEY:'sb_secret_fixture',VOIDPAY_FALLBACK_EMAIL:'owner@example.test',VOIDPAY_FALLBACK_PHONE:'11900000000',VOIDPAY_FALLBACK_DOCUMENT:'52998224725'};
 Object.assign(process.env,env);
 global.fetch=async(url,opts)=>{
  if(url.includes('voidpayments')){const p=JSON.parse(opts.body);charged.push([p.products[0].id,p.amount]);return Response.json({status:'OK',transactionId:'tx-'+charged.length,pix:{code:'code-'+charged.length}})}
  const {p_operation:cmd,p_keys:keys,p_values:values}=JSON.parse(opts.body);let result=null;
  if(cmd==='GET')result=store.get(keys[0])??null;
  else if(cmd==='CLAIM'){if(!store.has(keys[0])){store.set(keys[0],values[0]);result='OK'}}
  else if(cmd==='SET'){store.set(keys[0],values[0]);result='OK'}
  else if(cmd==='SAVE'){store.set(keys[0],values[0]);store.set(keys[1],values[1]);result=1}
  return Response.json(result);
 };
 try{
  const base={name:'Teste',email:'test@example.test',sid:'session-upsell'};
  const whatsapp=await createPayment({...base,upsell:'whatsapp'},'upsell'),video=await createPayment({...base,upsell:'video'},'upsell');
  assert.deepEqual(charged,[['whatsapp',19.9],['video',14.9]]);assert.notEqual(whatsapp.hash,video.hash);
  assert.deepEqual(await createPayment({...base,upsell:'whatsapp'},'upsell'),whatsapp);assert.equal(charged.length,2);
  assert.equal((await status(video.hash)).product,'video');
  await createPayment({...base,upsell:'vip'},'upsell');assert.deepEqual(charged[2],['vip',29.9]);
  await assert.rejects(createPayment({...base,upsell:'inexistente'},'upsell'),/Oferta inválida/);
 }finally{global.fetch=fetchOriginal;for(const name of Object.keys(env))delete process.env[name]}
});

test('nome curto e celular com +55 vão no formato que a VoidPay aceita',()=>{
 const env={VOIDPAY_FALLBACK_EMAIL:'owner@example.test',VOIDPAY_FALLBACK_PHONE:'11900000000',VOIDPAY_FALLBACK_DOCUMENT:'52998224725'};
 assert.equal(gatewayClient({name:'Zé',email:'a@b.co'},env).name,'Zé Cliente');
 assert.equal(gatewayClient({name:'Carlos',email:'a@b.co'},env).name,'Carlos');
 assert.equal(gatewayClient({name:'Carlos',phone:'+55 31 98442-7971'},env).phone,'31984427971');
 assert.equal(gatewayClient({name:'Carlos',phone:'031984427971'},env).phone,'31984427971');
 assert.equal(gatewayClient({name:'Carlos',phone:'55 99999-9999'},env).phone,'55999999999','DDD 55 (RS) continua igual');
});

test('VoidPay travada ou recusando: tenta de novo, explica o erro e nunca prende o cliente',async()=>{
 const fetchOriginal=global.fetch,store=new Map();let gateway=()=>Response.json({}),calls=[];
 const env={VOIDPAY_PUBLIC_KEY:'fixture',VOIDPAY_SECRET_KEY:'fixture',VOIDPAY_CALLBACK_URL:'https://example.test/api/voidpay/webhook',SUPABASE_URL:'https://database.example.test',SUPABASE_SECRET_KEY:'sb_secret_fixture',VOIDPAY_FALLBACK_EMAIL:'owner@example.test',VOIDPAY_FALLBACK_PHONE:'11900000000',VOIDPAY_FALLBACK_DOCUMENT:'52998224725'};
 Object.assign(process.env,env);
 const ok=()=>Response.json({status:'OK',transactionId:'tx-'+calls.length,pix:{code:'code-'+calls.length}});
 const refuse=path=>Response.json({statusCode:400,details:[{path:path.split('.'),message:'inválido'}]},{status:400});
 global.fetch=async(url,opts)=>{
  if(url.includes('voidpayments')){calls.push(JSON.parse(opts.body).client);return gateway(calls.length)}
  const {p_operation:cmd,p_keys:keys,p_values:values}=JSON.parse(opts.body);let result=null;
  if(cmd==='GET')result=store.get(keys[0])??null;
  else if(cmd==='CLAIM'){if(!store.has(keys[0])){store.set(keys[0],values[0]);result='OK'}}
  else if(cmd==='SET'){store.set(keys[0],values[0]);result='OK'}
  else if(cmd==='SAVE'){store.set(keys[0],values[0]);store.set(keys[1],values[1]);result=1}
  else if(cmd==='REJECT'){store.set(keys[1],values[1]);if(store.get(keys[0])===values[0])store.delete(keys[0]);result=1}
  return Response.json(result);
 };
 const body=sid=>({name:'Cliente Teste',email:'test@example.test',sid});
 try{
  gateway=n=>{if(n<3)throw new TypeError('timeout');return ok()};
  assert.equal((await createPayment(body('a'))).pixCode,'code-3');assert.equal(calls.length,3);
  calls=[];gateway=()=>new Response('',{status:504});
  await assert.rejects(createPayment(body('b')),e=>e.status===503&&/demorou/.test(e.message));assert.equal(calls.length,4);
  gateway=()=>ok();assert.ok((await createPayment(body('b'))).pixCode,'o mesmo cliente consegue tentar de novo');
  calls=[];gateway=()=>refuse('client.name');
  await assert.rejects(createPayment(body('c')),e=>e.field==='name'&&/nome/.test(e.message));
  const rejected=[...store.values()].map(v=>{try{return JSON.parse(v)}catch{return null}}).find(o=>o?.status==='rejected'&&o.reason?.[0]?.startsWith('client.name'));assert.ok(rejected);
  calls=[];gateway=n=>n===1?refuse('client.phone'):ok();
  await createPayment({...body('d'),phone:'(31) 0000-0000'});assert.equal(calls.length,2);assert.equal(calls[1].phone,'11900000000');
 }finally{global.fetch=fetchOriginal;for(const name of Object.keys(env))delete process.env[name]}
});
