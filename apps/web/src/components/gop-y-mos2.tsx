'use client';

// NÚT GÓP Ý NỔI CỦA CHÍNH MOS2 — cùng UX với hòm adfond: bấm là mở form nhỏ, dán ảnh
// Ctrl+V (ImageAttach — R2 sẵn có), nháp + ảnh sống qua F5 (localStorage giữ chữ + URL ảnh,
// KHÔNG giữ base64 — ảnh đã lên R2 ngay khi thêm). Gửi = một card pending trên plays
// `mos2`, follow hôm nay. Layout chỉ dựng component này cho admin.

import { useEffect, useState } from 'react';
import { ImageAttach, discardAttachments } from '@/components/ui/image-attach';
import { guiGopYMos2 } from '@/lib/actions/gop-y-mos2';

const KHOA = 'mos2.gop-y.nhap';
type Nhap = { loai: string; noiDung: string; anh: string[] };
const docNhap = (): Nhap => {
  try {
    const v = JSON.parse(localStorage.getItem(KHOA) ?? '');
    if (v && typeof v === 'object') {
      return {
        loai: v.loai === 'cau_hoi' ? 'cau_hoi' : 'loi',
        noiDung: typeof v.noiDung === 'string' ? v.noiDung : '',
        anh: Array.isArray(v.anh) ? v.anh.filter((u: unknown) => typeof u === 'string') : [],
      };
    }
  } catch { /* nháp hỏng — bắt đầu trắng */ }
  return { loai: 'loi', noiDung: '', anh: [] };
};

export function GopYMos2() {
  const [mo, setMo] = useState(false);
  const [nhap, setNhap] = useState<Nhap>({ loai: 'loi', noiDung: '', anh: [] });
  const [trang, setTrang] = useState('');
  const [busy, setBusy] = useState(false);
  const [ket, setKet] = useState('');

  useEffect(() => { if (mo) { setNhap(docNhap()); setTrang(window.location.href); setKet(''); } }, [mo]);
  const ghi = (n: Nhap) => {
    setNhap(n);
    try { localStorage.setItem(KHOA, JSON.stringify(n)); } catch { /* đầy thì thôi */ }
  };

  const gui = async () => {
    setBusy(true); setKet('');
    const r = await guiGopYMos2({ loai: nhap.loai, noiDung: nhap.noiDung, trang, anhUrls: nhap.anh });
    setBusy(false);
    if (!r.ok) { setKet(`⚠ ${r.error}`); return; }
    try { localStorage.removeItem(KHOA); } catch { /* thôi */ }
    setNhap({ loai: 'loi', noiDung: '', anh: [] });
    setKet(`✓ Đã lên bảng plays mos2 — card #${r.id}`);
  };

  const lbl = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 4 };
  return (
    <>
      <button type="button" aria-label="Báo lỗi / góp ý MOS2" title="Báo lỗi / góp ý về màn đang xem"
        onClick={() => setMo((v) => !v)}
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, width: 36, height: 36, borderRadius: 999,
          border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,.35)', fontSize: 15, lineHeight: '34px' }}>💬</button>
      {mo && (
        <div style={{ position: 'fixed', right: 16, bottom: 60, zIndex: 60, width: 340, maxWidth: 'calc(100vw - 32px)',
          border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-1)', padding: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,.45)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b style={{ fontSize: 12.5 }}>Góp ý / báo lỗi MOS2</b>
            <span style={{ marginLeft: 'auto' }} />
            <button type="button" onClick={() => setMo(false)} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
          <div>
            <div style={lbl}>Loại</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['loi', 'Báo lỗi / góp ý'], ['cau_hoi', 'Câu hỏi']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => ghi({ ...nhap, loai: v! })}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
                    border: `1px solid ${nhap.loai === v ? 'var(--accent)' : 'var(--line)'}`,
                    background: nhap.loai === v ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--bg-2)',
                    color: nhap.loai === v ? 'var(--fg-1)' : 'var(--fg-3)' }}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={lbl}>Mô tả</div>
            <textarea rows={4} autoFocus placeholder="Sai ở đâu, mong đợi thấy gì…"
              value={nhap.noiDung} onChange={(e) => ghi({ ...nhap, noiDung: e.target.value })}
              style={{ width: '100%', resize: 'vertical', background: 'var(--bg-2)', border: '1px solid var(--line)',
                borderRadius: 6, padding: '6px 8px', fontSize: 12.5, color: 'var(--fg-1)', fontFamily: 'inherit' }} />
            <div style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>Nháp và ảnh tự giữ — F5 không mất.</div>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={trang}>🔗 {trang}</div>
          <ImageAttach value={nhap.anh} onChange={(urls) => ghi({ ...nhap, anh: urls })} folder="gop-y" max={6} />
          {ket && <div style={{ fontSize: 11.5, color: ket.startsWith('✓') ? 'var(--ok,#22c55e)' : 'var(--bad,#ef4444)' }}>{ket}</div>}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { discardAttachments(nhap.anh); ghi({ loai: 'loi', noiDung: '', anh: [] }); try { localStorage.removeItem(KHOA); } catch { /* thôi */ } }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'none', color: 'var(--fg-3)', cursor: 'pointer' }}>Xoá nháp</button>
            <button type="button" disabled={busy || !nhap.noiDung.trim()} onClick={() => void gui()}
              style={{ fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 6, border: '1px solid var(--accent)',
                background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--fg-1)',
                cursor: busy ? 'default' : 'pointer', opacity: busy || !nhap.noiDung.trim() ? .5 : 1 }}>
              {busy ? '…' : '📨 Gửi lên plays'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
