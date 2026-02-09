import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import LibraryItem from '@/models/LibraryItem';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const items = await LibraryItem.find({ userId }).sort({ createdAt: -1 });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to list library items:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to list library items' },
      { status: 500 },
    );
  }
}
