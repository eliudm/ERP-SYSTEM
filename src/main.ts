import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = NestFactory.create(AppModule);

  // Global validation
  (await app).useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  (await app).setGlobalPrefix('api/v1');

  await (await app).listen(3000);
  console.log('🚀 ERP Server running on http://localhost:3000/api/v1');
}
bootstrap();
