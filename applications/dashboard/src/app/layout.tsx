import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contexta Dashboard',
  description: 'Manage your Contexta bot servers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text min-h-screen">{children}</body>
    </html>
  );
}
