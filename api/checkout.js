import {catalog,createPayment,status,handleError,PaymentError} from '../lib/payments.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(Number(req.headers['content-length']||0)>65536)throw new PaymentError('Corpo excede o limite.',413);
  if(req.method==='POST'&&!req.headers['content-type']?.startsWith('application/json'))throw new PaymentError('Envie JSON.',415);
  const origin=req.headers.origin;
  if(origin&&new URL(origin).host!==req.headers.host)throw new PaymentError('Origem inválida.',403);
  if(req.method==='GET'&&req.query.op==='products')return res.status(200).json(catalog);
  if(req.method==='GET'&&req.query.op==='status')return res.status(200).json(await status(req.query.hash));
  if(req.method==='POST'&&['pix','upsell-pix'].includes(req.query.op))return res.status(200).json(await createPayment(req.body,req.query.op==='upsell-pix'?'upsell':'main'));
  throw new PaymentError('Operação inválida.',405);
 }catch(error){handleError(res,error)}
}
