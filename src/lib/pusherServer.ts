import Pusher from 'pusher';

const appId = process.env.PUSHER_APP_ID;
const key = process.env.PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.PUSHER_CLUSTER;

const pusherServer =
  appId && key && secret && cluster
    ? new Pusher({ appId, key, secret, cluster, useTLS: true })
    : null;

export function roomChannel(code: string): string {
  return `room-${code}`;
}

export async function triggerRoomEvent(
  code: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!pusherServer) return;
  try {
    await pusherServer.trigger(roomChannel(code), event, payload);
  } catch (err) {
    console.warn(`[Pusher] Failed to trigger ${event} for room ${code}:`, err);
  }
}
