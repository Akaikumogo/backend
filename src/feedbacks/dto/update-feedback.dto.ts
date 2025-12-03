import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { FeedbackStatus } from '../../common/constants/feedback-status.enum';

export class UpdateFeedbackStatusDto {
  @ApiProperty({ enum: FeedbackStatus })
  @IsIn(Object.values(FeedbackStatus))
  status!: FeedbackStatus;

  @ApiPropertyOptional({ description: 'Admin response text' })
  @IsOptional()
  @IsString()
  response?: string;
}
