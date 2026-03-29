import type { Metadata } from 'next';
import './globals.css';

const themeScript = `(function(){try{var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme:dark)').matches;if(s==='dark'||(!s&&d)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})();`;

export const metadata: Metadata = {
  title: 'Contexta — AI Co-Host for Discord',
  description: 'An intelligent AI agent that remembers your conversations and provides contextual assistance in Discord servers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg text-text min-h-screen">{children}</body>
    </html>
  );
}
