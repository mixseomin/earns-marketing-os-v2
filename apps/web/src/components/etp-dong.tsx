'use client';
// DÒNG PHIM TỰ ĐỘNG (anh 03/11/2026, etp.on.tc): FormChayDong = form hỏi loại nội dung QC (KT / CC / CT…, mô tả + cách làm + giá + ví dụ thật) + thể loại;
// TabDong = mỗi phim một dòng, 8 bước có giờ bắt đầu / kết thúc, nút FIX từng bước, Dừng dòng. Máy: apps/etp/dong_phim.py (iMac) · canh: apps/etp/manh.py (box3).
import { useCallback, useEffect, useState } from 'react';
import { DataTable, EmptyState, FormModal, FormModalFooter, FormModalSection, SelectField, type DataColumn } from '@/components/ui';
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

function OBuoc({ d, b, xong }: { d: DongPhim; b?: BuocDong; xong: () => void }) {
  const [dang, setDang] = useState(false);
  if (!b) return <span style={{ color: 'var(--fg-3)' }}>·</span>;
  const [mau, chu] = MAU[b.trang_thai] ?? ['#6b7280', b.trang_thai]; const ke = ket(b);
  const coFix = d.trang_thai !== 'huy' && (b.trang_thai === 'loi' || b.trang_thai === 'dung' || ke);
  const t = `${TEN_BUOC[b.buoc]?.[0] ?? b.buoc} · ${chu}${b.lan > 1 ? ` · lần ${b.lan}` : ''}\nbắt đầu ${ngayGio(b.bat_dau)} · kết thúc ${ngayGio(b.ket_thuc)}${b.bat_dau ? ` · ${phut(b.bat_dau, b.ket_thuc)}` : ''} · hạn ${Math.round(b.han_giay / 60)} phút`
    + `${ke ? '\n⚠ KẸT: quá hạn hoặc máy im > 10 phút — Mạnh sẽ huỷ + FIX tự' : ''}${b.ghi ? `\n\n${b.ghi}` : ''}\n\n${TEN_BUOC[b.buoc]?.[1] ?? ''}`;
  return <div title={t} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, opacity: b.trang_thai === 'bo_qua' ? 0.45 : 1 }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: ke ? '#ef4444' : mau, flex: 'none', boxShadow: b.trang_thai === 'dang' ? `0 0 6px ${mau}` : undefined }} />
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{b.trang_thai === 'bo_qua' ? '—' : b.bat_dau ? `${gio(b.bat_dau)}→${b.ket_thuc ? gio(b.ket_thuc) : '…'}` : 'chờ'}</span>
    </span>
    <span style={{ fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{b.bat_dau ? phut(b.bat_dau, b.ket_thuc) : ''}{b.lan > 1 ? ` · lần ${b.lan}` : ''}
      {coFix ? <button className="btn" disabled={dang} style={{ marginLeft: 6, padding: '0 6px', fontSize: 11, lineHeight: '16px', color: '#fca5a5', borderColor: '#7f1d1d' }}
        onClick={async () => { setDang(true); const r = await fixBuoc(d.id, b.buoc); setDang(false); if ('loi' in r) window.alert(r.loi); xong(); }}>FIX</button> : null}</span>
  </div>;
}

export function TabDong() {
  const [du, setDu] = useState<Awaited<ReturnType<typeof docDong>> | null>(null);
  const tai = useCallback(async () => setDu(await docDong()), []);
  useEffect(() => { void tai(); const t = setInterval(() => void tai(), 10_000); return () => clearInterval(t); }, [tai]);
  if (!du) return <div style={{ padding: 16, color: 'var(--fg-2)' }}>Đang tải…</div>;
  if ('loi' in du) return <EmptyState icon="⚠" title={du.loi} />;
  const may = du.may[0]; const im = may ? (Date.now() - Date.parse(may.nhip)) / 1000 : null;
  const cot: DataColumn<DongPhim>[] = [
    { key: 'phim', header: 'Phim', align: 'left', width: 260, cell: (d) => <div style={{ minWidth: 0 }}>
      <a onClick={() => openEntityDrawer('etp-phim', d.content_id)} style={{ cursor: 'pointer', fontWeight: 600 }}>{d.ten ?? `phim #${d.content_id}`}</a>
      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>#{d.id} · <b>{d.loai}</b>{d.the_loai ? ` · ${d.the_loai}` : ''} · {d.ai ?? ''} · {ngayGio(d.tao_luc)}</div></div>,
      sortValue: (d) => d.ten ?? '' },
    { key: 'tt', header: 'Trạng thái', align: 'left', width: 120, cell: (d) => { const [m, c] = MAU[d.trang_thai] ?? ['#6b7280', d.trang_thai];
      return <span title={d.ly_do ?? ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: m }} />{c}
        {d.xong_luc ? <span style={{ color: 'var(--fg-3)', fontSize: 11 }}> {phut(d.tao_luc, d.xong_luc)}</span> : null}</span>; }, sortValue: (d) => d.trang_thai },
    ...Object.entries(TEN_BUOC).map(([k, [ten, mo]]): DataColumn<DongPhim> => ({ key: k, header: ten, title: mo, align: 'left', width: 104,
      cell: (d) => <OBuoc d={d} b={d.buoc.find((b) => b.buoc === k)} xong={() => void tai()} /> })),
    { key: 'kq', header: 'Kết quả · lý do', align: 'left', width: 300, cell: (d) => { const b = d.buoc.find((x) => x.trang_thai === 'dang') ?? [...d.buoc].reverse().find((x) => x.ket_thuc);
      const chu = d.trang_thai === 'chay' ? b?.ghi : d.ly_do ?? b?.ghi;
      return <div style={{ fontSize: 12, minWidth: 0 }}>{d.camp_id ? <b style={{ color: '#4ade80' }}>camp #{d.camp_id} </b> : null}{d.creative_id ? <span style={{ color: 'var(--fg-2)' }}>creative #{d.creative_id} </span> : null}
        <div title={chu ?? ''} style={{ color: d.trang_thai === 'dung' ? '#fbbf24' : d.trang_thai === 'loi' ? '#f87171' : 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{chu ?? ''}</div></div>; } },
    { key: 'lam', header: '', width: 70, cell: (d) => d.trang_thai === 'chay' || d.trang_thai === 'dung' || d.trang_thai === 'loi'
      ? <button className="btn" style={{ fontSize: 11 }} onClick={async () => { if (!window.confirm(`Dừng hẳn dòng #${d.id} (${d.ten ?? d.content_id})?`)) return; await dungDong(d.id); void tai(); }}>Dừng</button> : null },
  ];
  return <div>
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, color: 'var(--fg-2)', margin: '0 0 10px' }}>
      <span title="apps/etp/dong_phim.py trên iMac (launchd com.htuan.etp-dong-phim) — báo sống mỗi 10 giây">máy chạy dòng: {may ? <><b style={{ color: im! < 60 ? '#4ade80' : '#f87171' }}>{may.may}</b> {im! < 60 ? 'đang sống' : `im ${Math.round(im! / 60)} phút`}</> : <b style={{ color: '#f87171' }}>chưa bật</b>}</span>
      <span title="apps/etp/manh.py trên box3 (etp-manh.timer, 2 phút): bước quá hạn / im → huỷ + FIX tự một lần + Telegram">canh: <b>Mạnh</b> (box3, 2 phút)</span>
      <span>chạy tự động: menu ⋯ ở cột Phim (tab Phim) → <b>Chạy tự động tới khi lên camp</b></span>
    </div>
    <DataTable rows={du.dong} columns={cot} getRowKey={(d) => String(d.id)} persistKey="etp-dong" minWidth={1500} pageSize={50}
      searchText={(d) => `${d.id} ${d.content_id} ${d.ten ?? ''} ${d.loai} ${d.trang_thai}`} searchPlaceholder="Tìm phim, dòng…" />
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
                <video src={v.video} controls preload="none" style={{ width: 120, height: 213, background: '#000', borderRadius: 6, display: 'block' }} />
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
