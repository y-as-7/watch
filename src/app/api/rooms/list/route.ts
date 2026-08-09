import { NextResponse } from 'next/server';
import { listRooms } from '@/lib/rooms';

export async function GET() {
  const rooms = listRooms();
  return NextResponse.json({ success: true, rooms });
}
