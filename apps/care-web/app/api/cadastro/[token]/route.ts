import { registrationProxy } from '../../../../lib/registration-proxy';
export const runtime = 'nodejs';
type Ctx = { params: Promise<{ token: string }> };
const handle = async (req: Request, { params }: Ctx) => registrationProxy(req, (await params).token);
export const GET = handle, POST = handle;
