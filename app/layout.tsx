import type { Metadata } from 'next';
import { Space_Mono, Syne } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});

const syne = Syne({
  weight: ['800'],
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VibeShomer — AI Security & Performance Scanner',
  description:
    'Free AI-powered security & performance scanner for vibe-coded projects. Paste code or scan a GitHub repo.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceMono.variable} ${syne.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
