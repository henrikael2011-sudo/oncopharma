import { workProxy } from '../../../../lib/work-proxy';
export const runtime = 'nodejs';
type Ctx = { params: Promise<{ path: string[] }> };
const handle = async (req: Request, { params }: Ctx) => workProxy(req, (await params).path);
export const GET = handle, POST = handle;
