'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { Share2, Users, ArrowLeft, Radio, Film, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import SyncedPlayer, { ReactionItem } from '@/components/SyncedPlayer';
import UserListBar from '@/components/UserListBar';
import RoomChat, { ChatMessage } from '@/components/RoomChat';
import ShareRoomModal from '@/components/ShareRoomModal';
import { getOrCreateGuestSession, GuestUser } from '@/lib/session';

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

  // Real-time synchronization loop (Serverless + Sockets ready)
  useEffect(() => {
    if (!guest || !code) return;

    const performSyncFetch = async () => {
      try {
        const res = await fetch(`/api/rooms/sync?code=${code}&userId=${guest.id}`);
        const data = await res.json();

        if (data.success) {
          if (data.videoUrl && data.videoUrl !== videoUrl) setVideoUrl(data.videoUrl);
          if (data.videoTitle) setVideoTitle(data.videoTitle);
          setIsPlaying(data.isPlaying);
          setCurrentTime(data.currentTime);
          setConnectedUsers(data.users || []);
          if (data.chats) setChatMessages(data.chats);
          if (data.reactions) setFloatingReactions(data.reactions);
        }
      } catch {
        // quiet fallback
      }
    };

    // Immediate initial sync
    performSyncFetch();

    // Fast 1.2s sync heartbeat polling for serverless multi-client sync
    syncIntervalRef.current = setInterval(performSyncFetch, 1200);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [code, guest]);

  // Action handlers
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
    handleSendSyncAction('play', { currentTime: time });
  };

  const handlePause = (time: number) => {
    setIsPlaying(false);
    setCurrentTime(time);
    handleSendSyncAction('pause', { currentTime: time });
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    handleSendSyncAction('seek', { currentTime: time });
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl glass-panel border border-white/10">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Back to Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold">
                  ROOM #{code}
                </span>
                <h1 className="text-base sm:text-lg font-bold text-slate-100 truncate max-w-md">
                  {videoTitle || roomInfo?.title || 'Watch Party'}
                </h1>
              </div>
              <p className="text-xs text-slate-400">Synchronized Cloudflare R2 Stream</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-purple-900/40 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Room #{code}</span>
            </button>
          </div>
        </div>

        {/* Room Main Content: Player + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Synced Video Player */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            <SyncedPlayer
              videoUrl={videoUrl || roomInfo?.videoUrl || ''}
              videoTitle={videoTitle || roomInfo?.title}
              roomId={code}
              isPlaying={isPlaying}
              currentTime={currentTime}
              reactions={floatingReactions}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={handleSeek}
            />

            <div className="glass-card rounded-2xl p-4 border border-white/10 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Real-Time Playback & Seek Synchronized</span>
              </div>
              <span>Cloudflare R2 Storage</span>
            </div>
          </div>

          {/* Right Sidebar: Watchers List & Live Chat */}
          <div className="lg:col-span-4 flex flex-col space-y-6 min-h-[500px] h-full">
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
