import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
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

  const port = config.get<number>('app.port') || 3000;
  await app.listen(port);
}
bootstrap();
