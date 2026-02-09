import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INode extends Document<string> {
  _id: string; // Override _id to be string (React Flow ID)
  userId: string;
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

function stripScopedId(scopedId: string) {
  const separatorIndex = scopedId.indexOf('::');
  return separatorIndex === -1 ? scopedId : scopedId.slice(separatorIndex + 2);
}

const NodeSchema: Schema = new Schema({
  _id: { type: String, required: true }, // Explicitly define _id as String
  userId: { type: String, required: true, index: true },
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
    ret.id = stripScopedId(String(ret._id));
    delete ret._id;
  },
});

// Use singleton pattern to prevent recompilation errors in Next.js development
const Node: Model<INode> = mongoose.models.Node || mongoose.model<INode>('Node', NodeSchema);

export default Node;
