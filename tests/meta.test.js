import {test} from 'node:test';import assert from 'node:assert/strict';
import {purchaseEvent,deliverPurchase} from '../lib/meta.js';
test('Purchase usa valor pago e ID igual ao navegador, dados pessoais hashados',()=>{
 const event=purchaseEvent({hash:'abc',amount:1989,kind:'main'},{email:' Test@Example.test ',phone:'11912345678'},'2026-10-14T12:00:00Z');
 assert.equal(event.event_id,'purchase_abc');assert.equal(event.custom_data.value,19.89);assert.match(event.user_data.em[0],/^[a-f0-9]{64}$/);assert.match(event.user_data.ph[0],/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(event).includes('test@example.test'));
});
test('CAPI não transmite sem token e verifica recebimento quando configurado',async()=>{
 delete process.env.META_CAPI_ACCESS_TOKEN;assert.equal(await deliverPurchase({}),false);
 const original=global.fetch;process.env.META_CAPI_ACCESS_TOKEN='fixture-token';global.fetch=async(url,options)=>{assert.ok(url.endsWith('/1422813852615307/events'));assert.equal(JSON.parse(options.body).data[0].event_id,'purchase_abc');return Response.json({events_received:1})};
 try{assert.equal(await deliverPurchase({event_id:'purchase_abc'}),true)}finally{global.fetch=original;delete process.env.META_CAPI_ACCESS_TOKEN}
});
