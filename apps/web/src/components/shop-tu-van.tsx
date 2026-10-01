'use client';
// /shop › Tư vấn — duyệt tin chat của khách trên mặt tiền (khuôn "Duyệt tin" anh gửi 01/10/2026). Hàng số trên cùng → 4 cột theo giai
// đoạn khách (Chờ anh duyệt · Trước khi mua · Đang có đơn · Sau khi giao), mỗi cột có các bước + số đếm, thẻ khách có nháp máy soạn và nút
// Duyệt. Máy soạn → Kiểm (@mos2/shop/tu-van-kiem) → loại an toàn tự gửi; nhạy cảm/bị chặn/lỗi nằm ở cột 1. Tự tải lại 5 giây.
// URL: ?m=chat&mId= drawer.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Drawer, LinkChip, Pill, TextAreaField, ThanhChang } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { fmtAgoVi } from '@/lib/time-format';
import { CHANG_PHIEN } from '@mos2/shop/phien';
import { gio, isoCua } from '@/lib/shop/buoc';
import type { ChatDong, TinHoSo } from '@/lib/shop/ho-so-doc';
import { shopBoNhap, shopGuiChat, shopSoanLai, shopSuaHoSo, shopTinHoSo, shopTuVan } from '@/lib/actions/shop';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const truoc = (s: string | null) => (s ? fmtAgoVi(new Date(isoCua(s)).toISOString()) : '');
const ms = (s: string | null) => (s ? new Date(isoCua(s)).getTime() : 0);
const choDuyet = (c: ChatDong) => !!c.nhap && !c.nhap.dang_soan && (!!c.nhap.noi_dung || !!c.nhap.loi);
const NHAN_CHU_DE: Record<string, string> = { sizing: 'size', product: 'sản phẩm', shipping: 'ship', order_status: 'đơn đâu', returns: 'đổi trả', discount: 'giảm giá', complaint: 'khiếu nại', other: 'khác' };

/** Trạng thái một dòng của thẻ: chấm màu + chữ. */
function trangThai(c: ChatDong): { mau: string; chu: string } {
  if (c.nhap?.dang_soan) return { mau: 'var(--accent)', chu: 'máy đang soạn…' };
  if (c.nhap?.loi) return { mau: 'var(--bad)', chu: `máy soạn lỗi — trả lời tay` };
  if (choDuyet(c)) return c.nhap!.kiem?.ok === false && c.nhap!.nhom === 'an_toan'
    ? { mau: 'var(--bad)', chu: `bị chặn · ${c.nhap!.kiem!.ly_do[0] ?? ''}` }
    : { mau: 'var(--warn)', chu: `chờ anh duyệt · ${NHAN_CHU_DE[c.nhap!.chu_de ?? ''] ?? 'nhạy cảm'}` };
  if (c.tinCuoi?.nguoi === 'may') return { mau: 'var(--ok)', chu: 'máy đã tự gửi' };
  if (c.tinCuoi?.nguoi === 'minh') return { mau: 'var(--ok)', chu: 'anh đã gửi' };
  if (c.tinCuoi?.nguoi === 'khach') return { mau: 'var(--warn)', chu: 'khách đang chờ' };
  return { mau: 'var(--fg-3)', chu: '' };
}

export function BangTuVan({ ch }: { ch: string }) {
  const [ds, setDs] = useState<ChatDong[] | null>(null);
  const modal = useModalParam();
  const nap = () => shopTuVan().then(setDs).catch(() => null);
  useEffect(() => {
    nap();
    const t = setInterval(() => document.visibilityState === 'visible' && nap(), 5000);
    return () => clearInterval(t);
  }, []);
  const tat = useMemo(() => (ds ?? []).filter((c) => ch === 'all' || c.cuaHang === ch), [ds, ch]);
  const duyet = tat.filter(choDuyet).sort((a, b) => ms(a.khachCuoi) - ms(b.khachCuoi));
  // Tập trung (anh chốt 01/10/2026): khách đã rời site mà không còn chờ mình thì ẩn khỏi các cột — còn chờ (tin cuối là của khách) vẫn hiện
  const [hienRoi, setHienRoi] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tvr') === '1');
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (hienRoi) u.set('tvr', '1'); else u.delete('tvr');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${u.toString()}`);
  }, [hienRoi]);
  const canNhin = (c: ChatDong) => !!c.phien?.online || c.tinCuoi?.nguoi === 'khach' || !!c.nhap?.dang_soan;
  const conLaiHet = tat.filter((c) => !choDuyet(c));
  const conLai = conLaiHet.filter((c) => hienRoi || canNhin(c));
  const soRoi = conLaiHet.length - conLaiHet.filter(canNhin).length;
  const theoCot = (k: string) => conLai.filter((c) => c.cot === k);
  const nayKhach = tat.filter((c) => c.nayKhach > 0).length;
  const guiNay = tat.reduce((t, c) => t + c.nayMay + c.nayMinh, 0), mayNay = tat.reduce((t, c) => t + c.nayMay, 0);
  const iGio = CHANG_PHIEN.findIndex((x) => x.key === 'them_gio');
  const coPhien = tat.filter((c) => c.phien);
  const so = (nhan: string, v: React.ReactNode, mau?: string, title?: string) => (
    <div title={title} style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', ...phu, fontFamily: 'var(--font-mono)' }}>{nhan}</span>
      <b style={{ fontSize: 22, color: mau, fontVariantNumeric: 'tabular-nums' }}>{v}</b>
    </div>
  );
  const mo = tat.find((c) => String(c.id) === modal.id) ?? null;

  return (<>
    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end', padding: '4px 2px 12px' }}>
      {so('Khách nhắn hôm nay', nayKhach)}
      {so('Chờ anh duyệt', duyet.length, duyet.length ? 'var(--warn)' : undefined)}
      {so('Đã gửi hôm nay', guiNay, 'var(--ok)')}
      {so('Máy tự gửi', guiNay ? `${Math.round((mayNay / guiNay) * 100)}%` : '—', undefined, 'Phần trả lời hôm nay máy tự gửi (qua bước Kiểm), không phải chờ anh')}
      {so('Thêm giỏ sau chat', coPhien.filter((c) => c.phien!.chang >= iGio).length, undefined, 'Cuộc chat có phiên khách đã thêm giỏ (sổ phiên)')}
      {so('Đặt hàng sau chat', coPhien.filter((c) => c.phien!.soDon).length, 'var(--ok)')}
      <span style={{ flex: 1 }} />
      {soRoi > 0 && <label style={{ fontSize: 12.5, display: 'inline-flex', gap: 6, alignItems: 'center' }} title="Khách đã rời site và không còn chờ mình trả lời — ẩn để tập trung">
        <input type="checkbox" checked={hienRoi} onChange={(e) => setHienRoi(e.target.checked)} /> Hiện cả khách đã rời ({soRoi})</label>}
      <span style={{ fontSize: 12, ...phu }}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: 'var(--ok)', marginRight: 6 }} />đang chạy · tự tải lại 5s</span>
    </div>
    {ds === null ? <div style={phu}>Đang tải…</div> : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, alignItems: 'start' }}>
        <Cot mau="var(--warn)" ten="Chờ anh duyệt" phuDe="máy soạn xong, anh quyết" buoc={['Khách nhắn', 'Soạn', 'Kiểm', 'Anh duyệt', 'Gửi']} buocNay={3}
          so={[{ n: 'chờ duyệt', v: duyet.filter((c) => c.nhap?.nhom !== 'an_toan' && !c.nhap?.loi).length, mau: 'var(--warn)' },
            { n: 'bị chặn', v: duyet.filter((c) => c.nhap?.nhom === 'an_toan' && c.nhap?.kiem?.ok === false).length, mau: 'var(--bad)' },
            { n: 'máy lỗi', v: duyet.filter((c) => c.nhap?.loi).length, mau: 'var(--bad)' },
            { n: 'chờ > 1 giờ', v: duyet.filter((c) => Date.now() - ms(c.khachCuoi) > 3_600_000).length, mau: 'var(--bad)' }]}
          the={duyet} mo={(c) => modal.open('chat', c.id)} trong="Không có tin nào chờ anh." />
        <Cot mau="var(--accent)" ten="Trước khi mua" phuDe="size · ship · sản phẩm" buoc={['Khách nhắn', 'Tra', 'Soạn', 'Kiểm', 'Gửi']} buocNay={4}
          so={[{ n: 'khách', v: theoCot('truoc_mua').length }, { n: 'đang online', v: theoCot('truoc_mua').filter((c) => c.phien?.online).length, mau: 'var(--ok)' },
            { n: 'thêm giỏ', v: theoCot('truoc_mua').filter((c) => (c.phien?.chang ?? 0) >= iGio).length }, { n: 'máy tự gửi', v: theoCot('truoc_mua').filter((c) => c.tinCuoi?.nguoi === 'may').length, mau: 'var(--ok)' }]}
          the={theoCot('truoc_mua')} mo={(c) => modal.open('chat', c.id)} trong="Chưa có khách hỏi trước khi mua." />
        <Cot mau="var(--neon-cyan, var(--accent))" ten="Đang có đơn" phuDe="đơn đâu · đổi địa chỉ" buoc={['Khách nhắn', 'Tra đơn', 'Soạn', 'Kiểm', 'Gửi']} buocNay={4}
          so={[{ n: 'khách', v: theoCot('co_don').length }, { n: 'khách đang chờ', v: theoCot('co_don').filter((c) => c.tinCuoi?.nguoi === 'khach').length, mau: 'var(--warn)' }]}
          the={theoCot('co_don')} mo={(c) => modal.open('chat', c.id)} trong="Chưa có khách hỏi về đơn." />
        <Cot mau="var(--neon-pink, var(--ok))" ten="Sau khi giao" phuDe="cảm nhận · đổi size · review" buoc={['Đã giao', 'Hỏi thăm', 'Ghi nhận', 'Chốt']} buocNay={1}
          so={[{ n: 'khách', v: theoCot('sau_giao').length }, { n: 'khách đang chờ', v: theoCot('sau_giao').filter((c) => c.tinCuoi?.nguoi === 'khach').length, mau: 'var(--warn)' }]}
          the={theoCot('sau_giao')} mo={(c) => modal.open('chat', c.id)} trong="Chưa có khách sau giao nhắn." />
      </div>
    )}
    {modal.is('chat') && modal.numId != null && <DrawerChat id={modal.numId} c={mo} onClose={() => modal.close()} onDoi={nap} />}
  </>);
}

function Cot({ mau, ten, phuDe, buoc, buocNay, so, the, mo, trong }: { mau: string; ten: string; phuDe: string; buoc: string[]; buocNay: number;
  so: { n: string; v: number; mau?: string }[]; the: ChatDong[]; mo: (c: ChatDong) => void; trong: string }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-1)', padding: 12, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'grid', gap: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: mau, flex: 'none' }} /><b style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{ten}</b></span>
        <span style={{ fontSize: 11.5, ...phu, paddingLeft: 16 }}>{phuDe}</span>
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {buoc.map((b, i) => <span key={b} style={{ display: 'contents' }}>
          {i > 0 && <span aria-hidden style={{ flex: '1 1 4px', minWidth: 3, height: 1, background: 'var(--line)' }} />}
          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, border: `1px solid ${i === buocNay ? 'var(--accent)' : 'var(--line)'}`,
            color: i === buocNay ? 'var(--fg-0)' : 'var(--fg-2)', background: i === buocNay ? 'var(--accent-soft)' : 'transparent', whiteSpace: 'nowrap' }}>{b}</span>
        </span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${so.length}, 1fr)`, border: '1px solid var(--line)', borderRadius: 8 }}>
        {so.map((x, i) => <div key={x.n} style={{ padding: '6px 8px', borderLeft: i ? '1px solid var(--line)' : undefined, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, ...phu, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: 'var(--font-mono)', lineHeight: 1.25, minHeight: 24 }}>{x.n}</div>
          <b style={{ fontSize: 17, color: x.v ? x.mau : undefined, fontVariantNumeric: 'tabular-nums' }}>{x.v}</b>
        </div>)}
      </div>
      {the.length ? the.map((c) => <TheChat key={c.id} c={c} mo={() => mo(c)} />) : <div style={{ fontSize: 12.5, ...phu, padding: '6px 2px' }}>{trong}</div>}
    </div>
  );
}

function TheChat({ c, mo }: { c: ChatDong; mo: () => void }) {
  const tt = trangThai(c);
  const [dang, batDau] = useTransition();
  const [daGui, setDaGui] = useState(false);
  const vien = choDuyet(c) ? (tt.mau === 'var(--bad)' ? 'var(--bad)' : 'var(--warn)') : 'var(--line)';
  const ten = c.ten || c.email?.split('@')[0] || `Khách #${c.id}`;
  return (
    <div onClick={mo} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') mo(); }}
      style={{ border: `1px solid ${vien}`, borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5, cursor: 'pointer', background: 'var(--bg-2)', opacity: daGui ? 0.5 : 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
        {c.phien?.online && <span title="Đang trên site" style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--ok)', flex: 'none' }} />}
        <b style={{ fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ten}</b>
        <span style={{ fontSize: 11, ...phu, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {[c.phien?.thietBi, c.phien?.nuoc, c.soDon ? `đơn #${c.soDon}` : null].filter(Boolean).join(' · ')}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, ...phu, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{truoc(c.khachCuoi ?? c.capNhat)}</span>
      </div>
      {c.tinKhach && <div style={{ fontSize: 13.5, overflowWrap: 'anywhere' }}>“{c.tinKhach.slice(0, 140)}{c.tinKhach.length > 140 ? '…' : ''}”</div>}
      {c.nhap?.noi_dung && <div style={{ fontSize: 12.5, ...phu }}><span style={{ color: 'var(--fg-2)' }}>Nháp:</span> {c.nhap.noi_dung.slice(0, 160)}{c.nhap.noi_dung.length > 160 ? '…' : ''}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: tt.mau, display: 'inline-flex', gap: 5, alignItems: 'center', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: tt.mau, flex: 'none' }} />{tt.chu}</span>
        <span style={{ flex: 1 }} />
        <button className="btn ghost" onClick={(e) => { e.stopPropagation(); mo(); }}>Mở</button>
        {choDuyet(c) && c.nhap?.noi_dung && <button className="btn primary" disabled={dang} title="Gửi nguyên nháp này cho khách"
          onClick={(e) => { e.stopPropagation(); batDau(async () => { await shopGuiChat(c.id, c.nhap!.noi_dung!); setDaGui(true); }); }}>Duyệt</button>}
      </div>
    </div>
  );
}

function DrawerChat({ id, c, onClose, onDoi }: { id: number; c: ChatDong | null; onClose: () => void; onDoi: () => void }) {
  const [tin, setTin] = useState<TinHoSo[] | null>(null);
  const [nd, setNd] = useState(c?.nhap?.noi_dung ?? '');
  // nháp đang nạp vào ô sửa — nháp mới về (Soạn lại / khách nhắn tiếp) thì thay vào nếu anh chưa sửa; đã sửa thì hỏi trước khi đè
  const [nhapGoc, setNhapGoc] = useState(c?.nhap?.noi_dung ?? '');
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const nap = () => shopTinHoSo(id).then(setTin).catch(() => null);
  useEffect(() => { nap(); const t = setInterval(() => document.visibilityState === 'visible' && nap(), 5000); return () => clearInterval(t); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const nhapMoi = c?.nhap?.noi_dung ?? '';
  const daSua = nd.trim() !== '' && nd !== nhapGoc;
  useEffect(() => { if (nhapMoi && nhapMoi !== nhapGoc && !daSua) { setNd(nhapMoi); setNhapGoc(nhapMoi); } }, [nhapMoi]); // eslint-disable-line react-hooks/exhaustive-deps
  const lam = (f: () => Promise<{ ok: boolean; loi?: string }>, xoa = true) => batDau(async () => {
    setLoi(null);
    const r = await f().catch((e) => ({ ok: false, loi: (e as Error).message }));
    if (!r.ok) setLoi(r.loi ?? 'lỗi'); else if (xoa) setNd('');
    await nap(); onDoi();
  });
  if (!c) return <Drawer onClose={onClose} width={680}><div style={phu}>Không thấy cuộc chat #{id}.</div></Drawer>;
  const tt = trangThai(c);
  return (
    <Drawer onClose={onClose} width={680} dirty={!!nd.trim() && nd !== c.nhap?.noi_dung}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Chat #{c.id} · {c.ten || c.email || 'khách chưa để email'}</h2>
          <Pill color={tt.mau} label={tt.chu.split(' · ')[0]!} uppercase={false} mono={false} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '4px 10px', fontSize: 13 }}>
          <span style={phu}>Email</span><span>{c.email ?? <span style={phu}>chưa để — chỉ trả lời được trong ô chat khi khách còn trên site</span>}</span>
          {c.phien && <><span style={phu}>Đang xem</span><span>{c.phien.online ? '🟢 ' : ''}{c.phien.trang ?? '—'} <span style={phu}>· {c.phien.thietBi} {c.phien.nuoc}</span></span>
            <span style={phu}>Phễu</span><span><ThanhChang so={CHANG_PHIEN.length} i={c.phien.chang} nhan={CHANG_PHIEN[c.phien.chang]?.nhan} phuDe={c.phien.gio ? `giỏ $${c.phien.gio}` : undefined} /></span></>}
          {c.soDon && <><span style={phu}>Đơn</span><span><LinkChip href={`/shop?m=don&mId=${c.donId}`} tone="neutral" size="xs">#{c.soDon} ↗</LinkChip></span></>}
        </div>
        <div style={{ display: 'grid', gap: 8, padding: 10, border: '1px solid var(--line)', borderRadius: 8, maxHeight: 360, overflowY: 'auto' }}>
          {!tin ? <span style={phu}>Đang tải…</span> : tin.filter((t) => t.kenh === 'chat' || t.kenh === 'ghi_chu').map((t) => {
            const khach = t.nguoi === 'khach', note = t.kenh === 'ghi_chu';
            return <div key={t.id} style={{ justifySelf: note ? 'stretch' : khach ? 'start' : 'end', maxWidth: note ? '100%' : '85%', padding: '6px 10px', borderRadius: 8, fontSize: 13,
              background: note ? 'transparent' : khach ? 'var(--bg-2)' : 'var(--accent-soft)', border: note ? '1px dashed var(--line)' : '1px solid var(--line)', color: note ? 'var(--fg-3)' : undefined }}>
              <div style={{ fontSize: 11, ...phu, marginBottom: 2 }}>{khach ? 'Khách' : t.nguoi === 'may' ? 'Máy tự gửi' : t.nguoi === 'minh' ? 'Anh' : 'Máy'}{note ? ' · ghi chú' : ''} · {gio(t.ts)}</div>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{t.noiDung}</div>
            </div>;
          })}
        </div>
        {c.nhap?.kiem && !c.nhap.kiem.ok && <div style={{ fontSize: 12.5, color: 'var(--warn)' }}>Kiểm giữ lại vì: {c.nhap.kiem.ly_do.join(' · ')}</div>}
        {c.nhap?.dang_soan && <div style={{ fontSize: 12.5, color: 'var(--accent)' }}>Máy đang soạn trả lời…</div>}
        {nhapMoi && nhapMoi !== nhapGoc && daSua && <div style={{ fontSize: 12.5, color: 'var(--accent)', display: 'flex', gap: 8, alignItems: 'center' }}>
          Máy vừa soạn nháp mới (ô dưới đang giữ chữ anh sửa).
          <button className="btn ghost" onClick={() => { setNd(nhapMoi); setNhapGoc(nhapMoi); }}>Dùng nháp mới</button></div>}
        <TextAreaField id={`chat-nd-${id}`} label={c.nhap?.noi_dung ? 'Nháp máy soạn — sửa nếu cần rồi gửi' : 'Trả lời'} rows={5} value={nd} onChange={(e) => setNd(e.target.value)}
          hint={c.email ? `Gửi vào ô chat; khách đã rời trang thì gửi kèm thư tới ${c.email}.` : 'Gửi vào ô chat (khách chưa để email).'} />
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={dang || !nd.trim()} onClick={() => lam(() => shopGuiChat(id, nd))}>{dang ? 'Đang gửi…' : 'Duyệt & gửi'}</button>
          {c.tinCuoi?.nguoi === 'khach' && <button className="btn ghost" disabled={dang} title="Máy soạn lại trả lời cho tin khách mới nhất"
            onClick={() => { setNhapGoc(nd); lam(() => shopSoanLai(id), false); }}>{dang ? 'Đang soạn…' : 'Soạn lại'}</button>}
          {c.nhap && <button className="btn ghost" disabled={dang} onClick={() => lam(() => shopBoNhap(id))}>Bỏ nháp</button>}
          <span style={{ flex: 1 }} />
          {c.trangThai !== 'xong' && <button className="btn ghost" disabled={dang} onClick={() => lam(() => shopSuaHoSo(id, { trangThai: 'xong' }), false)}>Đóng chat</button>}
        </div>
      </div>
    </Drawer>
  );
}
