import React from 'react';
import {
  MessageSquare,
  Settings,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Radio,
  SlidersHorizontal,
  LogOut,
  User,
} from 'lucide-react';
import type { BotStatusState } from '../../shared/types.js';

interface HeaderProps {
  status: BotStatusState | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onLogout?: () => void;
  isAuthenticated?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onRefresh,
  onOpenSettings,
  onLogout,
  isAuthenticated = true,
}) => {
  const getStatusBadge = () => {
    if (!status || !status.configured || status.connectionState === 'not_configured') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-black text-amber-950 font-mono text-[11px] font-bold tracking-wider uppercase brutal-shadow-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          NOT CONFIGURED
        </div>
      );
    }

    if (status.connectionState === 'connected') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-black text-blue-900 font-mono text-[11px] font-bold tracking-wider uppercase brutal-shadow-sm">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          CONNECTED
          {status.bot?.username && (
            <span className="text-blue-700 font-normal ml-1">@{status.bot.username}</span>
          )}
        </div>
      );
    }

    if (status.connectionState === 'connecting') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 border border-black text-yellow-900 font-mono text-[11px] font-bold tracking-wider uppercase brutal-shadow-sm">
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          CONNECTING
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-100 border border-black text-rose-950 font-mono text-[11px] font-bold tracking-wider uppercase brutal-shadow-sm">
        <span className="w-2 h-2 rounded-full bg-rose-600" />
        {status.connectionState === 'error' ? 'ERROR' : 'DISCONNECTED'}
      </div>
    );
  };

  return (
    <header className="bg-white border-b-2 border-black px-4 py-2.5 flex items-center justify-between shrink-0 select-none">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 border-2 border-black flex items-center justify-center text-white brutal-shadow-sm">
          <MessageSquare className="w-4 h-4 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-tight text-black font-mono">
              CAKSTORE
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-black text-white px-1.5 py-0.2">
              SUPPORT PORTAL
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            TELEGRAM GATEWAY & INBOX
          </div>
        </div>
      </div>

      {/* Center status */}
      <div className="hidden md:flex items-center">
        {getStatusBadge()}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <div className="md:hidden">
          {getStatusBadge()}
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-black border border-black text-xs font-mono font-bold brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
          title="Refresh Data"
        >
          <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">REFRESH</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-black border border-black text-xs font-mono font-bold brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
          title="Bot Settings"
        >
          <Settings className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">SETTINGS</span>
        </button>

        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-900 border border-black text-xs font-mono font-bold brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">LOGOUT</span>
          </button>
        )}
      </div>
    </header>
  );
};
