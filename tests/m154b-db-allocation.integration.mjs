// M15.4b — migração 0012 em PostgreSQL real (role restrita): alocação insert-only com substituição única, uma alocação
// vigente por paciente, origem coerente (hospital ⇔ execução de sincronização), divergência resolvida uma única vez, isolamento.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const APP = process.env.DATABASE_URL, ADMIN = process.env.DATABASE_URL_ADMIN;
const psql = (url, sql) => { const r = spawnSync('psql', ['-X', url, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', timeout: 15000 }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const must = (url, sql) => { const r = psql(url, sql); if (!r.ok) throw new Error(r.err); return r.out; };
const fails = (url, sql, re) => { const r = psql(url, sql); assert.equal(r.ok, false, `deveria falhar: ${sql}`); if (re) assert.match(r.err, re, r.err); };
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const tx = (org, body) => `BEGIN; SET LOCAL app.organization_id = ${lit(org)}; ${body}; COMMIT;`;
const ISS = 'https://idp.synthetic.invalid/realms/oncopharma-test';
const F = { orgA: randomUUID(), orgB: randomUUID(), pat: randomUUID(), run: randomUUID(), m1: randomUUID(), item: randomUUID() };
const who = `${lit(ISS)},'farm','pharmacist'`;
test('fixtures sintéticas', () => {
  assert.ok(APP && ADMIN, 'BLOQUEADO: DATABASE_URL/DATABASE_URL_ADMIN ausentes');
  must(ADMIN, `INSERT INTO organizations(id,name) VALUES (${lit(F.orgA)},'ORG SINT A m154b'),(${lit(F.orgB)},'ORG SINT B m154b');
    INSERT INTO patients(id,organization_id,external_reference,synthetic,display_name,hospital_record) VALUES (${lit(F.pat)},${lit(F.orgA)},'M154B-${F.pat.slice(0, 8)}',true,'Paciente Sintético Aloc','PR-${F.pat.slice(0, 6)}')`);
});
test('manual: registra autoria; somente uma vigente; histórico imutável (apenas substituição única)', () => {
  must(APP, tx(F.orgA, `INSERT INTO patient_allocations(id,organization_id,patient_id,unit,floor,room,bed,source,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES (${lit(F.m1)},${lit(F.orgA)},${lit(F.pat)},'Oncologia Clínica','3º andar','306','A','manual',${who})`));
  fails(APP, tx(F.orgA, `INSERT INTO patient_allocations(organization_id,patient_id,unit,source,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES (${lit(F.orgA)},${lit(F.pat)},'Outra unidade','manual',${who})`), /patient_allocation_current/);
  fails(APP, tx(F.orgA, `UPDATE patient_allocations SET room='999' WHERE id=${lit(F.m1)}`), /permission denied/);
  fails(ADMIN, `UPDATE patient_allocations SET room='999', superseded_at=now() WHERE id=${lit(F.m1)}`, /imutável/);
  fails(APP, tx(F.orgA, `DELETE FROM patient_allocations WHERE id=${lit(F.m1)}`), /permission denied/);
  fails(APP, tx(F.orgA, `INSERT INTO patient_allocations(organization_id,patient_id,unit,source,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES (${lit(F.orgA)},${lit(F.pat)},'X','hospital',${who})`), /allocation_origin|patient_allocation_current/);
  fails(APP, tx(F.orgA, `INSERT INTO patient_allocations(organization_id,patient_id,unit,source,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES (${lit(F.orgA)},${lit(F.pat)},'Unidade','manual',${lit(ISS)},'adm','technical_admin')`), /check constraint/);
});
test('sincronização: divergência com manual fica registrada e é resolvida uma única vez; hospital substitui o manual', () => {
  must(APP, tx(F.orgA, `INSERT INTO allocation_sync_runs(id,organization_id,source_system,source_format,adapter_version,fetched_at,actor_issuer,actor_sub,actor_role,received) VALUES (${lit(F.run)},${lit(F.orgA)},'Hospital simulado','hl7v2_adt','location-feed-0.1',now(),${who},1);
    INSERT INTO allocation_sync_items(id,organization_id,run_id,patient_id,hospital_record,unit,floor,room,bed,outcome) VALUES (${lit(F.item)},${lit(F.orgA)},${lit(F.run)},${lit(F.pat)},'PR-${F.pat.slice(0, 6)}','Oncologia Clínica','4º andar','410','B','conflict')`));
  fails(APP, tx(F.orgA, `INSERT INTO allocation_sync_items(organization_id,run_id,patient_id,hospital_record,unit,outcome) VALUES (${lit(F.orgA)},${lit(F.run)},NULL,'PR-X1','Unidade','updated')`), /sync_item_patient/);
  fails(APP, tx(F.orgA, `UPDATE allocation_sync_items SET unit='trocada' WHERE id=${lit(F.item)}`), /permission denied/);
  must(APP, tx(F.orgA, `UPDATE patient_allocations SET superseded_at=now() WHERE id=${lit(F.m1)};
    INSERT INTO patient_allocations(organization_id,patient_id,unit,floor,room,bed,source,sync_run_id,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES (${lit(F.orgA)},${lit(F.pat)},'Oncologia Clínica','4º andar','410','B','hospital',${lit(F.run)},${who});
    UPDATE allocation_sync_items SET resolved_at=now(), resolved_by_sub='farm', resolution='accepted_hospital' WHERE id=${lit(F.item)}`));
  fails(APP, tx(F.orgA, `UPDATE allocation_sync_items SET resolved_at=now(), resolved_by_sub='outro', resolution='kept_manual' WHERE id=${lit(F.item)}`), /já resolvida/);
  fails(APP, tx(F.orgA, `UPDATE patient_allocations SET superseded_at=now() WHERE id=${lit(F.m1)}`), /imutável/);
  assert.equal(must(ADMIN, `SELECT string_agg(source||':'||(superseded_at IS NULL), ',' ORDER BY recorded_at) FROM patient_allocations WHERE patient_id=${lit(F.pat)}`), 'manual:false,hospital:true');
});
test('isolamento: outra organização não lê nem grava; sem contexto, nada', () => {
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM patient_allocations WHERE patient_id=${lit(F.pat)}`)), '0');
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM allocation_sync_runs WHERE id=${lit(F.run)}`)), '0');
  assert.equal(must(APP, `SELECT count(*) FROM allocation_sync_items WHERE id=${lit(F.item)}`), '0');
  fails(APP, tx(F.orgB, `INSERT INTO patient_allocations(organization_id,patient_id,unit,source,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES (${lit(F.orgA)},${lit(F.pat)},'Invasão','manual',${who})`), /row-level security/);
  assert.equal(must(APP, tx(F.orgB, `UPDATE allocation_sync_items SET resolved_at=now(), resolved_by_sub='x', resolution='kept_manual' WHERE id=${lit(F.item)} RETURNING id`)), '');
});
