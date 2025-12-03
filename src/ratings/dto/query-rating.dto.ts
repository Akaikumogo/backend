import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryRatingDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by region' })
  @IsOptional()
  @IsMongoId()
  region?: string;

  @ApiPropertyOptional({ description: 'Search by user first or last name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Sort format field:direction, e.g. 'submittedAt:desc'" })
  @IsOptional()
  @IsString()
  sort?: string;
}
