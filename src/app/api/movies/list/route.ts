import { NextResponse } from 'next/server';
import { listMovieFiles } from '@/lib/r2';

export async function GET() {
  try {
    const movies = await listMovieFiles();
    return NextResponse.json({ success: true, movies });
  } catch {
    return NextResponse.json({ error: 'Failed to list movies' }, { status: 500 });
  }
}
