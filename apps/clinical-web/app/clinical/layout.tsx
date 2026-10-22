import { ClinicalShell } from '../../components/clinical/ClinicalShell';
import { isAuthorizedTestEnv } from '../../components/TestEnvBanner';
import './transcricao.css';
export const dynamic = 'force-dynamic';
export default function ClinicalLayout({ children }: { children: React.ReactNode }) { return <ClinicalShell testEnv={isAuthorizedTestEnv(process.env.ONCO_ENVIRONMENT)}>{children}</ClinicalShell>; }
