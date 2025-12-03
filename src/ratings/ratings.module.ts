import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { Rating, RatingSchema } from './schemas/rating.schema';
import { Region, RegionSchema } from '../regions/schemas/region.schema';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [
    LogsModule,
    MongooseModule.forFeature([
      { name: Rating.name, schema: RatingSchema },
      { name: Region.name, schema: RegionSchema },
    ]),
  ],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
