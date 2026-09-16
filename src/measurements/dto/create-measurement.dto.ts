import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateMeasurementDto {
  @IsString()
  eventId!: string;

  @IsString()
  userId!: string;

  @IsISO8601()
  timestamp!: string;

  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(250)
  heartRate!: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  hrv?: number;
}
