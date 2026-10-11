'use client';
// M15.4 — chamadas do navegador ao BFF do Clinical (mesma origem; cookie HttpOnly).
export class WorkError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function work<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const r = await fetch(`/api/work/${path}`, { method: init?.method ?? 'GET', cache: 'no-store', headers: init?.body ? { 'content-type': 'application/json' } : undefined, body: init?.body ? JSON.stringify(init.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new WorkError(typeof j.error === 'string' ? j.error : 'Não foi possível concluir agora.', r.status);
  return j as T;
}
export const when = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export type Role = 'pharmacist' | 'physician' | 'nurse' | 'clinical_manager';
export const ROLE_LABEL: Record<Role, string> = { pharmacist: 'Farmácia', physician: 'Medicina', nurse: 'Enfermagem', clinical_manager: 'Gestão clínica' };
export type StaffMe = { role: Role; roleLabel: string; name: string | null; mfa: boolean };
export type Row = { id: string; name: string; record: string | null; severity: 'urgent' | 'review' | null; pending: number };
export type Action = { to: string; label: string };
export type Alert = { id: string; code: string; level: string; status: string; statusLabel: string; ruleVersion: string; explanation: string; description: string | null; reportedBy: string | null; createdAt: string; changedAt: string | null; final: boolean; actions: Action[] };
export type Task = { id: string; kind: 'task' | 'referral'; title: string; details: string | null; assigneeRole: Role; assigneeLabel: string; dueAt: string | null; status: 'open' | 'received' | 'done' | 'cancelled'; createdAt: string; mine: boolean; receivedAt: string | null; closedAt: string | null; outcome: string | null; canReceive: boolean; canComplete: boolean; canCancel: boolean };
export type PatientData = { patient: { id: string; name: string; record: string | null }; role: Role; alerts: Alert[]; tasks: Task[]; interventionAllowed: boolean };
