import React from 'react';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  photoUrl?: string | null;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 'md', photoUrl, className = '' }) => {
  const getInitials = (str: string) => {
    if (!str) return '?';
    const clean = str.replace(/^@/, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  const getBackground = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'bg-blue-600 text-white',
      'bg-slate-900 text-white',
      'bg-cyan-700 text-white',
      'bg-amber-500 text-black',
      'bg-indigo-700 text-white',
      'bg-sky-600 text-white',
      'bg-teal-700 text-white',
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px] font-mono font-bold',
    md: 'w-9 h-9 text-xs font-mono font-bold',
    lg: 'w-11 h-11 text-sm font-mono font-bold',
    xl: 'w-14 h-14 text-base font-mono font-bold',
  };

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizeClasses[size]} border border-black rounded-none object-cover shrink-0 select-none ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} border border-black rounded-none ${getBackground(
        name || 'Unknown'
      )} flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {getInitials(name)}
    </div>
  );
};
