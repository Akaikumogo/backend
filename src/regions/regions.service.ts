import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Region, RegionDocument } from './schemas/region.schema';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { buildPaginationMeta } from '../common/pagination/pagination.util';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { Rating, RatingDocument } from '../ratings/schemas/rating.schema';
import { Admin, AdminDocument } from '../admins/schemas/admin.schema';
import type { RequestUser } from '../common/types/request-user.type';
import { AdminRole } from '../common/constants/roles.enum';

@Injectable()
export class RegionsService {
  constructor(
    @InjectModel(Region.name)
    private readonly regionModel: Model<RegionDocument>,
    @InjectModel(Rating.name)
    private readonly ratingModel: Model<RatingDocument>,
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
  ) {}

  async create(dto: CreateRegionDto) {
    const exists = await this.regionModel.findOne({ name: dto.name });
    if (exists) {
      throw new ConflictException('Region already exists');
    }

    const created = await this.regionModel.create(dto);
    return created.toObject({ virtuals: true });
  }

  async findAll(query: PaginationQueryDto, currentUser?: RequestUser) {
    const { page = 1, limit = 10 } = query;

    const filter: Record<string, any> = {};

    // If user is ADMIN, filter by their allowedRegions
    if (currentUser?.role === AdminRole.ADMIN) {
      if (!currentUser.allowedRegions?.length) {
        return {
          meta: buildPaginationMeta(0, page, limit),
          data: [],
        };
      }

      filter._id = {
        $in: currentUser.allowedRegions.map((id) => new Types.ObjectId(id)),
      };
    }

    const [total, data] = await Promise.all([
      this.regionModel.countDocuments(filter),
      this.regionModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ created_at: -1 })
        .lean({ virtuals: true }),
    ]);

    return {
      meta: buildPaginationMeta(total, page, limit),
      data,
    };
  }

  async findOne(id: string, currentUser?: RequestUser) {
    const region = await this.regionModel.findById(id).lean({ virtuals: true });
    if (!region) {
      throw new NotFoundException('Region not found');
    }

    // If user is ADMIN, check if they have access to this region
    if (currentUser?.role === AdminRole.ADMIN) {
      if (!currentUser.allowedRegions?.length) {
        throw new ForbiddenException('Access denied');
      }

      const regionIdString = region._id?.toString() || region.id?.toString();
      if (!currentUser.allowedRegions.includes(regionIdString)) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Get rating statistics
    interface RatingStats {
      averageRating?: number;
      totalRatings?: number;
      ratingCounts?: number[];
    }

    const ratingStats = await this.ratingModel.aggregate<RatingStats>([
      { $match: { regionId: new Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          ratingCounts: {
            $push: '$rating',
          },
        },
      },
    ]);

    const stats: RatingStats = ratingStats[0] || {
      averageRating: 0,
      totalRatings: 0,
      ratingCounts: [],
    };

    // Count ratings by value (1-5)
    const ratingBreakdown = {
      '1': (stats.ratingCounts || []).filter((r: number) => r === 1).length,
      '2': (stats.ratingCounts || []).filter((r: number) => r === 2).length,
      '3': (stats.ratingCounts || []).filter((r: number) => r === 3).length,
      '4': (stats.ratingCounts || []).filter((r: number) => r === 4).length,
      '5': (stats.ratingCounts || []).filter((r: number) => r === 5).length,
      total: stats.totalRatings || 0,
      average: stats.averageRating
        ? Number(stats.averageRating.toFixed(2))
        : 0,
    };

    // Count admins assigned to this region (exclude super admins)
    const adminCount = await this.adminModel.countDocuments({
      allowedRegions: new Types.ObjectId(id),
      role: { $ne: AdminRole.SUPER_ADMIN }, // Exclude super admins
    });

    return {
      success: true,
      data: {
        ...region,
        adminCount,
        rating: ratingBreakdown,
      },
    };
  }

  async update(id: string, dto: UpdateRegionDto) {
    const region = await this.regionModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!region) {
      throw new NotFoundException('Region not found');
    }
    return region;
  }

  async remove(id: string) {
    const region = await this.regionModel.findByIdAndDelete(id);
    if (!region) {
      throw new NotFoundException('Region not found');
    }
    return { id };
  }
}
