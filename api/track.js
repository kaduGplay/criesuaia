import {recordFunnelEvent} from '../lib/funnel.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'||Number(req.headers['content-length']||0)>8192)return res.status(400).end();
 let body=req.body;
 if(typeof body==='string')try{body=JSON.parse(body)}catch{return res.status(400).end()}
 // Analytics must never break the funnel: failures are swallowed.
 try{await recordFunnelEvent(body,req.headers)}catch{}
 res.status(204).end();
}
