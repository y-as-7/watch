'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Sparkles, ArrowRight, PlusCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AdminLoginModal from '@/components/AdminLoginModal';
import OtpPinInput from '@/components/ui/OtpPinInput';
import { getOrCreateGuestSession, GuestUser } from '@/lib/session';

export default function HomePage() {
  const router = useRouter();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [guestSession, setGuestSession] = useState<GuestUser | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  useEffect(() => {
    setGuestSession(getOrCreateGuestSession());

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

  const handleJoinRoom = (codeToJoin?: string) => {
    const code = (codeToJoin || roomCodeInput).trim();
    if (/^\d{6}$/.test(code)) {
      router.push(`/room/${code}`);
    } else {
      alert('Please enter a valid 6-digit room code');
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

          {/* 6-Digit Shadcn OTP PIN Room Join Form */}
          <div className="max-w-md mx-auto mt-8 bg-slate-900/60 p-6 rounded-3xl border border-purple-500/30 shadow-2xl">
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">
              Enter 6-Digit Room PIN Number
            </label>

            <OtpPinInput
              length={6}
              value={roomCodeInput}
              onChange={(val) => setRoomCodeInput(val)}
              onComplete={(completedCode) => handleJoinRoom(completedCode)}
            />

            <button
              onClick={() => handleJoinRoom()}
              disabled={roomCodeInput.length !== 6}
              className="mt-4 w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm py-3.5 rounded-2xl shadow-lg shadow-purple-900/50 transition-all disabled:opacity-40"
            >
              <span>Enter Room #{roomCodeInput || '______'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
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
