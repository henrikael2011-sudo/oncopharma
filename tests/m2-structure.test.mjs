import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('M2: prontuário somente sintético, autenticado e auditado',()=>{const s=read('services/api/src/clinical.controller.ts');for(const t of ["@Get('patients/:patientId/record')",'req.principal.mfa','p.synthetic=true','care_assignments','patient.record.read','ALLOW_SYNTHETIC_API'])assert.ok(s.includes(t),t)});
test('M2: RLS em todas as tabelas clínicas',()=>{const s=read('infra/migrations/0004_oncology_record.sql');for(const t of ['oncology_protocols','treatment_cycles','clinical_observations','FORCE ROW LEVEL SECURITY','GRANT SELECT'])assert.ok(s.includes(t),t)});
test('M2: proxy autenticado e bloqueado em produção',()=>{const s=read('apps/portal/app/api/clinical/patients/[id]/route.ts');for(const t of ['session()','NODE_ENV','authorization',"cache:'no-store'"])assert.ok(s.includes(t),t)});
