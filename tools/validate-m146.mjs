// Evidência separada para M14.6: não sobrescreve relatórios históricos M14.5.
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {sourceDigest} from './source-digest.mjs';
const dir='artifacts/validation/m14_6';mkdirSync(dir,{recursive:true});
const report={release:'M14.6 / M15.5',at:new Date().toISOString(),sourceDigest:sourceDigest(),checks:[],readyForClinicalUse:false,clinicalApproval:false};
const clean=s=>{for(const key of ['DATABASE_URL','DATABASE_URL_ADMIN','APP_DB_PASSWORD','E2E_USER_PASSWORD','E2E_SESSION_KEY','KC_BOOTSTRAP_ADMIN_PASSWORD'])if(process.env[key])s=s.split(process.env[key]).join('[REDACTED]');return s.replace(/Bearer\s+\S+/g,'Bearer [REDACTED]');};
function run(name,args,{blocked=false,gate=false}={}){
 const r=spawnSync('npm',args,{encoding:'utf8',timeout:900000,maxBuffer:12*1024*1024});const output=clean((r.stdout??'')+'\n'+(r.stderr??''));writeFileSync(`${dir}/${name}.log`,output);
 const status=gate?(r.status===1&&output.includes('BLOQUEADO: piloto e produção não autorizados.')?'PASS':'FAIL'):r.status===0?'PASS':blocked&&r.status===2?'BLOCKED':'FAIL';
 report.checks.push({name,command:['npm',...args].join(' '),status,exitCode:r.status,reason:status==='BLOCKED'?'Pré-requisitos ausentes; consulte o log.':gate?'Gate deve permanecer bloqueado.':undefined});console.log(`${name}: ${status} (exit ${r.status})`);
}
report.checks.push({name:'node22',status:process.versions.node.startsWith('22.')?'PASS':'FAIL',version:process.version});
run('build',['run','build']);run('verify-local',['run','verify:local']);run('api-security',['run','test:api:security']);run('rules',['run','test:rules']);run('lab',['run','test:lab']);
run('postgres17',['run','test:db:required'],{blocked:true});run('e2e',['run','test:e2e'],{blocked:true});run('clinical-gate-enforced',['run','quality:gate'],{gate:true});
report.checks.push({name:'clinical-release',status:'BLOCKED',reason:'G01–G09 sem liberação institucional; somente dados sintéticos.'});
report.sourceDigestAfter=sourceDigest();report.checks.push({name:'source-stability',status:report.sourceDigest===report.sourceDigestAfter?'PASS':'FAIL'});
report.completedAt=new Date().toISOString();report.counts=Object.fromEntries(['PASS','FAIL','BLOCKED'].map(s=>[s,report.checks.filter(c=>c.status===s).length]));
writeFileSync(`${dir}/validation-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.counts));if(report.counts.FAIL)process.exitCode=1;
