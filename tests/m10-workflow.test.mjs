import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// M15.2: relato do paciente migrou para care.controller.ts (R3); as garantias valem para o conjunto.
const ctl=['workflow','care'].map(n=>readFileSync(new URL(`../services/api/src/${n}.controller.ts`,import.meta.url),'utf8')).join('\n');
const sql=readFileSync(new URL('../infra/migrations/0007_m10_patient_links.sql',import.meta.url),'utf8');
// M15.1: bloqueio em produção centralizado em synthetic-mode.ts (prod nunca habilita).
test('M10 bloqueado em produção',()=>{assert.match(ctl,/syntheticApiEnabled\(\)/);assert.match(readFileSync(new URL('../services/api/src/synthetic-mode.ts',import.meta.url),'utf8'),/NODE_ENV === 'production' \? 'prod'/);});
test('M10 usa autenticação',()=>assert.match(ctl,/@UseGuards\(AuthGuard\)/));
test('M10 verifica vínculo paciente e atribuição profissional',()=>{assert.match(ctl,/patient_portal_links/);assert.match(ctl,/care_assignments/)});
test('M10 registra auditoria e idempotência',()=>{assert.match(ctl,/symptom.created/);assert.match(ctl,/source_reference=\$2/)});
test('M10 usa transações por tenant',()=>assert.match(ctl,/withTenant/));
test('M10 ativa RLS',()=>assert.match(sql,/FORCE ROW LEVEL SECURITY/));
