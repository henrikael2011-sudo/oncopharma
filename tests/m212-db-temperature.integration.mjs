// M21.2 — migração 0016: RLS por organização (outra organização não lê), escrita só no tenant e sintética, imutável.
import test from 'node:test'; import assert from 'node:assert/strict'; import { spawnSync } from 'node:child_process'; import { randomUUID } from 'node:crypto';
const APP = process.env.DATABASE_URL, ADMIN = process.env.DATABASE_URL_ADMIN;
const psql = (url, sql) => { const r = spawnSync('psql', ['-X', url, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', timeout: 15000 }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const must = (url, sql) => { const r = psql(url, sql); if (!r.ok) throw new Error(r.err); return r.out; };
const denied = (url, sql) => { const r = psql(url, sql); assert.equal(r.ok, false, sql); assert.match(r.err, /permission denied|row-level security/i, r.err); };
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`; const tx = (org, body) => `BEGIN; SET LOCAL app.organization_id = ${lit(org)}; ${body}; COMMIT;`;
const F = { orgA: randomUUID(), orgB: randomUUID(), patA: randomUUID(), patB: randomUUID() };
const ins = (org, pat, ref, synth = true) => `INSERT INTO patient_temperature_readings(organization_id,patient_id,value_encrypted,value_iv,value_tag,key_id,measured_at,recorded_by,actor_issuer,actor_sub,source_reference,synthetic) VALUES (${lit(org)},${lit(pat)},'\\x00'::bytea,decode('000000000000000000000000','hex'),decode('00000000000000000000000000000000','hex'),'k',now(),'patient','iss','sub',${lit(ref)},${synth})`;
test('fixtures', () => { assert.ok(APP && ADMIN, 'BLOQUEADO: DATABASE_URL/DATABASE_URL_ADMIN ausentes');
  must(ADMIN, `INSERT INTO organizations(id,name) VALUES (${lit(F.orgA)},'ORG SINT A m212'),(${lit(F.orgB)},'ORG SINT B m212'); INSERT INTO patients(id,organization_id,external_reference,synthetic) VALUES (${lit(F.patA)},${lit(F.orgA)},'M212-A-${F.patA.slice(0, 8)}',true),(${lit(F.patB)},${lit(F.orgB)},'M212-B-${F.patB.slice(0, 8)}',true);`); });
test('RLS: leitura só no tenant; sem contexto zero; outra organização não lê', () => {
  must(APP, tx(F.orgA, ins(F.orgA, F.patA, 'm212-' + randomUUID())));
  assert.equal(must(APP, tx(F.orgA, `SELECT count(*) FROM patient_temperature_readings WHERE patient_id=${lit(F.patA)}`)), '1');
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM patient_temperature_readings WHERE patient_id=${lit(F.patA)}`)), '0');
  assert.equal(must(APP, `SELECT count(*) FROM patient_temperature_readings`), '0');
  denied(APP, tx(F.orgB, ins(F.orgA, F.patA, 'm212-' + randomUUID())));
  denied(APP, tx(F.orgA, ins(F.orgA, F.patA, 'm212-' + randomUUID(), false)));
});
test('imutável: sem UPDATE/DELETE para a aplicação; faixa de iv/tag validada', () => {
  denied(APP, tx(F.orgA, `UPDATE patient_temperature_readings SET key_id='x' WHERE patient_id=${lit(F.patA)}`));
  denied(APP, tx(F.orgA, `DELETE FROM patient_temperature_readings WHERE patient_id=${lit(F.patA)}`));
  assert.equal(psql(APP, tx(F.orgA, ins(F.orgA, F.patA, 'm212-x').replace("decode('000000000000000000000000','hex')", "'\\x00'::bytea"))).ok, false);
});
