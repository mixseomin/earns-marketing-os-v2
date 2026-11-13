'use client';
// etp2 09/11/2026 "sửa load chậm": EtpView CHỈ DỰNG Ở TRÌNH DUYỆT — trước máy chủ dựng sẵn HTML cả bảng ~1.569 camp (~1,5–2s TTFB, ~3 MB HTML)
// rồi trình duyệt dựng lại y hệt lúc hydrate.
// etp2 13/11/2026 "Etp2 đang lỗi. Fix triệt để": SỐ LIỆU CŨNG KHÔNG ĐI TRONG HTML NỮA — trang chỉ mang mã phiên bản + đường /etp/du?p=<mã>,
// khung này tải JSON nén (~1 MB) rồi mới dựng EtpView. Trước đó ~9,6 MB số liệu nằm trong HTML 11,4 MB dạng chuỗi flight → iPhone hết RAM, Safari giết tab
// và tự tải lại liên tục. router.refresh (sau thao tác / tự làm mới) đưa mã mới xuống → khung tải lại số theo mã; mã không đổi thì không tải gì.
// Đang tải bản mới thì vẫn hiện bản cũ; lỗi tải hiện ô đỏ đủ câu máy chủ nói + nút thử lại (luật "lỗi phải kêu to").
import dynamic from 'next/dynamic';
import { useEffect, useState, type ComponentProps } from 'react';
import type { EtpView as EtpViewGoc } from './etp-view';
import type { DuLieuEtpGui } from '@/lib/etp-xet-gon';

type Props = ComponentProps<typeof EtpViewGoc>;
const EtpViewTre = dynamic(() => import('./etp-view').then((m) => m.EtpView), {
  ssr: false,
  loading: () => <div style={{ padding: 24, color: 'var(--fg-2)', fontSize: 13 }}>Đang dựng bảng etp…</div>,
});

export function EtpView({ duUrl, ...p }: Omit<Props, 'du'> & { duUrl: string }) {
  const [du, setDu] = useState<DuLieuEtpGui | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [lan, setLan] = useState(0);
  useEffect(() => {
    let huy = false; setLoi(null);
    fetch(duUrl, { cache: 'no-store' })
      .then(async (r) => { if (!r.ok) throw new Error(`máy chủ trả ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`); return (await r.json()) as DuLieuEtpGui; })
      .then((d) => { if (!huy) setDu(d); })
      .catch((e: unknown) => { if (!huy) setLoi(e instanceof Error ? e.message : String(e)); });
    return () => { huy = true; };
  }, [duUrl, lan]);
  if (!du) {
    if (!loi) return <div style={{ padding: 24, color: 'var(--fg-2)', fontSize: 13 }}>Đang tải số liệu etp…</div>;
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
