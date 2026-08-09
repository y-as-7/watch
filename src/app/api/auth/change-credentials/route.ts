import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, updateAdminCredentials } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token || !verifyAdminToken(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { newEmail, newPassword } = await request.json();

    if (!newEmail && !newPassword) {
      return NextResponse.json({ error: 'Provide at least a new email or password' }, { status: 400 });
    }

    const updated = updateAdminCredentials(newEmail, newPassword);

    return NextResponse.json({ success: true, message: 'Admin credentials updated successfully', email: updated.email });
  } catch {
    return NextResponse.json({ error: 'Failed to update credentials' }, { status: 500 });
  }
}
