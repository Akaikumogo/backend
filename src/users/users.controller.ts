import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminRole } from '../common/constants/roles.enum';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  async findAll() {
    const users = await this.usersService.findAll();
    return {
      success: true,
      data: users,
    };
  }

  @Get(':id')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }
    return {
      success: true,
      data: user,
    };
  }

  @Get(':id/feedbacks')
  @Roles(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)
  async getUserFeedbacks(@Param('id') id: string) {
    const feedbacks = await this.usersService.getUserFeedbacks(id);
    return {
      success: true,
      data: feedbacks,
    };
  }
}

