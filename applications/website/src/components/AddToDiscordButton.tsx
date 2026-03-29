'use client';

import { useState } from 'react';

export default function AddToDiscordButton({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [showPopover, setShowPopover] = useState(false);

  const sizeClasses = {
    sm: 'px-4 py-1.5 text-[13px]',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-sm',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setShowPopover((v) => !v)}
        onBlur={() => setShowPopover(false)}
        className={`group inline-flex items-center gap-2.5 rounded-xl bg-blurple/60 ${sizeClasses[size]} text-white/80 font-semibold cursor-default shadow-lg shadow-blurple/15`}
      >
        <svg width="20" height="15" viewBox="0 0 71 55" fill="currentColor" className="opacity-60">
          <path d="M60.1 4.9A58.5 58.5 0 0 0 45.4.2a.2.2 0 0 0-.2.1 40.6 40.6 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37 37 0 0 0 25.4.3a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.4 5a.2.2 0 0 0-.1 0A59.7 59.7 0 0 0 .2 45.3a.2.2 0 0 0 .1.2A58.8 58.8 0 0 0 18 54.7a.2.2 0 0 0 .3-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.8 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .3 36.4 36.4 0 0 1-5.5 2.7.2.2 0 0 0-.1.3 47.2 47.2 0 0 0 3.6 5.8.2.2 0 0 0 .3.1A58.6 58.6 0 0 0 70.7 45.4a.2.2 0 0 0 .1-.1A59.5 59.5 0 0 0 60.2 5a.2.2 0 0 0 0 0ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 4-2.8 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 4-2.9 7.2-6.4 7.2Z" />
        </svg>
        Add to Discord
      </button>

      {/* Popover */}
      {showPopover && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 text-text text-xs font-medium whitespace-nowrap shadow-lg">
          In development
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45 bg-white/10 border-r border-b border-white/10" />
        </div>
      )}
    </div>
  );
}
