import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalogAr,createArPayment} from '../lib/argentina.js';

test('Argentina: catálogo em pesos e pagamento ainda não habilitado',async()=>{
 assert.equal(catalogAr.currency,'ARS');
 assert.ok(catalogAr.main.price>0&&Object.keys(catalogAr.upsells).length===6);
 await assert.rejects(createArPayment({name:'Juan',sid:'ar-1'}),e=>e.status===503&&/todavía no está habilitado/.test(e.message));
 const ar=fs.readFileSync(new URL('../public/assets/index-ar.js',import.meta.url),'utf8');
 assert.ok(ar.includes('&site=ar"')&&!ar.includes('&site=mx"')&&!ar.includes('MX$')&&ar.includes('currency:"ARS"')&&ar.includes('"es-AR"'));
});
