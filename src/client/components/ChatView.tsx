import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  UserCheck,
  RefreshCw,
  Info,
  ShieldAlert,
  Loader2,
  CheckCheck,
  MessageSquare,
} from 'lucide-react';
import type { IConversation, IMessage } from '../../shared/types.js';
import { Avatar } from './Avatar.js';
import { MessageComposer } from './MessageComposer.js';

interface ChatViewProps {
  conversation: IConversation | null;
  messages: IMessage[];
  loading: boolean;
  error: string | null;
  onSendMessage: (text: string) => Promise<void>;
  onUpdateMode: (mode: 'BOT' | 'HUMAN' | 'CLOSED') => Promise<void>;
  onRefresh: () => void;
  onBack?: () => void;
  onToggleDetails?: () => void;
  isDetailsOpen?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversation,
  messages,
  loading,
  error,
  onSendMessage,
  onUpdateMode,
  onRefresh,
  onBack,
  onToggleDetails,
  isDetailsOpen = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 60;
    setShouldAutoScroll(isAtBottom);
  };

  useEffect(() => {
    if (shouldAutoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, shouldAutoScroll]);

  useEffect(() => {
    setShouldAutoScroll(true);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-dot-grid">
        <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center text-black mb-3 brutal-shadow">
          <MessageSquare className="w-6 h-6 stroke-[2]" />
        </div>
        <h3 className="font-mono text-sm font-extrabold uppercase text-black tracking-tight">
          NO CONVERSATION SELECTED
        </h3>
        <p className="font-mono text-xs text-slate-500 max-w-sm mt-1">
          Select a customer from the conversation list to review message history and reply.
        </p>
      </div>
    );
  }

  const formatMessageTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatSeparatorDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'TODAY';
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b-2 border-black shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 -ml-1 border border-black hover:bg-slate-100 lg:hidden transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}

          <Avatar
            name={conversation.display_name}
            photoUrl={conversation.profile_photo}
            size="md"
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-black truncate">
                {conversation.display_name}
              </span>
              <span
                className={`hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase border border-black ${
                  conversation.mode === 'HUMAN'
                    ? 'bg-amber-100 text-amber-950'
                    : conversation.mode === 'BOT'
                    ? 'bg-blue-100 text-blue-950'
                    : 'bg-slate-200 text-slate-800'
                }`}
              >
                {conversation.mode}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500 truncate">
              {conversation.username ? (
                <span className="text-blue-700">@{conversation.username}</span>
              ) : (
                <span>ID: {conversation.telegram_user_id}</span>
              )}
              <span>•</span>
              <span>CHAT #{conversation.telegram_chat_id}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {conversation.mode === 'BOT' && (
            <button
              onClick={() => onUpdateMode('HUMAN')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-black border border-black font-mono text-[11px] font-bold uppercase brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">TAKE OVER</span>
            </button>
          )}

          {conversation.mode === 'HUMAN' && (
            <button
              onClick={() => onUpdateMode('BOT')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-black font-mono text-[11px] font-bold uppercase brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              <Bot className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">RETURN TO BOT</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            className="p-1.5 bg-white hover:bg-slate-100 text-black border border-black brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
            title="Refresh Messages"
          >
            <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          {onToggleDetails && (
            <button
              onClick={onToggleDetails}
              className={`p-1.5 border border-black brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
                isDetailsOpen ? 'bg-black text-white' : 'bg-white hover:bg-slate-100 text-black'
              }`}
              title="Customer Details"
            >
              <Info className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-dot-grid"
      >
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-black stroke-[2.5]" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-2.5 bg-rose-50 border-2 border-black text-rose-950 font-mono text-xs">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 stroke-[2.5]" />
            <span>{error}</span>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 font-mono text-xs">
            <p>No messages recorded for this conversation.</p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isCustomer = msg.direction === 'INCOMING';
          const isBot = msg.sender_type === 'BOT';
          const isAdmin = msg.sender_type === 'ADMIN';

          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateSeparator =
            !prevMsg ||
            new Date(prevMsg.sent_at).toDateString() !== new Date(msg.sent_at).toDateString();

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="flex items-center justify-center my-3">
                  <span className="px-2.5 py-0.5 bg-white border border-black font-mono text-[10px] font-bold text-black brutal-shadow-sm">
                    {formatSeparatorDate(msg.sent_at)}
                  </span>
                </div>
              )}

              <div className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}>
                {/* Sender tag */}
                <div className="flex items-center gap-1.5 mb-1 font-mono text-[10px] font-bold text-slate-700 px-1 uppercase">
                  {isCustomer && <span>{conversation.display_name}</span>}
                  {isBot && (
                    <span className="inline-flex items-center gap-1 text-slate-800">
                      <Bot className="w-3 h-3 stroke-[2.5]" /> BOT ASSISTANT
                    </span>
                  )}
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-blue-700">
                      <UserCheck className="w-3 h-3 stroke-[2.5]" /> ADMIN OPERATOR
                    </span>
                  )}
                </div>

                {/* Message Bubble Card */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] border-2 border-black p-3 text-xs leading-relaxed whitespace-pre-wrap break-words font-mono ${
                    isCustomer
                      ? 'bg-white text-black brutal-shadow-sm'
                      : isBot
                      ? 'bg-slate-100 text-slate-950 border-black brutal-shadow-sm'
                      : 'bg-blue-600 text-white border-black brutal-shadow'
                  }`}
                >
                  <div>{msg.text}</div>

                  {/* Timestamp */}
                  <div
                    className={`flex items-center justify-end gap-1 text-[9px] font-bold mt-1.5 ${
                      isCustomer
                        ? 'text-slate-500'
                        : isBot
                        ? 'text-slate-500'
                        : 'text-blue-100'
                    }`}
                  >
                    <span>{formatMessageTime(msg.sent_at)}</span>
                    {!isCustomer && <CheckCheck className="w-3 h-3 ml-0.5 stroke-[2.5]" />}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Composer */}
      <MessageComposer
        conversation={conversation}
        onSendMessage={onSendMessage}
        onReopenConversation={() => onUpdateMode('BOT')}
      />
    </div>
  );
};
