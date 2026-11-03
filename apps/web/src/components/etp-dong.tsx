'use client';
// DÒNG PHIM TỰ ĐỘNG (anh 03/11/2026, etp.on.tc): FormChayDong = form hỏi loại nội dung QC (KT / CC / CT…, mô tả + cách làm + giá + ví dụ thật) + thể loại;
// TabDong = mỗi phim một dòng, 8 bước có giờ bắt đầu / kết thúc, nút FIX từng bước, Dừng dòng. Máy: apps/etp/dong_phim.py (iMac) · canh: apps/etp/manh.py (box3).
import { useCallback, useEffect, useState } from 'react';
import { EmptyState, FormModal, FormModalFooter, FormModalSection, SelectField } from '@/components/ui';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { chayDong, docDong, dungDong, fixBuoc, formDong, type DongPhim, type BuocDong, type LoaiNoiDung } from '@/lib/actions/etp-dong';

const TEN_BUOC: Record<string, [string, string]> = {
  nhan: ['Nhận', 'Nhận phim: nhóm gốc Âu-Mỹ, không trong sổ cấm 18+, đội không giữ, phim chưa có camp → Nhà nhận'],
  ws: ['Trang phim', 'Thêm vào workspace Ethopex của Nhà + điền mô tả / cốt truyện, chờ đồng bộ tới khi đủ'],
  poster: ['Soát poster', 'AI soát poster 18+ (soat_18_ai) — cấm thì dòng dừng'],
  cat: ['Cắt', 'Tải tập + cắt 2 góc cuối tập, CTA kiểu Kiên (tho.py → cat-cuoi-lo)'],
  soat: ['Soát đoạn', 'Máy soát từng đoạn (Claude) — giữ đoạn sạch, không còn đoạn sạch thì dừng'],
  creative: ['Tải + chấm', 'Tải MỘT đoạn lên creative (KT: chờ máy sinh kể chuyện) → cổng chấm Meta / AFS'],
  camp: ['Lên camp', 'nhan-ban.py: $1, bộ 2, lịch hôm nay — mọi cổng luật ở đó, chặn thì dừng'],
  chay: ['Camp chạy', 'Chờ Ethopex đồng bộ xong + ACTIVE'],
};
const MAU: Record<string, [string, string]> = { cho: ['#6b7280', 'chờ'], dang: ['#60a5fa', 'đang chạy'], xong: ['#22c55e', 'xong'], dung: ['#f59e0b', 'dừng (policy / luật)'],
  loi: ['#ef4444', 'lỗi'], bo_qua: ['#374151', 'không thuộc loại nội dung này'], chay: ['#60a5fa', 'đang chạy'], huy: ['#6b7280', 'đã huỷ'] };
const gio = (iso: string | null) => { if (!iso) return '—'; const d = new Date(Date.parse(iso) + 7 * 3600_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const ngayGio = (iso: string | null) => { if (!iso) return '—'; const d = new Date(Date.parse(iso) + 7 * 3600_000); return `${gio(iso)} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const phut = (a: string | null, b: string | null) => { if (!a) return null; const s = ((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 1000; return s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}p` : `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, '0')}`; };
const ket = (b: BuocDong) => b.trang_thai === 'dang' && (Date.now() - Date.parse(b.bat_dau ?? '') > b.han_giay * 1000 || Date.now() - Date.parse(b.nhip ?? b.bat_dau ?? '') > 600_000);

// TÊN BƯỚC CHO NGƯỜI XEM (anh 03/11/2026 "tab đó trình bày toàn số, ko trực quan"): mỗi dòng một thẻ, 8 bước nối như thanh tiến độ, câu "đang làm gì" + thanh % từ 'N/M'
const DE: Record<string, string> = { nhan: 'Nhận phim', ws: 'Trang phim', poster: 'Kiểm ảnh bìa', cat: 'Cắt video', soat: 'Xem lại video', creative: 'Đưa lên + chấm', camp: 'Lên camp', chay: 'Camp chạy' };
const LOAI_DE: Record<string, string> = { CC: 'Cảnh cuối tập', KT: 'Kể chuyện', LT: 'Test rộng — mỗi tập một video' };
const soPhan = (t: string | null) => { const m = (t ?? '').match(/(\d+)\s*\/\s*(\d+)/); const a = Number(m?.[1]), b = Number(m?.[2]); return b > 0 ? Math.min(1, a / b) : null; };

function NutBuoc({ d, b, xong }: { d: DongPhim; b: BuocDong; xong: () => void }) {
  const [dang, setDang] = useState(false);
  const ke = ket(b); const tt = ke ? 'loi' : b.trang_thai;
  const [mau] = MAU[tt] ?? ['#6b7280'];
  const coFix = d.trang_thai !== 'huy' && (b.trang_thai === 'loi' || b.trang_thai === 'dung' || ke);
  const t = `${DE[b.buoc] ?? b.buoc} · ${MAU[b.trang_thai]?.[1] ?? b.trang_thai}${b.lan > 1 ? ` · lần ${b.lan}` : ''}\nbắt đầu ${ngayGio(b.bat_dau)} · xong ${ngayGio(b.ket_thuc)}`
    + `${ke ? '\n⚠ KẸT: quá hạn hoặc máy im > 10 phút' : ''}${b.ghi ? `\n\n${b.ghi}` : ''}\n\n${TEN_BUOC[b.buoc]?.[1] ?? ''}`;
  const ky = tt === 'xong' ? '✓' : tt === 'dang' || tt === 'chay' ? '▶' : tt === 'loi' ? '!' : tt === 'dung' ? '⏸' : tt === 'bo_qua' ? '–' : '';
  return <div title={t} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: tt === 'bo_qua' ? 0.4 : 1 }}>
    <span style={{ width: 26, height: 26, borderRadius: 13, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, zIndex: 1,
      background: tt === 'cho' ? 'var(--bg-1)' : mau, color: tt === 'cho' ? 'var(--fg-3)' : '#0b0b0f', border: `2px solid ${mau}`,
      boxShadow: tt === 'dang' ? `0 0 0 4px ${mau}33` : undefined, animation: tt === 'dang' ? 'pulse 1.6s ease-in-out infinite' : undefined }}>{ky}</span>
    <span style={{ fontSize: 12, fontWeight: tt === 'dang' ? 700 : 500, color: tt === 'cho' ? 'var(--fg-3)' : 'var(--fg-1)', textAlign: 'center', whiteSpace: 'nowrap' }}>{DE[b.buoc] ?? b.buoc}</span>
    <span style={{ fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{tt === 'bo_qua' ? 'bỏ qua' : b.bat_dau ? (b.ket_thuc ? phut(b.bat_dau, b.ket_thuc) : `${phut(b.bat_dau, null)}…`) : ''}</span>
    {coFix ? <button className="btn" disabled={dang} style={{ padding: '0 6px', fontSize: 11, lineHeight: '16px', color: '#fca5a5', borderColor: '#7f1d1d' }}
      onClick={async () => { setDang(true); const r = await fixBuoc(d.id, b.buoc); setDang(false); if ('loi' in r) window.alert(r.loi); xong(); }}>FIX</button> : null}
  </div>;
}

function TheDong({ d, xong }: { d: DongPhim; xong: () => void }) {
  const ds = Object.keys(TEN_BUOC).map((k) => d.buoc.find((b) => b.buoc === k)).filter((b): b is BuocDong => !!b);
  const hien = ds.find((b) => b.trang_thai === 'dang' || b.trang_thai === 'loi' || b.trang_thai === 'dung') ?? ds.find((b) => b.trang_thai === 'cho');
  const soXong = ds.filter((b) => b.trang_thai === 'xong' || b.trang_thai === 'bo_qua').length;
  const [m, c] = MAU[d.trang_thai] ?? ['#6b7280', d.trang_thai];
  const cau = d.trang_thai === 'xong' ? `Xong sau ${phut(d.tao_luc, d.xong_luc)}${d.camp_id ? ` — camp #${d.camp_id} đang chạy` : ''}`
    : d.trang_thai === 'huy' ? `Đã dừng${d.ly_do ? `: ${d.ly_do}` : ''}`
    : hien ? `${hien.trang_thai === 'dang' ? 'Đang' : hien.trang_thai === 'loi' ? 'Lỗi ở' : hien.trang_thai === 'dung' ? 'Dừng ở' : 'Chờ'} bước ${ds.indexOf(hien) + 1}/${ds.length} · ${DE[hien.buoc]}` : c;
  const ghi = d.trang_thai === 'dung' || d.trang_thai === 'loi' ? d.ly_do ?? hien?.ghi : hien?.ghi;
  const ph = soPhan(ghi ?? null);
  const pct = Math.round(((soXong + (hien?.trang_thai === 'dang' && ph != null ? ph : 0)) / Math.max(ds.length, 1)) * 100);
  const daLam = ds.length ? soXong / (ds.length - 1) : 0;
  return <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px', background: 'var(--bg-1)' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <a onClick={() => openEntityDrawer('etp-phim', d.content_id)} style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>{d.ten ?? `phim #${d.content_id}`}</a>
      <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{LOAI_DE[d.loai] ?? d.loai}</span>
      <span title={`dòng #${d.id} · ${d.ai ?? ''} · tạo ${ngayGio(d.tao_luc)}`} style={{ fontSize: 11, color: 'var(--fg-3)' }}>bắt đầu {ngayGio(d.tao_luc)}</span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: m }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: m }} />{cau}</span>
      {d.trang_thai === 'chay' || d.trang_thai === 'dung' || d.trang_thai === 'loi'
        ? <button className="btn" style={{ fontSize: 11 }} onClick={async () => { if (!window.confirm(`Dừng hẳn dòng ${d.ten ?? d.content_id}?`)) return; await dungDong(d.id); xong(); }}>Dừng</button> : null}
    </div>
    <div style={{ position: 'relative', display: 'flex', margin: '14px 0 8px' }}>
      <div style={{ position: 'absolute', top: 12, left: '6%', right: '6%', height: 2, background: 'var(--line)' }} />
      <div style={{ position: 'absolute', top: 12, left: '6%', width: `${Math.min(1, daLam) * 88}%`, height: 2, background: '#22c55e' }} />
      {ds.map((b) => <NutBuoc key={b.buoc} d={d} b={b} xong={xong} />)}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: d.trang_thai === 'loi' ? '#ef4444' : d.trang_thai === 'dung' ? '#f59e0b' : '#22c55e', transition: 'width .4s' }} /></div>
      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)', width: 38, textAlign: 'right' }}>{pct}%</span>
    </div>
    {ghi ? <div style={{ marginTop: 6, fontSize: 12, color: d.trang_thai === 'dung' ? '#fbbf24' : d.trang_thai === 'loi' ? '#f87171' : 'var(--fg-2)' }}>
      {d.camp_id ? <b style={{ color: '#4ade80' }}>camp #{d.camp_id} · </b> : null}{ghi}</div> : null}
  </div>;
}

export function TabDong() {
  const [du, setDu] = useState<Awaited<ReturnType<typeof docDong>> | null>(null);
  const tai = useCallback(async () => setDu(await docDong()), []);
  useEffect(() => { void tai(); const t = setInterval(() => void tai(), 10_000); return () => clearInterval(t); }, [tai]);
  if (!du) return <div style={{ padding: 16, color: 'var(--fg-2)' }}>Đang tải…</div>;
  if ('loi' in du) return <EmptyState icon="⚠" title={du.loi} />;
  const may = du.may[0]; const im = may ? (Date.now() - Date.parse(may.nhip)) / 1000 : null;
  const dangChay = du.dong.filter((d) => d.trang_thai === 'chay' || d.trang_thai === 'dung' || d.trang_thai === 'loi');
  const cu = du.dong.filter((d) => !dangChay.includes(d));
  return <div>
    <style>{'@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}'}</style>
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, color: 'var(--fg-2)', margin: '0 0 10px', flexWrap: 'wrap' }}>
      <span title="apps/etp/dong_phim.py trên iMac — báo sống mỗi 10 giây">máy chạy: {may ? <><b style={{ color: im! < 60 ? '#4ade80' : '#f87171' }}>{may.may}</b> {im! < 60 ? 'đang sống' : `im ${Math.round(im! / 60)} phút`}</> : <b style={{ color: '#f87171' }}>chưa bật</b>}</span>
      <span>thêm phim: tab Phim → menu ⋯ → <b>Chạy tự động tới khi lên camp</b></span>
      <span style={{ color: 'var(--fg-3)' }}>rê chuột vào từng bước để xem giờ + chi tiết</span>
    </div>
    {!du.dong.length ? <EmptyState icon="🎬" title="Chưa có phim nào chạy tự động" /> : null}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{dangChay.map((d) => <TheDong key={d.id} d={d} xong={() => void tai()} />)}</div>
    {cu.length ? <details style={{ marginTop: 14 }}><summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--fg-2)' }}>Đã xong / đã dừng ({cu.length})</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>{cu.map((d) => <TheDong key={d.id} d={d} xong={() => void tai()} />)}</div></details> : null}
  </div>;
}

export function FormChayDong({ contentId, onClose }: { contentId: number; onClose: () => void }) {
  const [f, setF] = useState<Awaited<ReturnType<typeof formDong>> | null>(null);
  const [loai, setLoai] = useState('CC'); const [tl, setTl] = useState(''); const [gui, setGui] = useState(false); const [loi, setLoi] = useState<string | null>(null);
  useEffect(() => { void formDong(contentId).then((r) => { setF(r); if (!('loi' in r)) setTl(r.tlPhim ?? ''); }); }, [contentId]);
  const ok = f && !('loi' in f);
  return <FormModal kind="generic" action="create" title={<>▶ Chạy tự động tới khi lên camp</>} idText={`PHIM #${contentId}`} subtitle={ok ? f.ten ?? undefined : undefined} width="md" onClose={onClose}>
    {!f ? <FormModalSection><div style={{ color: 'var(--fg-2)' }}>Đang tải…</div></FormModalSection>
      : 'loi' in f ? <FormModalSection><div style={{ color: '#f87171' }}>{f.loi}</div></FormModalSection> : <>
      <FormModalSection>
        {f.nhomGoc !== 'au_my' ? <div style={{ color: '#f87171', marginBottom: 10 }}>Phim {f.nhomGoc ? `nhóm gốc '${f.nhomGoc}'` : 'chưa xác định nhóm gốc'} — chỉ chạy phim Âu-Mỹ.</div> : null}
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Loại nội dung QC</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {f.loai.map((l: LoaiNoiDung) => <label key={l.ma} style={{ display: 'block', border: `1px solid ${loai === l.ma ? '#60a5fa' : 'var(--line)'}`, borderRadius: 8, padding: '10px 12px',
            cursor: l.chay ? 'pointer' : 'not-allowed', opacity: l.chay ? 1 : 0.55, background: loai === l.ma ? 'rgba(96,165,250,.08)' : undefined }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" name="loai" checked={loai === l.ma} disabled={!l.chay} onChange={() => setLoai(l.ma)} />
              <b>{l.ten}</b><span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }}>{l.gia} · {l.thoi_gian}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', margin: '6px 0 0 24px' }}>{l.mo_ta}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', margin: '4px 0 0 24px' }}>Máy làm: {l.cach}</div>
            {l.khoa ? <div style={{ fontSize: 11, color: '#fbbf24', margin: '4px 0 0 24px' }}>Chưa chạy được: {l.khoa}</div> : null}
            {l.vi_du.length ? <div style={{ display: 'flex', gap: 10, margin: '8px 0 0 24px', flexWrap: 'wrap' }}>
              {l.vi_du.map((v) => <div key={v.creative_id} style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                <video src={`${v.video}#t=3`} controls preload="metadata" style={{ width: 120, height: 213, background: '#000', borderRadius: 6, display: 'block' }} />
                <div style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${v.phim ?? ''} · creative #${v.creative_id}`}>#{v.creative_id} {v.phim ?? ''}</div>
                <div>14 ngày: chi ${v.chi} · lãi <b style={{ color: v.lai >= 0 ? '#4ade80' : '#f87171' }}>{v.lai >= 0 ? '+' : '−'}${Math.abs(v.lai)}</b></div></div>)}
            </div> : <div style={{ fontSize: 11, color: 'var(--fg-3)', margin: '6px 0 0 24px' }}>Chưa có ví dụ chạy ≥ $5 trong 14 ngày.</div>}
          </label>)}
        </div>
      </FormModalSection>
      <FormModalSection>
        <SelectField label="Thể loại phim" hint={f.tlPhim ? 'máy đã gắn sẵn — đổi nếu sai (ghi vào sổ thể loại, lịch giờ + báo cáo thể loại đọc cùng sổ)' : 'chưa gắn — chọn thể loại'}
          value={tl} onChange={(e) => setTl(e.target.value)}>
          <option value="">— chưa chọn —</option>
          {Object.entries(f.theLoai).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
        {loi ? <div style={{ color: '#f87171', marginTop: 8 }}>{loi}</div> : null}
      </FormModalSection>
      <FormModalFooter>
        <button className="btn" onClick={onClose}>Huỷ</button>
        <button className="btn primary" disabled={gui || f.nhomGoc !== 'au_my' || !tl} title={!tl ? 'chọn thể loại trước' : undefined} onClick={async () => {
          setGui(true); setLoi(null); const r = await chayDong(contentId, loai, tl); setGui(false);
          if ('loi' in r) return setLoi(r.loi);
          onClose(); const u = new URL(window.location.href); u.searchParams.set('t', 'dong'); window.location.href = u.toString();
        }}>{gui ? 'Đang gửi…' : '▶ Chạy tự động'}</button>
      </FormModalFooter>
    </>}
  </FormModal>;
}
