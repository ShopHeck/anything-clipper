import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './global.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ClipForge AI — Turn Videos into Viral Short-Form Content',
  description:
    'The AI-powered video editor that transcribes, clips, captions, and publishes. Like Descript + Opus Clip + CapCut combined.',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="/fontawesome/releases/v6.3.0/css/pro.min.css?token=2c15cc0cc7"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
