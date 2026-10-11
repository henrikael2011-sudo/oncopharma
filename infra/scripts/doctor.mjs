import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = path.join(root, '.env');
if (!fs.existsSync(envFile)) { console.error('FALHA: .env ausente. Copie .env.example e configure.'); process.exit(1); }
const entries = Object.fromEntries(fs.readFileSync(envFile,'utf8').split(/\r?\n/).filter(s=>s && !s.trim().startsWith('#') && s.includes('=')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i).trim(),s.slice(i+1).trim()]}));
const required=['DATABASE_URL','DATABASE_URL_ADMIN','OIDC_ISSUER','OIDC_AUDIENCE','OIDC_JWKS_URI','OIDC_AUTHORIZATION_ENDPOINT','OIDC_TOKEN_ENDPOINT','OIDC_CLIENT_ID','SESSION_ENCRYPTION_KEY','PORTAL_ORIGIN','API_INTERNAL_URL'];
const missing=required.filter(k=>!entries[k]);
if (missing.length) { console.error('FALHA: variáveis faltando: '+missing.join(', ')); process.exitCode=1; }
const url=entries.DATABASE_URL||'';
try { const u=new URL(url); if (u.username !== 'oncopharma_app') {console.error('FALHA: DATABASE_URL deve usar a role oncopharma_app, não o dono do schema');process.exitCode=1;} if(u.pathname!=='/oncopharma_dev'){console.error('FALHA: banco de desenvolvimento incorreto');process.exitCode=1;} } catch { console.error('FALHA: DATABASE_URL inválida');process.exitCode=1; }
if (entries.ALLOW_SYNTHETIC_API==='true') console.warn('AVISO: endpoint sintético habilitado (somente DEV).');
if (!process.exitCode) console.log('Configuração local consistente (não comprova conexão ou login).');
