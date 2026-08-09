import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accessKeyId = process.env.R2_ACCESS_KEY_ID || '6452ecb0532d58024eea647e80b854c3';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || 'e398cc1c6a18decd850421e75b0bbcbef6e6c676db8e9711f96e981178f531df';
const endpoint = process.env.R2_ENDPOINT || 'https://fb77823dc0e83ff3802c49c9bed5e246.r2.cloudflarestorage.com';
const bucketName = process.env.R2_BUCKET_NAME || 'stream';
const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://pub-dde59808cc1047d79e1e16a58f627c57.r2.dev';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export async function getPresignedUploadUrl(filename: string, contentType: string) {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `movies/${Date.now()}_${sanitizedFilename}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
  const publicUrl = `${publicDomain}/${key}`;

  return { uploadUrl, publicUrl, key };
}

export interface R2MovieFile {
  key: string;
  name: string;
  url: string;
  size?: number;
  lastModified?: Date;
}

// Preset default movies to ensure drop-down always has rich demo content out-of-the-box
const PRESET_MOVIES: R2MovieFile[] = [
  {
    key: 'movies/[Qfilm.tv].Siccin.3.2016.WEB-DL.720p.mp4',
    name: 'Siccin 3 (2016) WEB-DL 720p',
    url: 'https://pub-dde59808cc1047d79e1e16a58f627c57.r2.dev/movies/[Qfilm.tv].Siccin.3.2016.WEB-DL.720p.mp4',
  },
];

export async function listMovieFiles(): Promise<R2MovieFile[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'movies/',
    });

    const response = await r2Client.send(command);
    const filesFromR2: R2MovieFile[] = (response.Contents || [])
      .filter((item) => item.Key && item.Key !== 'movies/')
      .map((item) => {
        const key = item.Key!;
        const rawName = key.replace(/^movies\//, '');
        const cleanName = rawName.replace(/^\d+_/, ''); // strip timestamp prefix
        return {
          key,
          name: cleanName,
          url: `${publicDomain}/${key}`,
          size: item.Size,
          lastModified: item.LastModified,
        };
      });

    // Combine preset movies with actual R2 files
    const all = [...PRESET_MOVIES];
    for (const f of filesFromR2) {
      if (!all.some((existing) => existing.url === f.url)) {
        all.push(f);
      }
    }
    return all;
  } catch {
    return PRESET_MOVIES;
  }
}

export async function deleteMovieFile(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await r2Client.send(command);
  return { success: true, key };
}
