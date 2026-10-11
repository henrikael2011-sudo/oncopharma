import { PatientView } from '../../../../components/clinical/PatientView';
export default async function Paciente({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PatientView id={id} />; }
