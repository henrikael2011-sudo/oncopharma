// Fail-closed integration prerequisite: no skipped DB tests masquerading as success.
import { spawnSync } from 'node:child_process';
if (!process.env.DATABASE_URL) { console.error('BLOQUEADO: DATABASE_URL não configurada.'); process.exit(2); }
const probe = spawnSync('psql', [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-Atqc', 'SELECT 1'], {encoding:'utf8',timeout:15000});
if (probe.status!==0 || probe.stdout.trim()!=='1') { console.error('BLOQUEADO: PostgreSQL indisponível ou autenticação inválida. '+(probe.stderr||probe.error?.message||'')); process.exit(2); }
const role = spawnSync('psql', [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-Atqc', 'SELECT current_user'], {encoding:'utf8',timeout:15000});
if (role.status!==0 || role.stdout.trim()!=='oncopharma_app') { console.error('BLOQUEADO: testes devem usar a role restrita oncopharma_app.'); process.exit(2); }

const privileges = spawnSync('psql', [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-Atqc', 'SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user'], {encoding:'utf8',timeout:15000});
if (privileges.status!==0 || privileges.stdout.trim()!=='f') { console.error('BLOQUEADO: superusuário ou BYPASSRLS proibido na role runtime.'); process.exit(2); }
console.log('PostgreSQL conectado com role restrita; executando testes integrados obrigatórios.');
