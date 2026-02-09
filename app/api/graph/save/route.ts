import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Node from '@/models/Node';
import Edge from '@/models/Edge';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    console.log('前端传来的数据:', body);
    const { nodes, edges } = body;

    // Transaction-like logic: clear old data first
    await Node.deleteMany({});
    await Edge.deleteMany({});

    // Bulk insert new data with ID mapping
    // We map React Flow 'id' to MongoDB '_id' to ensure consistency
    if (nodes && nodes.length > 0) {
      const nodesToSave = nodes.map((node: any) => ({
        ...node,
        _id: node.id, // Explicitly set _id to be the React Flow ID
      }));
      await Node.insertMany(nodesToSave);
    }
    
    if (edges && edges.length > 0) {
      const edgesToSave = edges.map((edge: any) => ({
        ...edge,
        _id: edge.id, // Explicitly set _id to be the React Flow ID
      }));
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
