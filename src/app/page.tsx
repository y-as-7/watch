'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, ShieldCheck, Users, Sparkles, ArrowRight, Film, Key, Radio, PlusCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AdminLoginModal from '@/components/AdminLoginModal';
import { getOrCreateGuestSession, GuestUser } from '@/lib/session';

interface RoomItem {
  code: string;
  title: string;
  videoUrl: string;
  createdBy: string;
}

export default function HomePage() {
  const router = useRouter();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [guestSession, setGuestSession] = useState<GuestUser | null>(null);
  const [activeRooms, setActiveRooms] = useState<RoomItem[]>([]);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    setGuestSession(getOrCreateGuestSession());

    // Fetch active rooms list
    fetch('/api/rooms/list')
      .then((res) => res.json())
      .then((data) => {
        if (data.rooms) {
          setActiveRooms(data.rooms);
        }
      })
      .catch(() => {});

    // Check admin login status
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAdminLoggedIn(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCodeInput.trim();
    if (/^\d{6}$/.test(code)) {
      router.push(`/room/${code}`);
    } else {
      alert('Please enter a valid 6-digit room code (e.g. 123456)');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onUserUpdate={(updated) => setGuestSession(updated)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* Hero Section */}
        <section className="text-center py-12 px-4 relative overflow-hidden rounded-3xl glass-panel border border-white/10 shadow-2xl">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Logo & Brand Header */}
          <div className="inline-flex items-center space-x-3 bg-purple-950/60 border border-purple-500/30 rounded-full px-4 py-2 mb-6 shadow-lg shadow-purple-950/50">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-purple-200">
              Synchronized Streaming Platform
            </span>
          </div>

          <div className="flex flex-col items-center mb-6">
            <div className="relative w-28 h-28 mb-4 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/30 ring-2 ring-purple-500/40">
              <Image
                src="/logo.png"
                alt="Askar Watch Party Logo"
                fill
                className="object-cover"
              />
            </div>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Askar Watch Party
              </span>
            </h1>
            <p className="mt-3 text-slate-300 text-base sm:text-lg max-w-2xl font-normal">
              Watch Cloudflare R2 videos together in real-time synced rooms. Play, pause, and seek together with zero lag. No sign-up required for guests!
            </p>
          </div>

          {/* Join Room Form */}
          <div className="max-w-md mx-auto mt-8">
            <form onSubmit={handleJoinRoom} className="space-y-3">
              <div className="flex items-center space-x-2 bg-slate-900/90 border border-purple-500/40 rounded-2xl p-2 shadow-xl focus-within:ring-2 focus-within:ring-purple-500">
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-Digit Room Number..."
                  className="flex-1 bg-transparent px-4 py-2.5 text-center text-lg font-mono tracking-widest text-white placeholder-slate-500 focus:outline-none"
                  maxLength={6}
                />
                <button
                  type="submit"
                  className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-purple-900/50 transition-all group/btn"
                >
                  <span>Join Room</span>
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Tip: Try room code <code className="text-purple-300 font-mono font-bold">123456</code> to watch Siccin 3!
              </p>
            </form>
          </div>

          {/* Guest Identity Session Banner */}
          {guestSession && (
            <div className="mt-8 inline-flex items-center space-x-3 bg-slate-900/80 border border-slate-700/80 rounded-2xl px-5 py-2.5 text-xs text-slate-300">
              <span className="text-2xl">{guestSession.avatar}</span>
              <div>
                <span>Signed in as: </span>
                <strong className="text-purple-300 font-bold">{guestSession.name}</strong>
                <span className="text-slate-500 text-[10px] block">No registration required</span>
              </div>
            </div>
          )}
        </section>

        {/* Active Rooms Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Active Watch Rooms</h2>
                <p className="text-xs text-slate-400">Join an existing room or create a new room</p>
              </div>
            </div>

            {isAdminLoggedIn ? (
              <Link
                href="/admin"
                className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-purple-900/40 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New Room</span>
              </Link>
            ) : (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center space-x-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300 bg-purple-950/60 border border-purple-500/30 px-3.5 py-2 rounded-xl transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Room Creator</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeRooms.map((room) => (
              <div
                key={room.code}
                className="glass-card rounded-2xl p-5 border border-white/10 hover:border-purple-500/50 transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold">
                      #{room.code}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                      <Users className="w-3 h-3 text-emerald-400" />
                      <span>Live Room</span>
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-100 group-hover:text-purple-300 transition-colors line-clamp-1">
                    {room.title}
                  </h3>

                  <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="truncate">Cloudflare R2 Video Stream</span>
                  </div>
                </div>

                <Link
                  href={`/room/${room.code}`}
                  className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-purple-600 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-md group-hover:shadow-purple-900/50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Enter Room #{room.code}</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={() => {
          setIsAdminLoggedIn(true);
          router.push('/admin');
        }}
      />
    </div>
  );
}
