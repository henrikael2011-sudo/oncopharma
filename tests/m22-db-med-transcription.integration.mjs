// M22 — migração 0017: RLS por organização, entrada sempre pendente/sintética, conteúdo transcrito imutável (UPDATE por coluna),
// uma pendência por linhagem, pedidos criados só com origem 'transcr:', horário de adesão validado.
import test from 'node:test'; import assert from 'node:assert/strict'; import { spawnSync } from 'node:child_process'; import { randomUUID } from 'node:crypto';
const APP = process.env.DATABASE_URL, ADMIN = process.env.DATABASE_URL_ADMIN;
const psql = (url, sql) => { const r = spawnSync('psql', ['-X', url, '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', sql], { encoding: 'utf8', timeout: 15000 }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const must = (url, sql) => { const r = psql(url, sql); if (!r.ok) throw new Error(r.err); return r.out; };
const denied = (url, sql, re = /permission denied|row-level security/i) => { const r = psql(url, sql); assert.equal(r.ok, false, sql); assert.match(r.err, re, r.err); };
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`; const tx = (org, body) => `BEGIN; SET LOCAL app.organization_id = ${lit(org)}; ${body}; COMMIT;`;
const F = { orgA: randomUUID(), orgB: randomUUID(), patA: randomUUID(), patB: randomUUID(), lin: randomUUID() };
const iv = "decode('000000000000000000000000','hex')", tag = "decode('00000000000000000000000000000000','hex')";
const ins = (org, pat, lin, ver, { status = 'pending_release', synth = true } = {}) => `INSERT INTO clinical_med_transcriptions(organization_id,patient_id,lineage_id,version,kind,medication,dose_encrypted,dose_iv,dose_tag,route,times,frequency_text,start_date,instructions_encrypted,instructions_iv,instructions_tag,key_id,prescription_reference,status,entered_by_issuer,entered_by_sub,entered_by_role,synthetic) VALUES (${lit(org)},${lit(pat)},${lit(lin)},${ver},'new','Med sint','\\x00'::bytea,${iv},${tag},'VO',ARRAY['08:00'],'1x ao dia',current_date,'\\x00'::bytea,${iv},${tag},'k','Rx sint',${lit(status)},'iss','sub','pharmacist',${synth})`;
const order = (org, pat, ref) => `INSERT INTO clinical_medication_orders(id,organization_id,patient_id,medication,route,frequency_text,status,ordered_at,source_reference) VALUES (${lit(randomUUID())},${lit(org)},${lit(pat)},'Med sint','VO','08:00','active',now(),${lit(ref)})`;
test('fixtures', () => { assert.ok(APP && ADMIN, 'BLOQUEADO: DATABASE_URL/DATABASE_URL_ADMIN ausentes');
  must(ADMIN, `INSERT INTO organizations(id,name) VALUES (${lit(F.orgA)},'ORG SINT A m22'),(${lit(F.orgB)},'ORG SINT B m22'); INSERT INTO patients(id,organization_id,external_reference,synthetic) VALUES (${lit(F.patA)},${lit(F.orgA)},'M22-A-${F.patA.slice(0, 8)}',true),(${lit(F.patB)},${lit(F.orgB)},'M22-B-${F.patB.slice(0, 8)}',true);`); });
test('RLS: só no tenant; sem contexto zero; outra organização não lê nem grava', () => {
  must(APP, tx(F.orgA, ins(F.orgA, F.patA, F.lin, 1)));
  assert.equal(must(APP, tx(F.orgA, `SELECT count(*) FROM clinical_med_transcriptions WHERE patient_id=${lit(F.patA)}`)), '1');
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM clinical_med_transcriptions WHERE patient_id=${lit(F.patA)}`)), '0');
  assert.equal(must(APP, `SELECT count(*) FROM clinical_med_transcriptions`), '0');
  denied(APP, tx(F.orgB, ins(F.orgA, F.patA, randomUUID(), 1)));
  assert.equal(must(APP, tx(F.orgB, `UPDATE clinical_med_transcriptions SET status='released' WHERE patient_id=${lit(F.patA)} RETURNING id`)), '');
});
test('gating no banco: inserção só pendente e sintética; uma pendência por linhagem', () => {
  denied(APP, tx(F.orgA, ins(F.orgA, F.patA, randomUUID(), 1, { status: 'released' })));
  denied(APP, tx(F.orgA, ins(F.orgA, F.patA, randomUUID(), 1, { synth: false })));
  denied(APP, tx(F.orgA, ins(F.orgA, F.patA, F.lin, 2)), /duplicate key|unique/i);
});
test('imutável: conteúdo transcrito não muda; sem DELETE; revisão por colunas permitidas', () => {
  for (const col of ["medication='x'", "route='IV'", "times=ARRAY['09:00']", "start_date=current_date"]) denied(APP, tx(F.orgA, `UPDATE clinical_med_transcriptions SET ${col} WHERE lineage_id=${lit(F.lin)}`));
  denied(APP, tx(F.orgA, `DELETE FROM clinical_med_transcriptions WHERE lineage_id=${lit(F.lin)}`));
  assert.equal(must(APP, tx(F.orgA, `UPDATE clinical_med_transcriptions SET status='released',reviewed_by_issuer='iss',reviewed_by_sub='farm',reviewed_at=now() WHERE lineage_id=${lit(F.lin)} RETURNING status`)), 'released');
  denied(APP, tx(F.orgA, `UPDATE clinical_med_transcriptions SET reviewed_at=NULL WHERE lineage_id=${lit(F.lin)}`), /reviewed_pair|check constraint/i);
});
test('pedidos: aplicação só cria/edita pedidos de origem transcr:, no tenant; sem DELETE', () => {
  must(APP, tx(F.orgA, order(F.orgA, F.patA, `transcr:${F.lin}`)));
  denied(APP, tx(F.orgA, order(F.orgA, F.patA, 'manual-x')));
  denied(APP, tx(F.orgB, order(F.orgA, F.patA, `transcr:${randomUUID()}`)));
  denied(APP, tx(F.orgA, `UPDATE clinical_medication_orders SET patient_id=${lit(F.patB)} WHERE source_reference=${lit('transcr:' + F.lin)}`));
  denied(APP, tx(F.orgA, `DELETE FROM clinical_medication_orders WHERE source_reference=${lit('transcr:' + F.lin)}`));
  assert.equal(must(APP, tx(F.orgA, `UPDATE clinical_medication_orders SET status='stopped' WHERE source_reference=${lit('transcr:' + F.lin)} RETURNING status`)), 'stopped');
});
test('adesão: scheduled_time só HH:MM válido', () => {
  const cons = must(ADMIN, `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='patient_adherence_reports'::regclass AND pg_get_constraintdef(oid) ILIKE '%scheduled_time%'`);
  assert.match(cons, /scheduled_time/);
  for (const [v, good] of [['08:00', true], ['23:59', true], ['24:00', false], ['8:00', false], ['manhã', false]]) assert.equal(must(ADMIN, `SELECT ${lit(v)} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`), good ? 't' : 'f', v);
});
test('0018: origem da entrada validada (manual/foto_ia/hospital); padrão manual', () => {
  const l = randomUUID(); must(APP, tx(F.orgA, ins(F.orgA, F.patA, l, 1)));
  assert.equal(must(APP, tx(F.orgA, `SELECT entry_source FROM clinical_med_transcriptions WHERE lineage_id=${lit(l)}`)), 'manual');
  must(APP, tx(F.orgA, ins(F.orgA, F.patA, randomUUID(), 1).replace(',synthetic)', ',synthetic,entry_source,source_detail)').replace(/,(true|false)\)$/, ",$1,'foto_ia','extrator simulado')")));
  denied(APP, tx(F.orgA, ins(F.orgA, F.patA, randomUUID(), 1).replace(',synthetic)', ',synthetic,entry_source)').replace(/,(true|false)\)$/, ",$1,'ia_auto')")), /check constraint/i);
  denied(APP, tx(F.orgA, `UPDATE clinical_med_transcriptions SET entry_source='hospital' WHERE lineage_id=${lit(l)}`));
});
