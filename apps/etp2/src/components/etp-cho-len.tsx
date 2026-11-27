'use client';
// Ô "CHỜ LÊN ETHOPEX" ở etp2 › Camp (anh 27/11/2026: "sau này creative khi duyệt thì ko gửi lên etho. Phải show ra tao duyệt xong mởi bắt đầu gửi lên đó !").
// Bản dựng mới máy giữ ở etp.cho_len (0485) — CHƯA có trên Ethopex. ✓ Duyệt = máy iMac tải lên (~1–2 phút) → thành creative, rồi đi tiếp đường thường.
// ✕ Bỏ = không bao giờ lên. Lỗi hiện thành ô đỏ ngay dưới nút. Không có gì chờ → không vẽ gì. Cùng khuôn thẻ với ô Chờ anh duyệt (etp-cho-duyet.tsx).
import { useCallback, useEffect, useState } from 'react';
import { VideoXem } from '@/components/ui/video-xem';
import { BadgeDangNgan } from '@/components/etp-so';
import { boChoLen, doiKieuChoLen, dsChoLen, duyetChoLen, sinhChuKien, type ChoLen, type ChuQc } from '@/lib/actions/etp-cho-len';

const nut: React.CSSProperties = { fontSize: 12, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: 'inherit' };
const GIAI = 'bản dựng mới CHƯA gửi Ethopex. ✓ Duyệt = máy trên iMac tải lên Ethopex trong ~1–2 phút, thành creative rồi đi tiếp đường thường (ô Chờ anh duyệt / bảng camp). ✕ Bỏ = không bao giờ lên.';
const ANH_W = 'clamp(104px, 30vw, 162px)';
const TT: Record<ChoLen['trang_thai'], [string, string]> = {
  cho: ['⏸ chờ anh duyệt', '#f59e0b'], duyet: ['✓ đã duyệt · máy sắp tải lên', '#60a5fa'], dang_len: ['⏫ đang tải lên Ethopex', '#60a5fa'],
  da_len: ['✓ đã lên Ethopex', '#4ade80'], bo: ['✕ đã bỏ', '#f87171'],
};
const gioVn = (t: string) => new Date(t).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
type Kq = { ok: true; chu: string } | { loi: string };
// Chữ QC sẽ lên (anh 27/11/2026 "Khi duyệt creative thì cũng duyệt cả nội dung text luôn") — đúng sổ máy tạo creative đọc, không sửa ở đây
function ChuXem({ c }: { c: ChuQc }) {
  const dong = (nhan: string, ds: string[]) => ds.map((t, i) => <div key={nhan + i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><span style={{ color: 'var(--fg-3, #888)' }}>{nhan}: </span>{t}</div>);
  return (
    <div style={{ padding: '4px 6px', border: '1px dashed var(--line)', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {dong('Chữ chính', c.pt)}{dong('Tiêu đề', c.hl)}{dong('Mô tả', c.de)}
      <div><span style={{ color: 'var(--fg-3, #888)' }}>Link: </span>{c.link}</div>
    </div>);
}

export function ChoLenEtho() {
  const [ds, setDs] = useState<ChoLen[] | null>(null);
  const [loiDs, setLoiDs] = useState<string | null>(null);
  const [bao, setBao] = useState<Record<number, { loi?: string; chu?: string }>>({});
  const [dang, setDang] = useState<ReadonlySet<number>>(() => new Set());
  const [xem, setXem] = useState<number | null>(null);
  const tai = useCallback(async () => { const r = await dsChoLen(); if ('loi' in r) setLoiDs(r.loi); else { setLoiDs(null); setDs(r.ds); } }, []);
  useEffect(() => { void tai(); const t = setInterval(() => { void tai(); }, 15_000); return () => clearInterval(t); }, [tai]);
  if (loiDs === 'chỉ admin') return null;
  if (loiDs) return <div role="alert" style={{ margin: '6px 0', padding: 8, border: '1px solid #ef4444', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>Lỗi đọc Chờ lên Ethopex: {loiDs}</div>;
  if (!ds || !ds.length) return null;
  const bam = async (id: number, f: () => Promise<Kq>) => {
    setDang((s) => new Set(s).add(id)); setBao((b) => ({ ...b, [id]: {} }));
    try { const r = await f(); setBao((b) => ({ ...b, [id]: 'loi' in r ? { loi: r.loi } : { chu: r.chu } })); }
    catch (e) { setBao((b) => ({ ...b, [id]: { loi: `máy chủ lỗi: ${String((e as Error)?.message ?? e).slice(0, 200)}` } })); }
    setDang((s) => { const n = new Set(s); n.delete(id); return n; }); void tai();
  };
  const choDs = ds.filter((x) => x.trang_thai === 'cho');
  const duyetHet = async () => { for (const x of choDs) await bam(x.id, () => duyetChoLen(x.id)); };
  return (
    <div data-cho-len="" style={{ margin: '6px 0 10px', border: '1px solid #a78bfa', borderRadius: 8, padding: '8px 10px', background: 'rgba(167,139,250,.06)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <b style={{ color: '#a78bfa' }} title={GIAI}>⏸ Chờ lên Ethopex ({choDs.length})</b>
        <span style={{ fontSize: 12, color: 'var(--fg-2)', cursor: 'help' }} title={GIAI}>chưa gửi Ethopex — anh xem rồi Duyệt mới tải lên</span>
        {choDs.length > 1 ? <button type="button" style={{ ...nut, marginLeft: 'auto', borderColor: '#4ade80', color: '#4ade80' }} disabled={dang.size > 0} onClick={() => void duyetHet()}>✓ Duyệt cả {choDs.length}</button> : null}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {ds.map((x) => { const b = bao[x.id] ?? {}, [tt, mau] = TT[x.trang_thai], dg = dang.has(x.id);
          return (
            <div key={x.id} data-cho-len-id={x.id} style={{ display: 'flex', gap: 8, width: 'min(460px, 100%)', boxSizing: 'border-box', minWidth: 0, border: '1px solid var(--line)', borderRadius: 6, padding: 6 }}>
              <div style={{ flex: 'none', width: ANH_W }}>
                {xem === x.id && x.video ? <VideoXem src={x.video} controls style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 4, display: 'block' }} onEnded={() => setXem(null)} />
                  : <button type="button" title={x.video ? 'bấm để xem video' : 'chưa có video'} onClick={() => x.video && setXem(x.id)} style={{ padding: 0, border: 'none', background: 'none', cursor: x.video ? 'pointer' : 'default', position: 'relative', width: '100%', display: 'block' }}>
                      {x.anh ? <img src={x.anh} alt="" style={{ width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 4, display: 'block' }} /> : <span style={{ display: 'block', width: '100%', aspectRatio: '9 / 16', background: 'var(--line)', borderRadius: 4 }} />}
                      {x.video ? <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, color: '#fff', textShadow: '0 0 6px #000' }}>▶</span> : null}
                    </button>}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.phim ?? ''}>{x.phim ?? `phim #${x.content_id}`}</div>
                <div style={{ color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>{(x.lang ?? '?').toUpperCase()} · #{x.id} <BadgeDangNgan d={x.dang} />{x.giay ? ` · ${Math.round(x.giay)}s` : ''}</div>
                {x.mau || x.ma ? <div style={{ color: 'var(--fg-3, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={[x.ma, x.mau].filter(Boolean).join(' · ')}>{[x.ma, x.mau].filter(Boolean).join(' · ')}</div> : null}
                {x.ghi ? <div style={{ color: 'var(--fg-3, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.ghi}>{x.ghi}</div> : null}
                <div style={{ color: 'var(--fg-3, #888)' }}>dựng {gioVn(x.tao)}</div>
                <div style={{ color: mau, fontWeight: 600 }}>{tt}{x.creative_id ? ` → creative #${x.creative_id}` : ''}{x.trang_thai !== 'cho' ? <span style={{ fontWeight: 400, color: 'var(--fg-3, #888)' }}> · {gioVn(x.cap_nhat)}</span> : null}</div>
                {(() => { const coK = !!x.chu.kien, sua = x.trang_thai === 'cho' || x.trang_thai === 'duyet', kieu = coK ? x.kieu : 'dol', c = kieu === 'kien' ? x.chu.kien : x.chu.dol;
                  const chip = (k: 'kien' | 'dol', nhan: string, goi: string) => { const on = kieu === k, tat = !sua || dg || (k === 'kien' && !coK);
                    return <button type="button" title={goi} disabled={tat || on} onClick={() => void bam(x.id, () => doiKieuChoLen(x.id, k))}
                      style={{ ...nut, padding: '1px 8px', borderColor: on ? '#a78bfa' : 'var(--line)', background: on ? 'rgba(167,139,250,.25)' : 'transparent', fontWeight: on ? 700 : 400, opacity: tat && !on ? 0.45 : 1, cursor: tat || on ? 'default' : 'pointer' }}>{nhan}</button>; };
                  return (
                    <div data-cho-len-kieu={kieu} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--fg-2)' }}>Chữ QC:</span>
                        {chip('kien', 'K · Kiên', 'chữ Kiên của phim (sổ tay apps/etp/chu-kieu.json hoặc máy sinh etp.chu_kieu), link search.com — mặc định')}
                        {chip('dol', 'D · Dol', 'form Dol cố định (apps/etp/form-chu.json), link info.com')}
                      </div>
                      {!coK ? <div data-sinh-chu-kien style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', color: '#fbbf24' }}>
                        <span>máy chưa sinh được chữ Kiên cho phim này{sua ? '' : ' — đã lên với D · Dol'}</span>
                        {sua ? <button type="button" disabled={dg} title="sinh chữ Kiên từ cốt truyện phim (~2₫, apps/etp/sinh-chu-kien.py)" onClick={() => void bam(x.id, () => sinhChuKien(x.id))}
                          style={{ ...nut, padding: '1px 8px', borderColor: '#a78bfa', color: '#c4b5fd' }}>{dg ? '…' : '✦ Sinh chữ Kiên'}</button> : null}
                      </div> : null}
                      {c ? <ChuXem c={c} /> : null}
                    </div>); })()}
                {x.loi && x.trang_thai !== 'da_len' ? <div role="alert" style={{ padding: 6, border: '1px solid #ef4444', borderRadius: 4, background: 'rgba(239,68,68,.12)', color: '#fca5a5' }}>Lần tải lên trước lỗi: {x.loi} — máy tự thử lại</div> : null}
                {x.trang_thai === 'cho' || x.trang_thai === 'duyet' ? (
                  <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}>
                    {x.trang_thai === 'cho' ? <button type="button" disabled={dg} onClick={() => void bam(x.id, () => duyetChoLen(x.id))} style={{ ...nut, borderColor: '#4ade80', color: '#4ade80' }}>{dg ? '…' : '✓ Duyệt · lên Ethopex'}</button> : null}
                    <button type="button" disabled={dg} onClick={() => void bam(x.id, () => boChoLen(x.id))} style={{ ...nut, borderColor: '#f87171', color: '#f87171' }}>{dg ? '…' : '✕ Bỏ'}</button>
                  </div>) : null}
                {b.loi ? <div role="alert" style={{ padding: 6, border: '1px solid #ef4444', borderRadius: 4, background: 'rgba(239,68,68,.12)', color: '#fca5a5' }}>{b.loi}</div> : null}
                {b.chu ? <div style={{ color: '#86efac' }}>✓ {b.chu}</div> : null}
              </div>
            </div>); })}
      </div>
    </div>
  );
}
