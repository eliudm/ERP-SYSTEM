import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  // Disable built-in body-parser so our custom limit takes effect
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Support base64 company logos – max ~3 MB compressed
  app.use(json({ limit: '4mb' }));
  app.use(urlencoded({ extended: true, limit: '4mb' }));

  // Allow frontend dev server to call backend APIs
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  await app.listen(3000);
  console.log('🚀 ERP Server running on http://localhost:3000/api/v1');
}
bootstrap();
