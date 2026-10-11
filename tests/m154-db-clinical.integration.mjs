// M15.4 — migração 0011 em PostgreSQL real (role restrita): máquina de estados §5.1 garantida pelo banco, tarefas com
// recebimento/desfecho, parecer pré-ciclo insert-only, isolamento por organização e busca restrita ao vínculo.
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
const F = { orgA: randomUUID(), orgB: randomUUID(), pat: randomUUID(), pat2: randomUUID(), a1: randomUUID(), a2: randomUUID(), t1: randomUUID() };
const tr = (alert, from, to, j = 'null', role = 'pharmacist') => `INSERT INTO clinical_alert_transitions(organization_id,alert_id,from_status,to_status,justification,actor_issuer,actor_sub,actor_role) VALUES (${lit(F.orgA)},${lit(alert)},'${from}','${to}',${j},${lit(ISS)},'farm','${role}')`;
const move = (alert, from, to, j, extra = '') => tx(F.orgA, `${tr(alert, from, to, j)}; UPDATE clinical_alerts SET status='${to}'${extra} WHERE id=${lit(alert)}`);
test('fixtures sintéticas', () => {
  assert.ok(APP && ADMIN, 'BLOQUEADO: DATABASE_URL/DATABASE_URL_ADMIN ausentes');
  must(ADMIN, `INSERT INTO organizations(id,name) VALUES (${lit(F.orgA)},'ORG SINT A m154'),(${lit(F.orgB)},'ORG SINT B m154');
    INSERT INTO patients(id,organization_id,external_reference,synthetic,display_name,hospital_record) VALUES (${lit(F.pat)},${lit(F.orgA)},'M154-${F.pat.slice(0, 8)}',true,'Paciente Sintético Um','PR-${F.pat.slice(0, 6)}'),
      (${lit(F.pat2)},${lit(F.orgA)},'M154-${F.pat2.slice(0, 8)}',true,'Paciente Sintético Dois',NULL);
    INSERT INTO care_assignments(organization_id,patient_id,oidc_issuer,oidc_sub) VALUES (${lit(F.orgA)},${lit(F.pat)},${lit(ISS)},'farm');`);
  must(APP, tx(F.orgA, `INSERT INTO clinical_alerts(id,organization_id,patient_id,code,level,rule_version,explanation) VALUES (${lit(F.a1)},${lit(F.orgA)},${lit(F.pat)},'x','needs_review','t','sintético'),(${lit(F.a2)},${lit(F.orgA)},${lit(F.pat)},'x','needs_review','t','sintético')`));
  assert.equal(must(ADMIN, `SELECT status FROM clinical_alerts WHERE id=${lit(F.a1)}`), 'awaiting_review');
});
test('alerta: nasce só em detected/awaiting_review; prontuário: identificação válida', () => {
  fails(APP, tx(F.orgA, `INSERT INTO clinical_alerts(organization_id,patient_id,code,level,status,rule_version,explanation) VALUES (${lit(F.orgA)},${lit(F.pat)},'x','needs_review','resolved','t','s')`), /iniciar em detected/);
  fails(ADMIN, `UPDATE patients SET hospital_record='x; drop' WHERE id=${lit(F.pat2)}`, /check constraint/);
});
test('transições §5.1: exigem registro de autoria, seguem o grafo e estados finais são imutáveis', () => {
  fails(APP, tx(F.orgA, `UPDATE clinical_alerts SET status='in_evaluation' WHERE id=${lit(F.a1)}`), /sem registro de autoria/);
  fails(APP, move(F.a1, 'awaiting_review', 'resolved', "'pulando etapas'"), /não permitida/);
  must(APP, move(F.a1, 'awaiting_review', 'in_evaluation', "'revisão'"));
  assert.equal(must(ADMIN, `SELECT status||'|'||(status_changed_at IS NOT NULL) FROM clinical_alerts WHERE id=${lit(F.a1)}`), 'in_evaluation|true');
  assert.equal(must(ADMIN, `SELECT applied FROM clinical_alert_transitions WHERE alert_id=${lit(F.a1)} AND to_status='in_evaluation'`), 't');
  fails(APP, tx(F.orgA, tr(F.a1, 'in_evaluation', 'dismissed', "'curto'")), /dismiss_needs_justification/);
  fails(APP, move(F.a1, 'in_evaluation', 'duplicate', "'mesmo evento'"), /alert_duplicate_link/);
  must(APP, move(F.a1, 'in_evaluation', 'duplicate', "'mesmo evento do outro alerta'", `, duplicate_of=${lit(F.a2)}`));
  fails(APP, move(F.a1, 'duplicate', 'in_evaluation', "'reabrir'"), /não permitida/);
  must(APP, move(F.a2, 'awaiting_review', 'in_evaluation', "'revisão'")); must(APP, move(F.a2, 'in_evaluation', 'monitoring', "'acompanhar'"));
  must(APP, move(F.a2, 'monitoring', 'resolved', "'resolvido'"));
  assert.equal(must(ADMIN, `SELECT resolved_at IS NOT NULL FROM clinical_alerts WHERE id=${lit(F.a2)}`), 't');
  fails(APP, tx(F.orgA, `UPDATE clinical_alerts SET explanation='alterada' WHERE id=${lit(F.a2)}`), /permission denied/);
  fails(APP, tx(F.orgA, `UPDATE clinical_alert_transitions SET justification='x' WHERE alert_id=${lit(F.a2)}`), /permission denied/);
  fails(APP, tx(F.orgA, `DELETE FROM clinical_alert_transitions WHERE alert_id=${lit(F.a2)}`), /permission denied/);
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM clinical_alert_transitions WHERE alert_id=${lit(F.a2)}`)), '0');
  fails(APP, tx(F.orgB, `INSERT INTO clinical_alert_transitions(organization_id,alert_id,from_status,to_status,actor_issuer,actor_sub,actor_role) VALUES (${lit(F.orgA)},${lit(F.a2)},'resolved','monitoring','i','s','nurse')`), /row-level security/);
});
test('tarefas: recebimento antes do desfecho, sem desfazer, encerradas imutáveis, sem DELETE, isoladas', () => {
  must(APP, tx(F.orgA, `INSERT INTO clinical_tasks(id,organization_id,patient_id,alert_id,kind,title,assignee_role,created_by_issuer,created_by_sub) VALUES (${lit(F.t1)},${lit(F.orgA)},${lit(F.pat)},${lit(F.a2)},'referral','Avaliar suporte','physician',${lit(ISS)},'farm')`));
  fails(APP, tx(F.orgA, `UPDATE clinical_tasks SET title='outro' WHERE id=${lit(F.t1)}`), /permission denied/);
  fails(APP, tx(F.orgA, `UPDATE clinical_tasks SET status='done',closed_by_sub='m',closed_at=now() WHERE id=${lit(F.t1)}`), /task_closed/);
  must(APP, tx(F.orgA, `UPDATE clinical_tasks SET status='received',received_by_sub='med',received_at=now() WHERE id=${lit(F.t1)}`));
  fails(APP, tx(F.orgA, `UPDATE clinical_tasks SET status='open' WHERE id=${lit(F.t1)}`), /não pode ser desfeito/);
  fails(APP, tx(F.orgA, `UPDATE clinical_tasks SET received_by_sub='outro' WHERE id=${lit(F.t1)}`), /já confirmado/);
  must(APP, tx(F.orgA, `UPDATE clinical_tasks SET status='done',closed_by_sub='med',closed_at=now(),outcome='Avaliado pela medicina' WHERE id=${lit(F.t1)}`));
  fails(APP, tx(F.orgA, `UPDATE clinical_tasks SET outcome='mudado' WHERE id=${lit(F.t1)}`), /imutável/);
  fails(APP, tx(F.orgA, `DELETE FROM clinical_tasks WHERE id=${lit(F.t1)}`), /permission denied/);
  assert.equal(must(APP, tx(F.orgB, `SELECT count(*) FROM clinical_tasks WHERE id=${lit(F.t1)}`)), '0');
  fails(APP, tx(F.orgA, `INSERT INTO clinical_tasks(organization_id,patient_id,kind,title,assignee_role,created_by_issuer,created_by_sub) VALUES (${lit(F.orgA)},${lit(F.pat)},'task','x','technical_admin','i','s')`), /check constraint/);
});
test('parecer pré-ciclo: INSERT no tenant; sem UPDATE/DELETE; outra organização negada', () => {
  must(APP, tx(F.orgA, `INSERT INTO clinical_reviews(organization_id,patient_id,review_type,status,rationale,actor_issuer,actor_sub,reviewed_at) VALUES (${lit(F.orgA)},${lit(F.pat)},'pre_cycle','blocked','Dados insuficientes no período',${lit(ISS)},'farm',now())`));
  fails(APP, tx(F.orgA, `UPDATE clinical_reviews SET status='reviewed' WHERE patient_id=${lit(F.pat)}`), /permission denied/);
  fails(APP, tx(F.orgA, `DELETE FROM clinical_reviews WHERE patient_id=${lit(F.pat)}`), /permission denied/);
  fails(APP, tx(F.orgB, `INSERT INTO clinical_reviews(organization_id,patient_id,review_type,status,actor_issuer,actor_sub) VALUES (${lit(F.orgA)},${lit(F.pat)},'pre_cycle','draft','i','s')`), /row-level security/);
});
test('busca (mesma consulta da API): sem vínculo => vazio; com vínculo só o próprio paciente; outra org vazia', () => {
  const q = (org, sub, term) => tx(org, `SELECT count(*) FROM patients p JOIN care_assignments ca ON ca.patient_id=p.id AND ca.organization_id=p.organization_id WHERE p.organization_id=${lit(org)} AND p.synthetic AND ca.oidc_issuer=${lit(ISS)} AND ca.oidc_sub=${lit(sub)} AND ca.active AND translate(lower(p.display_name),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn') LIKE ${lit(`%${term}%`)}`);
  assert.equal(must(APP, q(F.orgA, 'farm', 'sintetico')), '1', 'acentos normalizados; Paciente Dois sem vínculo não aparece');
  assert.equal(must(APP, q(F.orgA, 'sem-vinculo', 'sintetico')), '0');
  assert.equal(must(APP, q(F.orgB, 'farm', 'sintetico')), '0');
});
