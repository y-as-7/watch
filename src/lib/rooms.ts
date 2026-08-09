export interface RoomInfo {
  code: string;
  title: string;
  videoUrl: string;
  createdAt: string;
  createdBy: string;
}

const DEFAULT_VIDEO =
  process.env.NEXT_PUBLIC_DEFAULT_VIDEO ||
  'https://pub-dde59808cc1047d79e1e16a58f627c57.r2.dev/movies/[Qfilm.tv].Siccin.3.2016.WEB-DL.720p.mp4';

// Global room cache across requests (empty by default)
const globalRooms = new Map<string, RoomInfo>();

export function generateRoomCode(): string {
  let code = '';
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (globalRooms.has(code));
  return code;
}

export function createRoom(title: string, videoUrl: string, createdBy: string = 'admin@admin.com'): RoomInfo {
  const code = generateRoomCode();
  const room: RoomInfo = {
    code,
    title: title || `Watch Party ${code}`,
    videoUrl: videoUrl || DEFAULT_VIDEO,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  globalRooms.set(code, room);
  return room;
}

export function getRoom(code: string): RoomInfo | null {
  if (globalRooms.has(code)) {
    return globalRooms.get(code)!;
  }
  // Auto-generate temporary room for any valid 6-digit code if requested
  if (/^\d{6}$/.test(code)) {
    const autoRoom: RoomInfo = {
      code,
      title: `Watch Party ${code}`,
      videoUrl: DEFAULT_VIDEO,
      createdAt: new Date().toISOString(),
      createdBy: 'admin@admin.com',
    };
    globalRooms.set(code, autoRoom);
    return autoRoom;
  }
  return null;
}

export function listRooms(): RoomInfo[] {
  return Array.from(globalRooms.values());
}
