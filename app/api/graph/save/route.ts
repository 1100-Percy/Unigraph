import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Node from '@/models/Node';
import Edge from '@/models/Edge';
import { auth } from '@clerk/nextjs/server';

type NodePayload = { id: string } & Record<string, unknown>;
type EdgePayload = { id: string } & Record<string, unknown>;

function makeScopedId(userId: string, id: string) {
  return `${userId}::${id}`;
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const body = await request.json();
    console.log('前端传来的数据:', body);
    const { nodes, edges } = body as { nodes?: unknown; edges?: unknown };

    // Transaction-like logic: clear old data first
    await Node.deleteMany({ userId });
    await Edge.deleteMany({ userId });

    // Bulk insert new data with ID mapping
    // We map React Flow 'id' to MongoDB '_id' to ensure consistency
    const nodeArray = Array.isArray(nodes) ? (nodes as NodePayload[]) : [];
    if (nodeArray.length > 0) {
      const nodesToSave = nodeArray.map((node) => ({
        ...node,
        userId,
        _id: makeScopedId(userId, node.id),
      })) as Record<string, unknown>[];
      await Node.insertMany(nodesToSave);
    }
    
    const edgeArray = Array.isArray(edges) ? (edges as EdgePayload[]) : [];
    if (edgeArray.length > 0) {
      const edgesToSave = edgeArray.map((edge) => ({
        ...edge,
        userId,
        _id: makeScopedId(userId, edge.id),
      })) as Record<string, unknown>[];
      await Edge.insertMany(edgesToSave);
    }

    return NextResponse.json({ success: true, message: 'Graph saved successfully' });
  } catch (error) {
    console.error('MongoDB 保存报错:', error);
    // Return the actual error message for easier debugging
    return NextResponse.json(
      { success: false, message: `Failed to save graph: ${error}` },
      { status: 500 }
    );
  }
}
