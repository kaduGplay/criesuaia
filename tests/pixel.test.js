import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('pixel único e Purchase só após status pago, sem duplicatas',async()=>{
 const storage=new Map(),scripts=[];
 const window={fetch:async()=>Response.json({status:'pending',amount:1989})};
 const context={window,document:{createElement:()=>({}),head:{appendChild:x=>scripts.push(x)}},location:{href:'https://example.test/',origin:'https://example.test',pathname:'/'},URL,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(fs.readFileSync(new URL('../public/meta-pixel.js',import.meta.url),'utf8'),context);
 assert.equal(window.fbq.queue.filter(x=>x[0]==='init').length,1);assert.equal(window.fbq.queue[0][1],'1422813852615307');
 await window.fetch('/api/checkout?op=status&hash=abc');await new Promise(r=>setTimeout(r,10));
 assert.equal(window.fbq.queue.filter(x=>x[1]==='Purchase').length,0);
 // Reload the helper with an already-created SDK and a confirmed backend response.
 window.fetch=async()=>Response.json({status:'paid',amount:1989,kind:'main'});
 vm.runInNewContext(fs.readFileSync(new URL('../public/meta-pixel.js',import.meta.url),'utf8'),context);
 await window.fetch('/api/checkout?op=status&hash=abc');await new Promise(r=>setTimeout(r,10));
 await window.fetch('/api/checkout?op=status&hash=abc');await new Promise(r=>setTimeout(r,10));
 const events=window.fbq.queue.filter(x=>x[1]==='Purchase');assert.equal(events.length,1);assert.equal(events[0][2].value,19.89);assert.equal(events[0][3].eventID,'purchase_abc');
 const bundle=fs.readFileSync(new URL('../source/brasil/index-B-OgTTgT.js',import.meta.url),'utf8');
 assert.ok(bundle.includes('ng=(e,t={},n=wf())=>n,'));
 assert.ok(!bundle.includes('Gh="1481680676270423"'));
 assert.equal(events[0][2].currency,'BRL');
});
test('Purchase do México sai em MXN',async()=>{
 const run=async(path,data)=>{const window={fetch:async()=>Response.json(data)};
  const context={window,document:{createElement:()=>({}),head:{appendChild:()=>{}}},location:{href:'https://example.test'+path,origin:'https://example.test',pathname:path},URL,localStorage:{getItem:()=>null,setItem:()=>{}}};
  vm.runInNewContext(fs.readFileSync(new URL('../public/meta-pixel.js',import.meta.url),'utf8'),context);
  await window.fetch('/api/checkout?op=status&hash=mx');await new Promise(r=>setTimeout(r,10));
  assert.equal(window.fbq.queue.find(x=>x[0]==='init')[1],'1641698144409525');
  return window.fbq.queue.find(x=>x[1]==='Purchase')[2].currency};
 assert.equal(await run('/mexico',{status:'paid',amount:9900,kind:'main',currency:'MXN'}),'MXN');
 assert.equal(await run('/mexico',{status:'paid',amount:9900,kind:'main'}),'MXN');
 const mx=fs.readFileSync(new URL('../public/assets/index-mx.js',import.meta.url),'utf8');
 assert.ok(!mx.includes('BRL')&&mx.includes('currency:"MXN"'));
});
