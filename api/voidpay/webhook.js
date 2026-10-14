import {webhook,handleError,PaymentError} from '../../lib/payments.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{if(Number(req.headers['content-length']||0)>65536)throw new PaymentError('Corpo excede o limite.',413);if(!req.headers['content-type']?.startsWith('application/json'))throw new PaymentError('Envie JSON.',415);if(req.method!=='POST')throw new PaymentError('Método inválido.',405);return res.status(200).json(await webhook(req.body))}catch(error){handleError(res,error)}
}
