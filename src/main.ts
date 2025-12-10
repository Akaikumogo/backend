/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SuccessResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

  // Security Headers (Helmet)
  app.use(
    helmet.default({
      contentSecurityPolicy: nodeEnv === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Request size limiting (10MB max)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS configuration - Fixed: Origin required in production
  const allowLocalhost =
    nodeEnv === 'development' ||
    configService.get<string>('ALLOW_LOCALHOST') === 'true';

  // Whitelist approach instead of regex (more secure)
  const allowedOrigins = [
    'https://akaikumogo.uz',
    'https://admin.akaikumogo.uz',
    'https://www.akaikumogo.uz',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // In production, origin is required
      if (!origin) {
        if (allowLocalhost) {
          // Allow no origin only in development
          return callback(null, true);
        }
        return callback(new Error('Origin required'), false);
      }

      // Allow localhost in development
      if (allowLocalhost) {
        const localhostPatterns = [
          /^https?:\/\/localhost(:\d+)?$/,
          /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
        ];

        const isLocalhost = localhostPatterns.some((pattern) =>
          pattern.test(origin),
        );
        if (isLocalhost) {
          return callback(null, true);
        }
      }

      // Check against whitelist
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new LoggingInterceptor(),
    new SuccessResponseInterceptor(),
  );

  // Swagger only in development
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Admin Panel API')
      .setDescription('Enterprise-grade admin backend')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Auth')
      .addTag('Admins')
      .addTag('Regions')
      .addTag('Pagination')
      .addTag('Ratings')
      .addTag('Feedbacks')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
bootstrap();
