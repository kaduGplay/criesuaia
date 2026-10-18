// Temporary: shows which public IP the server uses to reach outside services (for LiberPay's IP allow-list).
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{const r=await fetch('https://api.ipify.org?format=json',{signal:AbortSignal.timeout(5000)});res.status(200).json({ip:(await r.json()).ip,region:process.env.VERCEL_REGION||null})}
 catch{res.status(502).json({ip:null})}
}
