const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory Room State Store (Fallback & Local Cache)
const roomsState = new Map();

// MongoDB Client Setup
const MONGODB_URI = process.env.MONGODB_URI;
let db = null;

if (MONGODB_URI) {
  MongoClient.connect(MONGODB_URI)
    .then((client) => {
      db = client.db('watch_party');
      console.log('[MongoDB] Successfully connected to MongoDB Atlas.');
    })
    .catch((err) => {
      console.warn('[MongoDB] Initialization connection error:', err.message);
    });
}

// MongoDB Helper Functions
async function saveRoomToMongoDB(roomId, room) {
  if (!db) return;
  try {
    const payload = {
      roomId: room.roomId,
      videoUrl: room.videoUrl,
      videoTitle: room.videoTitle,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
      lastUpdated: room.lastUpdated,
      hostId: room.hostId,
      users: Array.from(room.users.values()),
      updatedAt: new Date(),
    };
    await db.collection('room_states').updateOne(
      { roomId },
      { $set: payload },
      { upsert: true }
    );
  } catch (err) {
    console.warn(`[MongoDB] Failed to save room state ${roomId}:`, err.message);
  }
}

async function loadRoomFromMongoDB(roomId) {
  if (!db) return null;
  try {
    const doc = await db.collection('room_states').findOne({ roomId });
    if (!doc) return null;
    const usersMap = new Map();
    if (Array.isArray(doc.users)) {
      doc.users.forEach((u) => usersMap.set(u.socketId, u));
    }
    return {
      roomId: doc.roomId,
      videoUrl: doc.videoUrl,
      videoTitle: doc.videoTitle,
      currentTime: doc.currentTime,
      isPlaying: doc.isPlaying,
      lastUpdated: doc.lastUpdated,
      hostId: doc.hostId,
      users: usersMap,
    };
  } catch (err) {
    console.warn(`[MongoDB] Failed to load room state ${roomId}:`, err.message);
    return null;
  }
}

async function saveChatMessageMongoDB(roomId, message) {
  if (!db) return;
  try {
    await db.collection('chat_messages').insertOne({
      roomId,
      messageId: message.id,
      user: message.user,
      text: message.text,
      timestamp: message.timestamp,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn(`[MongoDB] Failed to save chat message for ${roomId}:`, err.message);
  }
}

async function getChatHistoryMongoDB(roomId) {
  if (!db) return [];
  try {
    const docs = await db.collection('chat_messages')
      .find({ roomId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return docs.reverse().map((d) => ({
      id: d.messageId || d._id.toString(),
      user: d.user,
      text: d.text,
      timestamp: d.timestamp,
    }));
  } catch (err) {
    console.warn(`[MongoDB] Failed to load chat history for ${roomId}:`, err.message);
    return [];
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentUser = null;

    socket.on('join-room', async ({ roomId, user }) => {
      currentRoom = roomId;
      currentUser = { ...user, socketId: socket.id };

      socket.join(roomId);

      // Check local memory first, then MongoDB Atlas
      if (!roomsState.has(roomId)) {
        const dbRoom = await loadRoomFromMongoDB(roomId);
        if (dbRoom) {
          roomsState.set(roomId, dbRoom);
        } else {
          roomsState.set(roomId, {
            roomId,
            videoUrl:
              process.env.NEXT_PUBLIC_DEFAULT_VIDEO ||
              'https://pub-dde59808cc1047d79e1e16a58f627c57.r2.dev/movies/[Qfilm.tv].Siccin.3.2016.WEB-DL.720p.mp4',
            videoTitle: 'Siccin 3 (2016) WEB-DL 720p',
            currentTime: 0,
            isPlaying: false,
            lastUpdated: Date.now(),
            hostId: socket.id,
            users: new Map(),
          });
        }
      }

      const room = roomsState.get(roomId);
      room.users.set(socket.id, currentUser);

      // Compute estimated current time if playing
      let currentComputedTime = room.currentTime;
      if (room.isPlaying) {
        const elapsed = (Date.now() - room.lastUpdated) / 1000;
        currentComputedTime += elapsed;
      }

      // Persist room state to MongoDB Atlas
      saveRoomToMongoDB(roomId, room);

      // Emit initial room state to joining user
      socket.emit('room-state', {
        roomId: room.roomId,
        videoUrl: room.videoUrl,
        videoTitle: room.videoTitle,
        currentTime: currentComputedTime,
        isPlaying: room.isPlaying,
        users: Array.from(room.users.values()),
        hostId: room.hostId,
      });

      // Send past chat history if available in MongoDB Atlas
      const chatHistory = await getChatHistoryMongoDB(roomId);
      if (chatHistory.length > 0) {
        socket.emit('chat-history', chatHistory);
      }

      // Broadcast new user joined to room
      io.to(roomId).emit('user-joined', {
        user: currentUser,
        users: Array.from(room.users.values()),
      });
    });

    socket.on('sync-play', ({ roomId, currentTime }) => {
      const room = roomsState.get(roomId);
      if (room) {
        room.isPlaying = true;
        room.currentTime = currentTime;
        room.lastUpdated = Date.now();
        saveRoomToMongoDB(roomId, room);
        socket.to(roomId).emit('sync-play', { currentTime, timestamp: room.lastUpdated, sender: socket.id });
      }
    });

    socket.on('sync-pause', ({ roomId, currentTime }) => {
      const room = roomsState.get(roomId);
      if (room) {
        room.isPlaying = false;
        room.currentTime = currentTime;
        room.lastUpdated = Date.now();
        saveRoomToMongoDB(roomId, room);
        socket.to(roomId).emit('sync-pause', { currentTime, timestamp: room.lastUpdated, sender: socket.id });
      }
    });

    socket.on('sync-seek', ({ roomId, currentTime }) => {
      const room = roomsState.get(roomId);
      if (room) {
        room.currentTime = currentTime;
        room.lastUpdated = Date.now();
        saveRoomToMongoDB(roomId, room);
        socket.to(roomId).emit('sync-seek', { currentTime, timestamp: room.lastUpdated, sender: socket.id });
      }
    });

    socket.on('sync-video-change', ({ roomId, videoUrl, videoTitle }) => {
      const room = roomsState.get(roomId);
      if (room) {
        room.videoUrl = videoUrl;
        room.videoTitle = videoTitle || 'Custom Video';
        room.currentTime = 0;
        room.isPlaying = false;
        room.lastUpdated = Date.now();
        saveRoomToMongoDB(roomId, room);
        io.to(roomId).emit('sync-video-change', { videoUrl, videoTitle: room.videoTitle, sender: socket.id });
      }
    });

    socket.on('user-update', ({ roomId, user }) => {
      const room = roomsState.get(roomId);
      if (room && room.users.has(socket.id)) {
        const updated = { ...room.users.get(socket.id), ...user };
        room.users.set(socket.id, updated);
        saveRoomToMongoDB(roomId, room);
        io.to(roomId).emit('users-updated', Array.from(room.users.values()));
      }
    });

    socket.on('send-chat', ({ roomId, message }) => {
      if (currentUser) {
        const chatObj = {
          id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          user: currentUser,
          text: message,
          timestamp: new Date().toISOString(),
        };
        saveChatMessageMongoDB(roomId, chatObj);
        io.to(roomId).emit('chat-message', chatObj);
      }
    });

    socket.on('send-reaction', ({ roomId, emoji }) => {
      if (currentUser) {
        io.to(roomId).emit('reaction', {
          id: 'react-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          user: currentUser,
          emoji,
        });
      }
    });

    socket.on('disconnect', () => {
      if (currentRoom && roomsState.has(currentRoom)) {
        const room = roomsState.get(currentRoom);
        room.users.delete(socket.id);

        if (room.users.size === 0) {
          saveRoomToMongoDB(currentRoom, room);
        } else {
          if (room.hostId === socket.id) {
            room.hostId = Array.from(room.users.keys())[0];
          }
          saveRoomToMongoDB(currentRoom, room);
          io.to(currentRoom).emit('user-left', {
            socketId: socket.id,
            users: Array.from(room.users.values()),
            newHostId: room.hostId,
          });
        }
      }
    });
  });

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Server ready on http://${hostname}:${port}`);
  });
});
