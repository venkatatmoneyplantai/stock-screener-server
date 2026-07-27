import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import databaseConfig from './database/typeorm.config';
import { DatabaseModule } from './database/database.module';
import { ScreeningModule } from './screening/screening.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
    }),
    DatabaseModule,
    ScreeningModule,
    HealthModule,
  ],
})
export class AppModule {}
