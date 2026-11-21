'use client';
// Ô "CHỜ ANH DUYỆT" ở etp2 › Camp (anh 22/11/2026 "Tao cần duyệt trên page này cơ mà !"): creative máy giữ (etp.cho_anh_duyet, 0460) — chưa duyệt thì không đường nào lên camp.
// ✓ Duyệt = lên camp $1 (hẹn 07:00 nếu ngoài 07–12h VN) · ✕ Loại. Lỗi hiện thành ô đỏ ngay dưới nút. Không có gì chờ → không vẽ gì.
import { useCallback, useEffect, useState } from 'react';
import { VideoXem } from '@/components/ui/video-xem';
import { dsChoDuyet, duyetChoAnh, lenCamp, type ChoDuyet } from '@/lib/actions/etp-cho-duyet';

const nut: React.CSSProperties = { fontSize: 12, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: 'inherit' };
const GIAI = 'chưa duyệt thì máy không lên camp. ✓ Duyệt = lên camp $1, giờ chạy theo lịch: ngoài 07–12h VN thì hẹn 07:00. ✕ Loại = không bao giờ lên.';
const GIAI_DK = 'đang DỪNG KHẨN (etp.cau_hinh.dung_khan): bấm Duyệt vẫn ghi duyệt, nhưng máy chặn tạo camp tới khi tắt dừng khẩn — máy tự lên camp ở nhịp đầu nhả (apps/etp/lenh_cho.py), anh không phải bấm lại.';

export function ChoDuyetCr() {
  const [du, setDu] = useState<{ ds: ChoDuyet[]; dungKhan: boolean } | null>(null);
  const [loiDs, setLoiDs] = useState<string | null>(null);
  const [bao, setBao] = useState<Record<number, { loi?: string; chu?: string }>>({});
  const [dang, setDang] = useState<number | null>(null);
  const [xem, setXem] = useState<number | null>(null);
  const tai = useCallback(async () => { const r = await dsChoDuyet(); if ('loi' in r) setLoiDs(r.loi); else { setLoiDs(null); setDu(r); } }, []);
  useEffect(() => { void tai(); const t = setInterval(() => { void tai(); }, 20_000); return () => clearInterval(t); }, [tai]);
  if (loiDs === 'chỉ admin') return null;
  if (loiDs) return <div role="alert" style={{ margin: '6px 0', padding: 8, border: '1px solid #ef4444', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>Lỗi đọc chờ duyệt: {loiDs}</div>;
  if (!du || !du.ds.length) return null;
  const bam = async (cr: number, f: () => Promise<{ ok: true; chu: string } | { loi: string }>) => {
    setDang(cr); setBao((b) => ({ ...b, [cr]: {} }));
    try { const r = await f(); setBao((b) => ({ ...b, [cr]: 'loi' in r ? { loi: r.loi } : { chu: r.chu } })); }
    catch (e) { setBao((b) => ({ ...b, [cr]: { loi: `máy chủ lỗi: ${String((e as Error)?.message ?? e).slice(0, 200)}` } })); }
    setDang(null); void tai();
  };
  const cho = du.ds.filter((x) => x.duyet == null).length;
  return (
    <div data-cho-duyet="" style={{ margin: '6px 0 10px', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 10px', background: 'rgba(245,158,11,.06)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <b style={{ color: '#f59e0b' }} title={GIAI}>⏸ Chờ anh duyệt ({cho})</b>
        <span style={{ fontSize: 12, color: 'var(--fg-2)', cursor: 'help' }} title={GIAI}>Duyệt = camp $1 · hẹn theo lịch</span>
        {du.dungKhan ? <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600, cursor: 'help' }} title={GIAI_DK}>⏳ đang DỪNG KHẨN — đã duyệt thì máy tự lên khi nhả</span> : null}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {du.ds.map((x) => { const b = bao[x.creative_id] ?? {}, cho1 = x.duyet == null;
          return (
            <div key={x.creative_id} style={{ display: 'flex', gap: 8, width: 460, border: '1px solid var(--line)', borderRadius: 6, padding: 6 }}>
              <div style={{ flex: 'none', width: 162 }}>
                {xem === x.creative_id && x.video ? <VideoXem src={x.video} controls style={{ width: 162, height: 288, objectFit: 'cover', borderRadius: 4 }} onEnded={() => setXem(null)} />
                  : <button type="button" title={x.video ? 'bấm để xem video' : 'chưa có video'} onClick={() => x.video && setXem(x.creative_id)} style={{ padding: 0, border: 'none', background: 'none', cursor: x.video ? 'pointer' : 'default', position: 'relative' }}>
                      {x.anh ? <img src={x.anh} alt="" style={{ width: 162, height: 288, objectFit: 'cover', borderRadius: 4, display: 'block' }} /> : <span style={{ display: 'block', width: 162, height: 288, background: 'var(--line)', borderRadius: 4 }} />}
                      {x.video ? <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, color: '#fff', textShadow: '0 0 6px #000' }}>▶</span> : null}
                    </button>}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.phim ?? ''}>{x.phim ?? `phim #${x.content_id}`}</div>
                <div style={{ color: 'var(--fg-2)' }}>{(x.lang ?? '?').toUpperCase()} · cr #{x.creative_id} · {x.dang ?? ''}</div>
                <div style={{ color: 'var(--fg-3, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.ghi}>{x.ghi}</div>
                {x.diem_thap ? <div style={{ color: '#fbbf24' }} title={`tiêu chí chấm ≤ 4: ${x.diem_thap} — duyệt thì người duyệt thắng điểm (0443)`}>⚠ điểm thấp: {x.diem_thap.slice(0, 40)}</div> : null}
                {cho1 ? (
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    <button type="button" disabled={dang != null} onClick={() => bam(x.creative_id, () => duyetChoAnh(x.creative_id, true))} style={{ ...nut, borderColor: '#22c55e', color: '#4ade80', fontWeight: 600 }}>{dang === x.creative_id ? '…' : '✓ Duyệt'}</button>
                    <button type="button" disabled={dang != null} onClick={() => bam(x.creative_id, () => duyetChoAnh(x.creative_id, false))} style={{ ...nut, borderColor: '#ef4444', color: '#f87171' }}>✕ Loại</button>
                  </div>
                ) : x.camp_id ? <div style={{ color: '#4ade80', marginTop: 'auto' }}>✓ đã duyệt → camp #{x.camp_id} ({x.trang_thai})</div> : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 'auto' }}>
                    <span style={{ color: '#60a5fa' }} title={du.dungKhan ? GIAI_DK : 'máy đang lên camp / thử lại theo nhịp'}>{du.dungKhan ? '⏳ đã duyệt · xếp hàng lên camp' : '✓ đã duyệt · đang lên camp'}</span>
                    {du.dungKhan ? null : <button type="button" disabled={dang != null} onClick={() => bam(x.creative_id, () => lenCamp(x.creative_id))} style={nut}>{dang === x.creative_id ? '…' : 'Lên lại'}</button>}
                  </div>)}
                {b.loi ? <div role="alert" style={{ padding: 6, border: '1px solid #ef4444', borderRadius: 4, background: 'rgba(239,68,68,.12)', color: '#fca5a5' }}>{b.loi}</div> : null}
                {b.chu ? <div style={{ color: '#86efac' }} title={b.chu}>✓ {b.chu.startsWith('đã duyệt') ? 'đã xếp hàng' : 'đã gửi lệnh'}</div> : null}
                {x.nhat_ky && !b.loi ? <pre title="nhật ký lên camp (box3 /tmp/etp-len-cr-…)" style={{ margin: 0, fontSize: 10.5, whiteSpace: 'pre-wrap', color: 'var(--fg-2)', maxHeight: 60, overflow: 'auto' }}>{x.nhat_ky}</pre> : null}
              </div>
            </div>); })}
      </div>
    </div>
  );
}
