import {handleError,PaymentError} from '../../lib/payments.js';
import {liberpayWebhook} from '../../lib/liberpay.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{if(Number(req.headers['content-length']||0)>65536)throw new PaymentError('Corpo excede o limite.',413);if(req.method!=='POST')throw new PaymentError('Método inválido.',405);const body=typeof req.body==='string'?JSON.parse(req.body):req.body;return res.status(200).json(await liberpayWebhook(body))}catch(error){handleError(res,error)}
}
