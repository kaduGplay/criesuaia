import {test} from 'node:test';
import assert from 'node:assert/strict';
import {funnelRow} from '../lib/funnel.js';
test('funil grava a etapa sem e-mail nem nome e ignora robôs',()=>{
 const base={sid:'s1',vid:'v1',utm:{utm_source:'fb',outro:'x'}};
 const answer=funnelRow({...base,event:'question_answered',qp:2,qt:'Defina a silhueta',ans:'curvilinea'},{'user-agent':'Mozilla/5.0 (iPhone)','x-vercel-ip-country':'BR'});
 assert.deepEqual([answer.event,answer.qp,answer.question,answer.answer,answer.device,answer.country,answer.utm],['question_answered',2,'Defina a silhueta','curvilinea','ios','BR',{utm_source:'fb'}]);
 assert.equal(funnelRow({...base,event:'email_submitted',ans:'pessoa@gmail.com'}).answer,null);
 assert.equal(funnelRow({...base,event:'user_name_submitted',ans:'Carlos'}).answer,null);
 assert.equal(funnelRow({...base,event:'quiz_start',wd:true}),null);
 assert.equal(funnelRow({...base,event:'DROP TABLE'}),null);
 assert.equal(funnelRow({event:'quiz_start'}),null);
});
