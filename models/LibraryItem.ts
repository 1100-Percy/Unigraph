import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILibraryItem extends Document {
  userId: string;
  courseId: string;
  data: unknown;
  createdAt: Date;
}

const LibraryItemSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  courseId: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
});

LibraryItemSchema.index({ userId: 1, courseId: 1 }, { unique: true });

LibraryItemSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (_doc, ret) {
    delete ret._id;
  },
});

const LibraryItem: Model<ILibraryItem> =
  mongoose.models.LibraryItem ||
  mongoose.model<ILibraryItem>('LibraryItem', LibraryItemSchema);

export default LibraryItem;
