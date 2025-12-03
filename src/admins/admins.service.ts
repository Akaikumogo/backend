import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Admin, AdminDocument } from './schemas/admin.schema';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { QueryAdminDto } from './dto/query-admin.dto';
import { hashPassword } from '../common/utils/password.util';
import { buildPaginationMeta } from '../common/pagination/pagination.util';
import type { RequestUser } from '../common/types/request-user.type';
import { AdminRole } from '../common/constants/roles.enum';
import { Region, RegionDocument } from '../regions/schemas/region.schema';

@Injectable()
export class AdminsService implements OnModuleInit {
  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    @InjectModel(Region.name)
    private readonly regionModel: Model<RegionDocument>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const email = this.configService.get<string>('DEFAULT_ADMIN_EMAIL');
    const password = this.configService.get<string>('DEFAULT_ADMIN_PASSWORD');

    if (!email || !password) {
      return;
    }

    const existing = await this.adminModel.findOne({ email }).lean();
    if (existing) {
      return;
    }

    const hashed = await hashPassword(password);
    await this.adminModel.create({
      fullname: 'Super Admin',
      email,
      password: hashed,
      role: AdminRole.SUPER_ADMIN,
    });
  }

  async create(dto: CreateAdminDto) {
    const existing = await this.adminModel.findOne({ email: dto.email });
    if (existing) {
      throw new ConflictException('Admin with this email already exists');
    }

    await this.ensureRegionsExist(dto.allowedRegions);

    const hashed = await hashPassword(dto.password);
    const created = await this.adminModel.create({
      ...dto,
      allowedRegions: dto.allowedRegions?.map((id) => new Types.ObjectId(id)),
      password: hashed,
    });

    return this.sanitizeAdmin(created);
  }

  async findAll(query: QueryAdminDto, currentUser: RequestUser) {
    const { limit = 10, page = 1, search, role, region, sort } = query;

    const filter: FilterQuery<AdminDocument> = {};
    const andConditions: FilterQuery<AdminDocument>[] = [];

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ fullname: regex }, { email: regex }];
    }

    if (role) {
      filter.role = role;
    }

    if (region) {
      andConditions.push({ allowedRegions: new Types.ObjectId(region) });
    }

    if (currentUser.role === AdminRole.ADMIN) {
      if (!currentUser.allowedRegions?.length) {
        return {
          meta: buildPaginationMeta(0, page, limit),
          data: [],
        };
      }

      andConditions.push({
        allowedRegions: {
          $in: currentUser.allowedRegions.map((id) => new Types.ObjectId(id)),
        },
      });
    }

    if (andConditions.length) {
      filter.$and = andConditions;
    }

    const sortOptions = this.buildSort(sort);

    const [total, items] = await Promise.all([
      this.adminModel.countDocuments(filter),
      this.adminModel
        .find(filter)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-password')
        .lean({ virtuals: true }),
    ]);

    const data = items.map((item) => this.formatLeanAdmin(item));

    return {
      meta: buildPaginationMeta(total, page, limit),
      data,
    };
  }

  async findOne(id: string, currentUser: RequestUser) {
    const admin = await this.adminModel
      .findById(id)
      .select('-password')
      .populate('allowedRegions', 'id name')
      .lean();

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    this.ensureAccess(admin, currentUser);

    const formatted = this.formatLeanAdmin(admin);
    
    return {
      success: true,
      data: {
        ...formatted,
        allowedRegions: admin.allowedRegions?.map((region: any) => ({
          id: region._id?.toString() || region.id?.toString(),
          name: region.name,
        })) || [],
      },
    };
  }

  async update(id: string, dto: UpdateAdminDto, currentUser: RequestUser) {
    const admin = await this.adminModel.findById(id);

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    this.ensureAccess(admin.toObject(), currentUser);

    if (dto.email && dto.email !== admin.email) {
      const exists = await this.adminModel.findOne({ email: dto.email });
      if (exists) {
        throw new ConflictException('Email already taken');
      }
    }

    if (dto.allowedRegions) {
      await this.ensureRegionsExist(dto.allowedRegions);
      admin.allowedRegions = dto.allowedRegions.map(
        (regionId) => new Types.ObjectId(regionId),
      );
    }

    if (dto.password) {
      admin.password = await hashPassword(dto.password);
    }

    if (dto.fullname) admin.fullname = dto.fullname;
    if (dto.email) admin.email = dto.email;
    if (dto.role) admin.role = dto.role;

    await admin.save();

    return this.sanitizeAdmin(admin);
  }

  async remove(id: string, currentUser: RequestUser) {
    const admin = await this.adminModel.findById(id);
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot delete a super admin');
    }

    this.ensureAccess(admin.toObject(), currentUser);

    await admin.deleteOne();
    return { id };
  }

  async findByEmail(email: string) {
    return this.adminModel.findOne({ email }).exec();
  }

  private formatLeanAdmin(admin: any) {
    return {
      ...admin,
      allowedRegions: admin.allowedRegions?.map((id: Types.ObjectId | string) =>
        id.toString(),
      ),
    };
  }

  private sanitizeAdmin(admin: AdminDocument) {
    const { password, ...rest } = admin.toObject({ virtuals: true });
    return {
      ...rest,
      allowedRegions: rest.allowedRegions?.map((id: Types.ObjectId) =>
        id.toString(),
      ),
    };
  }

  private ensureAccess(admin: any, currentUser: RequestUser) {
    if (currentUser.role === AdminRole.SUPER_ADMIN) {
      return;
    }

    if (!currentUser.allowedRegions?.length) {
      throw new ForbiddenException('No regions assigned to admin');
    }

    const allowed = admin.allowedRegions?.map((id: Types.ObjectId | string) =>
      id.toString(),
    );

    const hasOverlap = allowed?.some((regionId: string) =>
      currentUser.allowedRegions?.includes(regionId),
    );

    if (!hasOverlap) {
      throw new ForbiddenException('Forbidden resource');
    }
  }

  private async ensureRegionsExist(regionIds?: string[]) {
    if (!regionIds || regionIds.length === 0) {
      return;
    }

    const count = await this.regionModel.countDocuments({
      _id: { $in: regionIds.map((id) => new Types.ObjectId(id)) },
    });

    if (count !== regionIds.length) {
      throw new BadRequestException('One or more regions are invalid');
    }
  }

  private buildSort(sort?: string) {
    if (!sort) {
      return '-created_at';
    }

    const direction = sort.startsWith('-') ? '-' : '';
    const field = sort.replace('-', '');

    if (!['fullname', 'created_at'].includes(field)) {
      throw new BadRequestException('Invalid sort field');
    }

    return `${direction}${field}`;
  }
}
