import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Contexta — Your Server\'s Memory',
  description: 'An AI Discord bot that remembers your conversations, learns your community, and builds knowledge over time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="bg-bg text-text min-h-screen font-[family-name:var(--font-sans)]">
        {children}
      </body>
    </html>
  );
}
