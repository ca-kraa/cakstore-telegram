import React, { useState } from 'react';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Lock,
  User,
  KeyRound,
} from 'lucide-react';
import { useToast } from './Toast.js';

interface AdminLoginViewProps {
  onLoginSuccess: () => void;
  onBackToStore?: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onLoginSuccess,
  onBackToStore,
}) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast('Please enter username', 'error');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      showToast('Authenticated successfully as Admin', 'success');
      onLoginSuccess();
    }, 400);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-dot-grid">
      {/* Top Header Navigation */}
      <div className="max-w-md w-full flex items-center justify-between mb-4 select-none">
        <button
          onClick={onBackToStore}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-black border-2 border-black font-mono text-xs font-bold uppercase brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>BACK TO STOREFRONT</span>
        </button>

        <div className="px-2.5 py-1 bg-black text-white font-mono text-[10px] font-bold tracking-wider uppercase border-2 border-black">
          ADMIN AUTH
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full bg-white border-2 border-black p-6 sm:p-8 brutal-shadow-lg animate-in fade-in zoom-in-95 duration-200">
        {/* Card Header */}
        <div className="flex items-center gap-3 pb-5 border-b-2 border-black mb-6">
          <div className="w-10 h-10 bg-blue-600 border-2 border-black flex items-center justify-center text-white brutal-shadow-sm">
            <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
              SECURE PORTAL
            </div>
            <h1 className="font-mono font-extrabold text-lg text-black tracking-tight leading-none mt-0.5">
              ADMIN PORTAL
            </h1>
            <div className="font-mono text-xs text-blue-700 font-semibold mt-0.5">
              CAKSTORE Telegram Support
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              USERNAME
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-black font-mono text-sm text-black placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:ring-0 focus:border-blue-600"
                required
              />
              <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[2]" />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              PASSWORD
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-black font-mono text-sm text-black placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:ring-0 focus:border-blue-600 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] font-bold text-slate-600 hover:text-black uppercase px-1 py-0.5"
              >
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          {/* Primary Action Button in BLUE */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-mono font-bold text-xs uppercase border-2 border-black brutal-shadow transition-transform active:translate-x-0.5 active:translate-y-0.5 mt-6 disabled:opacity-60"
          >
            <span>{loading ? 'AUTHENTICATING...' : 'LOG IN TO PORTAL'}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center">
          <span className="font-mono text-[11px] text-slate-500">
            Cakstore Telegram Bot Gateway v1.0.0
          </span>
        </div>
      </div>
    </div>
  );
};
