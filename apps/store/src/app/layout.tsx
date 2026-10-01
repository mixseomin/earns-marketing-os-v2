import type { Metadata } from 'next';
import Script from 'next/script';
import { Poppins } from 'next/font/google';
import { shopHienTai } from '@/lib/shop';
import { GioProvider } from '@/components/gio';
import './store.css';

export const dynamic = 'force-dynamic';
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--f-poppins', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const s = await shopHienTai();
  return s ? { title: { default: s.ten, template: `%s | ${s.ten}` }, metadataBase: new URL(`https://${s.domain}`) } : {};
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await shopHienTai();
  if (!s) return <html lang="en"><body><p style={{ padding: 40 }}>Store not found.</p></body></html>;
  const m = s.mt;
  const ga = m.do.ga4, px = m.do.meta_pixel, gads = m.do.gads;
  return <html lang="en" className={poppins.variable} style={{ ['--nhan' as string]: m.mau_nhan ?? undefined }}>
    <body>
      {(ga || gads) && <>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga || gads}`} strategy="afterInteractive" />
        <Script id="gtag" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());${ga ? `gtag('config','${ga}');` : ''}${gads ? `gtag('config','${gads}');` : ''}`}</Script>
      </>}
      {px && <Script id="fbq" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${px}');fbq('track','PageView');`}</Script>}
      <GioProvider cfg={{ bac_giam: m.bac_giam, ship: m.ship, sale_het: m.sale_het && Date.parse(m.sale_het) > Date.now() ? m.sale_het : null }}>
        {children}
      </GioProvider>
    </body>
  </html>;
}
