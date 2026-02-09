import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import LibraryItem from '@/models/LibraryItem';
import { auth } from '@clerk/nextjs/server';

type SavePayload = {
  courseId: string;
  data: unknown;
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = (await request.json()) as unknown;
    const payload = body as Partial<SavePayload>;

    if (!payload.courseId || typeof payload.courseId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing courseId' },
        { status: 400 },
      );
    }

    if (!('data' in payload)) {
      return NextResponse.json(
        { success: false, message: 'Missing data' },
        { status: 400 },
      );
    }

    const saved = await LibraryItem.findOneAndUpdate(
      { userId, courseId: payload.courseId },
      { userId, courseId: payload.courseId, data: payload.data },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return NextResponse.json({ success: true, item: saved });
  } catch (error) {
    console.error('Failed to save library item:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save library item' },
      { status: 500 },
    );
  }
}
