import { MongoClient, Db } from 'mongodb';

export interface RoomStateData {
  roomId: string;
  videoUrl: string;
  videoTitle: string;
  currentTime: number;
  isPlaying: boolean;
  lastUpdated: number;
  hostId: string;
  users: Array<{
    id: string;
    name: string;
    avatar: string;
    role: string;
    isMuted?: boolean;
    socketId: string;
  }>;
}

export interface ChatMessageData {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    role: string;
  };
  text: string;
  timestamp: string;
}

export interface RoomMetadata {
  code: string;
  title: string;
  videoUrl: string;
  createdAt: string;
  createdBy: string;
}

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | null = null;

if (MONGODB_URI) {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(MONGODB_URI);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    const client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect();
  }
}

export async function getDatabase(): Promise<Db | null> {
  if (!clientPromise) return null;
  try {
    const client = await clientPromise;
    return client.db('watch_party');
  } catch (err) {
    console.warn('[MongoDB] Failed to connect to database:', err);
    return null;
  }
}

// Room State Operations
export async function saveRoomStateDB(roomId: string, state: RoomStateData): Promise<boolean> {
  try {
    const db = await getDatabase();
    if (!db) return false;

    const collection = db.collection('room_states');
    await collection.updateOne(
      { roomId },
      { $set: { ...state, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.warn(`[MongoDB] Error saving room state for ${roomId}:`, err);
    return false;
  }
}

export async function getRoomStateDB(roomId: string): Promise<RoomStateData | null> {
  try {
    const db = await getDatabase();
    if (!db) return null;

    const collection = db.collection<RoomStateData>('room_states');
    const doc = await collection.findOne({ roomId });
    if (!doc) return null;

    return {
      roomId: doc.roomId,
      videoUrl: doc.videoUrl,
      videoTitle: doc.videoTitle,
      currentTime: doc.currentTime,
      isPlaying: doc.isPlaying,
      lastUpdated: doc.lastUpdated,
      hostId: doc.hostId,
      users: doc.users || [],
    };
  } catch (err) {
    console.warn(`[MongoDB] Error fetching room state for ${roomId}:`, err);
    return null;
  }
}

export async function deleteRoomStateDB(roomId: string): Promise<boolean> {
  try {
    const db = await getDatabase();
    if (!db) return false;

    await db.collection('room_states').deleteOne({ roomId });
    await db.collection('chat_messages').deleteMany({ roomId });
    return true;
  } catch (err) {
    console.warn(`[MongoDB] Error deleting room state for ${roomId}:`, err);
    return false;
  }
}

// Chat History Operations
export async function saveChatMessageDB(roomId: string, message: ChatMessageData): Promise<boolean> {
  try {
    const db = await getDatabase();
    if (!db) return false;

    const collection = db.collection('chat_messages');
    await collection.insertOne({
      roomId,
      messageId: message.id,
      user: message.user,
      text: message.text,
      timestamp: message.timestamp,
      createdAt: new Date(),
    });
    return true;
  } catch (err) {
    console.warn(`[MongoDB] Error saving chat message for room ${roomId}:`, err);
    return false;
  }
}

export async function getChatHistoryDB(roomId: string, limit = 50): Promise<ChatMessageData[]> {
  try {
    const db = await getDatabase();
    if (!db) return [];

    const collection = db.collection('chat_messages');
    const docs = await collection
      .find({ roomId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return docs.reverse().map((d) => ({
      id: d.messageId || d._id.toString(),
      user: d.user,
      text: d.text,
      timestamp: d.timestamp,
    }));
  } catch (err) {
    console.warn(`[MongoDB] Error fetching chat history for ${roomId}:`, err);
    return [];
  }
}

// Room Metadata Operations
export async function saveRoomMetadataDB(meta: RoomMetadata): Promise<boolean> {
  try {
    const db = await getDatabase();
    if (!db) return false;

    await db.collection('room_metadata').updateOne(
      { code: meta.code },
      { $set: { ...meta, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.warn(`[MongoDB] Error saving room metadata for ${meta.code}:`, err);
    return false;
  }
}

export async function getRoomMetadataDB(code: string): Promise<RoomMetadata | null> {
  try {
    const db = await getDatabase();
    if (!db) return null;

    const doc = await db.collection<RoomMetadata>('room_metadata').findOne({ code });
    if (!doc) return null;

    return {
      code: doc.code,
      title: doc.title,
      videoUrl: doc.videoUrl,
      createdAt: doc.createdAt,
      createdBy: doc.createdBy,
    };
  } catch (err) {
    console.warn(`[MongoDB] Error getting room metadata for ${code}:`, err);
    return null;
  }
}

export async function listRoomsMetadataDB(): Promise<RoomMetadata[]> {
  try {
    const db = await getDatabase();
    if (!db) return [];

    const docs = await db.collection<RoomMetadata>('room_metadata').find({}).toArray();
    return docs.map((doc) => ({
      code: doc.code,
      title: doc.title,
      videoUrl: doc.videoUrl,
      createdAt: doc.createdAt,
      createdBy: doc.createdBy,
    }));
  } catch (err) {
    console.warn('[MongoDB] Error listing room metadata:', err);
    return [];
  }
}
