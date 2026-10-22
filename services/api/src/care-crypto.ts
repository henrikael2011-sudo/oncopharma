// M21.2 — cifra em repouso de dados do Care (AES-256-GCM, mesmo esquema de pdf-import.ts). Fail-closed sem chave.
import { createHash } from 'node:crypto';
import { decryptFile, encryptFile } from './pdf-import';
export function careKey(): { key: Buffer; id: string } {
  const raw = process.env.CARE_ENCRYPTION_KEY; const key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (key.length !== 32) throw new Error('CARE_ENCRYPTION_KEY ausente ou inválida');
  return { key, id: createHash('sha256').update(key).digest('hex').slice(0, 12) };
}
export const sealText = (text: string, key: Buffer) => encryptFile(Buffer.from(text, 'utf8'), key);
export const openText = (e: { iv: Buffer; tag: Buffer; ciphertext: Buffer }, key: Buffer) => decryptFile(e, key).toString('utf8');
