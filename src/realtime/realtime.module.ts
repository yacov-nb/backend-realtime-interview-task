import { Module } from '@nestjs/common';
import { RealtimeBus } from './realtime-bus.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  providers: [RealtimeGateway, RealtimeBus],
  exports: [RealtimeGateway, RealtimeBus],
})
export class RealtimeModule {}
