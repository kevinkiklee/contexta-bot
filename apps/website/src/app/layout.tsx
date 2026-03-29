import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contexta — AI Co-Host for Discord',
  description: 'An intelligent AI agent that remembers your conversations and provides contextual assistance in Discord servers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
