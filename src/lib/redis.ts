// Re-export MongoDB Atlas functions for backwards compatibility
export {
  saveRoomStateDB as setRoomStateRedis,
  getRoomStateDB as getRoomStateRedis,
  deleteRoomStateDB as deleteRoomStateRedis,
  saveChatMessageDB as addChatMessageRedis,
  getChatHistoryDB as getChatHistoryRedis,
  saveRoomMetadataDB as saveRoomMetadataRedis,
  getRoomMetadataDB as getRoomMetadataRedis,
  listRoomsMetadataDB as listRoomsMetadataRedis,
} from './mongodb';

export type { RoomStateData, ChatMessageData, RoomMetadata } from './mongodb';
