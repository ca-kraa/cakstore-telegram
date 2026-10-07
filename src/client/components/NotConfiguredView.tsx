import React, { useState } from 'react';
import {
  Bot,
  AlertCircle,
  RefreshCw,
  Terminal,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import type { BotStatusState } from '../../shared/types.js';
import { api } from '../api/client.js';
import { useToast } from './Toast.js';

interface NotConfiguredViewProps {
  status: BotStatusState | null;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export const NotConfiguredView: React.FC<NotConfiguredViewProps> = ({
  status,
  onRefresh,
  onOpenSettings,
}) => {
  const [checking, setChecking] = useState(false);
  const { showToast } = useToast();

  const handleCheckConnection = async () => {
    setChecking(true);
    try {
      const updated = await api.getTelegramStatus();
      if (updated.configured) {
        showToast('Telegram bot token detected! Polling starting...', 'success');
        onRefresh();
      } else {
        showToast('Bot token is still not configured on the server.', 'error');
      }
    } catch (err) {
      showToast('Failed to reach server status endpoint', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 bg-dot-grid overflow-y-auto">
      <div className="max-w-xl w-full bg-white border-2 border-black p-6 sm:p-8 brutal-shadow-lg animate-in fade-in zoom-in-95 duration-200">
        {/* Card Header */}
        <div className="flex items-start justify-between border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-400 border-2 border-black flex items-center justify-center text-black brutal-shadow-sm">
              <Bot className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-slate-500">
                GATEWAY STATUS
              </div>
              <h2 className="text-xl font-extrabold text-black tracking-tight font-mono">
                TELEGRAM BOT NOT CONFIGURED
              </h2>
            </div>
          </div>
          <span className="px-2 py-1 bg-amber-100 border border-black text-amber-950 font-mono text-[10px] font-bold uppercase">
            REQUIRED
          </span>
        </div>

        {/* Message */}
        <div className="space-y-4 mb-6 text-sm text-slate-800 leading-relaxed">
          <p className="font-medium text-black">
            Connect a Telegram bot to start receiving and responding to customer conversations.
          </p>
          <p className="text-xs text-slate-600">
            The customer inbox is locked until a valid Telegram Bot Token is loaded server-side. Once configured, real customer updates will stream here automatically.
          </p>
        </div>

        {/* Setup instructions box */}
        <div className="bg-slate-50 border-2 border-black p-4 mb-6 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 font-bold text-black border-b border-slate-300 pb-2">
            <Terminal className="w-4 h-4 stroke-[2.5]" />
            <span>SERVER CONFIGURATION STEPS</span>
          </div>

          <ol className="space-y-2.5 text-slate-700 pl-4 list-decimal text-[12px]">
            <li>
              Open <span className="font-bold text-black">@BotFather</span> in Telegram and create a new bot to obtain your API Token.
            </li>
            <li>
              Set the token in your server <span className="font-bold text-black">.env</span> file:
              <div className="mt-1.5 p-2 bg-black text-white rounded-none select-all text-[11px]">
                TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
              </div>
            </li>
            <li>
              Restart the application server or click the button below to verify the token.
            </li>
          </ol>
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mb-6 bg-slate-100 p-2.5 border border-black">
          <Lock className="w-3.5 h-3.5 text-black shrink-0 stroke-[2.5]" />
          <span>Bot tokens remain strictly on the server and are never exposed to browser client code.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleCheckConnection}
            disabled={checking}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs uppercase border-2 border-black brutal-shadow transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 stroke-[2.5] ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'VERIFYING SERVER...' : 'CHECK CONNECTION / REFRESH'}
          </button>

          <button
            onClick={onOpenSettings}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-100 text-black font-mono font-bold text-xs uppercase border-2 border-black brutal-shadow transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            <span>GATEWAY DETAILS</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
