import type { Metadata } from 'next';
import './globals.css';
import AppHeader from '@/components/app-header';

export const metadata: Metadata = {
  title: 'Govenr — Dash Governance',
  description:
    'Open-source governance app for Dash. The chain records the vote; the platform remembers why.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
