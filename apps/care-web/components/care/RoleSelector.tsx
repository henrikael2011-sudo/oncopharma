'use client';
// M17 — "Sou paciente / Sou cuidador" (portado do protótipo). Só muda a ORIENTAÇÃO exibida antes do vínculo;
// quem decide o acesso é a API (vínculo do paciente ou convite aceito, com RLS). Nunca concede acesso.
import { useEffect, useState } from 'react';
export type Role = 'patient' | 'caregiver';
const KEY = 'care-role-intent';
export function useRoleIntent(fallback: Role | null) {
  const [role, setRole] = useState<Role | null>(fallback);
  useEffect(() => { const v = sessionStorage.getItem(KEY); if (v === 'patient' || v === 'caregiver') setRole(v); }, []);
  return [role, (r: Role) => { setRole(r); sessionStorage.setItem(KEY, r); }] as const;
}
export function RoleSelector({ role, onChange }: { role: Role | null; onChange: (r: Role) => void }) {
  return <div className="care-role" role="group" aria-label="Como você vai usar o Care?">
    <button type="button" aria-pressed={role === 'patient'} onClick={() => onChange('patient')}>👤 Sou paciente</button>
    <button type="button" aria-pressed={role === 'caregiver'} onClick={() => onChange('caregiver')}>👪 Sou cuidador</button>
  </div>;
}
