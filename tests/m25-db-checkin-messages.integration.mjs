// M25 — migração 0020: check-in diário (um por dia, edição só no mesmo dia, sem DELETE) e mensagens Care ↔ equipe
// (RLS por organização, direção coerente com o autor, texto/autoria imutáveis — só read_at muda).
import test from 'node:test'; import assert from 'node:assert/strict'; import { spawnSync } from 'node:child_process'; import { randomUUID } from 'node:crypto';
const APP = process.env.DATABASE_URL, ADMIN = process.env.DATABASE_URL_ADMIN;
const psql = (url, sql) => { const r = spawnSync('psql', ['-X', url, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', timeout: 15000 }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const must = (url, sql) => { const r = psql(url, sql); if (!r.ok) throw new Error(r.err); return r.out; };
const denied = (url, sql, re = /permission denied|row-level security|violates/i) => { const r = psql(url, sql); assert.equal(r.ok, false, sql); assert.match(r.err, re, r.err); };
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`; const tx = (org, body) => `BEGIN; SET LOCAL app.organization_id = ${lit(org)}; ${body}; COMMIT;`;
const F = { orgA: randomUUID(), orgB: randomUUID(), pA: randomUUID(), ck: randomUUID(), old: randomUUID(), msg: randomUUID() };
const iv = "decode('000000000000000000000000','hex')", tag = "decode('00000000000000000000000000000000','hex')";
const checkin = (org, id, { date = 'current_date', feeling = 'bem', synth = true } = {}) => `INSERT INTO patient_daily_checkins(id,organization_id,patient_id,checkin_date,feeling,recorded_by,actor_issuer,actor_sub,synthetic) VALUES (${lit(id)},${lit(org)},${lit(F.pA)},${date},${lit(feeling)},'patient','iss','sub',${synth})`;
const message = (org, id, { dir = 'to_team', role = 'patient' } = {}) => `INSERT INTO care_team_messages(id,organization_id,patient_id,direction,author_role,actor_issuer,actor_sub,body_encrypted,body_iv,body_tag,key_id,source_reference) VALUES (${lit(id)},${lit(org)},${lit(F.pA)},${lit(dir)},${lit(role)},'iss','sub','\\x00'::bytea,${iv},${tag},'k',${lit('t:' + id)})`;
test('fixtures', () => { assert.ok(APP && ADMIN, 'BLOQUEADO: DATABASE_URL/DATABASE_URL_ADMIN ausentes');
  must(ADMIN, `INSERT INTO organizations(id,name) VALUES (${lit(F.orgA)},'ORG SINT A m25'),(${lit(F.orgB)},'ORG SINT B m25')`);
  must(ADMIN, `INSERT INTO patients(id,organization_id,external_reference,synthetic) VALUES (${lit(F.pA)},${lit(F.orgA)},'M25-A-${F.pA.slice(0, 8)}',true)`);
  must(ADMIN, `${checkin(F.orgA, F.old, { date: "current_date - 1" })}`); });
test('check-in: RLS, um por dia, sentimento fechado, só sintético', () => {
  must(APP, tx(F.orgA, checkin(F.orgA, F.ck)));
  denied(APP, tx(F.orgA, checkin(F.orgA, randomUUID())), /duplicate key|unique/i);
  denied(APP, tx(F.orgA, checkin(F.orgA, randomUUID(), { date: 'current_date + 1', feeling: 'otimo' })), /check constraint|violates/i);
  denied(APP, tx(F.orgB, checkin(F.orgA, randomUUID(), { date: 'current_date + 2' })));
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM patient_daily_checkins WHERE id=${lit(F.ck)}`)), '0');
  assert.equal(must(APP, `SELECT count(*) FROM patient_daily_checkins`), '0');
});
test('check-in: edição só no mesmo dia e só colunas permitidas; sem DELETE', () => {
  assert.equal(must(APP, tx(F.orgA, `UPDATE patient_daily_checkins SET feeling='mal',edit_count=edit_count+1,updated_at=now() WHERE id=${lit(F.ck)} RETURNING feeling`)), 'mal');
  assert.equal(must(APP, tx(F.orgA, `UPDATE patient_daily_checkins SET feeling='mal' WHERE id=${lit(F.old)} RETURNING id`)), '', 'dia anterior não é alterado (RLS)');
  for (const col of ['checkin_date=current_date', `patient_id=${lit(randomUUID())}`, 'created_at=now()', 'synthetic=false']) denied(APP, tx(F.orgA, `UPDATE patient_daily_checkins SET ${col} WHERE id=${lit(F.ck)}`));
  denied(APP, tx(F.orgA, `DELETE FROM patient_daily_checkins WHERE id=${lit(F.ck)}`));
});
test('mensagens: RLS, direção coerente com autor, texto imutável, só read_at muda, sem DELETE', () => {
  must(APP, tx(F.orgA, message(F.orgA, F.msg)));
  must(APP, tx(F.orgA, message(F.orgA, randomUUID(), { dir: 'to_patient', role: 'pharmacist' })));
  denied(APP, tx(F.orgA, message(F.orgA, randomUUID(), { dir: 'to_team', role: 'pharmacist' })), /message_author_direction|check constraint/i);
  denied(APP, tx(F.orgB, message(F.orgA, randomUUID())));
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM care_team_messages WHERE id=${lit(F.msg)}`)), '0');
  assert.notEqual(must(APP, tx(F.orgA, `UPDATE care_team_messages SET read_at=now() WHERE id=${lit(F.msg)} RETURNING read_at`)), '');
  for (const col of ["body_encrypted='\\x01'::bytea", "author_role='caregiver'", "direction='to_patient'"]) denied(APP, tx(F.orgA, `UPDATE care_team_messages SET ${col} WHERE id=${lit(F.msg)}`));
  denied(APP, tx(F.orgA, `DELETE FROM care_team_messages WHERE id=${lit(F.msg)}`));
});
