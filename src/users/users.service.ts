import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import {
  Feedback,
  FeedbackDocument,
} from '../feedbacks/schemas/feedback.schema';
import type { UserInfoDto } from '../common/dto/user-info.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<FeedbackDocument>,
  ) {}

  async findOrCreate(
    userInfo: UserInfoDto & { email: string },
  ): Promise<UserDocument> {
    const existingUser = await this.userModel.findOne({
      email: userInfo.email,
    });

    if (existingUser) {
      // Update user info if needed
      existingUser.firstName = userInfo.firstName;
      existingUser.lastName = userInfo.lastName;
      existingUser.middleName = userInfo.middleName;
      existingUser.phone = userInfo.phone;
      existingUser.address = userInfo.address;
      await existingUser.save();
      return existingUser;
    }

    // Create new user
    const newUser = await this.userModel.create({
      email: userInfo.email,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      middleName: userInfo.middleName,
      phone: userInfo.phone,
      address: userInfo.address,
    });

    return newUser;
  }

  async findAll() {
    const users = await this.userModel
      .find()
      .sort({ created_at: -1 })
      .lean({ virtuals: true });

    // Get feedback count for each user
    const usersWithFeedbackCount = await Promise.all(
      users.map(async (user) => {
        const feedbackCount = await this.feedbackModel.countDocuments({
          userId: user._id,
        });
        return {
          ...user,
          feedbackCount,
        };
      }),
    );

    return usersWithFeedbackCount;
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).lean({ virtuals: true });
    if (!user) {
      return null;
    }

    // userId field in Feedback schema is ObjectId, so we need to match it properly
    // Use user._id directly (it's already ObjectId in lean query)
    const userObjectId = user._id;
    
    const feedbacks = await this.feedbackModel
      .find({ userId: userObjectId })
      .populate('regionId', 'id name')
      .populate('ratingId', 'id rating comment')
      .sort({ created_at: -1 })
      .lean({ virtuals: true });

    return {
      ...user,
      feedbacks: feedbacks.map((feedback: any) => {
        // Format similar to FeedbacksService.formatFeedback
        const feedbackId = feedback._id?.toString() || feedback.id;
        
        // Handle regionId
        let regionId: string | undefined;
        let region: { id: string; name: string } | undefined;
        if (feedback.regionId) {
          if (typeof feedback.regionId === 'object' && feedback.regionId._id) {
            regionId = feedback.regionId._id.toString();
            if (regionId) {
              region = {
                id: regionId,
                name: feedback.regionId.name,
              };
            }
          } else if (typeof feedback.regionId === 'object' && feedback.regionId.id) {
            regionId = feedback.regionId.id.toString();
            if (regionId) {
              region = {
                id: regionId,
                name: feedback.regionId.name,
              };
            }
          } else {
            regionId = feedback.regionId.toString();
          }
        }

        // Handle ratingId
        let ratingId: string | undefined;
        let rating: { id: string; rating: number; comment?: string } | undefined;
        if (feedback.ratingId) {
          if (typeof feedback.ratingId === 'object' && feedback.ratingId._id) {
            ratingId = feedback.ratingId._id.toString();
            if (ratingId) {
              rating = {
                id: ratingId,
                rating: feedback.ratingId.rating,
                comment: feedback.ratingId.comment,
              };
            }
          } else if (typeof feedback.ratingId === 'object' && feedback.ratingId.id) {
            ratingId = feedback.ratingId.id.toString();
            if (ratingId) {
              rating = {
                id: ratingId,
                rating: feedback.ratingId.rating,
                comment: feedback.ratingId.comment,
              };
            }
          } else {
            ratingId = feedback.ratingId.toString();
          }
        }

        return {
          id: feedbackId,
          feedbackId: feedbackId,
          ratingId: ratingId,
          rating: rating,
          regionId: regionId,
          region: region,
          userInfo: feedback.userInfo,
          anonymous: feedback.anonymous,
          subject: feedback.subject,
          message: feedback.message,
          status: feedback.status,
          response: feedback.response,
          submittedAt: feedback.submittedAt,
        };
      }),
    };
  }

  async findByEmail(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .lean({ virtuals: true });
  }

  async getUserFeedbacks(userId: string) {
    // Convert string id to ObjectId
    const userObjectId = new Types.ObjectId(userId);
    
    const feedbacks = await this.feedbackModel
      .find({ userId: userObjectId })
      .populate('regionId', 'id name')
      .populate('ratingId', 'id rating comment')
      .sort({ created_at: -1 })
      .lean({ virtuals: true });

    return feedbacks.map((feedback: any) => {
      // Format similar to FeedbacksService.formatFeedback
      const feedbackId = feedback._id?.toString() || feedback.id;
      
      // Handle regionId
      let regionId: string | undefined;
      let region: { id: string; name: string } | undefined;
      if (feedback.regionId) {
        if (typeof feedback.regionId === 'object' && feedback.regionId._id) {
          regionId = feedback.regionId._id.toString();
          if (regionId) {
            region = {
              id: regionId,
              name: feedback.regionId.name,
            };
          }
        } else if (typeof feedback.regionId === 'object' && feedback.regionId.id) {
          regionId = feedback.regionId.id.toString();
          if (regionId) {
            region = {
              id: regionId,
              name: feedback.regionId.name,
            };
          }
        } else {
          regionId = feedback.regionId.toString();
        }
      }

      // Handle ratingId
      let ratingId: string | undefined;
      let rating: { id: string; rating: number; comment?: string } | undefined;
      if (feedback.ratingId) {
        if (typeof feedback.ratingId === 'object' && feedback.ratingId._id) {
          ratingId = feedback.ratingId._id.toString();
          if (ratingId) {
            rating = {
              id: ratingId,
              rating: feedback.ratingId.rating,
              comment: feedback.ratingId.comment,
            };
          }
        } else if (typeof feedback.ratingId === 'object' && feedback.ratingId.id) {
          ratingId = feedback.ratingId.id.toString();
          if (ratingId) {
            rating = {
              id: ratingId,
              rating: feedback.ratingId.rating,
              comment: feedback.ratingId.comment,
            };
          }
        } else {
          ratingId = feedback.ratingId.toString();
        }
      }

      return {
        id: feedbackId,
        feedbackId: feedbackId,
        ratingId: ratingId,
        rating: rating,
        regionId: regionId,
        region: region,
        userInfo: feedback.userInfo,
        anonymous: feedback.anonymous,
        subject: feedback.subject,
        message: feedback.message,
        status: feedback.status,
        response: feedback.response,
        submittedAt: feedback.submittedAt,
      };
    });
  }
}
