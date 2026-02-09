import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Node from '@/models/Node';
import Edge from '@/models/Edge';

export const dynamic = 'force-dynamic'; // Ensure this API is not cached

export async function GET() {
  try {
    await connectToDatabase();
    
    // Mongoose toJSON transform will automatically handle _id -> id conversion
    const nodes = await Node.find({});
    const edges = await Edge.find({});

    return NextResponse.json({ nodes, edges });
  } catch (error) {
    console.error('Failed to load graph:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load graph' },
      { status: 500 }
    );
  }
}
