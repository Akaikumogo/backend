import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RegionsService } from './regions.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AdminRole } from '../common/constants/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/request-user.type';

@ApiTags('Regions')
@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER_ADMIN)
  create(@Body() dto: CreateRegionDto) {
    return this.regionsService.create(dto);
  }

  @Public()
  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() currentUser?: RequestUser,
  ) {
    return this.regionsService.findAll(query, currentUser);
  }

  @Public()
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser?: RequestUser,
  ) {
    return this.regionsService.findOne(id, currentUser);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateRegionDto) {
    return this.regionsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.regionsService.remove(id);
  }
}
