import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseEntity } from '../../database/base.schema';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true, versionKey: false },
})
export class Rating extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Region', required: true })
  regionId!: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ type: String })
  comment?: string;

  @Prop({ default: () => new Date() })
  submittedAt!: Date;
}

export type RatingDocument = Rating & Document;

export const RatingSchema = SchemaFactory.createForClass(Rating);

RatingSchema.virtual('id').get(function (this: RatingDocument) {
  return this._id.toHexString();
});

RatingSchema.plugin(mongooseLeanVirtuals);
