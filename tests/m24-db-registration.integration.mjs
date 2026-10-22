// M24 — migração 0019: RLS por organização, registro só nasce pendente/sintético, convite de uso único no banco,
// dados enviados imutáveis (UPDATE por coluna), sem DELETE, token/prazo do convite imutáveis.
import test from 'node:test'; import assert from 'node:assert/strict'; import { spawnSync } from 'node:child_process'; import { randomUUID, randomBytes } from 'node:crypto';
const APP = process.env.DATABASE_URL, ADMIN = process.env.DATABASE_URL_ADMIN;
const psql = (url, sql) => { const r = spawnSync('psql', ['-X', url, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', timeout: 15000 }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const must = (url, sql) => { const r = psql(url, sql); if (!r.ok) throw new Error(r.err); return r.out; };
const denied = (url, sql, re = /permission denied|row-level security|violates/i) => { const r = psql(url, sql); assert.equal(r.ok, false, sql); assert.match(r.err, re, r.err); };
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`; const tx = (org, body) => `BEGIN; SET LOCAL app.organization_id = ${lit(org)}; ${body}; COMMIT;`;
const F = { orgA: randomUUID(), orgB: randomUUID(), invA: randomUUID(), invA2: randomUUID() };
const h = () => `decode('${randomBytes(32).toString('hex')}','hex')`;
const iv = "decode('000000000000000000000000','hex')", tag = "decode('00000000000000000000000000000000','hex')";
const invite = (org, id, { used = 'NULL', exp = "now()+interval '3 days'" } = {}) => `INSERT INTO patient_registration_invites(id,organization_id,token_sha256,created_by_issuer,created_by_sub,created_by_role,expires_at,used_at) VALUES (${lit(id)},${lit(org)},${h()},'iss','sub','pharmacist',${exp},${used})`;
const regi = (org, inv, { status = 'pending_review', synth = true } = {}) => `INSERT INTO patient_registrations(organization_id,invite_id,display_name,payload_encrypted,payload_iv,payload_tag,key_id,submitted_by,consent_terms_version,consent_accepted_at,status,synthetic) VALUES (${lit(org)},${lit(inv)},'Paciente Fictício','\\x00'::bytea,${iv},${tag},'k','patient','cadastro-ficticio-v1',now(),${lit(status)},${synth})`;
test('fixtures', () => { assert.ok(APP && ADMIN, 'BLOQUEADO: DATABASE_URL/DATABASE_URL_ADMIN ausentes');
  must(ADMIN, `INSERT INTO organizations(id,name) VALUES (${lit(F.orgA)},'ORG SINT A m24'),(${lit(F.orgB)},'ORG SINT B m24')`); });
test('convites: RLS por organização; nascem abertos; validade máxima de 7 dias; token/prazo imutáveis', () => {
  must(APP, tx(F.orgA, invite(F.orgA, F.invA))); must(APP, tx(F.orgA, invite(F.orgA, F.invA2)));
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM patient_registration_invites WHERE id=${lit(F.invA)}`)), '0');
  assert.equal(must(APP, `SELECT count(*) FROM patient_registration_invites`), '0');
  denied(APP, tx(F.orgB, invite(F.orgA, randomUUID())));
  denied(APP, tx(F.orgA, invite(F.orgA, randomUUID(), { used: 'now()' })));
  denied(APP, tx(F.orgA, invite(F.orgA, randomUUID(), { exp: "now()+interval '8 days'" })), /invite_max_7d|check constraint/i);
  for (const col of [`token_sha256=${h()}`, "expires_at=now()+interval '1 day'", "created_by_sub='x'"]) denied(APP, tx(F.orgA, `UPDATE patient_registration_invites SET ${col} WHERE id=${lit(F.invA)}`));
  denied(APP, tx(F.orgA, `DELETE FROM patient_registration_invites WHERE id=${lit(F.invA)}`));
});
test('cadastro: só nasce pendente e sintético; uso único do convite no banco; RLS', () => {
  denied(APP, tx(F.orgA, regi(F.orgA, F.invA2, { status: 'confirmed' })));
  denied(APP, tx(F.orgA, regi(F.orgA, F.invA2, { synth: false })));
  denied(APP, tx(F.orgB, regi(F.orgA, F.invA2)));
  must(APP, tx(F.orgA, regi(F.orgA, F.invA)));
  denied(APP, tx(F.orgA, regi(F.orgA, F.invA)), /duplicate key|unique/i);
  assert.equal(must(APP, tx(F.orgA, `UPDATE patient_registration_invites SET used_at=now() WHERE id=${lit(F.invA)} AND used_at IS NULL RETURNING id`)), F.invA);
  assert.equal(must(APP, tx(F.orgA, `UPDATE patient_registration_invites SET used_at=now() WHERE id=${lit(F.invA)} AND used_at IS NULL RETURNING id`)), '', 'segunda marcação não acontece');
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM patient_registrations WHERE invite_id=${lit(F.invA)}`)), '0');
  assert.equal(must(APP, tx(F.orgA, `SELECT status FROM patient_registrations WHERE invite_id=${lit(F.invA)}`)), 'pending_review');
});
test('dados enviados imutáveis; conferência só por colunas permitidas e coerente; sem DELETE', () => {
  for (const col of ["display_name='Outro Nome'", "payload_encrypted='\\x01'::bytea", "submitted_by='caregiver'", 'consent_accepted_at=now()']) denied(APP, tx(F.orgA, `UPDATE patient_registrations SET ${col} WHERE invite_id=${lit(F.invA)}`));
  denied(APP, tx(F.orgA, `DELETE FROM patient_registrations WHERE invite_id=${lit(F.invA)}`));
  denied(APP, tx(F.orgA, `UPDATE patient_registrations SET status='confirmed' WHERE invite_id=${lit(F.invA)}`), /check constraint|registration_/i);
  assert.equal(must(APP, tx(F.orgA, `UPDATE patient_registrations SET status='rejected',reviewed_by_issuer='iss',reviewed_by_sub='farm',reviewed_by_role='pharmacist',reviewed_at=now(),review_note='Dados de teste' WHERE invite_id=${lit(F.invA)} RETURNING status`)), 'rejected');
  assert.equal(must(APP, tx(F.orgB, `UPDATE patient_registrations SET review_note='x' WHERE invite_id=${lit(F.invA)} RETURNING id`)), '');
});
