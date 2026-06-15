import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { RootProviders } from '@/components/root-providers';

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
  var theme = 'dark';
  if (raw) { var t = JSON.parse(raw); if (t && t.theme === 'light') theme = 'light'; }
  document.documentElement.setAttribute('data-theme', theme);
  var ov = localStorage.getItem('mos.design-tokens');
  if (ov) {
    var map = JSON.parse(ov);
    var themeMap = (map && map[theme]) || {};
    for (var k in themeMap) { if (themeMap[k]) document.documentElement.style.setProperty('--' + k, themeMap[k]); }
  }
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="dark">
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
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
