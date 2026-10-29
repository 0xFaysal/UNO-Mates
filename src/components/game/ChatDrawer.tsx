'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send } from 'lucide-react';

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerColor: string;
  message: string;
  createdAt: number;
}

interface ChatDrawerProps {
  isOpen: boolean;
  messages: ChatMessage[];
  currentUserId: string;
  onClose: () => void;
  onSendMessage: (text: string) => void;
}

const EMOJI_REACTIONS = ['🔥', '😂', '😭', '😱', '👍', '👏', '🎉', '💩'];

export function ChatDrawer({
  isOpen,
  messages,
  currentUserId,
  onClose,
  onSendMessage,
}: ChatDrawerProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-screen max-w-sm bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-black text-white text-base tracking-wide flex items-center gap-2">
                <span>ROOM CHAT</span>
                <span className="text-xs font-normal text-slate-400">({messages.length})</span>
              </h3>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Emojis */}
            <div className="flex items-center justify-around p-2 bg-slate-950/60 border-b border-slate-800/80">
              {EMOJI_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onSendMessage(emoji)}
                  className="text-lg hover:scale-125 transition-transform p-1 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-slate-500 text-xs py-8">
                  No messages yet. Send an emoji or say hi!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.playerId === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: msg.playerColor }}
                        />
                        <span className="text-[11px] font-bold text-slate-400">
                          {isMe ? 'You' : msg.playerName}
                        </span>
                      </div>
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-xs sm:text-sm max-w-[85%] break-words ${
                          isMe
                            ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white font-medium rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  maxLength={150}
                  className="flex-1 bg-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-yellow-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
