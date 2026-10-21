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
export type StaffMe = { roles?: string[]; role: Role; roleLabel: string; name: string | null; mfa: boolean };
export type RowAllocation = { unit: string; floor: string | null; room: string | null; bed: string | null; source: 'hospital' | 'manual' | 'pdf'; conflict: boolean };
export type Row = { id: string; name: string; record: string | null; severity: 'urgent' | 'review' | null; pending: number; allocation: RowAllocation | null };
export type Worklist = { patients: Row[]; searched: boolean; lastSync: { at: string; source: string } | null };
export type SyncResult = { at: string; source: string; received: number; updated: number; unchanged: number; conflicts: number; not_found: number };
export type AllocationView = { current: { label: string; source: 'hospital' | 'manual' | 'pdf'; at: string; origin: string; unit: string; floor: string | null; room: string | null; bed: string | null } | null;
  conflict: { label: string; at: string; origin: string } | null; manualAllowed: boolean };
export const roomLabel = (a: { room: string | null; bed: string | null }) => [a.room ? (/^\d/.test(a.room) ? `Quarto ${a.room}` : a.room) : null, a.bed ? `Leito ${a.bed}` : null].filter(Boolean).join(' · ');
export type Action = { to: string; label: string };
export type Alert = { id: string; code: string; level: string; status: string; statusLabel: string; ruleVersion: string; explanation: string; description: string | null; reportedBy: string | null; createdAt: string; changedAt: string | null; final: boolean; actions: Action[] };
export type Task = { id: string; kind: 'task' | 'referral'; title: string; details: string | null; assigneeRole: Role; assigneeLabel: string; dueAt: string | null; status: 'open' | 'received' | 'done' | 'cancelled'; createdAt: string; mine: boolean; receivedAt: string | null; closedAt: string | null; outcome: string | null; canReceive: boolean; canComplete: boolean; canCancel: boolean };
export type PatientData = { patient: { id: string; name: string; record: string | null }; allocation: AllocationView; role: Role; alerts: Alert[]; tasks: Task[]; interventionAllowed: boolean };
export type ImportRow = { id: string; line: number; record: string | null; name: string | null; allocation: string | null; action: 'create' | 'update' | 'unchanged' | 'conflict' | 'not_linked' | 'invalid'; current: string | null; nameDivergent: boolean; currentName: string | null; error: string | null };
export type ImportPreview = { importId: string; fileName: string; sha256: string; sizeBytes: number; layout: string; uploadedAt: string; previouslyImportedAt: string | null;
  counts: { create: number; update: number; unchanged: number; conflict: number; not_linked: number; invalid: number }; rows: ImportRow[] };
export type ImportResult = { importId: string; status: 'confirmed' | 'discarded'; created?: number; updated?: number; conflicts?: number; skipped?: number };
// M20 — Visão geral do farmacêutico (dados fictícios; somente pacientes vinculados).
export type Overview = { role: Role; fictional: true; generatedAt: string; lastSync: { at: string; source: string } | null;
  pending: { prescriptionChecks: number; openAlerts: number; awaitingPhysician: number; openTasks: number; fever: number; expiringSoon: number; total: number };
  feverThresholdC: number; fever: { patientId: string; name: string; record: string | null; place: string; celsius: number; measuredAt: string; priority: 'alta' | 'media' }[];
  stabilityNotice: string; expiring: { id: string; medication: string; container: string; patient: string; place: string; usedPercent: number; remainingMinutes: number; remaining: string; level: 'critico' | 'atencao' | 'ok'; source: string }[];
  aiConference: { href: string; pending: number } };
export const celsius = (v: number) => `${v.toFixed(1).replace('.', ',')} °C`;
