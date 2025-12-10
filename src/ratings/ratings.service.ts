import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import type { SortOrder } from 'mongoose';
import { Rating, RatingDocument } from './schemas/rating.schema';
import { CreateRatingDto } from './dto/create-rating.dto';
import { QueryRatingDto } from './dto/query-rating.dto';
import { RatingStatsQueryDto, RatingPeriod } from './dto/rating-stats.dto';
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
        throw new ForbiddenException('Access denied');
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
        throw new ForbiddenException('Access denied');
      }
    }

    return {
      success: true,
      data: this.formatRating(rating),
    };
  }

  async getStats(query: RatingStatsQueryDto, currentUser: RequestUser) {
    const { period = 'week', region, startDate, endDate } = query;

    const { start, end } = this.resolveDateRange(period, startDate, endDate);
    if (!start || !end || start > end) {
      throw new BadRequestException('Invalid date range');
    }

    let allowedRegions: Types.ObjectId[] | undefined;
    if (currentUser.role === AdminRole.ADMIN) {
      if (!currentUser.allowedRegions?.length) {
        return {
          success: true,
          data: {
            period,
            range: { start: start.toISOString(), end: end.toISOString() },
            distribution: [],
            trend: [],
          },
        };
      }
      allowedRegions = currentUser.allowedRegions.map(
        (id) => new Types.ObjectId(id),
      );
    }

    const regionFilter: FilterQuery<Region> = {};
    if (region) {
      const regionObjectId = new Types.ObjectId(region);
      if (
        allowedRegions &&
        !allowedRegions.some((rid) => rid.equals(regionObjectId))
      ) {
        return {
          success: true,
          data: {
            period,
            range: { start: start.toISOString(), end: end.toISOString() },
            distribution: [],
            trend: [],
          },
        };
      }
      regionFilter._id = regionObjectId;
    } else if (allowedRegions) {
      regionFilter._id = { $in: allowedRegions };
    }

    const regions = await this.regionModel
      .find(regionFilter)
      .select('id name')
      .lean({ virtuals: true });

    if (!regions.length) {
      return {
        success: true,
        data: {
          period,
          range: { start: start.toISOString(), end: end.toISOString() },
          distribution: [],
          trend: [],
        },
      };
    }

    const ratingMatch: Record<string, any> = {
      $expr: {
        $and: [
          { $gte: [{ $ifNull: ['$created_at', '$submittedAt'] }, start] },
          { $lte: [{ $ifNull: ['$created_at', '$submittedAt'] }, end] },
        ],
      },
    };

    if (region) {
      ratingMatch.regionId = new Types.ObjectId(region);
    } else if (allowedRegions) {
      ratingMatch.regionId = { $in: allowedRegions };
    }

    const [distributionRaw, trendRaw] = await Promise.all([
      this.ratingModel.aggregate<{
        regionId: Types.ObjectId;
        rating: number;
        count: number;
      }>([
        { $match: ratingMatch },
        {
          $group: {
            _id: { regionId: '$regionId', rating: '$rating' },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            regionId: '$_id.regionId',
            rating: '$_id.rating',
            count: 1,
          },
        },
      ]),
      this.ratingModel.aggregate<{
        regionId: Types.ObjectId;
        date: string;
        average: number;
        count: number;
      }>([
        { $match: ratingMatch },
        {
          $group: {
            _id: {
              regionId: '$regionId',
              bucket: {
                $dateToString: {
                  format: this.resolveDateFormat(period),
                  date: { $ifNull: ['$created_at', '$submittedAt'] },
                },
              },
            },
            average: { $avg: '$rating' },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            regionId: '$_id.regionId',
            date: '$_id.bucket',
            average: { $round: ['$average', 2] },
            count: 1,
          },
        },
        { $sort: { date: 1 } },
      ]),
    ]);

    const distribution = regions.map((regionDoc) => {
      const regionId =
        (regionDoc as any)._id?.toString?.() || (regionDoc as any).id?.toString();
      const base = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

      distributionRaw
        .filter((item) => item.regionId?.toString() === regionId)
        .forEach((item) => {
          const key = item.rating?.toString() as '1' | '2' | '3' | '4' | '5';
          if (base[key] !== undefined) {
            base[key] += item.count;
          }
        });

      const total =
        base['1'] + base['2'] + base['3'] + base['4'] + base['5'];

      return {
        regionId,
        regionName: (regionDoc as any).name,
        counts: base,
        total,
      };
    });

    const trend = regions.map((regionDoc) => {
      const regionId =
        (regionDoc as any)._id?.toString?.() || (regionDoc as any).id?.toString();
      const points = trendRaw
        .filter((item) => item.regionId?.toString() === regionId)
        .map((item) => ({
          date: item.date,
          average: item.average,
          count: item.count,
        }));

      return {
        regionId,
        regionName: (regionDoc as any).name,
        points,
      };
    });

    return {
      success: true,
      data: {
        period,
        range: { start: start.toISOString(), end: end.toISOString() },
        distribution,
        trend,
      },
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

  private resolveDateRange(
    period: RatingPeriod,
    startDate?: string,
    endDate?: string,
  ) {
    const end = endDate ? new Date(endDate) : new Date();
    if (Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid end date');
    }
    end.setHours(23, 59, 59, 999);

    let start: Date;
    if (startDate) {
      start = new Date(startDate);
      if (Number.isNaN(start.getTime())) {
        throw new BadRequestException('Invalid start date');
      }
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(end);
      start.setHours(0, 0, 0, 0);
      if (period === 'day') {
        // already start of today
      } else if (period === 'week') {
        start.setDate(start.getDate() - 6);
      } else if (period === 'month') {
        start = new Date(start.getFullYear(), start.getMonth(), 1);
      } else if (period === 'year') {
        start = new Date(start.getFullYear(), 0, 1);
      }
    }

    return { start, end };
  }

  private resolveDateFormat(period: RatingPeriod) {
    // keep daily buckets even for week/month/year to show smooth trend
    if (period === 'day' || period === 'week') {
      return '%Y-%m-%d';
    }
    if (period === 'month') {
      return '%Y-%m-%d';
    }
    return '%Y-%m-%d';
  }
}
