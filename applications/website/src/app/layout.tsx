import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const title = 'Contexta — Your Server\'s Memory';
const description = 'An AI Discord bot that remembers your conversations, learns your community, and builds knowledge over time. Long-term memory, semantic recall, server lore, and personal profiles for Discord.';

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL('https://contexta-bot.iser.io'),
  alternates: {
    canonical: '/',
  },
  keywords: [
    'Discord bot',
    'AI Discord bot',
    'Discord memory bot',
    'server memory',
    'conversation history',
    'semantic search Discord',
    'community knowledge base',
    'Discord AI assistant',
    'server lore',
    'Discord chatbot',
  ],
  authors: [{ name: 'Contexta' }],
  creator: 'Contexta',
  openGraph: {
    title,
    description,
    siteName: 'Contexta',
    type: 'website',
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Contexta',
    applicationCategory: 'CommunicationApplication',
    operatingSystem: 'Web',
    description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: undefined,
  };

  return (
    <html lang="en" className={manrope.variable}>
      <body className="bg-bg text-text min-h-screen font-[family-name:var(--font-sans)]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
