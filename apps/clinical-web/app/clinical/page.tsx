'use client';
// M20 — após o login, o farmacêutico chega à Visão geral (no topo), com a lista de pacientes vinculados logo abaixo
// (fluxo existente do E2E 06); demais papéis seguem só na lista de pacientes.
import { PharmacistOverview } from '../../components/clinical/PharmacistOverview';
import { useStaff } from '../../components/clinical/ClinicalShell';
import { Worklist } from '../../components/clinical/Worklist';
export default function Clinical() { const me = useStaff(); return me.role === 'pharmacist' ? <><PharmacistOverview /><Worklist embedded /></> : <Worklist />; }
