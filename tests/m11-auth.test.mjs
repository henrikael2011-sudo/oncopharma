import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('PKCE S256 e state presentes',()=>{const s=read('apps/portal/app/api/auth/login/route.ts');assert.match(s,/code_challenge_method','S256'/);assert.match(s,/state/);});
test('sessão HttpOnly e criptografada',()=>{const s=read('apps/portal/lib/auth.ts');assert.match(s,/aes-256-gcm/);assert.match(s,/httpOnly:true/);assert.match(s,/sameSite:'lax'/);});
test('callback valida state e expiração',()=>{const s=read('apps/portal/app/api/auth/callback/route.ts');assert.match(s,/flow.state!==state/);assert.match(s,/600000/);});
test('sem token no navegador',()=>{const s=read('apps/portal/components/ClinicalAccess.tsx');assert.doesNotMatch(s,/localStorage|access_token|Bearer/);});
test('logout POST e checagem de origem',()=>{const s=read('apps/portal/app/api/auth/logout/route.ts');assert.match(s,/export async function POST/);assert.match(s,/headers.get\('origin'\)/);});
test('pacientes de teste bloqueados por padrão',()=>{const s=read('apps/portal/app/api/clinical/summary/route.ts');assert.match(s,/NODE_ENV!=='production'/);assert.match(s,/NEXT_PUBLIC_ALLOW_SYNTHETIC_UI/);});
