import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Browser clients must be listed explicitly in production. Native apps and server-to-server
  // calls send no Origin header, so they are always allowed.
  const allowed = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === 'production' && allowed.length === 0) {
    console.warn('CORS_ORIGINS is not set; browser cross-origin requests are allowed from any origin.');
  }
  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || allowed.length === 0 || allowed.includes(origin)),
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
