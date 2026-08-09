'use client';

import React, { useState } from 'react';
import { MessageSquare, Send, Heart, Flame, Laugh, Popcorn, Sparkles } from 'lucide-react';
import { GuestUser } from '@/lib/session';

export interface ChatMessage {
  id: string;
  user: GuestUser;
  text: string;
  timestamp: string;
}

interface RoomChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
}

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '🍿', '👑', '👏', '😮', '🎉'];

export default function RoomChat({ messages = [], onSendMessage, onSendReaction }: RoomChatProps) {
  const [textInput, setTextInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    onSendMessage(textInput.trim());
    setTextInput('');
  };

  return (
    <div className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-pink-500/20 text-pink-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-100">Live Chat</h3>
        </div>
      </div>

      {/* Quick Floating Emoji Reaction Bar */}
      <div className="flex items-center justify-between p-2 mb-3 bg-slate-900/60 rounded-xl border border-slate-800">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">
          React:
        </span>
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="text-lg p-1 hover:scale-125 transition-transform active:scale-95"
              title={`Send floating ${emoji} reaction`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500">
            No chat messages yet. Say hi to the party!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start space-x-2">
              <span className="text-lg flex-shrink-0">{msg.user?.avatar || '🍿'}</span>
              <div className="bg-slate-900/80 rounded-xl px-3 py-2 border border-slate-800 max-w-[85%]">
                <div className="flex items-center space-x-2 mb-0.5">
                  <span className="text-[11px] font-bold text-purple-300">
                    {msg.user?.name}
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-200 break-words">{msg.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Send Input */}
      <form onSubmit={handleSend} className="flex items-center space-x-2 pt-2 border-t border-white/10">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Send a message..."
          className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500 placeholder-slate-500"
          maxLength={200}
        />
        <button
          type="submit"
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
