import {createHash} from 'node:crypto';
export const PIXEL_ID='1422813852615307';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function purchaseEvent(order,client={},timestamp){
 const user_data={external_id:[hash(order.hash)]};
 if(typeof client.email==='string'&&client.email.trim())user_data.em=[hash(client.email.trim().toLowerCase())];
 if(typeof client.phone==='string'){
  let phone=client.phone.replace(/\D/g,'');if(phone.length===10||phone.length===11)phone='55'+phone;
  if(phone)user_data.ph=[hash(phone)];
 }
 for(const key of ['fbp','fbc','client_user_agent'])if(order.meta?.[key])user_data[key]=order.meta[key];
 const time=Date.parse(timestamp);
 return {event_name:'Purchase',event_id:'purchase_'+order.hash,event_time:Number.isFinite(time)?Math.floor(time/1000):Math.floor(Date.now()/1000),action_source:'website',event_source_url:order.meta?.source_url||'https://criesuaia.vercel.app/',user_data,custom_data:{value:order.amount/100,currency:'BRL',order_id:order.hash,content_ids:[order.kind==='upsell'?'upsell':'main'],content_type:'product',num_items:1}};
}
export async function deliverPurchase(event){
 const token=process.env.META_CAPI_ACCESS_TOKEN;
 if(!token)return false;
 const version=process.env.META_GRAPH_API_VERSION||'v26.0';
 if(!/^v\d+\.\d+$/.test(version))return false;
 try{
  const payload={data:[event],access_token:token};if(process.env.META_TEST_EVENT_CODE)payload.test_event_code=process.env.META_TEST_EVENT_CODE;
  const response=await fetch(`https://graph.facebook.com/${version}/${PIXEL_ID}/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
  if(!response.ok)return false;
  const result=await response.json();return result.events_received===1;
 }catch{return false}
}
