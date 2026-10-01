'use client';
// /shop › Hạ tầng QC › NUÔI TÀI KHOẢN — theo dõi warmup via / BM / TK QC / Trang mới, CÙNG KHUÔN bảng đơn hàng (anh 02/10/2026):
// chip loại → dải luồng chặng (DaiLuong: số mảnh đang đứng ở mỗi chặng, đỏ trễ hạn / vàng tới hạn hôm nay) → bảng (ThanhChang)
// → drawer một mảnh (bảng chặng + hạn + nút xong, nhật ký). Lộ trình + cách tính ở lib/shop/qc-nuoi.ts, sổ mốc 0212.
import { useMemo, useState, useTransition } from 'react';
import { DaiLuong, DataTable, Drawer, EmptyState, FilterChips, Panel, Pill, SimpleTable, TextField, ThanhChang, type DataColumn, type NutLuong } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { useShallowParam } from '@/lib/url-shallow';
import { shopQcMoc } from '@/lib/actions/shop';
import type { BoHaTang } from '@/lib/shop/qc-doc';
import { TRANG_THAI_QC } from '@/lib/shop/qc-ha-tang';
import { LO_NUOI, TEN_NUOI, hanhTrinhNuoi, ngayVn, type HanhTrinhNuoi, type LoaiNuoi } from '@/lib/shop/qc-nuoi';

const phu: React.CSSProperties = { color: 'var(--fg-3)', fontSize: 12 };
const homNayVn = () => ngayVn(new Date().toISOString());
const dm = (ngay: string | null) => (ngay ? `${ngay.slice(8, 10)}/${ngay.slice(5, 7)}` : '—');
const gioVn = (iso: string) => { const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString(); return `${d.slice(11, 16)} ${d.slice(8, 10)}/${d.slice(5, 7)}`; };
const TAT = new Set(['khoa', 'mat']);

type Dong = { loai: LoaiNuoi; id: number; ten: string; nguon: string; trangThai: string; ht: HanhTrinhNuoi };

/** Các mảnh của bộ (bỏ mảnh "thôi dùng") kèm hành trình nuôi tính từ sổ mốc. */
function dsDong(bo: BoHaTang, homNay: string): Dong[] {
  const { h, moc } = bo;
  const mot = (loai: LoaiNuoi, id: number) => moc.filter((m) => m.loai === loai && m.doiTuongId === id);
  const ra: Dong[] = [];
  const them = (loai: LoaiNuoi, xs: { id: number; ten: string; trangThai: string }[], nguon: (x: never) => string) => {
    for (const x of xs) if (x.trangThai !== 'bo') ra.push({ loai, id: x.id, ten: x.ten, nguon: nguon(x as never), trangThai: x.trangThai, ht: hanhTrinhNuoi(loai, mot(loai, x.id), homNay) });
  };
  them('nguoi', h.nguoi, (n: (typeof h.nguoi)[number]) => (n.nguon === 'cua_minh' ? 'của mình' : n.nguon === 'via_mua' ? 'via mua' : n.nguon === 'clone_mua' ? 'clone mua' : 'khác'));
  them('bm', h.bm, (b: (typeof h.bm)[number]) => (b.nguon === 'mua' ? `mua${b.noiMua ? ` · ${b.noiMua}` : ''}` : 'tự tạo'));
  them('tk', h.tk, (k: (typeof h.tk)[number]) => (k.nguon === 'mua' ? `mua${k.noiMua ? ` · ${k.noiMua}` : ''}` : 'tự tạo'));
  them('trang', h.trang, (t: (typeof h.trang)[number]) => (t.nguon === 'mua' ? 'mua' : 'tự tạo'));
  return ra;
}
/** Khoá chặng đang đứng (cho dải luồng + bộ lọc): chưa nuôi / bị khoá đứng ngoài luồng, nuôi xong = 'xong'. */
const khoaCua = (d: Dong) => (TAT.has(d.trangThai) || !d.ht.batDau ? 'ngoai' : d.ht.xong ? 'xong' : d.ht.chang[d.ht.hienTai]!.key);

function ThanhNuoi({ d }: { d: Dong }) {
  if (!d.ht.batDau) return <span style={phu}>chưa bắt đầu</span>;
  const c = d.ht.chang[d.ht.hienTai];
  return <ThanhChang so={d.ht.chang.length} i={d.ht.hienTai} nhan={c ? c.nhan : 'Đã ấm'}
    phuDe={`${d.ht.hienTai}/${d.ht.chang.length}`} title={c ? c.chuThich : 'Đã qua hết chặng nuôi'} />;
}
function HanPill({ ht }: { ht: HanhTrinhNuoi }) {
  const c = ht.chang[ht.hienTai];
  if (!ht.batDau || !c?.han) return <span style={phu}>—</span>;
  return <span style={{ color: ht.tre ? 'var(--bad)' : ht.denHan ? 'var(--warn)' : undefined }}>{dm(c.han)}{ht.tre ? ' · trễ' : ht.denHan ? ' · hôm nay' : ''}</span>;
}

export function NuoiShop({ bo, onLuu }: { bo: BoHaTang; onLuu: () => void }) {
  const homNay = homNayVn();
  const [loaiUrl, setLoai] = useShallowParam('nl', 'nguoi');
  const loai = (loaiUrl in LO_NUOI ? loaiUrl : 'nguoi') as LoaiNuoi;
  const [chang, setChang] = useShallowParam('nc', '');
  const modal = useModalParam('qcn');
  const tatCa = useMemo(() => dsDong(bo, homNay), [bo, homNay]);
  const dem = useMemo(() => { const c: Partial<Record<LoaiNuoi, number>> = {}; for (const d of tatCa) c[d.loai] = (c[d.loai] ?? 0) + 1; return c; }, [tatCa]);
  const cuaLoai = tatCa.filter((d) => d.loai === loai);
  const ds = cuaLoai.filter((d) => !chang || khoaCua(d) === chang);

  const nut = (key: string, nhan: string, phuDe: string, title: string): NutLuong => {
    const o = cuaLoai.filter((d) => khoaCua(d) === key);
    return { key, nhan, phuDe, title, so: o.length, dau: [
      { n: o.filter((d) => d.ht.tre).length, nhan: 'trễ', mau: 'var(--bad)' },
      { n: o.filter((d) => d.ht.denHan).length, nhan: 'hôm nay', mau: 'var(--warn)' },
    ] };
  };
  const cot: DataColumn<Dong>[] = [
    { key: 'ten', header: TEN_NUOI[loai], align: 'left', cell: (d) => <b style={{ fontWeight: 500 }}>{d.ten}</b>, sortValue: (d) => d.ten },
    { key: 'ht', header: 'Chặng', align: 'left', cell: (d) => <ThanhNuoi d={d} />, sortValue: (d) => (d.ht.batDau ? d.ht.hienTai : -1) },
    { key: 'n', header: 'Ngày thứ', cell: (d) => (d.ht.ngayThu ?? '—'), sortValue: (d) => d.ht.ngayThu ?? -1 },
    { key: 'han', header: 'Hạn chặng', align: 'left', cell: (d) => <HanPill ht={d.ht} />, sortValue: (d) => d.ht.chang[d.ht.hienTai]?.han ?? '9' },
    { key: 'viec', header: 'Việc của chặng', align: 'left', cell: (d) => { const c = d.ht.chang[d.ht.hienTai];
      return <span style={{ ...phu, display: 'inline-block', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{c?.chuThich ?? ''}</span>; },
      cellTitle: (d) => d.ht.chang[d.ht.hienTai]?.chuThich ?? '' },
    { key: 'bd', header: 'Bắt đầu', align: 'left', cell: (d) => dm(d.ht.batDau), sortValue: (d) => d.ht.batDau ?? '' },
    { key: 'nguon', header: 'Nguồn', align: 'left', cell: (d) => <span style={phu}>{d.nguon}</span> },
    { key: 'tt', header: 'Trạng thái', align: 'left', cell: (d) => <Pill size="xs" color={d.trangThai === 'song' ? 'var(--ok)' : TAT.has(d.trangThai) ? 'var(--bad)' : 'var(--warn)'}
      label={TRANG_THAI_QC[d.trangThai as keyof typeof TRANG_THAI_QC] ?? d.trangThai} /> },
  ];
  const mo = modal.value && modal.value in LO_NUOI ? tatCa.find((d) => d.loai === modal.value && d.id === Number(modal.id)) : undefined;

  return (
    <div data-comp="NuoiShop"><Panel title="Nuôi tài khoản" subtitle="Via · BM · TK QC · Trang mới: đang ở chặng nào, ngày thứ mấy, trễ hạn chỗ nào — cùng khuôn bảng đơn hàng" pad={8}>
      <div style={{ display: 'grid', gap: 8 }}>
        <FilterChips<LoaiNuoi> urlKey="nl" value={loai} onChange={(v) => { setLoai(v); setChang(''); }} counts={dem}
          options={(Object.keys(LO_NUOI) as LoaiNuoi[]).map((k) => ({ value: k, label: TEN_NUOI[k] }))} allValue="nguoi" />
        <DaiLuong urlKey="nc" value={chang} onChange={setChang}
          nut={[...LO_NUOI[loai].map((c) => nut(c.key, c.nhan, `hạn ngày ${c.ngay}`, c.chuThich)), nut('xong', 'Đã ấm', '', 'Qua hết chặng nuôi — dùng chạy thật được.')]}
          ngoai={nut('ngoai', 'Chưa nuôi / bị khoá', '', 'Chưa bấm "Bắt đầu nuôi", hoặc mảnh đang bị khoá / mất.')} />
        {ds.length ? <DataTable rows={ds} columns={cot} getRowKey={(d) => `${d.loai}-${d.id}`} persistKey="shop-nuoi" minWidth={900}
            onRowClick={(d) => modal.open(d.loai, String(d.id))} />
          : <EmptyState compact icon="🌱" title={cuaLoai.length ? 'Không có mảnh nào ở chặng này' : `Chưa có ${TEN_NUOI[loai]} nào trong bộ`}
              description={cuaLoai.length ? undefined : 'Thêm ở nút "+" phía trên (người / BM / TK QC / Trang), rồi mở dòng ở đây để bắt đầu nuôi.'}
              action={chang ? <button className="btn ghost" onClick={() => setChang('')}>Xem tất cả</button> : undefined} />}
      </div>
      {mo && <DrawerNuoi key={`${mo.loai}-${mo.id}`} bo={bo} d={mo} onClose={() => modal.close()} onLuu={onLuu} />}
    </Panel></div>
  );
}

function DrawerNuoi({ bo, d, onClose, onLuu }: { bo: BoHaTang; d: Dong; onClose: () => void; onLuu: () => void }) {
  const [ghi, setGhi] = useState('');
  const [ngayBd, setNgayBd] = useState(homNayVn());
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const lam = (buoc: string, xong = true, ghiChu?: string, ngay?: string) => batDau(async () => {
    setLoi(null);
    const r = await shopQcMoc(bo.h.cuaHangId, d.loai, d.id, buoc, xong, ghiChu, ngay).catch((e) => ({ ok: false, loi: (e as Error).message }));
    if (!r.ok) { setLoi(r.loi ?? 'lỗi'); return; }
    if (buoc === 'ghi') setGhi('');
    onLuu();
  });
  const { ht } = d;
  const nk = bo.moc.filter((m) => m.loai === d.loai && m.doiTuongId === d.id).slice().reverse();
  const tenBuoc = (k: string) => (k === 'bat_dau' ? 'Bắt đầu nuôi' : k === 'ghi' ? 'Ghi chú' : LO_NUOI[d.loai].find((c) => c.key === k)?.nhan ?? k);
  return (
    <Drawer onClose={onClose} width={640} dirty={!!ghi.trim()}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{TEN_NUOI[d.loai]} · {d.ten}</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <ThanhNuoi d={d} />
            {ht.batDau && <span style={phu}>bắt đầu {dm(ht.batDau)} · hôm nay ngày thứ {ht.ngayThu}</span>}
            <span style={{ flex: 1 }} />
            <a className="btn ghost" href={`/shop?tab=ha_tang&qc=${d.loai}&qcId=${d.id}`}>Sửa thông tin</a>
          </div>
        </div>
        {!ht.batDau ? (
          <Panel pad={10} title="Chưa bắt đầu nuôi" subtitle="Ngày bắt đầu = ngày 0; hạn mỗi chặng tính từ đây.">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <TextField id="nuoi-bd" label="Bắt đầu từ" type="date" value={ngayBd} onChange={(e) => setNgayBd(e.target.value)} />
              <button className="btn primary" disabled={dang || !ngayBd} onClick={() => lam('bat_dau', true, undefined, ngayBd)}>Bắt đầu nuôi</button>
            </div>
          </Panel>
        ) : (
          <Panel pad={8} title={ht.xong ? 'Đã ấm — qua hết chặng' : `Đang ở: ${ht.chang[ht.hienTai]!.nhan}`}
            subtitle={ht.tre ? `Trễ hạn (${dm(ht.chang[ht.hienTai]!.han)})` : ht.denHan ? 'Hạn chặng này là hôm nay' : undefined}>
            <SimpleTable rows={ht.chang} getRowKey={(c) => c.key}
              rowStyle={(c, i) => (i === ht.hienTai ? { fontWeight: 600 } : !c.xong ? { color: 'var(--fg-3)' } : undefined)} columns={[
                { key: 'd', header: '', width: 22, cell: (c, i) => (i === ht.hienTai ? <span style={{ color: ht.tre ? 'var(--bad)' : 'var(--accent)' }}>●</span>
                  : c.xong ? <span style={{ color: 'var(--ok)' }}>✓</span> : '○') },
                { key: 'n', header: 'Chặng', cell: (c) => <span title={c.chuThich}>{c.nhan}<div style={{ ...phu, fontWeight: 400 }}>{c.chuThich}</div></span> },
                { key: 'h', header: 'Hạn', width: 92, cell: (c) => `ngày ${c.ngay} · ${dm(c.han)}` },
                { key: 'l', header: 'Xong lúc', width: 92, cell: (c) => (c.luc ? gioVn(c.luc) : '—') },
                { key: 'b', header: '', width: 86, cell: (c) => <button className="btn ghost" disabled={dang} onClick={() => lam(c.key, !c.xong)}>{c.xong ? 'Mở lại' : 'Xong'}</button> },
              ]} />
          </Panel>
        )}
        <Panel pad={8} title="Nhật ký" subtitle="Checkpoint, bị đòi xác minh, đổi IP, số đã chi… — ghi ngay khi xảy ra">
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 6 }}>
            <div style={{ flex: 1 }}><TextField id="nuoi-ghi" size="sm" value={ghi} onChange={(e) => setGhi(e.target.value)} placeholder="Ghi chú nuôi hôm nay" /></div>
            <button className="btn" disabled={dang || !ghi.trim()} onClick={() => lam('ghi', true, ghi)}>Ghi</button>
          </div>
          {nk.length ? <SimpleTable hideHeader rows={nk} getRowKey={(m) => String(m.id)} columns={[
            { key: 'l', header: '', width: 92, cell: (m) => <span style={phu}>{gioVn(m.luc)}</span> },
            { key: 'b', header: '', cell: (m) => <>{m.buoc === 'ghi' ? m.ghiChu : `${tenBuoc(m.buoc)}${m.buoc === 'bat_dau' ? '' : m.xong ? ' — xong' : ' — mở lại'}`}</> },
            { key: 'a', header: '', width: 110, cell: (m) => <span style={phu}>{m.nguoiGhi ?? ''}</span> },
          ]} /> : <div style={phu}>Chưa có mốc nào.</div>}
        </Panel>
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
      </div>
    </Drawer>
  );
}
