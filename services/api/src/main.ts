import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.use(helmet());
  app.setGlobalPrefix('v1');
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (allowed.length) app.enableCors({ origin: allowed, credentials: false });
  await app.listen(Number(process.env.PORT || 4000), '127.0.0.1');
}
bootstrap().catch((err) => { console.error('Falha ao iniciar API:', err); process.exit(1); });
