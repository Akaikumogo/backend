import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({ description: 'Region ID', required: true })
  @IsMongoId()
  regionId!: string;

  @ApiProperty({ description: 'Rating between 1 and 5', required: true })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ description: 'Comment about the rating' })
  @IsOptional()
  @IsString()
  comment?: string;
}
