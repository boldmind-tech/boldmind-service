import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression = require('compression');
import morgan = require('morgan');
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http.exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { validateDatabaseEnvVars } from './database/validate-env'; 

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate env vars before anything
  const { valid, missing } = validateDatabaseEnvVars();
  if (!valid) {
    logger.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const PORT = configService.get<number>('PORT', 4001);
  const NODE_ENV = configService.get<string>('NODE_ENV', 'development');
  const FRONTEND_ORIGINS = configService.get<string>('ALLOWED_ORIGINS', '').split(',');

  // Security
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // CORS — all BoldMind frontend apps
  app.enableCors({
    origin: NODE_ENV === 'production'
      ? [
        'https://boldmind.ng',
        'https://planai.boldmind.ng',
        'https://os.boldmind.ng',
        'https://tools.boldmind.ng',
        'https://fit.boldmind.ng',
        'https://concept.boldmind.ng',
        'https://amebogist.ng',
        'https://studio.amebogist.ng',
        'https://educenter.com.ng',
        'https://skills.educenter.com.ng',
        ...FRONTEND_ORIGINS.filter(Boolean),
      ]
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-App-ID', 'X-Request-ID'],
  });

  // Cookie parser — must be before any guard that reads req.cookies (e.g. JWT SSO cookie)
  app.use(cookieParser());

  // Compression + logging
  app.use(compression());
  app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

  // Global prefix
  app.setGlobalPrefix('api/v1', { exclude: ['health', '/'] });

  // Global pipes — strict validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  // Swagger — only in non-prod or if explicitly enabled
  if (NODE_ENV !== 'production' || configService.get('SWAGGER_ENABLED') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('BoldMind API')
      .setDescription('BoldMind Ecosystem — 32+ products, 1 monolith. api.boldmind.ng')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('Auth', 'Authentication & SSO')
      .addTag('Users', 'User management')
      .addTag('Payments', 'Paystack integration')
      .addTag('AI', 'OpenAI & AI utilities')
      .addTag('PlanAI', 'PlanAI suite — 12 business tools')
      .addTag('Receptionist', 'AI Receptionist for Meta platforms')
      .addTag('Content', 'AmeboGist CMS')
      .addTag('EduCenter', 'JAMB/WAEC/NECO exam prep')
      .addTag('Automation', 'n8n workflows & BullMQ')
      .addTag('Media', 'Cloudflare R2 uploads')
      .addTag('Notifications', 'Email, WhatsApp, Push')
      .addTag('Fitness', 'NaijaFit')
      .addTag('OS', 'BoldMind OS')
      .addTag('Storefronts', 'Digital Storefronts')
      .addTag('Admin', 'Admin dashboard')
      .addTag('Health', 'Railway healthcheck')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`Swagger docs: http://localhost:${PORT}/api/docs`);
  }

  await app.listen(PORT, '0.0.0.0');
  logger.log(`🚀 BoldMind API running on port ${PORT} [${NODE_ENV}]`);
}

bootstrap();