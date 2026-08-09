import { NextResponse } from 'next/server';

interface UserSession {
  id: string;
  name: string;
  avatar: string;
  lastSeen: number;
  isAdmin?: boolean;
}

interface ChatMsg {
  id: string;
  user: UserSession;
  text: string;
  timestamp: string;
}

interface Reaction {
  id: string;
  user: UserSession;
  emoji: string;
  timestamp: number;
}

interface VercelRoomState {
  code: string;
  videoUrl: string;
  videoTitle: string;
  currentTime: number;
  isPlaying: boolean;
  lastUpdated: number;
  users: Map<string, UserSession>;
  chats: ChatMsg[];
  reactions: Reaction[];
}

const DEFAULT_VIDEO =
  process.env.NEXT_PUBLIC_DEFAULT_VIDEO ||
  'https://pub-dde59808cc1047d79e1e16a58f627c57.r2.dev/movies/[Qfilm.tv].Siccin.3.2016.WEB-DL.720p.mp4';

// In-memory room sync storage for serverless edge/node runtime
const syncRooms = new Map<string, VercelRoomState>();

function getOrCreateSyncRoom(code: string): VercelRoomState {
  if (!syncRooms.has(code)) {
    syncRooms.set(code, {
      code,
      videoUrl: DEFAULT_VIDEO,
      videoTitle: 'Siccin 3 (2016) WEB-DL 720p',
      currentTime: 0,
      isPlaying: false,
      lastUpdated: Date.now(),
      users: new Map(),
      chats: [],
      reactions: [],
    });
  }
  return syncRooms.get(code)!;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('userId');

  if (!code) {
    return NextResponse.json({ error: 'Room code required' }, { status: 400 });
  }

  const room = getOrCreateSyncRoom(code);

  // Update user lastSeen timestamp if userId present
  if (userId && room.users.has(userId)) {
    const u = room.users.get(userId)!;
    u.lastSeen = Date.now();
  }

  // Cleanup inactive users (> 15s)
  const now = Date.now();
  for (const [uid, user] of room.users.entries()) {
    if (now - user.lastSeen > 15000) {
      room.users.delete(uid);
    }
  }

  // Calculate current playback position
  let currentComputedTime = room.currentTime;
  if (room.isPlaying) {
    const elapsed = (now - room.lastUpdated) / 1000;
    currentComputedTime += elapsed;
  }

  return NextResponse.json({
    success: true,
    code: room.code,
    videoUrl: room.videoUrl,
    videoTitle: room.videoTitle,
    currentTime: currentComputedTime,
    isPlaying: room.isPlaying,
    lastUpdated: room.lastUpdated,
    users: Array.from(room.users.values()),
    chats: room.chats.slice(-50), // Last 50 messages
    reactions: room.reactions.filter((r) => now - r.timestamp < 4000), // Active 4s floating reactions
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, action, user, currentTime, videoUrl, videoTitle, message, emoji } = body;

    if (!code) {
      return NextResponse.json({ error: 'Room code required' }, { status: 400 });
    }

    const room = getOrCreateSyncRoom(code);
    const now = Date.now();

    if (user && user.id) {
      room.users.set(user.id, {
        id: user.id,
        name: user.name || `guest_${user.id.slice(-4)}`,
        avatar: user.avatar || '🍿',
        lastSeen: now,
        isAdmin: !!user.isAdmin,
      });
    }

    if (action === 'play') {
      room.isPlaying = true;
      if (typeof currentTime === 'number') room.currentTime = currentTime;
      room.lastUpdated = now;
    } else if (action === 'pause') {
      room.isPlaying = false;
      if (typeof currentTime === 'number') room.currentTime = currentTime;
      room.lastUpdated = now;
    } else if (action === 'seek') {
      if (typeof currentTime === 'number') room.currentTime = currentTime;
      room.lastUpdated = now;
    } else if (action === 'change-video') {
      if (videoUrl) room.videoUrl = videoUrl;
      if (videoTitle) room.videoTitle = videoTitle;
      room.currentTime = 0;
      room.isPlaying = false;
      room.lastUpdated = now;
    } else if (action === 'chat') {
      if (message && user) {
        room.chats.push({
          id: 'msg-' + now + '-' + Math.random().toString(36).substring(2, 6),
          user,
          text: message,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (action === 'reaction') {
      if (emoji && user) {
        room.reactions.push({
          id: 'react-' + now + '-' + Math.random().toString(36).substring(2, 6),
          user,
          emoji,
          timestamp: now,
        });
      }
    }

    return NextResponse.json({
      success: true,
      code: room.code,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to process sync event' }, { status: 500 });
  }
}
