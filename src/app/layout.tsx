import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SyncSpeak | AI Presentation Copilot',
  description: 'An AI-powered teleprompter that tracks your speech and automatically scrolls as you present.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col antialiased bg-[var(--bg-primary)]`}>
        {children}
      </body>
    </html>
  );
}
