import { Transform, Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Matches the varchar(100) identifier columns in the "measurements" table. */
export const MAX_ID_LENGTH = 100;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateMeasurementDto {
  /**
   * Device-generated identifier for this event. Optional: the documented
   * wearable payload does not include one, so the server assigns an id when
   * the device did not send one.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ID_LENGTH)
  eventId?: string;

  /**
   * Trimmed so the stored value matches the room name a WebSocket client
   * subscribes with (the gateway trims as well).
   */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ID_LENGTH)
  userId!: string;

  /**
   * Full ISO-8601 date-time. Strict mode rejects impossible dates such as
   * 30 February; the pattern rejects date-only values, which ISO-8601 would
   * otherwise allow and which would be stored as midnight.
   */
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, {
    message: 'timestamp must be an ISO-8601 date-time including the time',
  })
  timestamp!: string;

  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(250)
  heartRate!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  hrv?: number;
}
