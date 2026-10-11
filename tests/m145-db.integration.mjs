import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
// Run only against an ephemeral test DB, after bootstrap. Missing prerequisites FAIL;
// the evidence runner must mark the group BLOCKED before invoking it.
const setup = async () => {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.ok(process.env.DATABASE_URL_ADMIN && process.env.DATABASE_URL);
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN });
  const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect(); await app.connect();
  assert.equal((await admin.query('SELECT current_database() AS db')).rows[0].db, 'oncopharma_dev');
  const a = randomUUID(), b = randomUUID(), pa = randomUUID(), pb = randomUUID();
  await admin.query('INSERT INTO organizations(id,name) VALUES($1,$2),($3,$4)',[a,'Synthetic TEST A',b,'Synthetic TEST B']);
  await admin.query('INSERT INTO patients(id,organization_id,external_reference,synthetic) VALUES($1,$2,$3,true),($4,$5,$6,true)',[pa,a,'M14.5-A',pb,b,'M14.5-B']);
  return {admin,app,a,b,pa,pb};
};
test('M14.5 PostgreSQL: populated cross-tenant RLS, audit INSERT, escalation and transaction reset', async () => {
  const {admin,app,a,b,pa,pb} = await setup();
  try {
    const role=(await app.query('SELECT current_user AS name, rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.equal(role.name,'oncopharma_app'); assert.equal(role.rolsuper,false); assert.equal(role.rolbypassrls,false);
    assert.equal((await app.query('SELECT id FROM patients')).rowCount,0);
    await app.query('BEGIN'); await app.query("SELECT set_config('app.organization_id',$1,true)",[a]);
    assert.deepEqual((await app.query('SELECT id FROM patients WHERE id IN ($1,$2) ORDER BY id',[pa,pb])).rows.map(x=>x.id),[pa]);
    await app.query("INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type) VALUES($1,'synthetic-idp','synthetic-patient','m145.test','test')",[a]);
    await app.query('SAVEPOINT negative_audit');
    await assert.rejects(app.query("INSERT INTO audit_events(organization_id,actor_issuer,actor_sub,action,resource_type) VALUES($1,'synthetic-idp','synthetic-patient','m145.test','test')",[b]), e=>e.code==='42501');
    await app.query('ROLLBACK TO SAVEPOINT negative_audit');
    await app.query('SAVEPOINT escalation');
    const adminRole=(await admin.query('SELECT quote_ident(current_user) AS name')).rows[0].name;
    await assert.rejects(app.query('SET ROLE '+adminRole),e=>e.code==='42501');
    await app.query('ROLLBACK TO SAVEPOINT escalation'); await app.query('ROLLBACK');
    assert.equal((await app.query('SELECT id FROM patients WHERE id=$1',[pa])).rowCount,0);
    // The privileged account DOES bypass RLS in PostgreSQL; prove the runner refuses it.
    const privileged=(await admin.query('SELECT rolsuper OR rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user')).rows[0].bypass;
    assert.equal(privileged,true);
    const rejected=spawnSync(process.execPath,['tests/require-postgres.mjs'],{env:{...process.env,DATABASE_URL:process.env.DATABASE_URL_ADMIN},encoding:'utf8'});
    assert.equal(rejected.status,2);
    console.log('Synthetic tenants isolated; same-tenant audit INSERT allowed; cross-tenant INSERT and runtime escalation rejected; admin prerequisite rejected.');
  } finally {await app.end();await admin.end();}
});
