import { Worklist } from '../../components/clinical/Worklist';
// Entrada do Clinical = lista de pacientes vinculados (fluxo coberto pelo E2E 06). O farmacêutico tem a Visão geral
// como primeiro item do menu (/clinical/visao-geral).
export default function Clinical() { return <Worklist />; }
