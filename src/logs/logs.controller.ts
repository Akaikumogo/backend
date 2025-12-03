import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { QueryLogsDto } from './dto/query-logs.dto';

@ApiTags('Pagination')
@ApiBearerAuth()
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  findAll(@Query() query: QueryLogsDto) {
    return this.logsService.findAll(query);
  }
}
