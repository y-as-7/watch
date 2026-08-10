import { NextResponse } from 'next/server';
import {
  getRoomStateDB,
  saveRoomStateDB,
  saveChatMessageDB,
  getChatHistoryDB,
} from '@/lib/mongodb';
import { triggerRoomEvent } from '@/lib/pusherServer';

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
  user: { id: string; name: string; avatar: string };
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

// In-memory room sync storage for local fallback
const syncRooms = new Map<string, VercelRoomState>();

function getOrCreateSyncRoomLocal(code: string): VercelRoomState {
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

  const now = Date.now();

  // Try MongoDB Atlas first (parallel reads to avoid doubling round-trip latency)
  const [dbState, dbChats] = await Promise.all([getRoomStateDB(code), getChatHistoryDB(code)]);

  let videoUrl = DEFAULT_VIDEO;
  let videoTitle = 'Siccin 3 (2016) WEB-DL 720p';
  let currentTime = 0;
  let isPlaying = false;
  let lastUpdated = now;
  let usersList: UserSession[] = [];
  let chatsList: ChatMsg[] = [];
  let reactionsList: Reaction[] = [];

  if (dbState) {
    videoUrl = dbState.videoUrl;
    videoTitle = dbState.videoTitle;
    currentTime = dbState.currentTime;
    isPlaying = dbState.isPlaying;
    lastUpdated = dbState.lastUpdated;
    usersList = (dbState.users || []).map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      lastSeen: 0,
    }));
    chatsList = (dbChats as unknown as ChatMsg[]) || [];
    reactionsList = (dbState.reactions || []).filter((r) => now - r.timestamp < 4000);
  } else {
    // Fallback to local memory map
    const localRoom = getOrCreateSyncRoomLocal(code);
    videoUrl = localRoom.videoUrl;
    videoTitle = localRoom.videoTitle;
    currentTime = localRoom.currentTime;
    isPlaying = localRoom.isPlaying;
    lastUpdated = localRoom.lastUpdated;
    usersList = Array.from(localRoom.users.values());
    chatsList = localRoom.chats.slice(-50);
    reactionsList = localRoom.reactions.filter((r) => now - r.timestamp < 4000);
  }

  // Calculate current playback position
  let currentComputedTime = currentTime;
  if (isPlaying) {
    const elapsed = (now - lastUpdated) / 1000;
    currentComputedTime += elapsed;
  }

  return NextResponse.json({
    success: true,
    code,
    videoUrl,
    videoTitle,
    currentTime: currentComputedTime,
    isPlaying,
    lastUpdated,
    users: usersList,
    chats: chatsList,
    reactions: reactionsList,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, action, user, currentTime, isPlaying, videoUrl, videoTitle, message, emoji } = body;

    if (!code) {
      return NextResponse.json({ error: 'Room code required' }, { status: 400 });
    }

    const now = Date.now();
    const localRoom = getOrCreateSyncRoomLocal(code);

    // Get current state from MongoDB or local
    let dbState = await getRoomStateDB(code);
    if (!dbState) {
      dbState = {
        roomId: code,
        videoUrl: localRoom.videoUrl,
        videoTitle: localRoom.videoTitle,
        currentTime: localRoom.currentTime,
        isPlaying: localRoom.isPlaying,
        lastUpdated: localRoom.lastUpdated,
        hostId: user?.id || 'host',
        users: [],
      };
    }

    // Update users array
    let users = dbState.users || [];
    if (user && user.id) {
      const existingIdx = users.findIndex((u) => u.id === user.id);
      const userObj = {
        id: user.id,
        name: user.name || `guest_${user.id.slice(-4)}`,
        avatar: user.avatar || '🍿',
        role: user.isAdmin ? 'admin' : 'viewer',
        socketId: user.id,
      };
      if (existingIdx >= 0) {
        users[existingIdx] = userObj;
      } else {
        users.push(userObj);
      }

      localRoom.users.set(user.id, {
        id: user.id,
        name: user.name || `guest_${user.id.slice(-4)}`,
        avatar: user.avatar || '🍿',
        lastSeen: now,
        isAdmin: !!user.isAdmin,
      });
    }

    let pusherEvent: string | null = null;
    let pusherPayload: Record<string, unknown> = {};

    if (action === 'play') {
      dbState.isPlaying = true;
      if (typeof currentTime === 'number') dbState.currentTime = currentTime;
      dbState.lastUpdated = now;

      localRoom.isPlaying = true;
      if (typeof currentTime === 'number') localRoom.currentTime = currentTime;
      localRoom.lastUpdated = now;

      pusherEvent = 'sync-play';
      pusherPayload = { currentTime: dbState.currentTime };
    } else if (action === 'pause') {
      dbState.isPlaying = false;
      if (typeof currentTime === 'number') dbState.currentTime = currentTime;
      dbState.lastUpdated = now;

      localRoom.isPlaying = false;
      if (typeof currentTime === 'number') localRoom.currentTime = currentTime;
      localRoom.lastUpdated = now;

      pusherEvent = 'sync-pause';
      pusherPayload = { currentTime: dbState.currentTime };
    } else if (action === 'seek') {
      if (typeof currentTime === 'number') dbState.currentTime = currentTime;
      dbState.lastUpdated = now;

      if (typeof currentTime === 'number') localRoom.currentTime = currentTime;
      localRoom.lastUpdated = now;

      pusherEvent = 'sync-seek';
      pusherPayload = { currentTime: dbState.currentTime, seekSeq: now };
    } else if (action === 'progress') {
      if (typeof currentTime === 'number') {
        dbState.currentTime = currentTime;
        localRoom.currentTime = currentTime;
      }
      if (typeof isPlaying === 'boolean') {
        dbState.isPlaying = isPlaying;
        localRoom.isPlaying = isPlaying;
      }
      dbState.lastUpdated = now;
      localRoom.lastUpdated = now;
    } else if (action === 'change-video') {
      if (videoUrl) {
        dbState.videoUrl = videoUrl;
        localRoom.videoUrl = videoUrl;
      }
      if (videoTitle) {
        dbState.videoTitle = videoTitle;
        localRoom.videoTitle = videoTitle;
      }
      dbState.currentTime = 0;
      dbState.isPlaying = false;
      dbState.lastUpdated = now;

      localRoom.currentTime = 0;
      localRoom.isPlaying = false;
      localRoom.lastUpdated = now;

      pusherEvent = 'sync-video-change';
      pusherPayload = { videoUrl: dbState.videoUrl, videoTitle: dbState.videoTitle };
    } else if (action === 'chat') {
      if (message && user) {
        const chatObj = {
          id: 'msg-' + now + '-' + Math.random().toString(36).substring(2, 6),
          user: {
            id: user.id || 'guest',
            name: user.name || 'Guest',
            avatar: user.avatar || '🍿',
            role: user.isAdmin ? 'admin' : 'viewer',
          },
          text: message,
          timestamp: new Date().toISOString(),
        };
        await saveChatMessageDB(code, chatObj);
        localRoom.chats.push({
          id: chatObj.id,
          user: {
            ...chatObj.user,
            lastSeen: now,
          },
          text: chatObj.text,
          timestamp: chatObj.timestamp,
        });

        pusherEvent = 'chat-message';
        pusherPayload = chatObj;
      }
    } else if (action === 'reaction') {
      if (emoji && user) {
        const reactionObj = {
          id: 'react-' + now + '-' + Math.random().toString(36).substring(2, 6),
          user: { id: user.id, name: user.name || 'Guest', avatar: user.avatar || '🍿' },
          emoji,
          timestamp: now,
        };
        dbState.reactions = [...(dbState.reactions || []), reactionObj].filter(
          (r) => now - r.timestamp < 4000
        );
        localRoom.reactions.push(reactionObj);

        pusherEvent = 'reaction';
        pusherPayload = reactionObj;
      }
    } else if (action === 'leave') {
      if (user && user.id) {
        users = users.filter((u) => u.id !== user.id);
        localRoom.users.delete(user.id);

        pusherEvent = 'user-left';
        pusherPayload = { userId: user.id, users };
      }
    }

    dbState.users = users;
    await saveRoomStateDB(code, dbState);

    if (pusherEvent) {
      await triggerRoomEvent(code, pusherEvent, pusherPayload);
    }

    return NextResponse.json({
      success: true,
      code: dbState.roomId,
      currentTime: dbState.currentTime,
      isPlaying: dbState.isPlaying,
      seekSeq: now,
    });
  } catch (err) {
    console.error('Failed to sync room state:', err);
    return NextResponse.json({ error: 'Failed to process sync event' }, { status: 500 });
  }
}
