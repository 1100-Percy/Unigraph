import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INode extends Document {
  _id: string; // Override _id to be string (React Flow ID)
  position: {
    x: number;
    y: number;
  };
  type: string;
  data: {
    label: string; // Moved inside data
    notes: string;
    tags: string[];
  };
}

const NodeSchema: Schema = new Schema({
  _id: { type: String, required: true }, // Explicitly define _id as String
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  type: { type: String, default: 'customNode' },
  data: {
    label: { type: String, required: true }, // Required label inside data
    notes: { type: String, default: '' },
    tags: { type: [String], default: [] },
  },
});

// Configure toJSON to handle ID transformation for React Flow
NodeSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  },
});

// Use singleton pattern to prevent recompilation errors in Next.js development
const Node: Model<INode> = mongoose.models.Node || mongoose.model<INode>('Node', NodeSchema);

export default Node;
