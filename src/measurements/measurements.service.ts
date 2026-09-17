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
    const entity = this.repository.create({
      ...dto,
      timestamp: new Date(dto.timestamp),
    });
    const saved = await this.repository.save(entity);
    await this.realtimeBus.publish(saved);
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
