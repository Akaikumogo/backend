import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { SortOrder } from 'mongoose';
import { Feedback, FeedbackDocument } from './schemas/feedback.schema';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { QueryFeedbackDto } from './dto/query-feedback.dto';
import { UpdateFeedbackStatusDto } from './dto/update-feedback.dto';
import { Region, RegionDocument } from '../regions/schemas/region.schema';
import { Rating, RatingDocument } from '../ratings/schemas/rating.schema';
import { FeedbackStatus } from '../common/constants/feedback-status.enum';
import { buildPaginationMeta } from '../common/pagination/pagination.util';
import { RequestUser } from '../common/types/request-user.type';
import { AdminRole } from '../common/constants/roles.enum';
import { LogsService } from '../logs/logs.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class FeedbacksService {
  constructor(
    @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<FeedbackDocument>,
    @InjectModel(Region.name)
    private readonly regionModel: Model<RegionDocument>,
    @InjectModel(Rating.name)
    private readonly ratingModel: Model<RatingDocument>,
    private readonly logsService: LogsService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateFeedbackDto) {
    await this.ensureRegion(dto.regionId);
    await this.ensureRating(dto.ratingId);

    // Create or update user if not anonymous and has email
    let userId: Types.ObjectId | undefined;
    if (!dto.anonymous && dto.userInfo?.email) {
      const user = await this.usersService.findOrCreate({
        fullName: dto.userInfo.fullName,
        phone: dto.userInfo.phone,
        email: dto.userInfo.email,
      });
      userId = user._id;
    }

    const feedback = await this.feedbackModel.create({
      regionId: new Types.ObjectId(dto.regionId),
      ratingId: new Types.ObjectId(dto.ratingId),
      anonymous: dto.anonymous,
      message: dto.message,
      subject: dto.subject,
      userInfo: dto.anonymous
        ? undefined
        : {
            fullName: dto.userInfo?.fullName,
            phone: dto.userInfo?.phone,
            email: dto.userInfo?.email,
          },
      userId: userId,
      status: FeedbackStatus.PENDING,
    });

    await this.logsService.record('CREATE_FEEDBACK', feedback.id);

    return {
      message: 'Rahmat! Sizning fikringiz biz uchun muhim!',
      status: 'success',
      data: {
        id: feedback.id,
        submittedAt: feedback.submittedAt,
      },
      actionText: 'Yangi mulohaza qo\'shildi',
    };
  }

  async findAll(query: QueryFeedbackDto, currentUser: RequestUser) {
    const { limit = 10, page = 1, search, region, status, sort } = query;
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

    if (status) {
      andConditions.push({ status });
    }

    if (search) {
      // Escape regex special characters to prevent ReDoS and NoSQL injection
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Limit search length to prevent DoS
      const safeSearch = escapedSearch.substring(0, 100);
      const regex = new RegExp(safeSearch, 'i');
      filter.$or = [
        { 'userInfo.fullName': regex },
        { subject: regex },
        { message: regex },
      ];
    }

    if (andConditions.length) {
      filter.$and = andConditions;
    }

    const sortOptions = this.parseSort(sort);

    const [total, data] = await Promise.all([
      this.feedbackModel.countDocuments(filter),
      this.feedbackModel
        .find(filter)
        .populate('regionId', 'id name')
        .populate('ratingId', 'id rating comment')
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean({ virtuals: true }),
    ]);

    return {
      meta: buildPaginationMeta(total, page, limit),
      data: data.map((item) => this.formatFeedback(item)),
      actionText: 'Admin mulohazalarni ko\'rdi',
    };
  }

  async findOne(id: string, currentUser: RequestUser) {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Feedback not found');
    }

    const objectId = new Types.ObjectId(id);
    const feedback = await this.feedbackModel
      .findOne({ _id: objectId })
      .populate('regionId', 'id name')
      .populate('ratingId', 'id rating comment')
      .lean({ virtuals: true });

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    if (currentUser.role === AdminRole.ADMIN) {
      if (!currentUser.allowedRegions?.length) {
        throw new ForbiddenException('Access denied');
      }

      // Handle regionId - use exact same logic as formatFeedback method
      let feedbackRegionId: string | undefined;
      if (feedback.regionId) {
        if (typeof feedback.regionId === 'object' && feedback.regionId._id) {
          feedbackRegionId = feedback.regionId._id.toString();
        } else if (typeof feedback.regionId === 'object' && feedback.regionId.id) {
          feedbackRegionId = feedback.regionId.id.toString();
        } else {
          feedbackRegionId = feedback.regionId.toString();
        }
      }

      // Check if feedbackRegionId is in allowedRegions (same logic as findAll)
      // allowedRegions is already string[], so we can directly use includes
      if (!feedbackRegionId || !currentUser.allowedRegions.includes(feedbackRegionId)) {
        throw new ForbiddenException('Access denied');
      }
    }

    return {
      success: true,
      data: this.formatFeedback(feedback),
    };
  }

  async update(id: string, dto: UpdateFeedbackStatusDto, currentUser: RequestUser) {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Feedback not found');
    }

    const feedback = await this.feedbackModel.findById(new Types.ObjectId(id));

    if (!feedback) {
      throw new NotFoundException('Feedback not found');
    }

    if (currentUser.role === AdminRole.ADMIN) {
      if (!currentUser.allowedRegions?.length) {
        throw new ForbiddenException('Access denied');
      }

      // Handle regionId - could be ObjectId or populated object
      let feedbackRegionId: string;
      if (typeof feedback.regionId === 'object' && feedback.regionId._id) {
        feedbackRegionId = feedback.regionId._id.toString();
      } else if (typeof feedback.regionId === 'object' && feedback.regionId.id) {
        feedbackRegionId = feedback.regionId.id.toString();
      } else {
        feedbackRegionId = feedback.regionId.toString();
      }

      // Check if feedbackRegionId is in allowedRegions (same logic as findAll)
      if (!currentUser.allowedRegions.includes(feedbackRegionId)) {
        throw new ForbiddenException('Access denied');
      }
    }

    feedback.status = dto.status;
    feedback.response = dto.response;

    await feedback.save();

    await this.logsService.record('UPDATE_FEEDBACK', feedback.id);

    return {
      message: 'Mulohaza yangilandi',
      status: 'success',
      data: this.formatFeedback(feedback.toObject({ virtuals: true })),
      actionText: 'Admin mulohaza holatini yangiladi',
    };
  }

  private async ensureRegion(regionId: string) {
    const exists = await this.regionModel.exists({ _id: regionId });
    if (!exists) {
      throw new NotFoundException('Region not found');
    }
  }

  private async ensureRating(ratingId: string) {
    const exists = await this.ratingModel.exists({ _id: ratingId });
    if (!exists) {
      throw new NotFoundException('Rating not found');
    }
  }

  private parseSort(sort?: string): Record<string, SortOrder> {
    if (!sort) {
      return { submittedAt: -1 };
    }

    const [field, direction] = sort.split(':');
    const allowed = ['submittedAt', 'status'];
    if (!allowed.includes(field)) {
      return { submittedAt: -1 };
    }

    return { [field]: direction === 'asc' ? 1 : -1 };
  }

  private formatFeedback(feedback: any) {
    // Handle feedback ID - prioritize _id over id
    let feedbackId: string;
    if (feedback._id) {
      feedbackId = feedback._id.toString();
    } else if (feedback.id) {
      feedbackId = feedback.id.toString();
    } else {
      throw new Error('Feedback ID is missing');
    }

    // Handle ratingId - could be ObjectId or populated object
    let ratingId: string | undefined;
    if (feedback.ratingId) {
      if (typeof feedback.ratingId === 'object' && feedback.ratingId._id) {
        ratingId = feedback.ratingId._id.toString();
      } else if (typeof feedback.ratingId === 'object' && feedback.ratingId.id) {
        ratingId = feedback.ratingId.id.toString();
      } else {
        ratingId = feedback.ratingId.toString();
      }
    }

    // Handle regionId - could be ObjectId or populated object
    let regionId: string | undefined;
    if (feedback.regionId) {
      if (typeof feedback.regionId === 'object' && feedback.regionId._id) {
        regionId = feedback.regionId._id.toString();
      } else if (typeof feedback.regionId === 'object' && feedback.regionId.id) {
        regionId = feedback.regionId.id.toString();
      } else {
        regionId = feedback.regionId.toString();
      }
    }

    return {
      id: feedbackId,
      feedbackId: feedbackId,
      ratingId: ratingId,
      rating: feedback.ratingId && typeof feedback.ratingId === 'object'
        ? {
            id: feedback.ratingId._id?.toString() || feedback.ratingId.id?.toString(),
            rating: feedback.ratingId.rating,
            comment: feedback.ratingId.comment,
          }
        : undefined,
      regionId: regionId,
      region: feedback.regionId && typeof feedback.regionId === 'object'
        ? {
            id: feedback.regionId._id?.toString() || feedback.regionId.id?.toString(),
            name: feedback.regionId.name,
          }
        : undefined,
      userInfo: feedback.userInfo,
      anonymous: feedback.anonymous,
      subject: feedback.subject,
      message: feedback.message,
      status: feedback.status,
      response: feedback.response,
      submittedAt: feedback.submittedAt,
    };
  }
}
