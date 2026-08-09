'use client';

import React from 'react';
import { Users, Crown, Shield, Radio } from 'lucide-react';
import { GuestUser } from '@/lib/session';

interface UserListBarProps {
  users: GuestUser[];
  currentUserId?: string;
}

export default function UserListBar({ users = [], currentUserId }: UserListBarProps) {
  return (
    <div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">Watchers</h3>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 text-xs font-bold border border-purple-500/30">
          {users.length} Live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {users.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No watchers connected yet.
          </div>
        ) : (
          users.map((user) => {
            const isMe = user.id === currentUserId;
            return (
              <div
                key={user.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                  isMe
                    ? 'bg-purple-900/30 border-purple-500/50 text-purple-100 shadow-sm'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span className="text-xl flex-shrink-0">{user.avatar || '🍿'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-semibold truncate max-w-[120px]">
                        {user.name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] uppercase font-bold text-purple-400 px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-500/30">
                          YOU
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {user.isAdmin && (
                    <span title="Room Admin" className="text-amber-400">
                      <Crown className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" title="Synced" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
