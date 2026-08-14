import type { Metadata } from 'next';
import Script from 'next/script';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import './globals.css';
import { RootProviders } from '@/components/root-providers';
import { TablePrefsProvider } from '@/components/ui/table-prefs';
import { readTablePrefs } from '@/lib/table-prefs';
import { getCurrentUser } from '@/lib/auth';

// Google Analytics 4 — property "MOS2" (mos2.on.tc). Public measurement ID, not a secret.
const GA_ID = 'G-GBENC4P7CB';

export const metadata: Metadata = {
  title: 'MOS — Mission Orchestration System',
  description: 'Earns Marketing OS — orchestrate AI agents across all your portfolio projects.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover' as const,
};

// Inline blocking script — runs synchronously BEFORE first paint to read
// theme + colour overrides from localStorage and apply them to <html>. This
// is the standard pattern (next-themes does this) to avoid the "dark flash"
// on F5 when user has picked light. Must NOT use modern syntax that could
// fail to parse in older WebViews.
const NO_FLASH_SCRIPT = `(function(){try{
  var raw = localStorage.getItem('mos.tweaks');
  var t = raw ? JSON.parse(raw) : null;
  var theme = (t && t.theme === 'light') ? 'light' : 'dark';
  var d = document.documentElement;
  d.setAttribute('data-theme', theme);
  d.setAttribute('data-sidebar', (t && t.showSidebar === false) ? 'hidden' : 'shown');
  d.setAttribute('data-rightbar', (t && t.showRightbar === true) ? 'shown' : 'hidden');
  var ov = localStorage.getItem('mos.design-tokens');
  if (ov) {
    var map = JSON.parse(ov);
    var themeMap = (map && map[theme]) || {};
    for (var k in themeMap) { if (themeMap[k]) d.style.setProperty('--' + k, themeMap[k]); }
  }
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reviewers (role 'viewer') are confined to the user.on.tc review portal. If one lands
  // on the main dashboard host, bounce them to the portal. (course.on.tc is gated at nginx
  // via /api/auth/verify.) Only costs a getCurrentUser on mos2.on.tc renders.
  const host = (await headers()).get('host')?.split(':')[0] || '';
  if (host === 'mos2.on.tc') {
    const u = await getCurrentUser();
    if (u && u.role === 'viewer') redirect('https://user.on.tc/review');
  }
  // Cột/sort/lọc của MỌI bảng — đọc ở đây để lần sơn đầu đã đúng (hết nháy khi F5).
  const tablePrefs = await readTablePrefs();
  return (
    <html lang="vi" data-theme="dark" data-sidebar="shown" data-rightbar="hidden">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {process.env.NODE_ENV === 'production' && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
        <TablePrefsProvider value={tablePrefs}>
          <RootProviders>{children}</RootProviders>
        </TablePrefsProvider>
      </body>
    </html>
  );
}
