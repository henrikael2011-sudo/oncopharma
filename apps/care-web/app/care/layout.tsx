import { CareShell } from '../../components/care/CareShell';
import { isAuthorizedTestEnv } from '../../components/TestEnvBanner';
import { bricolage, manrope } from './care-fonts';
import './consent-v1.css';
export const dynamic = 'force-dynamic';
export default function CareLayout({ children }: { children: React.ReactNode }) { return <div className={`${bricolage.variable} ${manrope.variable}`}><CareShell testEnv={isAuthorizedTestEnv(process.env.ONCO_ENVIRONMENT)}>{children}</CareShell></div>; }
