import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { r2Client, getPresignedUploadUrl } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';

export const maxDuration = 300; // 5 minute max execution for uploads on serverless

const bucketName = process.env.R2_BUCKET_NAME || 'movies';
const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://pub-dde59808cc1047d79e1e16a58f627c57.r2.dev';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token || !verifyAdminToken(token)) {
      return NextResponse.json({ error: 'Unauthorized. Admin access required for file upload.' }, { status: 401 });
    }

    const contentTypeHeader = request.headers.get('content-type') || '';

    // If client sends FormData (direct server-side proxy upload to bypass browser CORS)
    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `movies/${Date.now()}_${sanitizedFilename}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'video/mp4',
      });

      await r2Client.send(command);

      const publicUrl = `${publicDomain}/${key}`;
      return NextResponse.json({ success: true, publicUrl, key });
    }

    // JSON body mode for presigned URL fallback
    const { filename, contentType } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'Filename and content type are required' }, { status: 400 });
    }

    const result = await getPresignedUploadUrl(filename, contentType);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Upload initialization failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
