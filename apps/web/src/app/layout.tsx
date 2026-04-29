import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MOS v2',
  description: 'Earns Marketing OS — v2.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
