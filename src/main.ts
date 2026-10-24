import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './all-exceptions.filter';

async function bootstrap() {
  // Disable built-in body-parser so our custom limit takes effect
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(helmet());

  // Support base64 company logos – max ~3 MB compressed
  app.use(json({ limit: '4mb' }));
  app.use(urlencoded({ extended: true, limit: '4mb' }));

  app.useGlobalFilters(new AllExceptionsFilter());

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

  // Swagger / OpenAPI docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ERP Backend API')
    .setDescription(
      'Multi-module ERP backend: sales, accounting, inventory, procurement, HR, M-Pesa, and eTIMS.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(3000);
  console.log('🚀 ERP Server running on http://localhost:3000/api/v1');
  console.log('📚 API docs available at http://localhost:3000/api/docs');
}
bootstrap();
