import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Log, LogDocument } from './schemas/log.schema';
import { QueryLogsDto } from './dto/query-logs.dto';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor-pagination.util';

@Injectable()
export class LogsService {
  constructor(
    @InjectModel(Log.name) private readonly logModel: Model<LogDocument>,
  ) {}

  async record(action: string, userId: string | null) {
    await this.logModel.create({ action, user_id: userId || undefined, timestamp: new Date() });
  }

  async findAll(query: QueryLogsDto) {
    const { limit = 50, cursor, action } = query;
    const decodedCursor = decodeCursor(cursor);

    const filter: FilterQuery<LogDocument> = {};
    if (decodedCursor) {
      filter._id = { $gt: new Types.ObjectId(decodedCursor) };
    }

    if (action) {
      filter.action = action;
    }

    const logs = await this.logModel
      .find(filter)
      .sort({ _id: 1 })
      .limit(limit)
      .lean();

    const nextCursor =
      logs.length === limit ? encodeCursor(logs[logs.length - 1]._id) : null;

    const prevCursor = cursor ?? null;

    return {
      data: logs,
      cursor: {
        next: nextCursor,
        prev: prevCursor,
      },
    };
  }
}
