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
 assert.ok(js.includes('version:"mx-br-20261022-pasos-separados"'));
 const html = read('public/mexico/index.html');
 assert.ok(html.includes('lang="es-MX"') && html.includes('index-mx.js?v=mx-br-20261022-pasos-separados'));
 assert.ok(!html.includes('trackio') && !html.includes('utmify') && !html.includes('1481680676270423'));
});


test('modal mexicano pede apenas correio e registra um único lead', () => {
 const source=read('tools/mx-lead-modal.js');
 const hooks=[],events=[],saved=new Map();let cursor=0,done=0;
 const context={w:{
  useState(initial){const pos=cursor++;if(!(pos in hooks))hooks[pos]=typeof initial==='function'?initial():initial;return[hooks[pos],value=>{hooks[pos]=value}]},
  useRef(initial){const pos=cursor++;return hooks[pos]??= {current:initial}},useEffect(){}
 },i:{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
 localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},
 $:event=>events.push(event),Se:()=>{},setTimeout,clearTimeout};
 vm.runInNewContext(source,context);
 const render=()=>{cursor=0;return context.cg({onDone:()=>done++}).props.children};
 const fill=(form,name,value)=>form.props.children.find(node=>node?.props?.name===name).props.onChange({target:{value}});
 let form=render();
 assert.deepEqual(Array.from(form.props.children.filter(node=>node?.type==='input'),node=>node.props.name),['email']);
 form.props.onSubmit({preventDefault(){}});assert.equal(done,0);assert.equal(saved.size,0);
 fill(form,'email','invalido');form=render();form.props.onSubmit({preventDefault(){}});
 assert.equal(done,0);assert.equal(saved.size,0);
 fill(form,'email',' CARLOS@example.test ');form=render();form.props.onSubmit({preventDefault(){}});form.props.onSubmit({preventDefault(){}});
 assert.equal(saved.has('nq_nome'),false);assert.equal(saved.get('nq_email'),'carlos@example.test');assert.equal(done,1);
 assert.deepEqual(events,['email_submitted']);
 assert.ok(!source.includes('vt("Lead")'),'o dispatcher existente deduplica o Lead');
 assert.ok(!source.includes('eg-badge')&&!source.includes('%'),'modal sem porcentagem');
 assert.ok(!js.includes('className:"quiz-count"'));
 assert.ok(js.includes('||"tu novia"')&&!js.includes('||"sua namorada"'));
});

test('runtime retorna o país da versão mexicana ou argentina',async()=>{
 for(const [pathname,want] of [['/mexico','MX'],['/argentina','AR'],['/','BR']]){
  const context={window:{fetch:async()=>new Response(null)},navigator:{sendBeacon:()=>true},location:{pathname,href:'https://www.clichat.tech'+pathname,origin:'https://www.clichat.tech'},URL,Response};
  vm.runInNewContext(read('public/local-runtime.js'),context);
  const response=await context.window.fetch('https://geoapi.info/api/geo');
  assert.equal((await response.json()).location.country,want);
 }
});


test('nome da pessoa vem depois do correio e antes do componente de nome da IA',()=>{
 const hooks=[],saved=new Map([['nq_email','carlos@example.test']]),events=[];let cursor=0;
 const characterPreview=()=>{};
 const context={w:{useState(initial){const pos=cursor++;if(!(pos in hooks))hooks[pos]=typeof initial==='function'?initial():initial;return[hooks[pos],value=>{hooks[pos]=value}]},useRef(initial){const pos=cursor++;return hooks[pos]??={current:initial}},useEffect(){}},
 i:{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
 localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},$:event=>events.push(event),xg:characterPreview,setTimeout,clearTimeout};
 vm.runInNewContext(read('tools/mx-name-step.js'),context);
 const props={answers:{},onNameSubmit:()=>{},onChatNow:()=>{}};
 const render=()=>{cursor=0;return context.mxPreview(props)};
 let screen=render(),form=screen.props.children.props.children.props.children.find(node=>node?.type==='form');
 assert.equal(form.props.children[0].props.name,'name');
 form.props.children[0].props.onChange({target:{value:' Carlos '}});
 screen=render();form=screen.props.children.props.children.props.children.find(node=>node?.type==='form');
 form.props.onSubmit({preventDefault(){}});
 assert.equal(saved.get('nq_nome'),'Carlos');assert.equal(saved.get('nq_email'),'carlos@example.test');
 assert.deepEqual(events,['user_name_submitted']);
 assert.equal(render().type,characterPreview,'só então mostra o componente que pede o nome da IA');
 assert.ok(js.includes('i.jsx(mxPreview,{answers:x,onNameSubmit:je,onChatNow:F})'));
});
