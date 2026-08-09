'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2, X, Link as LinkIcon } from 'lucide-react';

interface ShareRoomModalProps {
  roomCode: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareRoomModal({ roomCode, isOpen, onClose }: ShareRoomModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const roomLink = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomCode}` : '';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-white/10 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 mb-4">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
            <Share2 className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-100">Invite Friends</h3>
        </div>

        <p className="text-xs text-slate-400 mb-6">
          Anyone with this 6-digit room code or link can join immediately without signing in!
        </p>

        {/* Room Code Card */}
        <div className="bg-slate-900/80 rounded-2xl p-4 border border-purple-500/30 text-center mb-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400 block mb-1">
            UNIQUE ROOM CODE
          </span>
          <div className="text-4xl font-mono font-extrabold tracking-widest bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent my-1">
            {roomCode}
          </div>
          <button
            onClick={handleCopyCode}
            className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Direct Link Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400 uppercase">
            Direct Link
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={roomLink}
              className="flex-1 bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none select-all"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center space-x-1 transition-all"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
