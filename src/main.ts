import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SuccessResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);
  // CORS configuration
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const allowLocalhost = nodeEnv === 'development' || configService.get<string>('ALLOW_LOCALHOST') === 'true';

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // Allow localhost in development or if ALLOW_LOCALHOST is true
      if (allowLocalhost) {
        const localhostPatterns = [
          /^https?:\/\/localhost(:\d+)?$/,
          /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
        ];

        const isLocalhost = localhostPatterns.some((pattern) => pattern.test(origin));
        if (isLocalhost) {
          return callback(null, true);
        }
      }

      // Regex pattern to match akaikumogo.uz and all its subdomains
      const allowedOrigins = [
        /^https?:\/\/([a-zA-Z0-9-]+\.)?akaikumogo\.uz$/,
        /^https?:\/\/akaikumogo\.uz$/,
      ];

      const isAllowed = allowedOrigins.some((pattern) => pattern.test(origin));

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
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

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
}
bootstrap();
