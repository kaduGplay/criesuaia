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
 const listExpression=js.slice(js.indexOf('I=w.useMemo(()=>')+'I=w.useMemo(()=>'.length,js.indexOf(',[t]);w.useEffect',js.indexOf('I=w.useMemo(()=>')));
 const steps=vm.runInNewContext(listExpression,{tc:current,t:'latam'});
 assert.deepEqual(Array.from(steps,q=>q.id),[0,2,3,7,10,18,1,13,14,17,11,12]);
 assert.equal(steps.find(q=>q.id===7).type,'appearance');
 assert.equal(steps.find(q=>q.id===3).type,'body');
 assert.equal(steps.find(q=>q.id===1).type,'profile');
 assert.ok(js.includes('[15,1,19].every(id=>!!x[id])'));
 assert.ok(js.includes('[3,4,5].every(id=>!!x[id])'));
 assert.ok(js.includes('[7,8,6].every(id=>!!x[id])'), 'exige as três escolhas antes de avançar');
 assert.ok(!js.includes('qzOrder='), 'não limita o questionário às sete perguntas anteriores');
 for (const q of current) for (const path of [q.headerImage, ...q.options?.map(o=>o.imagePath)||[]].filter(Boolean)) {
  assert.ok(fs.existsSync(new URL('../public'+path, import.meta.url)), path);
 }
});

test('nova versão mantém pagamento mexicano, pedidos pendentes e pixel exclusivo', () => {
 assert.ok(js.includes('d="nq_quiz_state_mx_br_v5"'), 'não mistura posições do questionário antigo');
 assert.ok(js.includes('ra="ck_pix_mx"') && js.includes('fi="ck_pago_mx"'), 'mantém retomada de pagamentos');
 assert.ok(js.includes('Gh="1641698144409525"') && js.includes('currency:"MXN"'));
 assert.ok(js.includes('/api/checkout?op=pix&site=mx'));
 assert.ok(js.includes('onCheckout:t==="latam"?()=>{stopFunnelMedia();h("checkout")}'));
 assert.ok(js.includes('version:"mx-br-20261022-sin-whatsapp"'));
 const html = read('public/mexico/index.html');
 assert.ok(html.includes('lang="es-MX"') && html.includes('index-mx.js?v=mx-br-20261022-sin-whatsapp'));
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



test('ordem original: nome da IA, nome da pessoa, depois revelação',()=>{
 const hooks=[],saved=new Map(),events=[],names=[];let cursor=0;
 const preview={nameTitle:'IA_NAME',nameSubtitle:'',namePlaceholder:'',nameButton:'Continuar',userNameTitle:n=>n+' USER_NAME',userNameSubtitle:'',userNamePlaceholder:'',userNameButton:'Continuar',typingTexts:()=>[],chatButton:'CHAT'};
 const context={w:{useState(initial){const pos=cursor++;if(!(pos in hooks))hooks[pos]=typeof initial==='function'?initial():initial;return[hooks[pos],value=>{hooks[pos]=value}]},useRef(initial){const pos=cursor++;return hooks[pos]??={current:initial}},useEffect(){}},
 i:{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},Yt:()=>({t:{preview}}),xa:()=>({image:'/character.webp',video:null}),Hu:()=>true,ii:()=>{},Cf:()=>{},wg:()=>{},De:()=>{},stopFunnelMedia:()=>{},
 localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},$:event=>events.push(event)};
 const start=js.indexOf('xg=({answers:');vm.runInNewContext(js.slice(start,js.indexOf(',gn=',start)),context);
 const render=()=>{cursor=0;return context.xg({answers:{},onNameSubmit:name=>names.push(name),onChatNow:()=>{}})};
 const find=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat()){const match=find(child,predicate);if(match)return match}return null};
 let screen=render();assert.equal(find(screen,n=>n.props?.className==='preview-title').props.children,'IA_NAME');
 find(screen,n=>n.type==='input').props.onChange({target:{value:'Luna'}});screen=render();find(screen,n=>n.type==='form').props.onSubmit({preventDefault(){}});
 screen=render();assert.equal(find(screen,n=>n.props?.className==='preview-title').props.children,'Luna USER_NAME');assert.deepEqual(names,['Luna']);
 find(screen,n=>n.type==='input').props.onChange({target:{value:'Carlos'}});screen=render();find(screen,n=>n.type==='form').props.onSubmit({preventDefault(){}});
 screen=render();assert.equal(saved.get('nq_nome'),'Carlos');assert.ok(find(screen,n=>n.props?.className==='chat-button'));
 assert.ok(!js.includes('mxPreview'));
});

test('checkout sem adicionais e antigos bumps oferecidos somente como upsells',()=>{
 const loading=text=>{const a=text.indexOf('dg=({onComplete:');return text.slice(a,text.indexOf(',_o=',a))};
 assert.equal(loading(js),loading(original));
 assert.ok(js.includes('const qzL=["chamadadevoz","segundaparceira","vip"].map(id=>qzUps.find(u=>u.id===id))'));
 assert.ok(!js.includes('className:"ck-bumps"')&&!js.includes('checked:y.has(id)'));
 assert.ok(js.includes('[y,j]=w.useState(new Set)'),'adicionais não pré-selecionados');
});


test('retomada de sessões antigas não acessa pergunta inexistente',()=>{
 const context={};vm.runInNewContext(read('tools/mx-quiz-state.js'),context);
 const state={phase:'questions',currentQuestion:18,answers:{0:'normal'},characterName:'Luna',ts:Date.now()};
 for(const [value,want] of [[18,17],[999,17],[-1,0],['18',0],[null,0],[17,17]]){
  const restored=context.mxQuizState(JSON.stringify({...state,currentQuestion:value}),18);
  assert.equal(restored.currentQuestion,want);assert.equal(restored.characterName,'Luna');
 }
 assert.equal(context.mxQuizState('{',18),null);
 assert.equal(context.mxQuizState(JSON.stringify({...state,phase:'invalid'}),18),null);
 assert.equal(context.mxQuizState(JSON.stringify({...state,ts:1}),18),null);
 const restored=context.mxQuizState(JSON.stringify({...state,answers:null,characterName:42}),18);
 assert.equal(JSON.stringify(restored.answers),'{}');assert.equal(restored.characterName,'');
 assert.ok(js.includes('mxQuizState(q,tc.filter(q=>![4,5,6,8,9,15,16].includes(q.id)).length)'));
});


test('checkout mexicano não pede nem exige telefone para gerar pagamento',()=>{
 assert.ok(!js.includes('ref:U.phone,type:"tel"'));
 assert.ok(js.includes('const O=Zu({...k,phone:""});Zt.current=O;'));
 const start=js.indexOf('Ju=(e,t=!0)=>');const end=js.indexOf(',Zu=',start);
 const context={jv:()=>false};vm.runInNewContext(js.slice(start,end),context);
 assert.equal(context.Ju({name:'Carlos',email:'carlos@example.test',phone:'',document:''}),null);
});

test('perfil usa três esteiras horizontais e preserva a escolha ao navegar', () => {
 const start=js.indexOf('qzProfileRail='), end=js.indexOf(',qzAppearanceRail=',start);
 const calls=[], scrolling=[], rail={clientWidth:320,scrollBy:value=>scrolling.push(value),scrollTo:value=>scrolling.push(value)};
 const element=(type,props,key)=>({type,props,key});
 const {qzProfileStep,qzProfileRail}=vm.runInNewContext('(()=>{const '+js.slice(start,end)+';return {qzProfileStep,qzProfileRail}})()',{
  w:{useRef:()=>({current:rail})},i:{jsx:element,jsxs:element}
 });
 const tree=qzProfileStep({questions:questions(js),answers:{19:'nurse'},onPick:(...args)=>calls.push(args),lang:'es',country:'AR'});
 const rows=tree.props.children.slice(1);
 assert.equal(rows.length,3);
 assert.equal(rows[0].props.group.options.length,10);
 assert.equal(rows[2].props.group.options.length,8);
 assert.equal(rows[2].props.group.options.find(o=>o.value==='waitress').label,'☕ Camarera');
 const rendered=qzProfileRail(rows[2].props), track=rendered.props.children[1];
 assert.equal(track.props.style.overflowX,'auto');
 assert.equal(track.props.style.scrollSnapType,'x mandatory');
 const nurse=track.props.children.find(card=>card.key==='job-nurse');
 assert.equal(nurse.props['aria-pressed'],true);
 nurse.props.onClick({currentTarget:{offsetLeft:284,offsetWidth:132}});
 assert.deepEqual(calls,[[19,'nurse']]);
 const arrows=rendered.props.children[0].props.children[2].props.children;
 arrows[1].props.onClick();
 assert.equal(scrolling.at(-1).left,152);
 assert.equal(calls.length,1,'deslizar não troca a seleção');
});
