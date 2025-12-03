import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UserInfoDto {
  @ApiProperty({ required: true })
  @IsString()
  firstName!: string;

  @ApiProperty({ required: true })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiProperty({ required: true })
  @IsString()
  phone!: string;

  @ApiProperty({ required: true })
  @IsString()
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}
