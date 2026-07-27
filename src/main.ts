import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Shared by the local dev entrypoint below and the Vercel serverless
// handler (api/index.ts) so both configure the app identically.
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({ origin: config.get<string>('app.allowedCorsOrigin') });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.setGlobalPrefix(config.get<string>('app.apiPrefix') || 'api/v1');

  if (config.get<boolean>('app.swaggerEnabled')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Stock Screener API')
        .setDescription('Technical + fundamental stock screening for NSE/BSE')
        .setVersion('0.1')
        .build(),
    );
    SwaggerModule.setup('api-docs', app, document);
  }

  return app;
}

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') || 3000;
  await app.listen(port);
}

if (require.main === module) {
  bootstrap();
}
