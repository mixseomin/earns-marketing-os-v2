'use client';

// HÒM GÓP Ý CỦA CHÍNH MOS2 — cùng hòm với be.adfond.com (anh chốt 19/09/2026): nút 💬 nổi mở một
// ngăn kéo hai tab. "Gửi góp ý": loại · mô tả · trang đang đứng · ảnh (Ctrl+V / kéo thả / Chọn file /
// URL) — nháp + ảnh sống qua F5 (localStorage giữ chữ + URL ảnh, KHÔNG giữ base64, ảnh đã lên R2 ngay
// khi thêm). "Của tôi": mọi góp ý mình đã gửi, trạng thái + tin mới nhất, bấm là mở đúng card trên
// plays (luồng trao đổi + duyệt/làm lại nằm ở đó). Gửi = một card pending trên plays `mos2`, follow
// hôm nay; Claude nhặt bằng /tasks-mos2, trả lời vào luồng rồi nộp Review. Layout chỉ dựng cho admin.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, Tabs, type TabItem } from '@/components/ui';
import { ImageAttach, discardAttachments } from '@/components/ui/image-attach';
import { dsGopYCuaToi, guiGopYMos2, type GopYCuaToi } from '@/lib/actions/gop-y-mos2';

const KHOA = 'mos2.gop-y.nhap';
const KHOA_TAB = 'mos2.gop-y.tab';
type TabKey = 'gui' | 'cua-toi';
const TABS_HOM: TabItem<TabKey>[] = [{ key: 'gui', label: 'Gửi góp ý' }, { key: 'cua-toi', label: 'Của tôi' }];
type Nhap = { loai: string; noiDung: string; anh: string[] };
const TRANG_MOI: Nhap = { loai: 'loi', noiDung: '', anh: [] };
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
  return TRANG_MOI;
};

// Trạng thái card → nhãn + màu. `review` đứng đầu bộ lọc: đó là lý do người ta mở tab này (ngồi duyệt).
const TT: Record<string, { nhan: string; mau: string }> = {
  review: { nhan: 'Chờ duyệt', mau: 'var(--warn, #f59e0b)' },
  pending: { nhan: 'Chờ xử', mau: 'var(--fg-3)' },
  claimed: { nhan: 'Đang làm', mau: 'var(--accent)' },
  submitted: { nhan: 'Đang làm', mau: 'var(--accent)' },
  broken: { nhan: 'Kẹt', mau: 'var(--bad, #ef4444)' },
  completed: { nhan: 'Xong', mau: 'var(--ok, #22c55e)' },
  verified: { nhan: 'Xong', mau: 'var(--ok, #22c55e)' },
  dropped: { nhan: 'Bỏ qua', mau: 'var(--fg-4)' },
};
const THU_TU = ['review', 'pending', 'claimed', 'broken', 'completed', 'dropped'];
const nhomTT = (t: string) => (t === 'submitted' ? 'claimed' : t === 'verified' ? 'completed' : t);
const DA_DONG = new Set(['completed', 'dropped']);
const cach = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} phút trước`;
  if (m < 60 * 48) return `${Math.round(m / 60)} giờ trước`;
  return `${Math.round(m / 1440)} ngày trước`;
};

const lbl = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 4 };
const nutPhu = { fontSize: 11.5, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'none', color: 'var(--fg-3)', cursor: 'pointer' } as const;
const oNhap = { width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '7px 9px', fontSize: 12.5, color: 'var(--fg-1)', fontFamily: 'inherit' } as const;

function FormGopY({ onGui }: { onGui: (id: number) => void }) {
  const [nhap, setNhap] = useState<Nhap>(TRANG_MOI);
  const [trang, setTrang] = useState('');
  const [busy, setBusy] = useState(false);
  const [ket, setKet] = useState('');
  // Đọc nháp trong effect chứ không trong useState(() => …): SSR không có localStorage, đọc lúc render
  // là server/client vẽ khác nhau.
  useEffect(() => { setNhap(docNhap()); setTrang(window.location.href); }, []);
  const ghi = (n: Nhap) => {
    setNhap(n);
    try { localStorage.setItem(KHOA, JSON.stringify(n)); } catch { /* đầy thì thôi */ }
  };
  const xoaNhap = () => {
    discardAttachments(nhap.anh); ghi(TRANG_MOI);
    try { localStorage.removeItem(KHOA); } catch { /* thôi */ }
  };
  const gui = async () => {
    setBusy(true); setKet('');
    const r = await guiGopYMos2({ loai: nhap.loai, noiDung: nhap.noiDung, trang, anhUrls: nhap.anh });
    setBusy(false);
    if (!r.ok || !r.id) { setKet(`⚠ ${r.error}`); return; }
    try { localStorage.removeItem(KHOA); } catch { /* thôi */ }
    setNhap(TRANG_MOI);
    setKet(`✓ Đã lên bảng plays mos2 — card #${r.id}`);
    onGui(r.id);
  };
  const trong = !nhap.noiDung.trim();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={lbl}>Loại</div>
        <select value={nhap.loai} onChange={(e) => ghi({ ...nhap, loai: e.target.value })} style={{ ...oNhap, cursor: 'pointer' }}>
          <option value="loi">Báo lỗi / góp ý</option>
          <option value="cau_hoi">Câu hỏi</option>
        </select>
      </div>
      <div>
        <div style={lbl}>Mô tả</div>
        <textarea rows={5} autoFocus placeholder="Sai ở đâu, mong đợi thấy gì…"
          value={nhap.noiDung} onChange={(e) => ghi({ ...nhap, noiDung: e.target.value })}
          style={{ ...oNhap, resize: 'vertical', outline: 'none' }} />
        <div style={{ fontSize: 10.5, color: 'var(--fg-4)', marginTop: 3 }}>Nháp và ảnh tự giữ — F5 không mất.</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={trang}>🔗 {trang}</div>
      <ImageAttach value={nhap.anh} onChange={(urls) => ghi({ ...nhap, anh: urls })} folder="gop-y" max={6} />
      {ket && <div style={{ fontSize: 11.5, color: ket.startsWith('✓') ? 'var(--ok,#22c55e)' : 'var(--bad,#ef4444)' }}>{ket}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={xoaNhap} disabled={trong && !nhap.anh.length} style={{ ...nutPhu, opacity: trong && !nhap.anh.length ? .5 : 1 }}>Huỷ</button>
        <button type="button" disabled={busy || trong} onClick={() => void gui()}
          style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 16px', borderRadius: 6, border: '1px solid var(--accent)',
            background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--fg-1)',
            cursor: busy ? 'default' : 'pointer', opacity: busy || trong ? .5 : 1 }}>
          {busy ? '…' : '📨 Gửi'}
        </button>
      </div>
    </div>
  );
}

function CuaToi({ ds, onSangTabGui, onMo }: { ds: GopYCuaToi[] | null; onSangTabGui: () => void; onMo: (id: number) => void }) {
  const [loc, setLoc] = useState<string>('');
  const [q, setQ] = useState('');
  if (ds === null) return <div style={{ fontSize: 12, color: 'var(--fg-3)', padding: 8 }}>đang đọc…</div>;
  if (!ds.length) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--fg-3)', padding: '18px 8px', textAlign: 'center' }}>
        Chưa có góp ý nào của anh.{' '}
        <button type="button" onClick={onSangTabGui} style={{ ...nutPhu, color: 'var(--accent)', borderColor: 'var(--accent)' }}>Gửi góp ý đầu tiên →</button>
      </div>
    );
  }
  const dem = new Map<string, number>();
  for (const b of ds) { const k = nhomTT(b.trangThai); dem.set(k, (dem.get(k) ?? 0) + 1); }
  const nd = q.trim().toLowerCase();
  const hien = ds.filter((b) => (!loc || nhomTT(b.trangThai) === loc)
    && (!nd || b.noiDung.toLowerCase().includes(nd) || String(b.id).includes(nd) || b.trang.toLowerCase().includes(nd)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        {THU_TU.filter((k) => dem.get(k)).map((k) => {
          const chon = loc === k;
          return (
            <button key={k} type="button" onClick={() => setLoc(chon ? '' : k)}
              style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${chon ? TT[k]!.mau : 'var(--line)'}`, color: chon ? 'var(--fg-1)' : 'var(--fg-3)',
                background: chon ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg-2)' }}>
              {TT[k]!.nhan} <b>{dem.get(k)}</b>
            </button>
          );
        })}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="tìm…" style={{ ...oNhap, width: 120, padding: '3px 8px', fontSize: 11.5, marginLeft: 'auto' }} />
      </div>
      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {hien.map((b) => {
          const tt = TT[nhomTT(b.trangThai)] ?? TT.pending!;
          const mo = DA_DONG.has(nhomTT(b.trangThai));
          return (
            <div key={b.id} onClick={() => onMo(b.id)} title="Mở card trên plays — luồng trao đổi + duyệt/làm lại ở đó"
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', background: 'var(--bg-2)', opacity: mo ? .7 : 1 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                <span style={{ border: `1px solid ${tt.mau}`, color: tt.mau, borderRadius: 4, padding: '0 5px' }}>{tt.nhan}</span>
                <b style={{ color: 'var(--fg-2)' }}>#{b.id}</b>
                <span>{b.loai === 'cau_hoi' ? 'hỏi' : 'lỗi'}</span>
                <span style={{ marginLeft: 'auto' }}>cập nhật {cach(b.capNhat)}{b.soTin ? ` · ${b.soTin} tin` : ''}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-1)', marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.noiDung}</div>
              {b.tinCuoi && (
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  <b style={{ color: b.tinCuoi.nguoi === 'ai' ? 'var(--accent)' : 'var(--fg-2)' }}>{b.tinCuoi.nguoi === 'ai' ? 'AI' : b.tinCuoi.nguoi}</b>
                  {b.tinCuoi.xuLy ? ` · ${b.tinCuoi.xuLy === 'duyet' ? 'đã duyệt' : 'làm lại'}` : ''}: {b.tinCuoi.noiDung}
                </div>
              )}
            </div>
          );
        })}
        {!hien.length && <div style={{ fontSize: 12, color: 'var(--fg-3)', padding: 8 }}>Không mục nào khớp.</div>}
      </div>
    </div>
  );
}

export function GopYMos2() {
  const router = useRouter();
  const [mo, setMo] = useState(false);
  const [tab, setTab] = useState<TabKey>('gui');
  const [ds, setDs] = useState<GopYCuaToi[] | null>(null);
  // Danh sách nạp Ở ĐÂY (không trong tab): con số trên nhãn "Của tôi" phải nói được "còn mấy việc"
  // ngay khi ngăn kéo mở ở tab Gửi.
  const nap = () => { void dsGopYCuaToi().then(setDs); };
  useEffect(() => {
    if (!mo) return;
    try { const t = localStorage.getItem(KHOA_TAB); if (t === 'cua-toi') setTab('cua-toi'); } catch { /* thôi */ }
    nap();
  }, [mo]);
  const doiTab = (t: TabKey) => { setTab(t); try { localStorage.setItem(KHOA_TAB, t); } catch { /* thôi */ } };
  const conMo = ds?.filter((b) => !DA_DONG.has(nhomTT(b.trangThai))).length ?? 0;
  const moCard = (id: number) => { setMo(false); router.push(`/plays?proj=mos2&task=${id}`); };
  return (
    <>
      <button type="button" aria-label="Góp ý / báo lỗi MOS2" title="Góp ý / báo lỗi về màn đang xem"
        onClick={() => setMo((v) => !v)}
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, width: 36, height: 36, borderRadius: 999,
          border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,.35)', fontSize: 15, lineHeight: '34px' }}>💬</button>
      {mo && (
        <Drawer onClose={() => setMo(false)} width={560} padding={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <b style={{ fontSize: 14 }}>Góp ý / báo lỗi</b>
            <span style={{ marginLeft: 'auto' }} />
            <button type="button" onClick={() => setMo(false)} aria-label="Đóng" style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 15 }}>✕</button>
          </div>
          <Tabs<TabKey> items={TABS_HOM.map((t) => (t.key === 'cua-toi' && ds ? { ...t, badge: conMo || undefined } : t))} value={tab} onChange={doiTab} />
          {tab === 'gui'
            ? <FormGopY onGui={() => nap()} />
            : <CuaToi ds={ds} onSangTabGui={() => doiTab('gui')} onMo={moCard} />}
        </Drawer>
      )}
    </>
  );
}
