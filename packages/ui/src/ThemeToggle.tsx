'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function getAppliedTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    const applied = getAppliedTheme(theme);
    document.documentElement.classList.toggle('dark', applied === 'dark');

    if (theme === 'system') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  function cycle() {
    setTheme((prev) => {
      if (prev === 'system') return 'light';
      if (prev === 'light') return 'dark';
      return 'system';
    });
  }

  const label = theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to change.`}
      className="rounded-md px-2 py-1 text-xs font-medium text-text-muted hover:text-text hover:bg-bg-overlay transition"
    >
      {theme === 'system' && '◐'}
      {theme === 'light' && '☀'}
      {theme === 'dark' && '☾'}
      <span className="ml-1">{label}</span>
    </button>
  );
}
