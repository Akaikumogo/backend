import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UserInfoDto {
  @ApiProperty({ required: true, description: 'Full name' })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: true, description: 'Email address' })
  @IsEmail()
  email!: string;
}
