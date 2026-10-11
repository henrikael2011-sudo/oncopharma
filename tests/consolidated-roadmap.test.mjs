import test from 'node:test'; import assert from 'node:assert/strict'; import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('migration gates to dev',()=>assert.match(read('infra/migrations/0006_clinical_workflow.sql'),/Somente oncopharma_dev/));
test('no write grants to app role',()=>assert.doesNotMatch(read('infra/migrations/0006_clinical_workflow.sql'),/GRANT\s+(INSERT|UPDATE|DELETE)\s+ON/i));
test('human approval required for guidance',()=>assert.match(read('infra/migrations/0006_clinical_workflow.sql'),/guidance_approval/));
test('pilot marked no-go',()=>assert.match(read('docs/quality/CRITERIOS_PILOTO_M8.md'),/NO-GO/));
test('rules engine included',()=>assert.ok(existsSync(new URL('../packages/clinical-rules/src/index.mjs',import.meta.url))));
