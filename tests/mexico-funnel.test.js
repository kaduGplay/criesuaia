import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const js = read('public/assets/index-mx.js');
const original = read('source/brasil-2026-10-22/index-BR-QfwKO.js');
function questions(bundle) {
 return JSON.parse(JSON.stringify(vm.runInNewContext('('+bundle.slice(bundle.indexOf('tc=[')+3, bundle.indexOf('],_v={')+1)+')')));
}

test('México usa todas as perguntas e opções do original brasileiro capturado', () => {
 const source = questions(original), current = questions(js);
 source[0].options[0].label = 'Realista';
 assert.deepEqual(current, source);
 assert.deepEqual(current.filter(q=>q.id!==16).map(q=>q.id), [0,2,3,4,5,6,7,8,9,10,18,1,11,12,13,14,15,17]);
 assert.ok(js.includes('I=w.useMemo(()=>t==="br"?tc:tc.filter(q=>q.id!==16)'));
 assert.ok(!js.includes('qzOrder='), 'não limita o questionário às sete perguntas anteriores');
 for (const q of current) for (const path of [q.headerImage, ...q.options?.map(o=>o.imagePath)||[]].filter(Boolean)) {
  assert.ok(fs.existsSync(new URL('../public'+path, import.meta.url)), path);
 }
});

test('nova versão mantém pagamento mexicano, pedidos pendentes e pixel exclusivo', () => {
 assert.ok(js.includes('d="nq_quiz_state_mx_br_v1"'), 'não mistura posições do questionário antigo');
 assert.ok(js.includes('ra="ck_pix_mx"') && js.includes('fi="ck_pago_mx"'), 'mantém retomada de pagamentos');
 assert.ok(js.includes('Gh="1641698144409525"') && js.includes('currency:"MXN"'));
 assert.ok(js.includes('/api/checkout?op=pix&site=mx'));
 assert.ok(js.includes('onCheckout:t==="latam"?()=>{stopFunnelMedia();h("checkout")}'));
 assert.ok(js.includes('version:"mx-br-20261022-modal-original"'));
 const html = read('public/mexico/index.html');
 assert.ok(html.includes('lang="es-MX"') && html.includes('index-mx.js?v=mx-br-20261022-modal-original'));
 assert.ok(!html.includes('trackio') && !html.includes('utmify') && !html.includes('1481680676270423'));
});


test('modal de e-mail idêntico ao original e sem número de etapa adicionado', () => {
 const modal = text => text.slice(text.indexOf('cg=({onDone:'), text.indexOf(',dg=', text.indexOf('cg=({onDone:')));
 assert.equal(modal(js), modal(original).replace('Rt("Lead")', 'vt("Lead")'));
 assert.ok(!js.includes('className:"quiz-count"'));
});
