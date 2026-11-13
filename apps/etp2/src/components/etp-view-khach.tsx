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
async function taiPhan(url: string, tien?: Tien): Promise<[Record<string, unknown>, string, string]> {
  const r = await fetch(url);   // /etp/du?p=<mã> cố định theo mã — để trình duyệt dùng bản đã giữ
  if (!r.ok) throw new Error(`máy chủ trả ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
  const tong = Number(r.headers.get('x-tho')) || 0, ma = r.headers.get('x-phien') ?? '';
  if (!r.body) { const t = await r.text(); return [JSON.parse(t), ma, t]; }
  const doc = r.body.getReader(), khuc: Uint8Array[] = []; let nhan = 0;
  for (;;) { const { done, value } = await doc.read(); if (done) break; khuc.push(value); nhan += value.length; tien?.(nhan, tong); }
  const gop = new Uint8Array(nhan); let o = 0; for (const k of khuc) { gop.set(k, o); o += k.length; }
  const t = new TextDecoder().decode(gop);
  return [JSON.parse(t), ma, t];
}
const urlPhan = (duUrl: string, phan: 'chinh' | 'phu', ma?: string) => { const u = new URL(duUrl, location.origin); u.searchParams.set('phan', phan); if (ma) u.searchParams.set('p', ma); return `${u.pathname}${u.search}`; };

// BẢN LẦN TRƯỚC GIỮ TRONG MÁY (anh 13/11/2026 "Có giải pháp nào hợp lý và nhanh hơn?" — mạng iPhone 20–200 KB/giây, mỗi lần tải lại kéo ~660 KB):
// mở / tải lại trang → hiện NGAY bản lần trước (Cache API của trình duyệt, theo người đang xem), dòng trên đầu ghi số lúc mấy giờ; bản mới tải ngầm, về là thay.
// Mã bản giữ = mã trang vừa nhận → số chưa đổi, không tải gì. Trình duyệt chặn / hết chỗ → lặng lẽ quay về tải thường (không mất số, chỉ chậm như cũ).
const KHO_MAY = 'etp2-du-v1';
const khoaMay = (duUrl: string, phan: string) => `/etp2-du-may/${new URL(duUrl, location.origin).searchParams.get('ng') || 'nha'}/${phan}`;
async function docMay(duUrl: string): Promise<{ du: Record<string, unknown>; ma: string; luc: number } | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const c = await caches.open(KHO_MAY);
    const [a, b] = await Promise.all([c.match(khoaMay(duUrl, 'chinh')), c.match(khoaMay(duUrl, 'phu'))]);
    if (!a || !b || a.headers.get('x-phien') !== b.headers.get('x-phien')) return null;
    return { du: { ...(await a.json()), ...(await b.json()) }, ma: a.headers.get('x-phien') ?? '', luc: Number(a.headers.get('x-luc')) || 0 };
  } catch { return null; }
}
async function ghiMay(duUrl: string, ma: string, chinh: string, phu: string) {
  try {
    if (typeof caches === 'undefined') return;
    const c = await caches.open(KHO_MAY), h = { 'content-type': 'application/json', 'x-phien': ma, 'x-luc': String(Date.now()) };
    await Promise.all([c.put(khoaMay(duUrl, 'chinh'), new Response(chinh, { headers: h })), c.put(khoaMay(duUrl, 'phu'), new Response(phu, { headers: h }))]);
  } catch { /* hết chỗ / bị chặn — lần sau tải thường */ }
}
const gioVn = (ms: number) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

export function EtpView({ duUrl, ...p }: Omit<Props, 'du'> & { duUrl: string }) {
  const [du, setDu] = useState<DuLieuEtpGui | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [lan, setLan] = useState(0);
  const [tien, setTien] = useState<[number, number] | null>(null);
  const coDu = useRef(false);
  const [cu, setCu] = useState<number | null>(null);   // đang hiện bản giữ trong máy lúc mấy giờ (null = số mới)
  useEffect(() => {
    let huy = false; setLoi(null);
    const bao = (e: unknown) => { if (!huy) setLoi(e instanceof Error ? e.message : String(e)); };
    const maTrang = new URL(duUrl, location.origin).searchParams.get('p') ?? '';
    const taiCa = () => Promise.all([taiPhan(urlPhan(duUrl, 'chinh')), taiPhan(urlPhan(duUrl, 'phu'))])
      .then(([[chinh, ma, tc], [phu, , tp]]) => { if (huy) return; coDu.current = true; setCu(null); setDu({ ...chinh, ...phu } as DuLieuEtpGui); void ghiMay(duUrl, ma, tc, tp); });
    void (async () => {
      try {
        if (!coDu.current) {
          const may = await docMay(duUrl);
          if (huy) return;
          if (may) {
            coDu.current = true; setDu(may.du as DuLieuEtpGui);
            if (may.ma === maTrang) { setCu(null); return; }   // số chưa đổi từ lần trước — không tải gì
            setCu(may.luc); await taiCa(); return;
          }
          // máy chưa có bản nào: phần chính (có tiến độ) → dựng; phần phụ theo đúng mã của phần chính → ghép
          const [chinh, ma, tc] = await taiPhan(urlPhan(duUrl, 'chinh'), (a, b) => { if (!huy) setTien([a, b]); });
          if (huy) return; coDu.current = true; setTien(null); setDu(chinh as DuLieuEtpGui);
          const [phu, , tp] = await taiPhan(urlPhan(duUrl, 'phu', ma));
          if (huy) return; setDu((d) => ({ ...(d ?? chinh), ...phu }) as DuLieuEtpGui); void ghiMay(duUrl, ma, tc, tp);
        } else await taiCa();
      } catch (e) { bao(e); }
    })();
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
      {cu && !loi ? <div style={{ padding: '4px 12px', fontSize: 11.5, color: 'var(--fg-2)', borderBottom: '1px solid var(--line)' }}>Số lúc {gioVn(cu)} (bản giữ trong máy) — đang tải bản mới…</div> : null}
      {loi ? <div style={{ padding: '6px 12px', fontSize: 12, color: '#f87171', borderBottom: '1px solid #f87171' }}>Số liệu mới chưa tải được ({loi}) — đang hiện bản trước. <button type="button" onClick={() => setLan((n) => n + 1)} style={{ fontSize: 12, background: 'transparent', border: '1px solid #f87171', color: 'inherit', borderRadius: 4, cursor: 'pointer' }}>Thử lại</button></div> : null}
      <EtpViewTre {...p} du={du} />
    </>
  );
}
