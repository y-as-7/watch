import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Askar Watch Party - Synchronized Movie Rooms',
  description:
    'Watch movies together in real-time synchronized rooms powered by Cloudflare R2 storage. No registration needed for guests!',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100 selection:bg-purple-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
