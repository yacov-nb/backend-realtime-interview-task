import { Injectable } from '@nestjs/common';
import { Measurement } from '../measurements/measurement.entity';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeBus {
  constructor(private readonly gateway: RealtimeGateway) {}

  async publish(measurement: Measurement): Promise<void> {
    // Initial single-instance implementation.
    // This abstraction deliberately exists so the transport can evolve later.
    this.gateway.publishMeasurement(measurement);
  }
}
