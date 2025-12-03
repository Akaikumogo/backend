import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserInfoDto } from '../../common/dto/user-info.dto';

export class CreateFeedbackDto {
  @ApiProperty()
  @IsMongoId()
  regionId!: string;

  @ApiProperty()
  @IsMongoId()
  ratingId!: string;

  @ApiProperty()
  @IsBoolean()
  anonymous!: boolean;

  @ApiProperty({ description: 'Feedback or complaint message' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({ description: 'Short subject' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ type: UserInfoDto })
  @ValidateIf((o) => !o.anonymous)
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => UserInfoDto)
  userInfo?: UserInfoDto;
}
