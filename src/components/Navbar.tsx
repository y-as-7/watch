'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Film, ShieldCheck, User, Sparkles, LogOut, Edit3, Check } from 'lucide-react';
import { getOrCreateGuestSession, saveGuestSession, AVATAR_OPTIONS, GuestUser } from '@/lib/session';

interface NavbarProps {
  currentRoomCode?: string;
  onUserUpdate?: (user: GuestUser) => void;
}

export default function Navbar({ currentRoomCode, onUserUpdate }: NavbarProps) {
  const [guest, setGuest] = useState<GuestUser | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isEditingGuest, setIsEditingGuest] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🍿');

  useEffect(() => {
    const session = getOrCreateGuestSession();
    setGuest(session);
    setNameInput(session.name);
    setSelectedAvatar(session.avatar);

    // Check admin session
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAdminLoggedIn(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guest || !nameInput.trim()) return;

    const updated: GuestUser = {
      ...guest,
      name: nameInput.trim(),
      avatar: selectedAvatar,
    };

    saveGuestSession(updated);
    setGuest(updated);
    setIsEditingGuest(false);

    if (onUserUpdate) {
      onUserUpdate(updated);
    }
  };

  const handleLogoutAdmin = async () => {
    await fetch('/api/auth/me', { method: 'POST' });
    setIsAdminLoggedIn(false);
    window.location.href = '/';
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Title */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform duration-300">
              <Image
                src="/logo.png"
                alt="Askar Watch Party Logo"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <span className="font-bold text-lg tracking-wider bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                ASKAR
              </span>
              <span className="text-xs uppercase tracking-widest text-slate-400 block font-medium">
                Watch Party
              </span>
            </div>
          </Link>

          {/* Center Info - Current Room badge */}
          {currentRoomCode && (
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>ROOM: #{currentRoomCode}</span>
            </div>
          )}

          {/* Right Actions */}
          <div className="flex items-center space-x-3">
            {/* Guest Profile Badge */}
            {guest && (
              <button
                onClick={() => setIsEditingGuest(true)}
                className="flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-full px-3 py-1.5 transition-all text-xs font-medium text-slate-200"
                title="Edit Guest Profile"
              >
                <span className="text-base">{guest.avatar}</span>
                <span className="max-w-[120px] truncate">{guest.name}</span>
                <Edit3 className="w-3 h-3 text-slate-400" />
              </button>
            )}

            {/* Admin Badge / Link */}
            {isAdminLoggedIn ? (
              <div className="flex items-center space-x-2">
                <Link
                  href="/admin"
                  className="flex items-center space-x-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md shadow-purple-900/50 transition-all"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin Dashboard</span>
                </Link>
                <button
                  onClick={handleLogoutAdmin}
                  className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Logout Admin"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/admin"
                className="flex items-center space-x-1.5 text-slate-400 hover:text-purple-300 text-xs font-medium px-2 py-1 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Guest Profile Edit Modal */}
      {isEditingGuest && guest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-white/10 shadow-2xl relative">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span>Customize Profile</span>
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Display Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter name (e.g. guest_123456)"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
                  maxLength={25}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Select Icon Avatar
                </label>
                <div className="grid grid-cols-6 gap-2 p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                  {AVATAR_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedAvatar(emoji)}
                      className={`text-2xl p-2.5 rounded-xl flex items-center justify-center transition-all ${
                        selectedAvatar === emoji
                          ? 'bg-purple-600/30 border border-purple-500 scale-110 shadow-md'
                          : 'hover:bg-slate-800/60'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingGuest(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-900/40 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
