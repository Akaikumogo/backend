import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CursorPaginationDto } from '../../common/pagination/cursor-pagination.dto';

export class QueryLogsDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: 'Filter by action' })
  @IsOptional()
  @IsString()
  action?: string;
}
