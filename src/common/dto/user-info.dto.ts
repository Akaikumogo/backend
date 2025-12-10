import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UserInfoDto {
  @ApiProperty({ required: true, description: 'Full name' })
  @IsString()
  fullName!: string;

  @ApiProperty({ required: true, description: 'Phone number' })
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
