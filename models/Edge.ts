import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEdge extends Document {
  _id: string; // Override _id to be string (React Flow ID)
  source: string;
  target: string;
  type: string;
  label?: string;
}

const EdgeSchema: Schema = new Schema({
  _id: { type: String, required: true }, // Explicitly define _id as String
  source: { type: String, required: true },
  target: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
  },
  label: { type: String },
});

// Configure toJSON to handle ID transformation for React Flow
EdgeSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  },
});

// Use singleton pattern to prevent recompilation errors in Next.js development
const Edge: Model<IEdge> = mongoose.models.Edge || mongoose.model<IEdge>('Edge', EdgeSchema);

export default Edge;
