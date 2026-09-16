import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { Measurement } from './measurements/measurement.entity';
import { MeasurementsModule } from './measurements/measurements.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url:
        process.env.DATABASE_URL ??
        'postgres://interview:interview@localhost:5432/interview',
      entities: [Measurement],
      synchronize: false,
    }),
    RealtimeModule,
    MeasurementsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
