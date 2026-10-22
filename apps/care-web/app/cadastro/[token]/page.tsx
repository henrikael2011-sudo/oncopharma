import { SelfRegistration } from '../../../components/care/SelfRegistration';
import { isAuthorizedTestEnv } from '../../../components/TestEnvBanner';
type Props = { params: Promise<{ token: string }> };
export default async function Cadastro({ params }: Props) {
  return <SelfRegistration token={(await params).token} testEnv={isAuthorizedTestEnv(process.env.ONCO_ENVIRONMENT)} />;
}
