import {catalog,createPayment,status,handleError,PaymentError} from '../lib/payments.js';
import {catalogMx,createMxPayment} from '../lib/liberpay.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(Number(req.headers['content-length']||0)>65536)throw new PaymentError('Corpo excede o limite.',413);
  if(req.method==='POST'&&!req.headers['content-type']?.startsWith('application/json'))throw new PaymentError('Envie JSON.',415);
  const origin=req.headers.origin;
  if(origin&&new URL(origin).host!==req.headers.host)throw new PaymentError('Origem inválida.',403);
  // ?site=mx is the Mexican site: MXN catalog and LiberPay (SPEI/OXXO) instead of VoidPay PIX.
  const mx=req.query.site==='mx';
  if(req.method==='GET'&&req.query.op==='products')return res.status(200).json(mx?catalogMx:catalog);
  // Temporary: outgoing IP of this function (LiberPay allow-list check).
  if(req.method==='GET'&&req.query.op==='egress'){const r=await fetch('https://api.ipify.org?format=json',{signal:AbortSignal.timeout(5000)});return res.status(200).json(await r.json())}
  if(req.method==='GET'&&req.query.op==='status')return res.status(200).json(await status(req.query.hash));
  if(req.method==='POST'&&['pix','upsell-pix'].includes(req.query.op))return res.status(200).json(await (mx?createMxPayment:createPayment)(req.body,req.query.op==='upsell-pix'?'upsell':'main'));
  throw new PaymentError('Operação inválida.',405);
 }catch(error){handleError(res,error)}
}
