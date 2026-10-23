// TEMPORARY: reads the Mexican LiberPay account (balance and payment status) from the site's fixed IPs. Removed right after use.
import {createHash} from 'node:crypto';
const KEY_SHA256='7b929c71b634eecf1b976948eee6314c12e240fb44fa3ff81dec7ff6ad381b3c';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(createHash('sha256').update(String(req.query.key||'')).digest('hex')!==KEY_SHA256)return res.status(404).end();
 const undici=await import('undici'),agent=new undici.Agent({connections:1,keepAliveTimeout:30000});
 const call=async(path,method,body,token)=>{try{const r=await undici.fetch('https://api.liberpay.pro'+path,{method,dispatcher:agent,headers:{'Content-Type':'application/json','Accept':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});return {status:r.status,body:(await r.text()).slice(0,500)}}catch(e){return {status:0,body:String(e).slice(0,200)}}};
 const login=await call('/auth/token','POST',{client_id:process.env.LIBERPAY_CLIENT_ID,client_secret:process.env.LIBERPAY_CLIENT_SECRET});
 let token=null;try{const d=JSON.parse(login.body);token=d.access_token||d.token||d.data?.access_token||d.data?.token}catch{}
 const out={login:login.status};
 if(!token)return res.status(200).json(out);
 out.balance=await call('/balance','GET',null,token);
 const ids=String(req.query.ids||'').split(',').filter(x=>/^[\w-]{8,64}$/.test(x)).slice(0,6),first=ids[0];
 for(const p of ['/payments/'+first,'/payments/deposit/'+first,'/payments/status/'+first,'/transactions/'+first,'/payments?transaction_id='+first,'/payments/deposits/'+first,'/payments/'+first+'/status'])out[p.replace(first,'{id}')]=await call(p,'GET',null,token);
 res.status(200).json(out);
}
