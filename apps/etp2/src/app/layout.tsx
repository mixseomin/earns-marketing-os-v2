// etp2.on.tc — bản etp riêng của anh (anh 09/11/2026 "tách etp hoặc clone thành 1 cái là etp2 để riêng tao dùng"). Chép từ apps/web /etp lúc tách;
// từ đây mọi thay đổi etp làm ở app này, etp.on.tc (apps/web) để yên. nginx gác SSO mos2 (auth_request) như etp.on.tc.
import type { Metadata } from 'next';
import './globals.css';
import '@mos2/bang/bang.css';
import { TablePrefsProvider } from '@/components/ui/table-prefs';
import { readTablePrefs } from '@/lib/table-prefs';
import { getCurrentUser } from '@/lib/auth';
import { GopYMos2 } from '@/components/gop-y-mos2';
import { EtpDrawerHost } from '@/components/etp-drawer-host';

export const metadata: Metadata = { title: 'ETP2 · camp', robots: { index: false, follow: false } };
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover' as const };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [u, tablePrefs] = await Promise.all([getCurrentUser(), readTablePrefs()]);
  return (
    <html lang="vi" data-theme="dark" data-sidebar="shown" data-rightbar="hidden">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <TablePrefsProvider value={tablePrefs}>
          {children}
          <EtpDrawerHost />
          {u?.role === 'admin' && <GopYMos2 hom="mos2" tren />}
        </TablePrefsProvider>
      </body>
    </html>
  );
}
