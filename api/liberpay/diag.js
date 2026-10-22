// TEMPORARY: diagnoses the Argentine LiberPay account from the site's fixed IPs. Removed right after use.
import {createHash} from 'node:crypto';
const KEY_SHA256='ce4daa1ea777d4278fa8eb25dd4d83c1143c9e04a35c56728fa2821922086a33';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(createHash('sha256').update(String(req.query.key||'')).digest('hex')!==KEY_SHA256)return res.status(404).end();
 const undici=await import('undici'),agent=new undici.Agent({connections:1,keepAliveTimeout:30000});
 const call=async(path,method,body,token)=>{try{const r=await undici.fetch('https://api.liberpay.pro'+path,{method,dispatcher:agent,headers:{'Content-Type':'application/json','Accept':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});return {status:r.status,body:(await r.text()).slice(0,400)}}catch(e){return {status:0,body:String(e).slice(0,200)}}};
 const login=await call('/auth/token','POST',{client_id:process.env.LIBERPAY_AR_CLIENT_ID,client_secret:process.env.LIBERPAY_AR_CLIENT_SECRET});
 let token=null;try{const d=JSON.parse(login.body);token=d.access_token||d.token||d.data?.access_token||d.data?.token}catch{}
 const out={login:{status:login.status,ok:!!token}};
 if(!token)return res.status(200).json(out);
 out.balance=await call('/balance','GET',null,token);
 const email=process.env.VOIDPAY_FALLBACK_EMAIL||'pagos@clichat.tech',ts=Date.now().toString(36);
 const meta=id=>({provider:'MinhaLoja',user_email:email,order_id:id,checkout_url:'https://www.clichat.tech/argentina',shop_url:'https://www.clichat.tech'});
 const variants={
  documentacao:{amount:3000.00,external_id:'pedido-ar-'+ts+'a',payment_method:'bank_transfer_ar',currency:'ARS',payer:{name:'Juan Pérez',email},metadata:meta('pedido-ar-'+ts+'a')},
  com_telefone:{amount:3000.00,external_id:'pedido-ar-'+ts+'b',payment_method:'bank_transfer_ar',currency:'ARS',payer:{name:'Juan Pérez',email,phone:'+5491123456789'},metadata:meta('pedido-ar-'+ts+'b')},
  valor_7490:{amount:7490,external_id:'pedido-ar-'+ts+'c',payment_method:'bank_transfer_ar',currency:'ARS',payer:{name:'Juan Pérez',email},metadata:meta('pedido-ar-'+ts+'c')},
 };
 for(const [name,payload] of Object.entries(variants))out[name]=await call('/payments/deposit','POST',payload,token);
 res.status(200).json(out);
}
