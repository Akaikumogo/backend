import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseEntity } from '../../database/base.schema';
import { FeedbackStatus } from '../../common/constants/feedback-status.enum';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true, versionKey: false },
})
export class Feedback extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Region', required: true })
  regionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Rating', required: true })
  ratingId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ default: false })
  anonymous!: boolean;

  @Prop({ required: true })
  message!: string;

  @Prop()
  subject?: string;

  @Prop({
    type: {
      fullName: { type: String },
      phone: { type: String },
      email: { type: String, required: true },
    },
  })
  userInfo?: Record<string, string>;

  @Prop({ enum: FeedbackStatus, default: FeedbackStatus.PENDING })
  status!: FeedbackStatus;

  @Prop()
  response?: string;

  @Prop({ default: () => new Date() })
  submittedAt!: Date;
}

export type FeedbackDocument = Feedback & Document;

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

FeedbackSchema.virtual('id').get(function (this: FeedbackDocument) {
  return this._id.toHexString();
});

FeedbackSchema.plugin(mongooseLeanVirtuals);
