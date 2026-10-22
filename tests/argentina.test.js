import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createArPayment,liberpayWebhook,catalogAr} from '../lib/liberpay.js';
import {status} from '../lib/payments.js';
import {capiTarget} from '../lib/meta.js';

const env={LIBERPAY_AR_CLIENT_ID:'ar-client',LIBERPAY_AR_CLIENT_SECRET:'ar-secret',LIBERPAY_CLIENT_ID:'mx-client',LIBERPAY_CLIENT_SECRET:'mx-secret',VOIDPAY_FALLBACK_EMAIL:'owner@example.test',META_CAPI_ACCESS_TOKEN_MX:'mx-token',SUPABASE_URL:'https://database.example.test',SUPABASE_SECRET_KEY:'sb_secret_fixture'};
function fakeServices(){
 const store=new Map(),deposits=[],logins=[],capi=[];
 global.fetch=async(url,opts)=>{
  if(url.endsWith('/auth/token')){const c=JSON.parse(opts.body);logins.push(c.client_id);return Response.json({access_token:'tok-'+c.client_id})}
  if(url.includes('liberpay')){const p=JSON.parse(opts.body);deposits.push({...p,token:opts.headers.Authorization});return Response.json({message:'Deposit created successfully.',qrCodeResponse:{transactionId:'ar-tx-'+deposits.length,status:'pending',amount:p.amount,qrcode:'00000857002742334958'+String(deposits.length).padStart(2,'0'),instructionText:'Transfira via app do seu banco para o CVU.'}},{status:201})}
  if(url.includes('graph.facebook')){capi.push(url);return Response.json({events_received:1})}
  const {p_operation:cmd,p_keys:keys,p_values:values}=JSON.parse(opts.body);let result=null;
  if(cmd==='GET')result=store.get(keys[0])??null;
  else if(cmd==='CLAIM'){if(!store.has(keys[0])){store.set(keys[0],values[0]);result='OK'}}
  else if(cmd==='SET'){store.set(keys[0],values[0]);result='OK'}
  else if(cmd==='SAVE'){store.set(keys[0],values[0]);store.set(keys[1],values[1]);result=1}
  else if(cmd==='REJECT'){store.set(keys[1],values[1]);if(store.get(keys[0])===values[0])store.delete(keys[0]);result=1}
  else if(cmd==='PAID'){const o=JSON.parse(store.get(keys[0]));result=o.status==='paid'?0:1;o.status='paid';store.set(keys[0],JSON.stringify(o))}
  return Response.json(result);
 };
 return {store,deposits,logins,capi};
}

test('Argentina: transferência para CVU em pesos, com a conta LiberPay da Argentina',async()=>{
 const fetchOriginal=global.fetch;Object.assign(process.env,env);const {deposits,logins,capi}=fakeServices();
 try{
  const r=await createArPayment({name:'Juan',email:'',sid:'ar-1',method:'spei',bumps:['segundaparceira']});
  assert.deepEqual([deposits[0].amount,deposits[0].currency,deposits[0].payment_method,deposits[0].payer.email,deposits[0].metadata.shop_url],[(catalogAr.main.price+catalogAr.bumps.segundaparceira.price)/100,'ARS','bank_transfer_ar','owner@example.test','https://www.clichat.tech/argentina']);
  assert.deepEqual(logins,['ar-client']);assert.equal(deposits[0].token,'Bearer tok-ar-client');
  assert.deepEqual([r.method,r.currency,r.pixCode.length,r.barcodeUrl],['bank_transfer_ar','ARS',22,null]);
  await createArPayment({name:'Juan',email:'',sid:'ar-2',upsell:'video'},'upsell');
  assert.deepEqual([deposits[1].payment_method,deposits[1].amount],['bank_transfer_ar',catalogAr.upsells.video.price/100]);
  // Confirmation can take hours; once paid it is marked, and no purchase goes to the Mexican pixel.
  assert.equal((await liberpayWebhook({event:'payment.paid',data:{transaction_id:'ar-tx-1',status:'paid',amount:deposits[0].amount,net_amount:1}})).duplicate,false);
  assert.equal((await status(r.hash)).currency,'ARS');assert.equal((await status(r.hash)).status,'paid');
  assert.deepEqual(capi,[]);assert.equal(capiTarget({currency:'ARS',gateway:'liberpay'}).token,null);
  await assert.rejects(createArPayment({name:'',email:'',sid:'ar-3'}),/Escribí tu nombre/);
  delete process.env.LIBERPAY_AR_CLIENT_SECRET;await assert.rejects(createArPayment({name:'Juan',email:'',sid:'ar-4'}),e=>e.status===503&&/LIBERPAY_AR_CLIENT_ID/.test(e.message));
 }finally{global.fetch=fetchOriginal;for(const k of Object.keys(env))delete process.env[k]}
});

test('Argentina: página em pesos, sem nada do México',()=>{
 assert.equal(catalogAr.currency,'ARS');
 assert.ok(Object.values(catalogAr.upsells).every(u=>u.price>=200000)&&catalogAr.main.price>=200000,'a LiberPay aceita de AR$ 2.000 a AR$ 1.000.000');
 const ar=fs.readFileSync(new URL('../public/assets/index-ar.js',import.meta.url),'utf8');
 assert.ok(ar.includes('&site=ar"')&&!ar.includes('&site=mx"')&&!ar.includes('MX$')&&ar.includes('currency:"ARS"')&&ar.includes('"es-AR"'));
});
