import { ClinicalShell } from '../../components/clinical/ClinicalShell';
import { isAuthorizedTestEnv } from '../../components/TestEnvBanner';
import { bricolage, manrope } from './clinical-fonts';
import './transcricao.css';
import './clinical-v3h.css';
export const dynamic = 'force-dynamic';
export default function ClinicalLayout({ children }: { children: React.ReactNode }) { return <div className={`${bricolage.variable} ${manrope.variable}`}><ClinicalShell testEnv={isAuthorizedTestEnv(process.env.ONCO_ENVIRONMENT)}>{children}</ClinicalShell></div>; }
