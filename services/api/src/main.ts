import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
// express (via @nestjs/platform-express) sem @types/express: tipagem mínima dos parsers usados.
type Mw = (...a: unknown[]) => void;
const { json, urlencoded } = require('express') as { json: (o: { limit: string }) => Mw; urlencoded: (o: { extended: boolean; limit: string }) => Mw };

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(helmet());
  // M15.4c — limite ampliado SOMENTE no envio de PDF (2 MB em base64); demais rotas mantêm 100 kB.
  app.use('/v1/clinical/imports/pdf', json({ limit: '3mb' }));
  app.use(json({ limit: '100kb' })); app.use(urlencoded({ extended: false, limit: '100kb' }));
  app.setGlobalPrefix('v1');
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (allowed.length) app.enableCors({ origin: allowed, credentials: false });
  await app.listen(Number(process.env.PORT || 4000), '127.0.0.1');
}
bootstrap().catch((err) => { console.error('Falha ao iniciar API:', err); process.exit(1); });
