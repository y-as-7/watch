import { NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

const appId = process.env.AGORA_APP_ID;
const appCertificate = process.env.AGORA_APP_CERTIFICATE;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelName = searchParams.get('channelName');
  const uidStr = searchParams.get('uid') || '0';

  if (!channelName) {
    return NextResponse.json({ error: 'Channel name required' }, { status: 400 });
  }

  if (!appId || !appCertificate) {
    return NextResponse.json(
      { error: 'Agora credentials not configured on server' },
      { status: 500 }
    );
  }

  const role = RtcRole.PUBLISHER;
  const expirationTimeInSeconds = 3600 * 24; // 24 hours
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  try {
    let token = '';
    const numericUid = parseInt(uidStr, 10);

    if (!isNaN(numericUid) && numericUid > 0) {
      token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        numericUid,
        role,
        privilegeExpiredTs,
        privilegeExpiredTs
      );
    } else {
      token = RtcTokenBuilder.buildTokenWithUserAccount(
        appId,
        appCertificate,
        channelName,
        uidStr,
        role,
        privilegeExpiredTs,
        privilegeExpiredTs
      );
    }

    return NextResponse.json({
      success: true,
      token,
      appId,
      channelName,
      uid: uidStr,
    });
  } catch (err) {
    console.error('Failed to generate Agora RTC token:', err);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
