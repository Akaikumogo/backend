import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { FeedbackStatus } from '../../common/constants/feedback-status.enum';

export class QueryFeedbackDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  region?: string;

  @ApiPropertyOptional({ description: 'Search by name or subject' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: FeedbackStatus })
  @IsOptional()
  @IsIn(Object.values(FeedbackStatus))
  status?: FeedbackStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sort?: string;
}
