import { careProxy } from '../../../../lib/care-proxy';
export const runtime = 'nodejs';
type Ctx = { params: Promise<{ path: string[] }> };
const handle = async (req: Request, { params }: Ctx) => careProxy(req, (await params).path);
export const GET = handle, POST = handle, PUT = handle;
