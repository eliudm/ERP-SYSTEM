import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded, raw } from 'express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './all-exceptions.filter';

async function bootstrap() {
  // Disable built-in body-parser so our custom limit takes effect
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(helmet());

  // Stripe webhook needs the raw body for signature verification
  app.use('/api/v1/billing/stripe/webhook', raw({ type: 'application/json' }));

  // Support base64 company logos – max ~3 MB compressed
  app.use(json({ limit: '4mb' }));
  app.use(urlencoded({ extended: true, limit: '4mb' }));

  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS: allow localhost in dev, or the explicit CORS_ORIGIN env var in production
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin header)
      if (!origin) return callback(null, true);
      // Always allow localhost for local dev / ngrok tunnels
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      // In production allow the configured origin(s)
      if (corsOrigin) {
        const allowed = corsOrigin.split(',').map(o => o.trim());
        if (allowed.includes(origin)) return callback(null, true);
      }
      callback(new Error(`CORS: origin '${origin}' not allowed`));
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

  // Swagger only in non-production environments
  if (process.env.NODE_ENV !== 'production') {
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
  }

  await app.listen(3000);
  console.log('🚀 ERP Server running on http://localhost:3000/api/v1');
  console.log('📚 API docs available at http://localhost:3000/api/docs');
}
bootstrap();
