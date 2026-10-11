import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const url=process.env.DATABASE_URL;
const available=spawnSync('psql',['--version'],{encoding:'utf8'}).status===0;
const run=(sql)=>{const r=spawnSync('psql',[url,'-v','ON_ERROR_STOP=1','-Atqc',sql],{encoding:'utf8'});if(r.status!==0) throw new Error(r.stderr);return r.stdout.trim()};
test('M1.2: role sem privilégios de escrita clínica', {skip:!url||!available}, ()=>{
  assert.equal(run('SELECT current_user'), 'oncopharma_app');
  assert.equal(run("SELECT has_table_privilege(current_user, 'patients','INSERT')"),'f');
  assert.equal(run("SELECT has_table_privilege(current_user, 'patients','UPDATE')"),'f');
  assert.equal(run("SELECT has_table_privilege(current_user, 'patients','DELETE')"),'f');
  assert.equal(run("SELECT has_table_privilege(current_user, 'audit_events','INSERT')"),'t');
  assert.equal(run("SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user"),'f');
});
test('M1.2: isolamento RLS sem contexto e com organização incorreta', {skip:!url||!available}, ()=>{
  assert.equal(run('SELECT count(*) FROM patients'),'0');
  assert.equal(run("BEGIN; SELECT set_config('app.organization_id','33333333-3333-4333-8333-333333333333',true); SELECT count(*) FROM patients; ROLLBACK;").split('\n').includes('0'),true);
});
