'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { Share2, ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import SyncedPlayer, { ReactionItem } from '@/components/SyncedPlayer';
import UserListBar from '@/components/UserListBar';
import RoomChat, { ChatMessage } from '@/components/RoomChat';
import ShareRoomModal from '@/components/ShareRoomModal';
import { getOrCreateGuestSession, GuestUser } from '@/lib/session';
import { subscribeToRoom, unsubscribeFromRoom, getPusherClient } from '@/lib/pusherClient';

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  const [guest, setGuest] = useState<GuestUser | null>(null);
  const [roomInfo, setRoomInfo] = useState<{ code: string; title: string; videoUrl: string } | null>(null);

  // Sync state
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState<GuestUser[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<ReactionItem[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'watchers'>('chat');

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const session = getOrCreateGuestSession();
    setGuest(session);

    // Fetch initial room metadata
    fetch(`/api/rooms/${code}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.room) {
          setRoomInfo(data.room);
          setVideoUrl(data.room.videoUrl);
          setVideoTitle(data.room.title);
        }
      })
      .catch(() => {});
  }, [code]);

  // Real-time Pusher Channels & HTTP polling fallback
  const httpSyncWorkingRef = useRef(false);
  const isInitialSyncRef = useRef(true);
  const guestRef = useRef(guest);
  guestRef.current = guest;

  const guestId = guest?.id;

  // Add a floating reaction and auto-remove it once its float-up animation ends,
  // regardless of whether it arrived via Pusher or a poll (dedup by id either way).
  const addReaction = (r: ReactionItem) => {
    setFloatingReactions((prev) => (prev.some((x) => x.id === r.id) ? prev : [...prev, r]));
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((x) => x.id !== r.id));
    }, 4200);
  };

  useEffect(() => {
    if (!guestId || !code) return;

    const channel = subscribeToRoom(code);
    const pusherClient = getPusherClient();

    const handlePusherStateChange = (states: { current: string }) => {
      if (states.current === 'connected') {
        setConnectionStatus('connected');
      } else if (!httpSyncWorkingRef.current) {
        setConnectionStatus('reconnecting');
      }
    };

    // Pusher event handlers (near-instant sync while connected)
    const handleSyncPlay = ({ currentTime: time }: { currentTime: number }) => {
      setIsPlaying(true);
      if (typeof time === 'number') setCurrentTime(time);
    };

    const handleSyncPause = ({ currentTime: time }: { currentTime: number }) => {
      setIsPlaying(false);
      if (typeof time === 'number') setCurrentTime(time);
    };

    const handleSyncSeek = ({ currentTime: time }: { currentTime: number }) => {
      if (typeof time === 'number') setCurrentTime(time);
    };

    const handleSyncVideoChange = ({ videoUrl: url, videoTitle: title }: { videoUrl: string; videoTitle: string }) => {
      if (url) setVideoUrl(url);
      if (title) setVideoTitle(title);
      setCurrentTime(0);
      setIsPlaying(false);
    };

    const handleChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };

    const handleReaction = (r: ReactionItem) => addReaction(r);

    pusherClient?.connection.bind('state_change', handlePusherStateChange);

    if (channel) {
      channel.bind('sync-play', handleSyncPlay);
      channel.bind('sync-pause', handleSyncPause);
      channel.bind('sync-seek', handleSyncSeek);
      channel.bind('sync-video-change', handleSyncVideoChange);
      channel.bind('chat-message', handleChatMessage);
      channel.bind('reaction', handleReaction);
    }

    // Server state synchronization fetcher: the resilient fallback that always
    // runs, so sync keeps working even when Pusher can't connect.
    const performSyncFetch = async () => {
      try {
        const res = await fetch(`/api/rooms/sync?code=${code}&userId=${guestId}`);
        const data = await res.json();

        if (data.success) {
          httpSyncWorkingRef.current = true;
          setConnectionStatus('connected');

          if (data.videoUrl && data.videoUrl !== videoUrl) setVideoUrl(data.videoUrl);
          if (data.videoTitle && data.videoTitle !== videoTitle) setVideoTitle(data.videoTitle);

          if (isInitialSyncRef.current) {
            // New user joining: instantly snap to exact playback position & play/pause state from MongoDB Atlas
            if (typeof data.currentTime === 'number') setCurrentTime(data.currentTime);
            setIsPlaying(Boolean(data.isPlaying));
            isInitialSyncRef.current = false;
          } else {
            // Periodic sync update: always pass the authoritative time through so
            // SyncedPlayer can smooth out small drift instead of only reacting to jumps >3s.
            setIsPlaying((prev) => (prev !== data.isPlaying ? data.isPlaying : prev));
            if (typeof data.currentTime === 'number') setCurrentTime(data.currentTime);
          }

          if (data.users) {
            setConnectedUsers((prev) => {
              const next = data.users as GuestUser[];
              const unchanged =
                next.length === prev.length &&
                next.every((u, i) => u.id === prev[i]?.id && u.name === prev[i]?.name && u.avatar === prev[i]?.avatar);
              return unchanged ? prev : next;
            });
          }
          if (Array.isArray(data.chats)) {
            setChatMessages((prev) => {
              const map = new Map<string, ChatMessage>();
              data.chats.forEach((c: ChatMessage) => map.set(c.id, c));
              prev.forEach((c) => {
                if (!map.has(c.id)) map.set(c.id, c);
              });
              const merged = Array.from(map.values()).sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
              const unchanged =
                merged.length === prev.length && merged.every((m, i) => m.id === prev[i]?.id);
              return unchanged ? prev : merged;
            });
          }
          if (Array.isArray(data.reactions)) {
            data.reactions.forEach((r: ReactionItem) => addReaction(r));
          }
        } else {
          httpSyncWorkingRef.current = false;
        }
      } catch {
        httpSyncWorkingRef.current = false;
        if (pusherClient?.connection.state !== 'connected') {
          setConnectionStatus('reconnecting');
        }
      }
    };

    // Immediate initial sync
    performSyncFetch();

    // 1-Second long-polling heartbeat fallback for MongoDB Atlas room sync
    syncIntervalRef.current = setInterval(performSyncFetch, 1000);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      pusherClient?.connection.unbind('state_change', handlePusherStateChange);
      if (channel) {
        channel.unbind_all();
      }
      unsubscribeFromRoom(code);
    };
  }, [code, guestId]);

  // Action handlers with immediate MongoDB Atlas persistence; the sync route
  // triggers the Pusher broadcast server-side once the write succeeds.
  const handleSendSyncAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!guest) return;
    try {
      await fetch('/api/rooms/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          action,
          user: guest,
          ...payload,
        }),
      });
    } catch {
      // quiet catch
    }
  };

  const handlePlay = (time: number) => {
    setIsPlaying(true);
    setCurrentTime(time);
    handleSendSyncAction('play', { currentTime: time, isPlaying: true });
  };

  const handlePause = (time: number) => {
    setIsPlaying(false);
    setCurrentTime(time);
    handleSendSyncAction('pause', { currentTime: time, isPlaying: false });
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    handleSendSyncAction('seek', { currentTime: time, isPlaying });
  };

  const handleSendMessage = (text: string) => {
    handleSendSyncAction('chat', { message: text });
  };

  const handleSendReaction = (emoji: string) => {
    handleSendSyncAction('reaction', { emoji });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar currentRoomCode={code} onUserUpdate={(u) => setGuest(u)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4 rounded-2xl glass-panel border border-white/10">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 pr-1">
            <Link
              href="/"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex-shrink-0"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/40 text-purple-300 text-[10px] sm:text-xs font-mono font-bold flex-shrink-0">
                  #{code}
                </span>
                <h1 className="text-xs sm:text-lg font-bold text-slate-100 truncate">
                  {videoTitle || roomInfo?.title || 'Watch Party'}
                </h1>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate hidden xs:block sm:block">
                Synchronized Cloudflare R2 Stream
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center space-x-1.5 sm:space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-lg shadow-purple-900/40 transition-all flex-shrink-0"
          >
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Share Room #{code}</span>
            <span className="sm:hidden">Share</span>
          </button>
        </div>

        {/* Room Main Content: Player + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Main Synced Video Player */}
          <div className="lg:col-span-8 flex flex-col space-y-3 sm:space-y-4">
            <SyncedPlayer
              videoUrl={videoUrl || roomInfo?.videoUrl || ''}
              videoTitle={videoTitle || roomInfo?.title}
              roomId={code}
              isPlaying={isPlaying}
              currentTime={currentTime}
              reactions={floatingReactions}
              connectionStatus={connectionStatus}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={handleSeek}
            />

            <div className="glass-card rounded-2xl p-3 sm:p-4 border border-white/10 flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Real-Time Instant Seek & State Synchronized</span>
              </div>
              <span>Cloudflare R2 Storage</span>
            </div>
          </div>

          {/* Right Sidebar: Watchers List & Live Chat */}
          <div className="lg:col-span-4 flex flex-col space-y-4 sm:space-y-6 h-full">
            {/* Mobile Tab Switcher (< lg breakpoint) */}
            <div className="flex lg:hidden p-1 rounded-xl bg-slate-900/90 border border-white/10">
              <button
                onClick={() => setActiveMobileTab('chat')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeMobileTab === 'chat'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                💬 Live Chat ({chatMessages.length})
              </button>
              <button
                onClick={() => setActiveMobileTab('watchers')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeMobileTab === 'watchers'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                👥 Watchers ({connectedUsers.length})
              </button>
            </div>

            {/* Mobile Tab Views */}
            <div className="lg:hidden h-[420px]">
              {activeMobileTab === 'chat' ? (
                <RoomChat
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                  onSendReaction={handleSendReaction}
                />
              ) : (
                <UserListBar users={connectedUsers} currentUserId={guest?.id} />
              )}
            </div>

            {/* Desktop Stacked Layout (lg+ breakpoint) */}
            <div className="hidden lg:flex lg:flex-col lg:space-y-6 min-h-[500px] h-full">
              <div className="h-48 flex-shrink-0">
                <UserListBar users={connectedUsers} currentUserId={guest?.id} />
              </div>

              <div className="flex-1 min-h-[350px]">
                <RoomChat
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                  onSendReaction={handleSendReaction}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      <ShareRoomModal
        roomCode={code}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}
