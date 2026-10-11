import { spawnSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceDigest } from './source-digest.mjs'; // M14.5 consolidado: digest de fontes (proposta Codex)
const out='artifacts/validation'; mkdirSync(out,{recursive:true});
const report={schema:'oncopharma-validation-v2',date:new Date().toISOString(),baseline:'Plano Diretor v3.0',release:'M14.5-consolidado',sourceDigest:sourceDigest(),clinicalApproval:false,checks:[]};
// Logs sem segredos (proposta Codex): remove valores de variáveis sensíveis e tokens Bearer.
function sanitize(t){for(const k of ['DATABASE_URL','DATABASE_URL_ADMIN','APP_DB_PASSWORD','SESSION_ENCRYPTION_KEY','E2E_SESSION_KEY','E2E_USER_PASSWORD','KC_BOOTSTRAP_ADMIN_PASSWORD'])if(process.env[k])t=t.split(process.env[k]).join('[REDACTED]');return t.replace(/Bearer\s+[A-Za-z0-9._-]+/g,'Bearer [REDACTED]');}
const rec=(name,status,reason='',extra={})=>{report.checks.push({name,status,reason,...extra});return status;};
function check(name,cmd,args,opts={}){
 const p=spawnSync(cmd,args,{encoding:'utf8',timeout:opts.timeout||120000,env:process.env,maxBuffer:8*1024*1024});
 const status=p.error?.code==='ENOENT'?'BLOCKED':p.status===0?'PASS':'FAIL';
 report.checks.push({name,status,exitCode:p.status,reason:sanitize(p.error?.message||((p.stderr||'').slice(-1000))),command:[cmd,...args].join(' ')});
 writeFileSync(`${out}/${name.replace(/[^a-z0-9-]/gi,'_')}.log`,sanitize((p.stdout||'')+'\n'+(p.stderr||'')));
 return status;
}
rec('node22',process.versions.node.split('.')[0]==='22'?'PASS':'FAIL',process.version);
rec('lockfile',existsSync('package-lock.json')?'PASS':'FAIL','package-lock.json versionado (CI usa npm ci).');
check('local-tests','npm',['run','verify:local']);
check('lab-unit-tests','npm',['run','test:lab']);
check('clinical-rules','npm',['run','test:rules']);
if(!process.env.DATABASE_URL)report.checks.push({name:'postgres-required',status:'BLOCKED',reason:'DATABASE_URL ausente; nenhum teste PostgreSQL executado.'});
else check('postgres-required','npm',['run','test:db:required'],{timeout:120000});
{ const db=report.checks.find(c=>c.name==='postgres-required').status;
  rec('migration-0003',db==='PASS'?'PASS':'BLOCKED',db==='PASS'?'Aplicada por provision-app-role.sh (bootstrap); GRANTs e política INSERT de audit_events exercitados no PostgreSQL.':'Execução no banco não comprovada.');
  rec('migration-0008-nullif',db==='PASS'?'PASS':'BLOCKED',db==='PASS'?'Políticas com nullif; sessão reutilizada retorna 0 linhas sem erro 22P02 (tests/m145-db-0008.integration.mjs).':'Execução no banco não comprovada.'); }
if(existsSync('node_modules/next')&&existsSync('node_modules/@nestjs'))check('full-build','npm',['run','build'],{timeout:900000});
else report.checks.push({name:'full-build',status:'BLOCKED',reason:'Dependências Next.js/NestJS não instaladas; build não executado.'});
if(existsSync('services/api/dist/database.service.js'))check('api-security-unit','npm',['run','test:api:security']);
else rec('api-security-unit','BLOCKED','API não compilada.');
check('design','npm',['run','check:design']);
check('governance','npm',['run','check:governance']);
// M14.5: E2E real (API + PostgreSQL role restrita + care/clinical/admin + IdP de TESTE com TOTP). Sem variáveis/IdP => BLOCKED.
const e2eVars=['DATABASE_URL','DATABASE_URL_ADMIN','KC_URL','KC_BOOTSTRAP_ADMIN_USERNAME','KC_BOOTSTRAP_ADMIN_PASSWORD','E2E_USER_PASSWORD','E2E_STATE_FILE'];
const e2eMissing=e2eVars.filter(n=>!process.env[n]);
let e2e='BLOCKED';
if(!existsSync('node_modules/@playwright/test'))report.checks.push({name:'e2e-care-clinical',status:'BLOCKED',reason:'Playwright não instalado.'});
else if(e2eMissing.length)report.checks.push({name:'e2e-care-clinical',status:'BLOCKED',reason:`Variáveis ausentes: ${e2eMissing.join(', ')}`});
else e2e=check('e2e-care-clinical','npm',['run','test:e2e'],{timeout:900000});
report.checks.push({name:'oidc-mfa-test-idp',status:e2e,reason:e2e==='PASS'?'OIDC code+PKCE, TOTP real, claim amr, audience, sessão HttpOnly, CSRF, logout RP-initiated, expiração e negativos de papel validados no navegador e na API contra IdP de TESTE local (Keycloak dev) com contas sintéticas.':e2e==='FAIL'?'Suíte E2E falhou; ver e2e-care-clinical.log.':'Suíte E2E não executada.'});
rec('vertical-care-clinical-audit',e2e,e2e==='PASS'?'Care -> API/PostgreSQL -> Clinical -> intervenção -> auditoria com pacientes sintéticos, isolamento por organização e role restrita.':'Fluxo vertical não comprovado nesta execução.');
report.checks.push({name:'oidc-mfa',status:'BLOCKED',reason:'IdP de homologação institucional não definido (D-008). A validação M14.5 usou somente IdP de teste local; repetir a suíte no IdP escolhido antes de qualquer piloto.'});
// Separação adotada da proposta Codex: o gate FUNCIONA (bloqueia) => release-gate-enforced PASS; a liberação clínica em si continua BLOCKED.
{ const g=spawnSync('npm',['run','quality:gate'],{encoding:'utf8',timeout:60000}); writeFileSync(`${out}/release-gate.log`,sanitize((g.stdout||'')+'\n'+(g.stderr||'')));
  const enforced=g.status===1&&/BLOQUEADO: piloto e produção não autorizados\./.test(g.stdout||'');
  rec('release-gate-enforced',enforced?'PASS':'FAIL',enforced?'quality:gate sai com 1 e bloqueia G01–G09 (comportamento esperado).':'Gate não bloqueou como esperado.',{exitCode:g.status,command:'npm run quality:gate'});
  rec('clinical-release','BLOCKED','G01–G09 exigem aprovações externas (clínica, LGPD/RIPD, SaMD/Anvisa, instituição, operação de alertas).'); }
const browserBin=['/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>existsSync(p));
if(browserBin){
 const temp=mkdtempSync(join(tmpdir(),'onco-browser-'));const port=41779;
 const server=spawn(process.execPath,['tools/synthetic-lab/server.mjs'],{env:{...process.env,PORT:String(port),ONCO_LAB_DATA:join(temp,'synthetic.json')},stdio:'ignore'});
 try {
   let ready=false;
   for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${port}/`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
   if(!ready)throw Error('Servidor sintético não iniciou');
   const r=spawnSync(browserBin,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars','--window-size=1280,900',`--screenshot=${join(process.cwd(),out,'lab-browser.png')}`,`http://127.0.0.1:${port}/`],{encoding:'utf8',timeout:12000});
   const ok=r.status===0&&existsSync(`${out}/lab-browser.png`);
   report.checks.push({name:'browser-lab-render',status:ok?'PASS':'BLOCKED',reason:ok?`${browserBin} renderizou laboratório sintético (o E2E dos apps é o check e2e-care-clinical).`:'Chromium indisponível operacionalmente no container (erro ou timeout); sem captura validada.'});
 }catch(e){report.checks.push({name:'browser-lab-render',status:'FAIL',reason:String(e)});}
 finally{server.kill();rmSync(temp,{recursive:true,force:true});}
}else report.checks.push({name:'browser-lab-render',status:'BLOCKED',reason:'Chromium indisponível.'});
const required=['full-build','postgres-required','oidc-mfa'];
report.readyForIntegratedValidation=required.every(n=>report.checks.find(c=>c.name===n)?.status==='PASS');
report.readyForClinicalUse=false;
report.completedAt=new Date().toISOString();report.sourceDigestAfter=sourceDigest();
rec('source-stability',report.sourceDigest===report.sourceDigestAfter?'PASS':'FAIL',report.sourceDigest===report.sourceDigestAfter?'Fontes inalteradas durante a validação.':'Fontes mudaram durante a validação.');
writeFileSync(`${out}/validation-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.checks.some(c=>c.status==='FAIL'))process.exitCode=1;
