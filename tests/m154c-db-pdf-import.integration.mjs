// M15.4c — migração 0013 em PostgreSQL real (role restrita): conteúdo cifrado gravável mas não legível pela aplicação;
// importação decidida uma única vez; linha aplicada imutável; paciente criado só sintético; vínculo só com o próprio
// importador e só para paciente criado por linha aplicada; alocação "pdf" exige importação; isolamento por organização.
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
const F = { orgA: randomUUID(), orgB: randomUUID(), imp: randomUUID(), row: randomUUID(), pat: randomUUID(), other: randomUUID() };
const rec = `PR-C${F.pat.slice(0, 6)}`;
const impSql = (id, org) => `INSERT INTO pdf_imports(id,organization_id,file_name,sha256,size_bytes,layout_id,layout_label,encrypted,iv,tag,key_id,uploaded_by_issuer,uploaded_by_sub,uploaded_by_role)
  VALUES (${lit(id)},${lit(org)},'censo.pdf',${lit('a'.repeat(64))},1000,'tasy-censo-v1','Tasy — censo','\\x00ff'::bytea,decode(repeat('00',12),'hex'),decode(repeat('00',16),'hex'),'k-000000001',${lit(ISS)},'farm','pharmacist')`;
test('fixtures sintéticas', () => {
  assert.ok(APP && ADMIN, 'BLOQUEADO: DATABASE_URL/DATABASE_URL_ADMIN ausentes');
  must(ADMIN, `INSERT INTO organizations(id,name) VALUES (${lit(F.orgA)},'ORG SINT A m154c'),(${lit(F.orgB)},'ORG SINT B m154c')`);
});
test('importação: app grava cifrado mas não lê o conteúdo; decide uma única vez', () => {
  must(APP, tx(F.orgA, impSql(F.imp, F.orgA)));
  fails(APP, tx(F.orgA, `SELECT encrypted FROM pdf_imports WHERE id=${lit(F.imp)}`), /permission denied/);
  assert.equal(must(APP, tx(F.orgA, `SELECT status FROM pdf_imports WHERE id=${lit(F.imp)}`)), 'previewed');
  fails(APP, tx(F.orgA, `UPDATE pdf_imports SET file_name='x' WHERE id=${lit(F.imp)}`), /permission denied/);
  fails(APP, tx(F.orgA, `DELETE FROM pdf_imports WHERE id=${lit(F.imp)}`), /permission denied/);
  fails(APP, tx(F.orgA, `INSERT INTO pdf_imports(organization_id,file_name,sha256,size_bytes,layout_id,layout_label,encrypted,iv,tag,key_id,uploaded_by_issuer,uploaded_by_sub,uploaded_by_role)
    VALUES (${lit(F.orgA)},'a.pdf','nao-hash',1,'tasy','Tasy','\\x00'::bytea,'\\x00'::bytea,'\\x00'::bytea,'k-000000001',${lit(ISS)},'farm','pharmacist')`), /check constraint/);
});
test('confirmação: paciente sintético + alocação pdf + linha aplicada + vínculo do próprio importador', () => {
  must(APP, tx(F.orgA, `INSERT INTO pdf_import_rows(id,organization_id,import_id,line,record,name,unit,action) VALUES (${lit(F.row)},${lit(F.orgA)},${lit(F.imp)},4,${lit(rec)},'Ana Sint','Oncologia Clínica','create')`));
  fails(APP, tx(F.orgA, `INSERT INTO patients(organization_id,external_reference,synthetic,display_name,hospital_record) VALUES (${lit(F.orgA)},'PDF-X',false,'Real','PR-REAL1')`), /row-level security/);
  fails(APP, tx(F.orgA, `INSERT INTO patient_allocations(organization_id,patient_id,unit,source,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES (${lit(F.orgA)},${lit(F.pat)},'Onco','pdf',${lit(ISS)},'farm','pharmacist')`), /allocation_origin|foreign key/);
  fails(APP, tx(F.orgA, `INSERT INTO patients(id,organization_id,external_reference,synthetic,display_name,hospital_record) VALUES (${lit(F.pat)},${lit(F.orgA)},'PDF-X2',true,'Ana',${lit(rec)})`), /permission denied/);
  must(APP, tx(F.orgA, `INSERT INTO patients(organization_id,external_reference,synthetic,display_name,hospital_record) VALUES (${lit(F.orgA)},'PDF-${rec}',true,'Ana Sint',${lit(rec)})`));
  F.pat = must(ADMIN, `SELECT id FROM patients WHERE organization_id=${lit(F.orgA)} AND hospital_record=${lit(rec)}`);
  must(APP, tx(F.orgA, `INSERT INTO patient_allocations(organization_id,patient_id,unit,source,import_id,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES (${lit(F.orgA)},${lit(F.pat)},'Oncologia Clínica','pdf',${lit(F.imp)},${lit(ISS)},'farm','pharmacist')`));
  // vínculo antes de a linha estar aplicada: negado
  fails(APP, tx(F.orgA, `INSERT INTO care_assignments(organization_id,patient_id,oidc_issuer,oidc_sub,active) VALUES (${lit(F.orgA)},${lit(F.pat)},${lit(ISS)},'farm',true)`), /row-level security/);
  must(APP, tx(F.orgA, `UPDATE pdf_import_rows SET applied=true, patient_id=${lit(F.pat)} WHERE id=${lit(F.row)}`));
  fails(APP, tx(F.orgA, `INSERT INTO care_assignments(organization_id,patient_id,oidc_issuer,oidc_sub,active) VALUES (${lit(F.orgA)},${lit(F.pat)},${lit(ISS)},'outra-pessoa',true)`), /row-level security/);
  must(APP, tx(F.orgA, `INSERT INTO care_assignments(organization_id,patient_id,oidc_issuer,oidc_sub,active) VALUES (${lit(F.orgA)},${lit(F.pat)},${lit(ISS)},'farm',true)`));
  fails(APP, tx(F.orgA, `UPDATE pdf_import_rows SET applied=false WHERE id=${lit(F.row)}`), /imutável/);
  fails(APP, tx(F.orgA, `UPDATE patients SET display_name='x' WHERE id=${lit(F.pat)}`), /permission denied/);
  must(APP, tx(F.orgA, `UPDATE pdf_imports SET status='confirmed',decided_at=now(),created_count=1,updated_count=0,conflicts_applied=0,skipped_count=0 WHERE id=${lit(F.imp)}`));
  fails(APP, tx(F.orgA, `UPDATE pdf_imports SET status='discarded',decided_at=now() WHERE id=${lit(F.imp)}`), /já decidida/);
  assert.equal(must(ADMIN, `SELECT source||':'||(import_id IS NOT NULL) FROM patient_allocations WHERE patient_id=${lit(F.pat)}`), 'pdf:true');
});
test('isolamento: outra organização não lê nem grava importações', () => {
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM pdf_imports WHERE id=${lit(F.imp)}`)), '0');
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM pdf_import_rows WHERE import_id=${lit(F.imp)}`)), '0');
  assert.equal(must(APP, `SELECT count(*) FROM pdf_imports`), '0');
  fails(APP, tx(F.orgB, impSql(F.other, F.orgA)), /row-level security/);
});
