import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION = 'onco_session';
export const FLOW = 'onco_login_flow';
export type Session = { token:string; expiresAt:number };
const required = (name:string) => { const value=process.env[name]; if (!value) throw new Error(`${name} não configurado`); return value; };
const key = () => { const raw=Buffer.from(required('SESSION_ENCRYPTION_KEY'),'base64'); if(raw.length!==32) throw new Error('SESSION_ENCRYPTION_KEY deve conter 32 bytes base64'); return raw; };
export const origin = () => required('PORTAL_ORIGIN').replace(/\/$/,'');
export const secureCookie = () => process.env.NODE_ENV==='production';
export function seal(value:unknown):string { const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url'); }
export function unseal<T>(text:string):T|null { try { const b=Buffer.from(text,'base64url');if(b.length<29)return null;const decipher=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));decipher.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(b.subarray(28)),decipher.final()]).toString('utf8')) as T; }catch{return null;} }
export const random = () => randomBytes(32).toString('base64url');
export const challenge = (verifier:string) => createHash('sha256').update(verifier).digest('base64url');
export async function session():Promise<Session|null> {const raw=(await cookies()).get(SESSION)?.value;if(!raw)return null;const s=unseal<Session>(raw);return s && typeof s.token==='string' && Number.isFinite(s.expiresAt) && s.expiresAt>Date.now()+5000 ? s : null;}
export const cookieOptions = (maxAge:number) => ({httpOnly:true,secure:secureCookie(),sameSite:'lax' as const,path:'/',maxAge});
export function oidcConfig(){return {issuer:required('OIDC_ISSUER'),authorizationEndpoint:required('OIDC_AUTHORIZATION_ENDPOINT'),tokenEndpoint:required('OIDC_TOKEN_ENDPOINT'),clientId:required('OIDC_CLIENT_ID')};}
