import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { Public } from '../common/decorators/public.decorator';
import { QueryRatingDto } from './dto/query-rating.dto';
import { RatingStatsQueryDto } from './dto/rating-stats.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminRole } from '../common/constants/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/request-user.type';

@ApiTags('Ratings')
@Controller()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Public()
  @Post('ratings')
  create(@Body() dto: CreateRatingDto) {
    return this.ratingsService.create(dto);
  }

  @ApiBearerAuth()
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @Get('admin/ratings')
  findAll(@Query() query: QueryRatingDto, @CurrentUser() user: RequestUser) {
    return this.ratingsService.findAll(query, user);
  }

  @ApiBearerAuth()
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @Get('admin/ratings/stats')
  getStats(
    @Query() query: RatingStatsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ratingsService.getStats(query, user);
  }

  @ApiBearerAuth()
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  @Get('admin/ratings/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.ratingsService.findOne(id, user);
  }
}
