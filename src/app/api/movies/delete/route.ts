import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { deleteMovieFile } from '@/lib/r2';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token || !verifyAdminToken(token)) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const { key } = await request.json();

    if (!key) {
      return NextResponse.json({ error: 'Movie object key required' }, { status: 400 });
    }

    await deleteMovieFile(key);

    return NextResponse.json({ success: true, message: 'Movie deleted successfully' });
  } catch {
    return NextResponse.json({ error: 'Failed to delete movie file' }, { status: 500 });
  }
}
