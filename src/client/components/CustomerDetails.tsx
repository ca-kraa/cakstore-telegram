import React from 'react';
import {
  User,
  Hash,
  MessageSquare,
  Bot,
  UserCheck,
  Archive,
  RotateCcw,
  Copy,
  ExternalLink,
  Calendar,
  Clock,
  Tag,
  X,
} from 'lucide-react';
import type { IConversation } from '../../shared/types.js';
import { Avatar } from './Avatar.js';
import { useToast } from './Toast.js';

interface CustomerDetailsProps {
  conversation: IConversation | null;
  onUpdateMode: (mode: 'BOT' | 'HUMAN' | 'CLOSED') => Promise<void>;
  onCloseMobileDrawer?: () => void;
  isMobileDrawer?: boolean;
}

export const CustomerDetails: React.FC<CustomerDetailsProps> = ({
  conversation,
  onUpdateMode,
  onCloseMobileDrawer,
  isMobileDrawer = false,
}) => {
  const { showToast } = useToast();

  if (!conversation) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-white border-l-2 border-black font-mono">
        <User className="w-8 h-8 mb-2 text-slate-400 stroke-[2]" />
        <p className="text-xs font-bold text-black uppercase">NO SELECTION</p>
        <p className="text-[10px] text-slate-500 mt-1">Select a conversation to view customer telemetry</p>
      </div>
    );
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard`, 'success');
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Not available';
    const d = new Date(isoStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="h-full flex flex-col bg-white border-l-2 border-black overflow-y-auto select-none font-mono">
      {/* Mobile Header */}
      {isMobileDrawer && (
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-slate-50 lg:hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-black">CUSTOMER DETAILS</span>
          <button
            onClick={onCloseMobileDrawer}
            className="p-1 border border-black hover:bg-slate-200"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Profile Header */}
      <div className="p-5 flex flex-col items-center text-center border-b-2 border-black bg-slate-50/70">
        <Avatar
          name={conversation.display_name}
          photoUrl={conversation.profile_photo}
          size="xl"
          className="mb-3 brutal-shadow-sm"
        />
        <h3 className="text-sm font-bold text-black uppercase tracking-tight">{conversation.display_name}</h3>
        {conversation.username ? (
          <a
            href={`https://t.me/${conversation.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-700 font-bold hover:underline mt-0.5"
          >
            @{conversation.username}
            <ExternalLink className="w-3 h-3 ml-0.5 stroke-[2.5]" />
          </a>
        ) : (
          <span className="text-[10px] text-slate-500 mt-0.5">No Telegram username</span>
        )}

        {/* Mode & Status Badges */}
        <div className="flex items-center gap-1.5 mt-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase border border-black ${
              conversation.mode === 'HUMAN'
                ? 'bg-amber-100 text-amber-950'
                : conversation.mode === 'BOT'
                ? 'bg-blue-100 text-blue-950'
                : 'bg-slate-200 text-slate-800'
            }`}
          >
            {conversation.mode === 'HUMAN' && <UserCheck className="w-3 h-3 stroke-[2.5]" />}
            {conversation.mode === 'BOT' && <Bot className="w-3 h-3 stroke-[2.5]" />}
            {conversation.mode === 'CLOSED' && <Archive className="w-3 h-3 stroke-[2.5]" />}
            {conversation.mode} MODE
          </span>

          <span
            className={`px-2 py-0.5 text-[9px] font-bold uppercase border border-black ${
              conversation.status === 'WAITING'
                ? 'bg-rose-100 text-rose-950'
                : conversation.status === 'OPEN'
                ? 'bg-emerald-100 text-emerald-950'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {conversation.status}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-b-2 border-black space-y-2 bg-white">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          ACTIONS
        </div>

        {conversation.mode === 'BOT' && (
          <button
            onClick={() => onUpdateMode('HUMAN')}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-400 hover:bg-amber-500 text-black border border-black text-xs font-bold uppercase brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>TAKE OVER (HUMAN)</span>
          </button>
        )}

        {conversation.mode === 'HUMAN' && (
          <button
            onClick={() => onUpdateMode('BOT')}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white border border-black text-xs font-bold uppercase brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            <Bot className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>RETURN TO BOT</span>
          </button>
        )}

        {conversation.mode !== 'CLOSED' ? (
          <button
            onClick={() => onUpdateMode('CLOSED')}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-rose-950 border border-black text-xs font-bold uppercase brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            <Archive className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>CLOSE CONVERSATION</span>
          </button>
        ) : (
          <button
            onClick={() => onUpdateMode('BOT')}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white border border-black text-xs font-bold uppercase brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>REOPEN CONVERSATION</span>
          </button>
        )}
      </div>

      {/* Metadata Attributes */}
      <div className="p-4 space-y-3.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          TELEMETRY
        </div>

        {/* Deep link parameter if present */}
        {conversation.latest_deep_link && (
          <div className="p-2.5 bg-blue-50 border border-black">
            <div className="flex items-center gap-1 text-[10px] text-blue-950 font-bold uppercase mb-1">
              <Tag className="w-3 h-3 stroke-[2.5]" />
              <span>DEEP-LINK / REFERRAL</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-blue-900 break-all">
                {conversation.latest_deep_link}
              </span>
              <button
                onClick={() => handleCopy(conversation.latest_deep_link!, 'Referral code')}
                className="p-1 text-black hover:bg-blue-200 border border-black ml-1"
                title="Copy referral parameter"
              >
                <Copy className="w-3 h-3 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-slate-200">
            <span className="text-slate-500 text-[11px] uppercase">USER ID</span>
            <div className="flex items-center gap-1 font-bold text-black">
              <span>{conversation.telegram_user_id}</span>
              <button
                onClick={() => handleCopy(conversation.telegram_user_id, 'User ID')}
                className="p-0.5 hover:text-blue-700"
                title="Copy"
              >
                <Copy className="w-3 h-3 stroke-[2.5]" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200">
            <span className="text-slate-500 text-[11px] uppercase">CHAT ID</span>
            <div className="flex items-center gap-1 font-bold text-black">
              <span>{conversation.telegram_chat_id}</span>
              <button
                onClick={() => handleCopy(conversation.telegram_chat_id, 'Chat ID')}
                className="p-0.5 hover:text-blue-700"
                title="Copy"
              >
                <Copy className="w-3 h-3 stroke-[2.5]" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200">
            <span className="text-slate-500 text-[11px] uppercase">FIRST SEEN</span>
            <span className="font-bold text-black text-right text-[11px]">{formatDate(conversation.created_at)}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200">
            <span className="text-slate-500 text-[11px] uppercase">LAST MESSAGE</span>
            <span className="font-bold text-black text-right text-[11px]">{formatDate(conversation.last_message_at)}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-slate-500 text-[11px] uppercase">UNREAD MESSAGES</span>
            <span className="font-bold text-black">{conversation.unread_count}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
