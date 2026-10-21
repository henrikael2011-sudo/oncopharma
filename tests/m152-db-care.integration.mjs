// M15.2 — migração 0009 (Care): RLS por organização, relato de adesão imutável, contatos somente leitura,
// R3 (resolução do paciente pela identidade). Banco efêmero oncopharma_dev; role restrita real. Fail-closed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const APP = process.env.DATABASE_URL, ADMIN = process.env.DATABASE_URL_ADMIN;
const psql = (url, sql) => { const r = spawnSync('psql', ['-X', url, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', timeout: 15000 }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const must = (url, sql) => { const r = psql(url, sql); if (!r.ok) throw new Error(r.err); return r.out; };
const denied = (url, sql) => { const r = psql(url, sql); assert.equal(r.ok, false, `deveria falhar: ${sql}`); assert.match(r.err, /permission denied|row-level security|violates row-level/i, r.err); };
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const tx = (org, body) => `BEGIN; SET LOCAL app.organization_id = ${lit(org)}; ${body}; COMMIT;`;
const ISS = 'https://idp.synthetic.invalid/realms/oncopharma-test';
const F = { orgA: randomUUID(), orgB: randomUUID(), patA: randomUUID(), patB: randomUUID(), ordA: randomUUID(), subA: 'm152-a-' + randomUUID(), subTwo: 'm152-dois-' + randomUUID() };

test('M15.2 pré-condições e fixtures sintéticas', () => {
  assert.ok(APP && ADMIN, 'BLOQUEADO: DATABASE_URL/DATABASE_URL_ADMIN ausentes');
  assert.equal(must(APP, 'SELECT current_user'), 'oncopharma_app');
  must(ADMIN, `INSERT INTO organizations(id,name) VALUES (${lit(F.orgA)},'ORG SINT A m152'),(${lit(F.orgB)},'ORG SINT B m152');
    INSERT INTO patients(id,organization_id,external_reference,synthetic) VALUES (${lit(F.patA)},${lit(F.orgA)},'M152-A-${F.patA.slice(0, 8)}',true),(${lit(F.patB)},${lit(F.orgB)},'M152-B-${F.patB.slice(0, 8)}',true);
    INSERT INTO patient_portal_links(organization_id,patient_id,oidc_issuer,oidc_sub) VALUES (${lit(F.orgA)},${lit(F.patA)},${lit(ISS)},${lit(F.subA)});
    ALTER TABLE clinical_medication_orders NO FORCE ROW LEVEL SECURITY;
    INSERT INTO clinical_medication_orders(id,organization_id,patient_id,medication,status,ordered_at,source_reference,route) VALUES (${lit(F.ordA)},${lit(F.orgA)},${lit(F.patA)},'Sintético oral','active',now(),'M152-${F.ordA.slice(0, 8)}','VO');
    ALTER TABLE clinical_medication_orders FORCE ROW LEVEL SECURITY;
    INSERT INTO organization_help_contacts(organization_id,label,phone) VALUES (${lit(F.orgA)},'Central sintética','0000');`);
});

test('R3: a resolução por identidade retorna exatamente o paciente vinculado; outro sujeito/organização => nenhum', () => {
  const q = (org, sub) => tx(org, `SELECT l.patient_id FROM patient_portal_links l JOIN patients p ON p.id=l.patient_id AND p.organization_id=l.organization_id WHERE l.organization_id=${lit(org)} AND l.oidc_issuer=${lit(ISS)} AND l.oidc_sub=${lit(sub)} AND l.active=true AND p.synthetic=true`);
  assert.equal(must(APP, q(F.orgA, F.subA)), F.patA);
  assert.equal(must(APP, q(F.orgB, F.subA)), '', 'mesmo sujeito em outra organização não resolve paciente');
  assert.equal(must(APP, q(F.orgA, 'desconhecido')), '');
});

test('preferências/consentimento: escrita só no tenant do contexto; leitura isolada', () => {
  must(APP, tx(F.orgA, `INSERT INTO patient_care_preferences(organization_id,patient_id,consent_terms_version,consent_accepted_at) VALUES (${lit(F.orgA)},${lit(F.patA)},'care-termos-2026-10',now()) ON CONFLICT (organization_id,patient_id) DO UPDATE SET font_scale='large'`));
  assert.equal(must(APP, tx(F.orgA, `SELECT count(*) FROM patient_care_preferences WHERE patient_id=${lit(F.patA)}`)), '1');
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM patient_care_preferences WHERE patient_id=${lit(F.patA)}`)), '0');
  assert.equal(must(APP, `SELECT count(*) FROM patient_care_preferences`), '0', 'sem contexto => zero linhas');
  denied(APP, tx(F.orgB, `INSERT INTO patient_care_preferences(organization_id,patient_id) VALUES (${lit(F.orgA)},${lit(F.patA)})`));
  denied(APP, tx(F.orgA, `DELETE FROM patient_care_preferences WHERE patient_id=${lit(F.patA)}`));
  denied(APP, tx(F.orgA, `UPDATE patient_care_preferences SET patient_id=${lit(F.patB)} WHERE patient_id=${lit(F.patA)}`));
  // consentimento exige versão + data juntos
  const r = psql(APP, tx(F.orgA, `UPDATE patient_care_preferences SET consent_accepted_at=NULL WHERE patient_id=${lit(F.patA)}`)); assert.equal(r.ok, false); assert.match(r.err, /consent_pair/);
});

test('adesão relatada: imutável, somente sintética, isolada por organização, idempotente', () => {
  const ref = randomUUID();
  const ins = (org, extra = '') => tx(org, `INSERT INTO patient_adherence_reports(organization_id,patient_id,order_id,status,source_reference,actor_issuer,actor_sub${extra ? ',synthetic' : ''}) VALUES (${lit(F.orgA)},${lit(F.patA)},${lit(F.ordA)},'taken',${lit(ref)},${lit(ISS)},${lit(F.subA)}${extra})`);
  must(APP, ins(F.orgA));
  assert.equal(psql(APP, ins(F.orgA)).ok, false, 'source_reference duplicado é recusado');
  denied(APP, ins(F.orgB));
  denied(APP, tx(F.orgA, `INSERT INTO patient_adherence_reports(organization_id,patient_id,order_id,status,source_reference,actor_issuer,actor_sub,synthetic) VALUES (${lit(F.orgA)},${lit(F.patA)},${lit(F.ordA)},'taken',${lit(randomUUID())},${lit(ISS)},${lit(F.subA)},false)`));
  denied(APP, tx(F.orgA, `UPDATE patient_adherence_reports SET status='missed' WHERE source_reference=${lit(ref)}`));
  denied(APP, tx(F.orgA, `DELETE FROM patient_adherence_reports WHERE source_reference=${lit(ref)}`));
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM patient_adherence_reports WHERE source_reference=${lit(ref)}`)), '0');
});

test('contatos de ajuda: leitura no tenant; aplicação não escreve', () => {
  assert.equal(must(APP, tx(F.orgA, `SELECT count(*) FROM organization_help_contacts`)), '1');
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM organization_help_contacts WHERE organization_id=${lit(F.orgA)}`)), '0');
  denied(APP, tx(F.orgA, `INSERT INTO organization_help_contacts(organization_id,label) VALUES (${lit(F.orgA)},'x')`));
});

test('M16 (P1): histórico do paciente lê o estado REAL do alerta (subconsulta de me/journey) sob RLS, isolado por organização', () => {
  const rep = randomUUID(), al = randomUUID(), rq = randomUUID();
  must(APP, tx(F.orgA, `INSERT INTO patient_symptom_reports(id,organization_id,patient_id,symptom_code,description,source,source_reference,triage_status,details,actor_issuer,actor_sub) VALUES (${lit(rep)},${lit(F.orgA)},${lit(F.patA)},'fatigue','Relato M16','care-portal',${lit(rq)},'pending','{}'::jsonb,${lit(ISS)},${lit(F.subA)});
    INSERT INTO clinical_alerts(id,organization_id,patient_id,source_report_id,code,level,status,rule_version,explanation) VALUES (${lit(al)},${lit(F.orgA)},${lit(F.patA)},${lit(rep)},'symptom.fatigue','needs_review','awaiting_review','care-demo-v1','M16')`));
  const q = (org) => tx(org, `SELECT r.id||'|'||coalesce((SELECT a.status FROM clinical_alerts a WHERE a.organization_id=r.organization_id AND a.source_report_id=r.id ORDER BY a.created_at DESC LIMIT 1),'-') FROM patient_symptom_reports r WHERE r.organization_id=${lit(org)} AND r.id=${lit(rep)}`);
  assert.equal(must(APP, q(F.orgA)), `${rep}|awaiting_review`, 'recém-criado => aguardando avaliação, nunca "recebido/avaliado"');
  assert.equal(must(APP, q(F.orgB)), '', 'outra organização não vê o relato nem o alerta');
});
