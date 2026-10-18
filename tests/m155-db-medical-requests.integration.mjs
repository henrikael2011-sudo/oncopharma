// PostgreSQL 17 real, sem mocks, role restrita. Banco administrativo só cria fixtures sintéticas.
import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
const APP=process.env.DATABASE_URL,ADMIN=process.env.DATABASE_URL_ADMIN,iss='https://sam.synthetic.invalid';
const f=Object.fromEntries(['org','other','pat','pat2','lab','lab2','request','shift'].map(k=>[k,randomUUID()]));
const l=v=>`'${String(v).replaceAll("'","''")}'`;
function sql(url,q){const r=spawnSync('psql',['-X',url,'-v','ON_ERROR_STOP=1','-Atq','-c',q],{encoding:'utf8',timeout:15000});return{ok:r.status===0,out:r.stdout?.trim(),err:r.stderr?.trim()};}
function must(url,q){const r=sql(url,q);assert.equal(r.ok,true,r.err);return r.out;}
const tx=(sub,q,org=f.org,mfa=true)=>`BEGIN; SET LOCAL app.organization_id=${l(org)};SET LOCAL app.sam_issuer=${l(iss)};SET LOCAL app.sam_sub=${l(sub)};SET LOCAL app.sam_mfa='${mfa}';${q};COMMIT;`;
function fails(q,re){const r=sql(APP,q);assert.equal(r.ok,false,'deveria falhar');if(re)assert.match(r.err,re);}
const refs=JSON.stringify([{type:'lab',id:f.lab}]);
const insert=(id=f.request,mode='on_call',evidence=refs)=>`INSERT INTO medical_requests(id,organization_id,patient_id,author_issuer,author_sub,author_role,unit,recipient_mode,recipient_issuer,recipient_sub,justification,priority,evidence) VALUES(${l(id)},${l(f.org)},${l(f.pat)},${l(iss)},'farm','pharmacist','Unidade SAM',${l(mode)},${mode==='specific'?l(iss):'null'},${mode==='specific'?"'med'":'null'},'Solicito avaliação das evidências sintéticas','routine',${l(evidence)}::jsonb)`;
test('SAM fixtures isoladas e sintéticas',()=>{
 assert.ok(APP&&ADMIN,'BLOQUEADO: URLs de teste ausentes');
 must(ADMIN,`INSERT INTO organizations(id,name) VALUES(${l(f.org)},'SAM sintética'),(${l(f.other)},'SAM outra');
 INSERT INTO patients(id,organization_id,external_reference,synthetic) VALUES(${l(f.pat)},${l(f.org)},${l(f.pat)},true),(${l(f.pat2)},${l(f.other)},${l(f.pat2)},true);
 INSERT INTO memberships(organization_id,oidc_issuer,oidc_sub,role) VALUES(${l(f.org)},${l(iss)},'farm','pharmacist'),(${l(f.org)},${l(iss)},'med','physician'),(${l(f.org)},${l(iss)},'admin','technical_admin'),(${l(f.org)},${l(iss)},'other-med','physician');
 INSERT INTO care_assignments(organization_id,patient_id,oidc_issuer,oidc_sub) VALUES(${l(f.org)},${l(f.pat)},${l(iss)},'farm');
 INSERT INTO clinical_labs(id,organization_id,patient_id,analyte_code,analyte_label,unit,collected_at,source_reference) VALUES(${l(f.lab)},${l(f.org)},${l(f.pat)},'ANC','Exame sintético','x',now(),'SAM-LAB'),(${l(f.lab2)},${l(f.other)},${l(f.pat2)},'ANC','Outro paciente','x',now(),'SAM-OTHER');
 INSERT INTO patient_allocations(organization_id,patient_id,unit,source,recorded_by_issuer,recorded_by_sub,recorded_by_role) VALUES(${l(f.org)},${l(f.pat)},'Unidade SAM','manual',${l(iss)},'farm','pharmacist');
 INSERT INTO request_priority_criteria(organization_id,unit,priority,description) VALUES(${l(f.org)},'Unidade SAM','routine','Critério demonstrativo de teste');`);
 must(APP,tx('farm',insert()));
 assert.equal(must(APP,tx('farm',`SELECT evidence->0->>'source_reference' FROM medical_requests WHERE id=${l(f.request)}`)),'SAM-LAB');
});
test('SAM RLS: sem contexto, outra organização, sem vínculo, admin e sem MFA não leem/criam',()=>{
 assert.equal(must(APP,`SELECT count(*) FROM medical_requests WHERE id=${l(f.request)}`),'0');
 for(const [sub,org,mfa] of [['farm',f.other,true],['stranger',f.org,true],['admin',f.org,true],['farm',f.org,false],['med',f.org,true]])assert.equal(must(APP,tx(sub,`SELECT count(*) FROM medical_requests WHERE id=${l(f.request)}`,org,mfa)),'0');
 fails(tx('admin',insert(randomUUID())),/Criação não autorizada|row-level security/);fails(tx('farm',insert(randomUUID()),f.org,false),/Criação não autorizada|row-level security/);
 fails(tx('farm',insert(randomUUID(),'on_call',JSON.stringify([{type:'lab',id:f.lab2}]))),/Evidência não pertence/);
 fails(tx('farm',insert(randomUUID(),'specific')),/Médico sem vínculo/);
});
test('SAM envio bloqueia escala ausente/ambígua; fronteiras início inclusivo e fim exclusivo',()=>{
 fails(tx('farm',`UPDATE medical_requests SET status='sent' WHERE id=${l(f.request)}`),/Sem médico de plantão/);
 must(ADMIN,`INSERT INTO on_call_shifts(id,organization_id,unit,physician_issuer,physician_sub,starts_at,ends_at) VALUES(${l(f.shift)},${l(f.org)},'Unidade SAM',${l(iss)},'med',now()-interval '1 hour',now()+interval '1 hour');`);
 const other=randomUUID();must(ADMIN,`INSERT INTO on_call_shifts(id,organization_id,unit,physician_issuer,physician_sub,starts_at,ends_at) VALUES(${l(other)},${l(f.org)},'Unidade SAM',${l(iss)},'med',now()-interval '1 hour',now()+interval '1 hour');`);
 fails(tx('farm',`UPDATE medical_requests SET status='sent' WHERE id=${l(f.request)}`),/escala ambígua/);
 must(ADMIN,`DELETE FROM on_call_shifts WHERE id=${l(other)}`);
 must(APP,tx('farm',`UPDATE medical_requests SET status='sent' WHERE id=${l(f.request)}`));
 assert.equal(must(APP,tx('med',`SELECT count(*) FROM medical_requests WHERE id=${l(f.request)}`)),'1');
 assert.equal(must(APP,tx('other-med',`SELECT count(*) FROM medical_requests WHERE id=${l(f.request)}`)),'0');
 must(ADMIN,`UPDATE on_call_shifts SET ends_at=now()-interval '1 second' WHERE id=${l(f.shift)}`);
 assert.equal(must(APP,tx('med',`SELECT count(*) FROM medical_requests WHERE id=${l(f.request)}`)),'0');
 must(ADMIN,`UPDATE on_call_shifts SET starts_at=now()+interval '1 hour',ends_at=now()+interval '2 hours' WHERE id=${l(f.shift)}`);
 assert.equal(must(APP,tx('med',`SELECT count(*) FROM medical_requests WHERE id=${l(f.request)}`)),'0');
 must(ADMIN,`UPDATE on_call_shifts SET starts_at=now()-interval '1 hour',ends_at=now()+interval '1 hour' WHERE id=${l(f.shift)}`);
});
test('SAM transições, resposta/conclusão obrigatórias, conteúdo congelado, só autor conclui',()=>{
 fails(tx('farm',`UPDATE medical_requests SET status='accepted',response='xpto' WHERE id=${l(f.request)}`),/Transição/);
 fails(tx('farm',`UPDATE medical_requests SET justification='Texto adulterado depois do envio' WHERE id=${l(f.request)}`),/Transição|imutável/);
 must(APP,tx('med',`UPDATE medical_requests SET status='in_review' WHERE id=${l(f.request)}`));
 fails(tx('med',`UPDATE medical_requests SET status='adjusted' WHERE id=${l(f.request)}`),/Resposta médica/);
 must(APP,tx('med',`UPDATE medical_requests SET status='adjusted',response='Avaliado no sistema oficial sintético' WHERE id=${l(f.request)}`));
 fails(tx('med',`UPDATE medical_requests SET status='completed',outcome='feito',official_reference='SINT-1' WHERE id=${l(f.request)}`),/Transição/);
 fails(tx('farm',`UPDATE medical_requests SET status='completed',outcome='feito' WHERE id=${l(f.request)}`),/obrigatórios/);
 must(APP,tx('farm',`UPDATE medical_requests SET status='completed',outcome='Confirmado pelo autor',official_reference='SINT-1' WHERE id=${l(f.request)}`));
 fails(tx('farm',`UPDATE medical_requests SET status='draft' WHERE id=${l(f.request)}`),/Transição/);
 fails(tx('farm',`DELETE FROM medical_requests WHERE id=${l(f.request)}`),/permission denied/);
 fails(tx('farm',`UPDATE medical_request_events SET action='apagado' WHERE request_id=${l(f.request)}`),/permission denied/);
 fails(tx('farm',`DELETE FROM medical_request_events WHERE request_id=${l(f.request)}`),/permission denied/);
 assert.equal(must(ADMIN,`SELECT string_agg(action,',' ORDER BY id) FROM medical_request_events WHERE request_id=${l(f.request)}`),'created,sent,in_review,adjusted,completed');
 assert.equal(must(ADMIN,`SELECT count(*) FROM audit_events WHERE metadata->>'request_id'=${l(f.request)}`),'5');
});
test('SAM rascunho editável pelo autor, snapshot anterior preservado e descarte final',()=>{
 const id=randomUUID();must(APP,tx('farm',insert(id)));
 must(APP,tx('farm',`UPDATE medical_requests SET justification='Justificativa revisada pelo autor' WHERE id=${l(id)}`));
 assert.equal(must(ADMIN,`SELECT count(DISTINCT snapshot->>'justification') FROM medical_request_events WHERE request_id=${l(id)}`),'2');
 must(APP,tx('farm',`UPDATE medical_requests SET status='discarded' WHERE id=${l(id)}`));
 fails(tx('farm',`UPDATE medical_requests SET status='sent' WHERE id=${l(id)}`),/Transição/);
});
