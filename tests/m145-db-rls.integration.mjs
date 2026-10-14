// M14.5 — testes negativos de RLS/privilégios em PostgreSQL real (somente banco efêmero oncopharma_dev).
// Fail-closed: sem DATABASE_URL (role restrita) e DATABASE_URL_ADMIN (fixtures sintéticas) o teste FALHA, não é pulado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const APP = process.env.DATABASE_URL;
const ADMIN = process.env.DATABASE_URL_ADMIN;
function psql(url, sql) {
  const r = spawnSync('psql', ['-X', url, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', timeout: 15000 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
const must = (url, sql) => { const r = psql(url, sql); if (!r.ok) throw new Error(r.err); return r.out; };
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
// SET LOCAL equivale a set_config(..., true) usado pela API: contexto restrito à transação.
const tx = (org, body) => `BEGIN; SET LOCAL app.organization_id = ${lit(org)}; ${body}; COMMIT;`;

const ISS = 'https://idp.synthetic.invalid/realms/oncopharma-test';
const F = { orgA: randomUUID(), orgB: randomUUID(), patA: randomUUID(), patA2: randomUUID(), patB: randomUUID(), subA: 'synthetic-patient-a-' + randomUUID(), subB: 'synthetic-patient-b-' + randomUUID() };

test('M14.5 pré-condições: URLs configuradas, banco DEV, role restrita', () => {
  assert.ok(APP, 'BLOQUEADO: DATABASE_URL (role oncopharma_app) ausente');
  assert.ok(ADMIN, 'BLOQUEADO: DATABASE_URL_ADMIN ausente (necessária só para fixtures sintéticas efêmeras)');
  assert.equal(must(ADMIN, 'SELECT current_database()'), 'oncopharma_dev');
  assert.equal(must(APP, 'SELECT current_user'), 'oncopharma_app');
  // Fixtures 100% sintéticas, em duas organizações novas a cada execução (idempotente, sem dados reais).
  must(ADMIN, `
    INSERT INTO organizations(id,name) VALUES (${lit(F.orgA)},'ORG SINTÉTICA A (teste M14.5)'),(${lit(F.orgB)},'ORG SINTÉTICA B (teste M14.5)');
    INSERT INTO patients(id,organization_id,external_reference,synthetic) VALUES (${lit(F.patA)},${lit(F.orgA)},'SINT-A-${F.patA.slice(0,8)}',true),(${lit(F.patA2)},${lit(F.orgA)},'SINT-A2-${F.patA2.slice(0,8)}',true),(${lit(F.patB)},${lit(F.orgB)},'SINT-B-${F.patB.slice(0,8)}',true);
    INSERT INTO patient_portal_links(organization_id,patient_id,oidc_issuer,oidc_sub) VALUES (${lit(F.orgA)},${lit(F.patA)},${lit(ISS)},${lit(F.subA)}),(${lit(F.orgB)},${lit(F.patB)},${lit(ISS)},${lit(F.subB)});`);
});

test('RLS cross-tenant: contexto da org A não enxerga paciente/vínculo da org B', () => {
  assert.equal(must(APP, tx(F.orgA, `SELECT count(*) FROM patients WHERE id=${lit(F.patB)}`)), '0');
  assert.equal(must(APP, tx(F.orgA, `SELECT count(*) FROM patients WHERE id=${lit(F.patA)}`)), '1');
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM patients WHERE organization_id=${lit(F.orgA)}`)), '0');
  assert.equal(must(APP, tx(F.orgA, `SELECT count(*) FROM patient_portal_links WHERE patient_id=${lit(F.patB)}`)), '0');
  assert.equal(must(APP, 'SELECT count(*) FROM patients'), '0', 'sem contexto não pode haver linhas visíveis');
});

test('patientId fornecido pelo cliente: vínculo de identidade da conta A não autoriza paciente B (nem na mesma org)', () => {
  // Mesma consulta usada pela API (workflow.controller.ts) para autorizar o relato Care.
  const q = (org, pat, sub) => tx(org, `SELECT count(*) FROM patient_portal_links l JOIN patients p ON p.id=l.patient_id AND p.organization_id=l.organization_id WHERE l.organization_id=${lit(org)} AND l.patient_id=${lit(pat)} AND l.oidc_issuer=${lit(ISS)} AND l.oidc_sub=${lit(sub)} AND l.active=true AND p.synthetic=true`);
  assert.equal(must(APP, q(F.orgA, F.patA, F.subA)), '1');
  assert.equal(must(APP, q(F.orgA, F.patA2, F.subA)), '0', 'mesma organização, paciente não vinculado à conta');
  assert.equal(must(APP, q(F.orgA, F.patB, F.subA)), '0');
  assert.equal(must(APP, q(F.orgB, F.patB, F.subA)), '0');
});

test('INSERT cross-tenant de relato/alerta/intervenção é negado pela política WITH CHECK', () => {
  const sym = psql(APP, tx(F.orgA, `INSERT INTO patient_symptom_reports(organization_id,patient_id,symptom_code,description,source,source_reference) VALUES (${lit(F.orgB)},${lit(F.patB)},'nausea','sintético','test',${lit(randomUUID())})`));
  assert.equal(sym.ok, false); assert.match(sym.err, /row-level security/);
  const alert = psql(APP, tx(F.orgA, `INSERT INTO clinical_alerts(organization_id,patient_id,code,level,rule_version,explanation) VALUES (${lit(F.orgB)},${lit(F.patB)},'symptom.nausea','needs_review','t','sintético')`));
  assert.equal(alert.ok, false); assert.match(alert.err, /row-level security/);
  const intv = psql(APP, tx(F.orgA, `INSERT INTO clinical_interventions(organization_id,patient_id,type,note,decision,actor_issuer,actor_sub) VALUES (${lit(F.orgB)},${lit(F.patB)},'clinical_review','x','pending',${lit(ISS)},'x')`));
  assert.equal(intv.ok, false); assert.match(intv.err, /row-level security/);
  const nonSynthetic = psql(APP, tx(F.orgA, `INSERT INTO patient_symptom_reports(organization_id,patient_id,symptom_code,description,source,source_reference,synthetic) VALUES (${lit(F.orgA)},${lit(F.patA)},'nausea','x','test',${lit(randomUUID())},false)`));
  assert.equal(nonSynthetic.ok, false, 'relato não sintético deve ser rejeitado');
});

test('UPDATE cross-tenant de alerta não afeta linhas da outra organização', () => {
  const alertB = randomUUID();
  must(ADMIN, `INSERT INTO clinical_alerts(id,organization_id,patient_id,code,level,rule_version,explanation) VALUES (${lit(alertB)},${lit(F.orgB)},${lit(F.patB)},'symptom.nausea','needs_review','t','sintético')`);
  const r = psql(APP, tx(F.orgA, `UPDATE clinical_alerts SET status='resolved' WHERE id=${lit(alertB)} RETURNING id`));
  // RETURNING exige SELECT (concedido) — a linha da org B é invisível, então nada retorna.
  assert.equal(r.ok, true, r.err); assert.equal(r.out, '');
  assert.equal(must(ADMIN, `SELECT status FROM clinical_alerts WHERE id=${lit(alertB)}`), 'awaiting_review'); // M15.4: estado inicial §5.1
});

test('audit_events: INSERT só no tenant do contexto; sem leitura, UPDATE ou DELETE pela role da API', () => {
  const ok = psql(APP, tx(F.orgA, `INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type) VALUES (${lit(F.orgA)},${lit(ISS)},'t','test.m145','test')`));
  assert.equal(ok.ok, true, ok.err);
  const cross = psql(APP, tx(F.orgA, `INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type) VALUES (${lit(F.orgB)},${lit(ISS)},'t','test.m145','test')`));
  assert.equal(cross.ok, false); assert.match(cross.err, /row-level security/);
  const noCtx = psql(APP, `INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type) VALUES (${lit(F.orgA)},${lit(ISS)},'t','test.m145','test')`);
  assert.equal(noCtx.ok, false, 'sem contexto o INSERT deve falhar');
  assert.match(psql(APP, 'SELECT count(*) FROM audit_events').err, /permission denied/);
  assert.match(psql(APP, tx(F.orgA, `UPDATE audit_events SET action='x' WHERE organization_id=${lit(F.orgA)}`)).err, /permission denied/);
  assert.match(psql(APP, tx(F.orgA, `DELETE FROM audit_events WHERE organization_id=${lit(F.orgA)}`)).err, /permission denied/);
  // Mesmo a role administrativa não altera trilha (trigger append-only).
  assert.match(psql(ADMIN, `UPDATE audit_events SET action='x' WHERE organization_id=${lit(F.orgA)}`).err, /append-only/);
  assert.equal(must(ADMIN, `SELECT count(*) FROM audit_events WHERE organization_id=${lit(F.orgA)} AND action='test.m145'`), '1');
});

test('Bypass de superusuário/RLS: role da API não é superuser, não tem BYPASSRLS e não assume a role administrativa', () => {
  assert.equal(must(APP, "SELECT rolsuper::text||','||rolbypassrls::text||','||rolcreaterole::text||','||rolcreatedb::text FROM pg_roles WHERE rolname=current_user"), 'false,false,false,false');
  const adminUser = must(ADMIN, 'SELECT current_user');
  assert.equal(must(APP, `SELECT pg_has_role(current_user, ${lit(adminUser)}, 'MEMBER')`), 'f');
  const setRole = psql(APP, `SET ROLE ${adminUser}`);
  assert.equal(setRole.ok, false); assert.match(setRole.err, /permission denied/);
  // row_security=off para role sem BYPASSRLS faz a consulta falhar em vez de ignorar a política.
  const off = psql(APP, `SET row_security = off; SELECT count(*) FROM patients`);
  assert.equal(off.ok, false); assert.match(off.err, /row-level security/);
  // Escrita direta em tabelas clínicas sem GRANT é negada.
  // M15.4c: INSERT de paciente existe só para importação sintética confirmada (política exige synthetic+prontuário+nome).
  assert.match(psql(APP, tx(F.orgA, `INSERT INTO patients(organization_id,synthetic) VALUES (${lit(F.orgA)},true)`)).err, /permission denied|row-level security/);
  assert.match(psql(APP, tx(F.orgA, `UPDATE patients SET synthetic=false`)).err, /permission denied/);
  assert.match(psql(APP, `TRUNCATE patient_symptom_reports`).err, /permission denied/);
  // Informativo: a role administrativa (superuser em CI) IGNORA RLS. Por isso nunca deve ser usada pela API.
  assert.equal(must(ADMIN, `SELECT count(*) FROM patients WHERE id IN (${lit(F.patA)},${lit(F.patB)})`), '2');
});
