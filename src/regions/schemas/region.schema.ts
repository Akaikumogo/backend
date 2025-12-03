import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../database/base.schema';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true, versionKey: false },
  toObject: { virtuals: true, versionKey: false },
})
export class Region extends BaseEntity {
  @Prop({ required: true, unique: true })
  name!: string;
}

export type RegionDocument = Region & Document;

export const RegionSchema = SchemaFactory.createForClass(Region);

// 🔥 Virtual id
RegionSchema.virtual('id').get(function (this: RegionDocument) {
  return this._id.toHexString();
});

// 🔥 Plugin shu yerda bo‘ladi
RegionSchema.plugin(mongooseLeanVirtuals);
