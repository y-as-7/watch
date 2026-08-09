export interface GuestUser {
  id: string;
  name: string;
  avatar: string;
  isAdmin?: boolean;
}

export const AVATAR_OPTIONS = ['🍿', '🎬', '🚀', '🦊', '⚡', '🍕', '👑', '💎', '👾', '🎭', '🎥', '✨'];

export function getOrCreateGuestSession(isAdmin: boolean = false): GuestUser {
  if (typeof window === 'undefined') {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return {
      id: `u_${randomNum}`,
      name: `guest_${randomNum}`,
      avatar: '🍿',
      isAdmin,
    };
  }

  const stored = localStorage.getItem('watch_guest_session');
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as GuestUser;
      if (isAdmin) parsed.isAdmin = true;
      return parsed;
    } catch {
      // fallback
    }
  }

  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const newSession: GuestUser = {
    id: `u_${randomNum}`,
    name: `guest_${randomNum}`,
    avatar: AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)],
    isAdmin,
  };

  localStorage.setItem('watch_guest_session', JSON.stringify(newSession));
  return newSession;
}

export function saveGuestSession(session: GuestUser) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('watch_guest_session', JSON.stringify(session));
  }
}
