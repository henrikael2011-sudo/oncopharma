import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('M10.2: homepage no longer claims M1',()=>{const t=read('apps/portal/app/page.tsx');assert.doesNotMatch(t,/Fundação M1/);assert.match(t,/M10\.2/)});
test('M10.2: Care never claims that reporting is impossible',()=>{const t=read('apps/portal/app/care/page.tsx');assert.doesNotMatch(t,/ainda não recebe relatos/);assert.match(t,/não há equipe monitorando/i)});
test('M10.2: Clinical states technical validation limits',()=>{const t=read('apps/portal/app/clinical/page.tsx');assert.match(t,/Sem validação integrada/)});
test('M10.2: brand care includes family and heart',()=>{const t=read('apps/portal/public/brand/care.svg');assert.match(t,/família e coração/)});
test('M10.2: brand clinical includes professional and infusion',()=>{const t=read('apps/portal/public/brand/clinical.svg');assert.match(t,/bolsa de infusão e profissional/)});
test('M10.2: plan baseline is preserved',()=>{assert.match(read('docs/product/PLANO_DIRETOR_V3_BASELINE.md'),/ONCOPHARMA/)});
