// M15.3 — migração 0010 (cuidador) em PostgreSQL real com a role restrita: prazos 72 h/90 dias, escopos fechados,
// revogação definitiva, sem DELETE, isolamento por organização. Fail-closed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
const APP = process.env.DATABASE_URL, ADMIN = process.env.DATABASE_URL_ADMIN;
const psql = (url, sql) => { const r = spawnSync('psql', ['-X', url, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', timeout: 15000 }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const must = (url, sql) => { const r = psql(url, sql); if (!r.ok) throw new Error(r.err); return r.out; };
const fails = (url, sql, re) => { const r = psql(url, sql); assert.equal(r.ok, false, `deveria falhar: ${sql}`); if (re) assert.match(r.err, re, r.err); };
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const tx = (org, body) => `BEGIN; SET LOCAL app.organization_id = ${lit(org)}; ${body}; COMMIT;`;
const ISS = 'https://idp.synthetic.invalid/realms/oncopharma-test';
const F = { orgA: randomUUID(), orgB: randomUUID(), pat: randomUUID(), inv: randomUUID(), inv2: randomUUID(), link: randomUUID() };
const h = () => createHash('sha256').update(randomUUID()).digest('hex');
const invite = (id, extra = "now()+interval '72 hours'") => `INSERT INTO caregiver_invites(id,organization_id,patient_id,code_hash,term_days,created_by_issuer,created_by_sub,expires_at) VALUES (${lit(id)},${lit(F.orgA)},${lit(F.pat)},${lit(h())},30,${lit(ISS)},'p',${extra})`;
test('fixtures sintéticas', () => {
  assert.ok(APP && ADMIN, 'BLOQUEADO: DATABASE_URL/DATABASE_URL_ADMIN ausentes');
  must(ADMIN, `INSERT INTO organizations(id,name) VALUES (${lit(F.orgA)},'ORG SINT A m153'),(${lit(F.orgB)},'ORG SINT B m153');
    INSERT INTO patients(id,organization_id,external_reference,synthetic) VALUES (${lit(F.pat)},${lit(F.orgA)},'M153-${F.pat.slice(0, 8)}',true);`);
});
test('convite: válido por no máximo 72 h; hash obrigatório; prazo 1..90; outra organização negada', () => {
  must(APP, tx(F.orgA, invite(F.inv)));
  fails(APP, tx(F.orgA, invite(randomUUID(), "now()+interval '73 hours'")), /invite_72h/);
  fails(APP, tx(F.orgA, `INSERT INTO caregiver_invites(organization_id,patient_id,code_hash,term_days,created_by_issuer,created_by_sub,expires_at) VALUES (${lit(F.orgA)},${lit(F.pat)},'CODIGO-EM-CLARO',30,'i','p',now())`), /code_hash/);
  fails(APP, tx(F.orgA, `INSERT INTO caregiver_invites(organization_id,patient_id,code_hash,term_days,created_by_issuer,created_by_sub,expires_at) VALUES (${lit(F.orgA)},${lit(F.pat)},${lit(h())},91,'i','p',now())`), /term_days/);
  fails(APP, tx(F.orgB, invite(randomUUID())), /row-level security/);
  fails(APP, tx(F.orgA, `UPDATE caregiver_invites SET code_hash=${lit(h())} WHERE id=${lit(F.inv)}`), /permission denied/);
  fails(APP, tx(F.orgA, `DELETE FROM caregiver_invites WHERE id=${lit(F.inv)}`), /permission denied/);
});
test('vínculo: nasce sem escopos; escopos fechados; prazo ≤ 90 dias; revogação definitiva; sem DELETE', () => {
  must(APP, tx(F.orgA, `INSERT INTO caregiver_links(id,organization_id,patient_id,invite_id,caregiver_issuer,caregiver_sub,expires_at,consent_accepted_at) VALUES (${lit(F.link)},${lit(F.orgA)},${lit(F.pat)},${lit(F.inv)},${lit(ISS)},'cg',now()+interval '90 days',now())`));
  assert.equal(must(APP, tx(F.orgA, `SELECT array_length(scopes,1) IS NULL FROM caregiver_links WHERE id=${lit(F.link)}`)), 't');
  must(ADMIN, invite(F.inv2).replace(`'p',`, `'p',`));
  fails(APP, tx(F.orgA, `INSERT INTO caregiver_links(organization_id,patient_id,invite_id,caregiver_issuer,caregiver_sub,expires_at,consent_accepted_at) VALUES (${lit(F.orgA)},${lit(F.pat)},${lit(F.inv2)},${lit(ISS)},'cg2',now()+interval '91 days',now())`), /link_90d/);
  fails(APP, tx(F.orgA, `INSERT INTO caregiver_links(organization_id,patient_id,invite_id,caregiver_issuer,caregiver_sub,expires_at,consent_accepted_at) VALUES (${lit(F.orgA)},${lit(F.pat)},${lit(F.inv)},${lit(ISS)},'cg3',now()+interval '1 day',now())`), /unique|duplicate/i);
  fails(APP, tx(F.orgA, `UPDATE caregiver_links SET scopes=ARRAY['ver_tudo'] WHERE id=${lit(F.link)}`), /check constraint/);
  must(APP, tx(F.orgA, `UPDATE caregiver_links SET scopes=ARRAY['ver_jornada'] WHERE id=${lit(F.link)}`));
  fails(APP, tx(F.orgA, `UPDATE caregiver_links SET expires_at=now()+interval '1 year' WHERE id=${lit(F.link)}`), /permission denied/);
  fails(APP, tx(F.orgA, `UPDATE caregiver_links SET caregiver_sub='outro' WHERE id=${lit(F.link)}`), /permission denied/);
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM caregiver_links WHERE id=${lit(F.link)}`)), '0');
  must(APP, tx(F.orgA, `UPDATE caregiver_links SET revoked_at=now() WHERE id=${lit(F.link)}`));
  fails(APP, tx(F.orgA, `UPDATE caregiver_links SET revoked_at=NULL WHERE id=${lit(F.link)}`), /revogado é imutável/);
  fails(APP, tx(F.orgA, `UPDATE caregiver_links SET scopes=ARRAY['ver_medicamentos'] WHERE id=${lit(F.link)}`), /revogado é imutável/);
  fails(APP, tx(F.orgA, `DELETE FROM caregiver_links WHERE id=${lit(F.link)}`), /permission denied/);
});
test('histórico de acessos: inserção e leitura no tenant; sem UPDATE/DELETE', () => {
  must(APP, tx(F.orgA, `INSERT INTO caregiver_access_events(organization_id,patient_id,link_id,action) VALUES (${lit(F.orgA)},${lit(F.pat)},${lit(F.link)},'care.home.read')`));
  assert.equal(must(APP, tx(F.orgA, `SELECT count(*) FROM caregiver_access_events WHERE link_id=${lit(F.link)}`)), '1');
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM caregiver_access_events WHERE link_id=${lit(F.link)}`)), '0');
  fails(APP, tx(F.orgA, `UPDATE caregiver_access_events SET action='care.x' WHERE link_id=${lit(F.link)}`), /permission denied/);
  fails(APP, tx(F.orgA, `DELETE FROM caregiver_access_events WHERE link_id=${lit(F.link)}`), /permission denied/);
  fails(APP, tx(F.orgA, `INSERT INTO caregiver_access_events(organization_id,patient_id,link_id,action) VALUES (${lit(F.orgA)},${lit(F.pat)},${lit(F.link)},'DROP TABLE')`), /check constraint/);
});
