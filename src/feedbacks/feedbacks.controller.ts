import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FeedbacksService } from './feedbacks.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { Public } from '../common/decorators/public.decorator';
import { QueryFeedbackDto } from './dto/query-feedback.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminRole } from '../common/constants/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/request-user.type';
import { UpdateFeedbackStatusDto } from './dto/update-feedback.dto';

@ApiTags('Feedbacks')
@Controller()
export class FeedbacksController {
  constructor(private readonly feedbacksService: FeedbacksService) {}

  @Public()
  @Post('feedbacks')
  create(@Body() dto: CreateFeedbackDto) {
    return this.feedbacksService.create(dto);
  }

  @ApiBearerAuth()
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @Get('admin/feedbacks')
  findAll(
    @Query() query: QueryFeedbackDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.feedbacksService.findAll(query, user);
  }

  @ApiBearerAuth()
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @Get('admin/feedbacks/:id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.feedbacksService.findOne(id, user);
  }

  @ApiBearerAuth()
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @Patch('admin/feedbacks/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.feedbacksService.update(id, dto, user);
  }
}
