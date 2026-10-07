import React, { useState, useEffect } from 'react';
import {
  Search,
  Bot,
  UserCheck,
  Archive,
  RefreshCw,
  MessageSquare,
  Filter,
} from 'lucide-react';
import type { IConversation } from '../../shared/types.js';
import { Avatar } from './Avatar.js';

interface ConversationListProps {
  conversations: IConversation[];
  selectedId: string | null;
  onSelectConversation: (id: string) => void;
  onSearchChange: (query: string) => void;
  onFilterChange: (mode: string) => void;
  currentFilter: string;
  loading: boolean;
  onRefresh: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelectConversation,
  onSearchChange,
  onFilterChange,
  currentFilter,
  loading,
  onRefresh,
}) => {
  const [searchInput, setSearchInput] = useState('');

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, onSearchChange]);

  const formatRelativeTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'NOW';
    if (diffMins < 60) return `${diffMins}M`;
    if (diffHours < 24) return `${diffHours}H`;
    if (diffDays === 1) return '1D';
    if (diffDays < 7) return `${diffDays}D`;
    return d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col bg-white border-r-2 border-black select-none">
      {/* Search Header */}
      <div className="p-3 border-b-2 border-black bg-slate-50 space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-black absolute left-3 top-1/2 -translate-y-1/2 stroke-[2.5]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, @username, ID..."
            className="w-full pl-9 pr-8 py-2 bg-white border-2 border-black font-mono text-xs text-black placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 brutal-shadow-sm"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-slate-500 hover:text-black uppercase"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {[
            { id: 'ALL', label: 'ALL' },
            { id: 'HUMAN', label: 'HUMAN', icon: UserCheck },
            { id: 'BOT', label: 'BOT', icon: Bot },
            { id: 'CLOSED', label: 'CLOSED', icon: Archive },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = currentFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onFilterChange(tab.id)}
                className={`flex items-center gap-1 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider uppercase border border-black transition-all shrink-0 ${
                  active
                    ? 'bg-blue-600 text-white brutal-shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-800'
                }`}
              >
                {Icon && <Icon className="w-3 h-3 stroke-[2.5]" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversation List / Real States */}
      <div className="flex-1 overflow-y-auto divide-y border-b border-black">
        {loading && conversations.length === 0 && (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2.5 animate-pulse">
                <div className="w-9 h-9 bg-slate-200 border border-black" />
                <div className="flex-1 space-y-1.5">
                  <div className="w-24 h-3 bg-slate-200" />
                  <div className="w-36 h-2 bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REAL EMPTY STATE */}
        {!loading && conversations.length === 0 && (
          <div className="p-8 text-center flex flex-col items-center justify-center h-64 bg-slate-50/50">
            <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center text-black mb-3 brutal-shadow-sm">
              <MessageSquare className="w-5 h-5 stroke-[2]" />
            </div>
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-black">
              NO CONVERSATIONS YET
            </h4>
            <p className="font-mono text-[11px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
              {searchInput
                ? 'No matching customer records found.'
                : 'When customers message your Telegram bot, their conversations will appear here.'}
            </p>
          </div>
        )}

        {/* REAL CONVERSATIONS FROM DATABASE */}
        {conversations.map((conv) => {
          const isSelected = selectedId === conv.id;
          const hasUnread = conv.unread_count > 0;

          return (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`w-full p-3 text-left flex items-start gap-2.5 transition-colors border-b border-black last:border-b-0 ${
                isSelected
                  ? 'bg-blue-50 border-l-4 border-l-blue-600'
                  : hasUnread
                  ? 'bg-slate-50/80 hover:bg-slate-100'
                  : 'bg-white hover:bg-slate-50'
              }`}
            >
              <div className="relative shrink-0">
                <Avatar
                  name={conv.display_name}
                  photoUrl={conv.profile_photo}
                  size="md"
                />
                {conv.mode === 'HUMAN' && (
                  <span
                    className="absolute -bottom-1 -right-1 px-1 bg-amber-400 text-black border border-black font-mono text-[8px] font-bold"
                    title="Human Mode Active"
                  >
                    H
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`font-mono text-xs truncate ${
                      hasUnread ? 'font-black text-black' : 'font-bold text-slate-900'
                    }`}
                  >
                    {conv.display_name}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 font-bold shrink-0">
                    {formatRelativeTime(conv.last_message_at)}
                  </span>
                </div>

                {conv.username && (
                  <div className="font-mono text-[10px] text-blue-700 font-medium truncate">
                    @{conv.username}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-1">
                  <p
                    className={`text-xs truncate ${
                      hasUnread ? 'font-semibold text-black' : 'text-slate-600'
                    }`}
                  >
                    {conv.last_message_preview || 'No messages'}
                  </p>

                  {hasUnread && (
                    <span className="px-1.5 py-0.2 bg-blue-600 text-white font-mono text-[10px] font-bold border border-black shrink-0">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
