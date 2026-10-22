import { CareShell } from '../../components/care/CareShell';
import { isAuthorizedTestEnv } from '../../components/TestEnvBanner';
import './care-mobile.css';
export const dynamic = 'force-dynamic';
export default function CareLayout({ children }: { children: React.ReactNode }) { return <CareShell testEnv={isAuthorizedTestEnv(process.env.ONCO_ENVIRONMENT)}>{children}</CareShell>; }
