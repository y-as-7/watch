import Pusher, { Channel } from 'pusher-js';

let pusher: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return null;

  if (!pusher) {
    pusher = new Pusher(key, { cluster });
  }
  return pusher;
}

export function subscribeToRoom(code: string): Channel | null {
  const client = getPusherClient();
  if (!client) return null;
  return client.subscribe(`room-${code}`);
}

export function unsubscribeFromRoom(code: string) {
  pusher?.unsubscribe(`room-${code}`);
}
