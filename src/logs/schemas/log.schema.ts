import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../database/base.schema';

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true, versionKey: false },
})
export class Log extends BaseEntity {
  @Prop({ required: true })
  action!: string;

  @Prop({ required: false })
  user_id?: string;

  @Prop({ default: () => new Date() })
  timestamp!: Date;
}

export type LogDocument = Log & Document;

export const LogSchema = SchemaFactory.createForClass(Log);

LogSchema.virtual('id').get(function (this: LogDocument) {
  return this._id.toHexString();
});
