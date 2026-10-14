import {webhook,handleError,PaymentError} from '../../lib/payments.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{if(req.method!=='POST')throw new PaymentError('Método inválido.',405);return res.status(200).json(await webhook(req.body))}catch(error){handleError(res,error)}
}
