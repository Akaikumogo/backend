import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseEntity } from '../../database/base.schema';
import { AdminRole } from '../../common/constants/roles.enum';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true, versionKey: false },
})
export class Admin extends BaseEntity {
  @Prop({ required: true })
  fullname!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({
    required: true,
    enum: AdminRole,
    default: AdminRole.ADMIN,
  })
  role!: AdminRole;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Region' }], default: [] })
  allowedRegions!: Types.ObjectId[];
}

export type AdminDocument = Admin & Document;

export const AdminSchema = SchemaFactory.createForClass(Admin);

AdminSchema.virtual('id').get(function (this: AdminDocument) {
  return this._id.toHexString();
});
AdminSchema.plugin(mongooseLeanVirtuals);
