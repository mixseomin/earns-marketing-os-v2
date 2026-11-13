'use client';
// etp2 09/11/2026 "sửa load chậm": EtpView CHỈ DỰNG Ở TRÌNH DUYỆT — trước máy chủ dựng sẵn HTML cả bảng ~1.569 camp (~1,5–2s TTFB, ~3 MB HTML)
// rồi trình duyệt dựng lại y hệt lúc hydrate.
// etp2 13/11/2026 "Etp2 đang lỗi. Fix triệt để": SỐ LIỆU CŨNG KHÔNG ĐI TRONG HTML NỮA — trang chỉ mang mã phiên bản + đường /etp/du?p=<mã>,
// khung này tải JSON nén (~1 MB) rồi mới dựng EtpView. Trước đó ~9,6 MB số liệu nằm trong HTML 11,4 MB dạng chuỗi flight → iPhone hết RAM, Safari giết tab
// và tự tải lại liên tục. router.refresh (sau thao tác / tự làm mới) đưa mã mới xuống → khung tải lại số theo mã; mã không đổi thì không tải gì.
// Đang tải bản mới thì vẫn hiện bản cũ; lỗi tải hiện ô đỏ đủ câu máy chủ nói + nút thử lại (luật "lỗi phải kêu to").
// HAI PHẦN + THANH TIẾN ĐỘ (anh 13/11/2026 22:00 "Ko load nổi" — mạng iPhone ~20 KB/giây, khối 950 KB mất ~45 giây, anh tưởng treo nên tải lại giữa chừng):
// lần đầu tải phần CHÍNH → dựng trang ngay, phần PHỤ (xét luật, lịch sử bậc, chấm…) về sau thì ghép; lúc chờ hiện % + KB đã nhận.
// Lần làm mới (mã đổi): tải cả hai phần song song, đủ cả hai mới thay — không có khoảng trang mất phần phụ.
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import type { EtpView as EtpViewGoc } from './etp-view';
import type { DuLieuEtpGui } from '@/lib/etp-xet-gon';

type Props = ComponentProps<typeof EtpViewGoc>;
const EtpViewTre = dynamic(() => import('./etp-view').then((m) => m.EtpView), {
  ssr: false,
  loading: () => <div style={{ padding: 24, color: 'var(--fg-2)', fontSize: 13 }}>Đang dựng bảng etp…</div>,
});

type Tien = (nhan: number, tong: number) => void;
/** tải một phần số liệu, đếm byte đã nhận (sau giải nén) so với x-tho để báo tiến độ → [JSON, mã phiên bản của bản trả về] */
async function taiPhan(url: string, tien?: Tien): Promise<[Record<string, unknown>, string]> {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`máy chủ trả ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
  const tong = Number(r.headers.get('x-tho')) || 0, ma = r.headers.get('x-phien') ?? '';
  if (!r.body || !tien) return [await r.json(), ma];
  const doc = r.body.getReader(), khuc: Uint8Array[] = []; let nhan = 0;
  for (;;) { const { done, value } = await doc.read(); if (done) break; khuc.push(value); nhan += value.length; tien(nhan, tong); }
  const gop = new Uint8Array(nhan); let o = 0; for (const k of khuc) { gop.set(k, o); o += k.length; }
  return [JSON.parse(new TextDecoder().decode(gop)), ma];
}
const urlPhan = (duUrl: string, phan: 'chinh' | 'phu', ma?: string) => { const u = new URL(duUrl, location.origin); u.searchParams.set('phan', phan); if (ma) u.searchParams.set('p', ma); return `${u.pathname}${u.search}`; };

export function EtpView({ duUrl, ...p }: Omit<Props, 'du'> & { duUrl: string }) {
  const [du, setDu] = useState<DuLieuEtpGui | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [lan, setLan] = useState(0);
  const [tien, setTien] = useState<[number, number] | null>(null);
  const coDu = useRef(false);
  useEffect(() => {
    let huy = false; setLoi(null);
    const bao = (e: unknown) => { if (!huy) setLoi(e instanceof Error ? e.message : String(e)); };
    if (!coDu.current) {
      // lần đầu: phần chính (có tiến độ) → dựng; phần phụ theo đúng mã của phần chính → ghép
      void (async () => {
        try {
          const [chinh, ma] = await taiPhan(urlPhan(duUrl, 'chinh'), (a, b) => { if (!huy) setTien([a, b]); });
          if (huy) return; coDu.current = true; setTien(null); setDu(chinh as DuLieuEtpGui);
          const [phu] = await taiPhan(urlPhan(duUrl, 'phu', ma));
          if (!huy) setDu((d) => ({ ...(d ?? chinh), ...phu }) as DuLieuEtpGui);
        } catch (e) { bao(e); }
      })();
    } else {
      void Promise.all([taiPhan(urlPhan(duUrl, 'chinh')), taiPhan(urlPhan(duUrl, 'phu'))])
        .then(([[chinh], [phu]]) => { if (!huy) setDu({ ...chinh, ...phu } as DuLieuEtpGui); }).catch(bao);
    }
    return () => { huy = true; };
  }, [duUrl, lan]);
  if (!du) {
    if (!loi) return <div style={{ padding: 24, color: 'var(--fg-2)', fontSize: 13 }}>
      Đang tải số liệu etp…{tien ? ` ${tien[1] ? Math.min(99, Math.round((tien[0] / tien[1]) * 100)) + '% · ' : ''}${Math.round(tien[0] / 1024)} KB` : ''}
      <div style={{ marginTop: 8, height: 3, maxWidth: 320, background: 'var(--line)', borderRadius: 2 }}><div style={{ height: 3, width: `${tien && tien[1] ? Math.min(100, (tien[0] / tien[1]) * 100) : 4}%`, background: 'var(--accent, #60a5fa)', borderRadius: 2, transition: 'width .3s' }} /></div>
    </div>;
    return (
      <div style={{ margin: '40px auto', maxWidth: 640, padding: 14, border: '1px solid #f87171', background: 'rgba(248,113,113,.1)', borderRadius: 10, color: 'var(--fg-1)' }}>
        <b style={{ color: '#f87171' }}>Không tải được số liệu etp2</b>
        <div style={{ marginTop: 6, fontSize: 13, wordBreak: 'break-word' }}>{loi}</div>
        <button type="button" onClick={() => setLan((n) => n + 1)} style={{ marginTop: 10, fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Thử lại</button>
      </div>
    );
  }
  return (
    <>
      {loi ? <div style={{ padding: '6px 12px', fontSize: 12, color: '#f87171', borderBottom: '1px solid #f87171' }}>Số liệu mới chưa tải được ({loi}) — đang hiện bản trước. <button type="button" onClick={() => setLan((n) => n + 1)} style={{ fontSize: 12, background: 'transparent', border: '1px solid #f87171', color: 'inherit', borderRadius: 4, cursor: 'pointer' }}>Thử lại</button></div> : null}
      <EtpViewTre {...p} du={du} />
    </>
  );
}
