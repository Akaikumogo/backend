import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsMongoId, IsOptional } from 'class-validator';

export type RatingPeriod = 'day' | 'week' | 'month' | 'year';

export class RatingStatsQueryDto {
  @ApiPropertyOptional({
    description: 'Time period to aggregate by',
    enum: ['day', 'week', 'month', 'year'],
    default: 'week',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'year'])
  period?: RatingPeriod;

  @ApiPropertyOptional({
    description: 'Limit stats to a specific region',
  })
  @IsOptional()
  @IsMongoId()
  region?: string;

  @ApiPropertyOptional({
    description: 'Custom start date (ISO string). Overrides period start.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Custom end date (ISO string). Overrides period end.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

