import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RealtimeBus } from '../realtime/realtime-bus.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { Measurement } from './measurement.entity';

@Injectable()
export class MeasurementsService {
  constructor(
    @InjectRepository(Measurement)
    private readonly repository: Repository<Measurement>,
    private readonly realtimeBus: RealtimeBus,
  ) {}

  async ingest(dto: CreateMeasurementDto): Promise<Measurement> {
    // TODO(candidate):
    // 1. Convert the DTO into a Measurement entity.
    // 2. Persist it.
    // 3. Publish it to realtime clients only after persistence succeeds.
    // 4. Return the persisted entity.
    throw new Error('Not implemented');
  }

  findRecent(userId: string, limit: number): Promise<Measurement[]> {
    return this.repository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
