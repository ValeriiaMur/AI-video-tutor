import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Teach Me Like I\'m 5 — AI Video Tutor',
  description: 'An AI-powered Socratic tutor with a glowing wisdom orb avatar that teaches any topic through guided questions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-body bg-canvas text-ink">
        {children}
      </body>
    </html>
  );
}
