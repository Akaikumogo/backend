import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../database/base.schema';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true, versionKey: false },
})
export class User extends BaseEntity {
  @Prop({ required: false, unique: false, lowercase: true, trim: true })
  email?: string;

  @Prop({ required: true })
  fullName!: string;

  @Prop()
  phone?: string;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('id').get(function (this: UserDocument) {
  return this._id.toHexString();
});

UserSchema.plugin(mongooseLeanVirtuals);
