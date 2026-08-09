import { NextResponse } from 'next/server';
import { getRoomAsync } from '@/lib/rooms';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid room code' }, { status: 400 });
  }

  const room = await getRoomAsync(code);

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, room });
}
