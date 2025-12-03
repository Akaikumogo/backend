import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { SortOrder } from 'mongoose';
import { Rating, RatingDocument } from './schemas/rating.schema';
import { CreateRatingDto } from './dto/create-rating.dto';
import { QueryRatingDto } from './dto/query-rating.dto';
import { Region, RegionDocument } from '../regions/schemas/region.schema';
import { buildPaginationMeta } from '../common/pagination/pagination.util';
import { RequestUser } from '../common/types/request-user.type';
import { AdminRole } from '../common/constants/roles.enum';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class RatingsService {
  constructor(
    @InjectModel(Rating.name) private readonly ratingModel: Model<RatingDocument>,
    @InjectModel(Region.name) private readonly regionModel: Model<RegionDocument>,
    private readonly logsService: LogsService,
  ) {}

  async create(dto: CreateRatingDto) {
    await this.ensureRegion(dto.regionId);

    const rating = await this.ratingModel.create({
      regionId: new Types.ObjectId(dto.regionId),
      rating: dto.rating,
      comment: dto.comment,
    });

    await this.logsService.record('CREATE_RATING', rating.id);

    return {
      message: 'Rahmat! Sizning fikringiz biz uchun muhim!',
      status: 'success',
      data: {
        id: rating.id,
        submittedAt: rating.submittedAt,
      },
      actionText: 'Yangi baho qo\'shildi',
    };
  }

  async findAll(query: QueryRatingDto, currentUser: RequestUser) {
    const { limit = 10, page = 1, search, region, sort } = query;
    const filter: Record<string, any> = {};
    const andConditions: Record<string, any>[] = [];

    if (currentUser.role === AdminRole.ADMIN) {
      if (!currentUser.allowedRegions?.length) {
        return { meta: buildPaginationMeta(0, page, limit), data: [] };
      }

      // Admin faqat o'ziga biriktirilgan hududlarni ko'ra oladi
      const allowedRegionIds = currentUser.allowedRegions.map((id) => new Types.ObjectId(id));
      
      if (region) {
        // Agar region parametri berilgan bo'lsa, u admin'ning allowedRegions'ida bo'lishi kerak
        if (!currentUser.allowedRegions.includes(region)) {
          return { meta: buildPaginationMeta(0, page, limit), data: [] };
        }
        andConditions.push({ regionId: new Types.ObjectId(region) });
      } else {
        // Region parametri berilmagan bo'lsa, faqat allowedRegions'ni filter qil
        andConditions.push({
          regionId: {
            $in: allowedRegionIds,
          },
        });
      }
    } else if (region) {
      // Super admin uchun region filter
      andConditions.push({ regionId: new Types.ObjectId(region) });
    }

    // Search removed as rating no longer has userInfo

    if (andConditions.length) {
      filter.$and = andConditions;
    }

    const sortOptions = this.parseSort(sort);

    const [total, data] = await Promise.all([
      this.ratingModel.countDocuments(filter),
      this.ratingModel
        .find(filter)
        .populate('regionId', 'id name')
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean({ virtuals: true }),
    ]);

    return {
      meta: buildPaginationMeta(total, page, limit),
      data: data.map((rating) => this.formatRating(rating)),
      actionText: 'Admin baholarni ko\'rdi',
    };
  }

  async findOne(id: string, currentUser: RequestUser) {
    const rating = await this.ratingModel
      .findById(id)
      .populate('regionId', 'id name')
      .lean({ virtuals: true });

    if (!rating) {
      throw new NotFoundException('Rating not found');
    }

    if (currentUser.role === AdminRole.ADMIN) {
      if (!currentUser.allowedRegions?.length) {
        throw new NotFoundException('Rating not found');
      }

      const ratingRegionId = rating.regionId?.toString?.() || 
        (typeof rating.regionId === 'object' && rating.regionId?._id?.toString()) ||
        (typeof rating.regionId === 'object' && rating.regionId?.id?.toString()) ||
        '';

      if (
        ratingRegionId &&
        !currentUser.allowedRegions
          .map((rid) => rid.toString())
          .includes(ratingRegionId)
      ) {
        throw new NotFoundException('Rating not found');
      }
    }

    return {
      success: true,
      data: this.formatRating(rating),
    };
  }

  private async ensureRegion(regionId: string) {
    const exists = await this.regionModel.exists({ _id: regionId });
    if (!exists) {
      throw new NotFoundException('Region not found');
    }
  }

  private parseSort(sort?: string): Record<string, SortOrder> {
    if (!sort) {
      return { submittedAt: -1 };
    }

    const [field, direction] = sort.split(':');
    const dir: SortOrder = direction === 'asc' ? 1 : -1;
    const allowed = ['submittedAt', 'rating'];

    if (!allowed.includes(field)) {
      return { submittedAt: -1 };
    }

    return { [field]: dir };
  }

  private formatRating(rating: any) {
    // Handle regionId - could be ObjectId or populated object
    let regionId: string | undefined;
    if (rating.regionId) {
      if (typeof rating.regionId === 'object' && rating.regionId._id) {
        regionId = rating.regionId._id.toString();
      } else if (typeof rating.regionId === 'object' && rating.regionId.id) {
        regionId = rating.regionId.id.toString();
      } else {
        regionId = rating.regionId.toString();
      }
    }

    return {
      id: rating._id?.toString() || rating.id,
      ratingId: rating._id?.toString() || rating.id,
      regionId: regionId,
      region: rating.regionId && typeof rating.regionId === 'object'
        ? {
            id: rating.regionId._id?.toString() || rating.regionId.id?.toString(),
            name: rating.regionId.name,
          }
        : undefined,
      rating: rating.rating,
      ratingStars: rating.rating,
      ratingNumber: rating.rating,
      ratingText: rating.comment,
      comment: rating.comment,
      submittedAt: rating.submittedAt,
    };
  }
}
