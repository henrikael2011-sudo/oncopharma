'use client';
// M15.2 — chamadas do navegador ao BFF do Care (mesma origem; cookie HttpOnly).
export class CareError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function care<T>(path: string, init?: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown }): Promise<T> {
  const r = await fetch(`/api/care/${path}`, { method: init?.method ?? 'GET', cache: 'no-store', headers: init?.body ? { 'content-type': 'application/json' } : undefined, body: init?.body ? JSON.stringify(init.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new CareError(typeof j.error === 'string' ? j.error : 'Não foi possível concluir agora. Tente novamente.', r.status);
  return j as T;
}
export const dateBR = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
export type Me = { actor: 'patient'; displayName: string | null; consent: { required: string; accepted: boolean; acceptedAt: string | null }; preferences: { fontScale: 'normal' | 'large' | 'xlarge'; highContrast: boolean } };
