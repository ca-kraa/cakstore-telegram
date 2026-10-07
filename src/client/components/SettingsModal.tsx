import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  Bot,
  ShieldCheck,
  Activity,
  Clock,
  Layers,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import type { BotStatusState } from '../../shared/types.js';
import { api } from '../api/client.js';
import { useToast } from './Toast.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: BotStatusState | null;
  onStatusUpdated: (status: BotStatusState) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusUpdated,
}) => {
  const [restarting, setRestarting] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const updated = await api.restartTelegram();
      onStatusUpdated(updated);
      showToast('Telegram polling service restarted', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to restart polling', 'error');
    } finally {
      setRestarting(false);
    }
  };

  const getStatusBadge = () => {
    if (!status?.configured) {
      return (
        <span className="px-2 py-0.5 bg-amber-200 border border-black text-amber-950 font-mono text-[10px] font-bold uppercase">
          NOT CONFIGURED
        </span>
      );
    }
    if (status?.connectionState === 'connected') {
      return (
        <span className="px-2 py-0.5 bg-blue-100 border border-black text-blue-900 font-mono text-[10px] font-bold uppercase">
          CONNECTED
        </span>
      );
    }
    if (status?.connectionState === 'connecting') {
      return (
        <span className="px-2 py-0.5 bg-yellow-100 border border-black text-yellow-950 font-mono text-[10px] font-bold uppercase">
          CONNECTING
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-rose-100 border border-black text-rose-950 font-mono text-[10px] font-bold uppercase">
        {status?.connectionState === 'error' ? 'ERROR' : 'DISCONNECTED'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border-2 border-black max-w-lg w-full brutal-shadow-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 border border-black flex items-center justify-center text-white brutal-shadow-sm">
              <Bot className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-extrabold text-black uppercase tracking-tight">
                TELEGRAM BOT GATEWAY
              </h2>
              <p className="font-mono text-[11px] text-slate-500">Live service telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 border border-black hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Status Row */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-black font-mono">
            <div>
              <div className="text-[10px] uppercase text-slate-500 font-bold">STATE</div>
              <div className="text-xs font-bold text-black uppercase">
                {status?.connectionState || 'DISCONNECTED'}
              </div>
            </div>
            {getStatusBadge()}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 bg-slate-50 border border-black">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase mb-1">
                <Bot className="w-3 h-3 stroke-[2.5]" />
                <span>BOT NAME</span>
              </div>
              <div className="font-bold text-black truncate">
                {status?.bot?.name || status?.botInfo?.first_name || 'Not available'}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-black">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase mb-1">
                <ShieldCheck className="w-3 h-3 stroke-[2.5]" />
                <span>USERNAME</span>
              </div>
              <div className="font-bold text-blue-700 truncate">
                {status?.bot?.username || status?.botInfo?.username
                  ? `@${status.bot?.username || status.botInfo?.username}`
                  : 'Not available'}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-black">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase mb-1">
                <Layers className="w-3 h-3 stroke-[2.5]" />
                <span>BOT ID</span>
              </div>
              <div className="font-bold text-black truncate">
                {status?.bot?.id || status?.botInfo?.id || '—'}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-black">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase mb-1">
                <Activity className="w-3 h-3 stroke-[2.5]" />
                <span>LAST UPDATE ID</span>
              </div>
              <div className="font-bold text-black truncate">
                {status?.lastUpdateId !== null && status?.lastUpdateId !== undefined
                  ? status.lastUpdateId
                  : '0'}
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="p-3 bg-slate-50 border border-black space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 stroke-[2.5]" />
                LAST SUCCESSFUL POLL:
              </span>
              <span className="font-bold text-black">
                {status?.lastSuccessPollAt
                  ? new Date(status.lastSuccessPollAt).toLocaleTimeString()
                  : 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 uppercase flex items-center gap-1">
                <Activity className="w-3 h-3 stroke-[2.5]" />
                GATEWAY UPTIME:
              </span>
              <span className="font-bold text-black">
                {status?.uptimeSeconds ? `${Math.floor(status.uptimeSeconds / 60)}m ${status.uptimeSeconds % 60}s` : '0s'}
              </span>
            </div>
          </div>

          {/* Error display if present */}
          {status?.lastError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-black text-rose-950 font-mono text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 stroke-[2.5]" />
              <div className="break-all">{status.lastError}</div>
            </div>
          )}

          {/* Security Notice */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
            <Lock className="w-3 h-3 text-slate-700 stroke-[2.5]" />
            <span>TELEGRAM_BOT_TOKEN is stored strictly server-side in .env</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-100 border-t-2 border-black">
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-200 text-black border border-black font-mono text-xs font-bold uppercase brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${restarting ? 'animate-spin' : ''}`} />
            {restarting ? 'RESTARTING...' : 'RESTART POLLING'}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase border border-black brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
