import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AdminRole } from '../../common/constants/roles.enum';

export class CreateAdminDto {
  @ApiProperty()
  @IsString()
  fullname!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: AdminRole, default: AdminRole.ADMIN })
  @IsEnum(AdminRole)
  role: AdminRole = AdminRole.ADMIN;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsOptional()
  allowedRegions?: string[];
}
