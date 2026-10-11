// M14.5 — migração 0008 (R1): sessão reutilizada após contexto transacional não pode gerar erro 22P02
// nem ampliar acesso. Executa com a role restrita real (DATABASE_URL) e lê pg_policies com DATABASE_URL_ADMIN.
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
const TABLES = ['clinical_reviews','patient_symptom_reports','clinical_alerts','clinical_interventions','patient_guidance','clinical_protocol_versions','patient_portal_links'];
test('0008: todas as políticas de tenant usam nullif (nenhum cast direto de current_setting)', async () => {
  assert.ok(process.env.DATABASE_URL_ADMIN, 'BLOQUEADO: DATABASE_URL_ADMIN ausente');
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_ADMIN }); await admin.connect();
  try {
    const { rows } = await admin.query(`SELECT tablename, policyname, coalesce(qual,'')||' '||coalesce(with_check,'') AS expr FROM pg_policies WHERE schemaname='public' AND (coalesce(qual,'')||coalesce(with_check,'')) LIKE '%app.organization_id%'`);
    assert.ok(rows.length >= 20, `políticas encontradas: ${rows.length}`);
    const bad = rows.filter((r) => !/NULLIF/i.test(r.expr)).map((r) => `${r.tablename}.${r.policyname}`);
    assert.deepEqual(bad, [], `políticas sem nullif: ${bad.join(', ')}`);
  } finally { await admin.end(); }
});
test('0008: conexão reutilizada (contexto vazio) retorna zero linhas em vez de erro, com a role restrita', async () => {
  assert.ok(process.env.DATABASE_URL, 'BLOQUEADO: DATABASE_URL ausente');
  const app = new pg.Client({ connectionString: process.env.DATABASE_URL }); await app.connect();
  try {
    assert.equal((await app.query('SELECT current_user AS u')).rows[0].u, 'oncopharma_app');
    await app.query('BEGIN'); await app.query("SELECT set_config('app.organization_id','11111111-1111-4111-8111-111111111111',true)"); await app.query('COMMIT');
    assert.equal((await app.query("SELECT current_setting('app.organization_id',true) AS v")).rows[0].v, '');
    for (const t of TABLES) assert.equal((await app.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n, 0, t);
    // INSERT sem contexto continua negado (NULL nunca iguala organization_id).
    await assert.rejects(app.query(`INSERT INTO clinical_alerts(organization_id,patient_id,code,level,rule_version,explanation) VALUES ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222221','x','needs_review','t','sintético')`), (e) => e.code === '42501');
  } finally { await app.end(); }
});
