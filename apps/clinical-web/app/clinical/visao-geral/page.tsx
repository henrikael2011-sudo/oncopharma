'use client';
// M20 — Visão geral do farmacêutico (pendências, febre >= 37,8 °C, vencimentos). Outros papéis veem a lista de pacientes.
import { PharmacistOverview } from '../../../components/clinical/PharmacistOverview';
import { useStaff } from '../../../components/clinical/ClinicalShell';
import { Worklist } from '../../../components/clinical/Worklist';
export default function VisaoGeral() { const me = useStaff(); return me.role === 'pharmacist' ? <PharmacistOverview /> : <Worklist />; }
