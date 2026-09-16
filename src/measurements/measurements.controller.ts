import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { MeasurementsService } from './measurements.service';

@Controller('measurements')
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Post()
  create(@Body() dto: CreateMeasurementDto) {
    return this.measurementsService.ingest(dto);
  }

  @Get(':userId')
  findRecent(
    @Param('userId') userId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.measurementsService.findRecent(userId, Math.min(limit, 100));
  }
}
