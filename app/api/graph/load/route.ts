import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import Node from '@/models/Node';
import Edge from '@/models/Edge';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic'; // Ensure this API is not cached

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    // Mongoose toJSON transform will automatically handle _id -> id conversion
    const nodes = await Node.find({ userId });
    const edges = await Edge.find({ userId });

    return NextResponse.json({ nodes, edges });
  } catch (error) {
    console.error('Failed to load graph:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load graph' },
      { status: 500 }
    );
  }
}
