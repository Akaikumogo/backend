import { Types } from 'mongoose';

export const encodeCursor = (id: string | Types.ObjectId) =>
  Buffer.from(id.toString()).toString('base64');

export const decodeCursor = (cursor?: string) => {
  if (!cursor) return undefined;
  try {
    return Buffer.from(cursor, 'base64').toString('ascii');
  } catch (error) {
    return undefined;
  }
};
