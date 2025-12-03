import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RegionsService } from './regions.service';
import { RegionsController } from './regions.controller';
import { Region, RegionSchema } from './schemas/region.schema';
import { Rating, RatingSchema } from '../ratings/schemas/rating.schema';
import { Admin, AdminSchema } from '../admins/schemas/admin.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Region.name, schema: RegionSchema },
      { name: Rating.name, schema: RatingSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
  ],
  controllers: [RegionsController],
  providers: [RegionsService],
  exports: [RegionsService],
})
export class RegionsModule {}
