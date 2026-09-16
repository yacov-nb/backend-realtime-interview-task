import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { RealtimeBus } from '../realtime/realtime-bus.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { Measurement } from './measurement.entity';

@Injectable()
export class MeasurementsService {
  private readonly logger = new Logger(MeasurementsService.name);

  constructor(
    @InjectRepository(Measurement)
    private readonly repository: Repository<Measurement>,
    private readonly realtimeBus: RealtimeBus,
  ) {}

  async ingest(dto: CreateMeasurementDto): Promise<Measurement> {
    const measurement = this.repository.create({
      eventId: dto.eventId ?? randomUUID(),
      userId: dto.userId,
      timestamp: new Date(dto.timestamp),
      heartRate: dto.heartRate,
      hrv: dto.hrv ?? null,
    });

    const saved = await this.repository.save(measurement);

    // The database is the source of truth; realtime delivery is best-effort.
    // A publish failure must not turn a successful write into a failed
    // request, otherwise the device would retry and store a duplicate.
    try {
      await this.realtimeBus.publish(saved);
    } catch (error) {
      this.logger.error(
        `Failed to publish measurement ${saved.id} for user ${saved.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return saved;
  }

  findRecent(userId: string, limit: number): Promise<Measurement[]> {
    return this.repository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
