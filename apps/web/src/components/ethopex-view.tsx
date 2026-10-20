'use client';
// TAB ETHOPEX (trang chủ) — quản lý camp FB phim ngắn trên Ethopex + LUẬT đang áp cho từng camp, khuôn cột "Luật" của adfond /report2:
// ô biểu tượng (luật nặng nhất đang chạm, tô theo mức dung > ha > bao > len) + chip mã luật (rê = câu luật với số thật của camp + vì sao);
// bấm hàng → ngăn chi tiết: từng luật, điều kiện ✓/○ (hiện tại vs ngưỡng), "Chạm thì: …". Sổ luật: lib/ethopex-luat.ts. Dữ liệu: lib/ethopex-doc.ts.
import { useMemo, useState, useEffect } from 'react';
import { DataTable, Drawer, FilterChips, Panel, StatsStrip, type DataColumn } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { LUAT, LUAT_THEO_MA, MUC_MAU, chamLuat, nangNhat, roi, type CampEtp, type LuatCham } from '@/lib/ethopex-luat';
import type { DuLieuEthopex } from '@/lib/ethopex-doc';

type Dong = CampEtp & { luat: LuatCham[] };
type Loc = 'all' | 'chay' | 'tat' | 'cham';
const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;
const pct = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`);
const mauTien = (v: number) => (v > 0 ? 'var(--neon-lime, #9be15d)' : v < 0 ? 'var(--neon-red, #ff5c5c)' : 'var(--fg-3)');
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
function truoc(iso: string) { const p = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return p < 1 ? 'vừa xong' : p < 60 ? `${p} phút trước` : `${Math.round(p / 60)} giờ trước`; }

function OLuat({ ds }: { ds: LuatCham[] }) {
  const n = nangNhat(ds), cham = ds.filter((x) => x.trang_thai === 'cham'), gan = ds.filter((x) => x.trang_thai === 'gan');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span title={`${cham.length} luật đang chạm · ${gan.length} sắp chạm · ${ds.length} luật đang áp`}
        style={{ width: 14, display: 'inline-block', textAlign: 'center', color: n ? MUC_MAU[n.muc] : 'var(--fg-3)', opacity: n ? 1 : 0.5 }}>{n ? n.icon : '·'}</span>
      {ds.filter((x) => x.trang_thai !== 'ap').map((x) => {
        const l = LUAT_THEO_MA[x.ma]!;
        return <span key={x.ma} title={`${l.ma} · ${l.ten} | ${x.cau}\nVì sao: ${l.vi}`}
          style={{ ...mono, fontSize: 10, padding: '0 4px', borderRadius: 3, border: `1px ${x.trang_thai === 'gan' ? 'dashed' : 'solid'} ${x.trang_thai === 'cham' ? MUC_MAU[l.muc] : 'var(--line)'}`,
            color: x.trang_thai === 'cham' ? MUC_MAU[l.muc] : 'var(--fg-2)' }}>{l.ma}</span>;
      })}
    </span>
  );
}

function NganCamp({ c, onClose }: { c: Dong; onClose: () => void }) {
  const [mo, setMo] = useState<string | null>(null);
  const r = roi(c.thang);
  return (
    <Drawer onClose={onClose} width={640}>
      <div style={{ ...mono, fontSize: 11, color: 'var(--fg-3)' }}>Camp #{c.id} · tạo {new Date(c.tao).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>
      <h3 style={{ margin: '4px 0 12px', fontSize: 15 }}>{c.ten}</h3>
      <StatsStrip minColWidth={110} cards={[
        { key: 'ns', label: 'Ngân sách', value: `$${c.ngan_sach}` },
        { key: 'chi', label: 'Chi tháng', value: usd(c.thang.chi) },
        { key: 'lai', label: 'Lãi tháng', value: usd(c.thang.thu - c.thang.chi), color: mauTien(c.thang.thu - c.thang.chi) },
        { key: 'roi', label: 'ROI tháng', value: pct(r), color: mauTien(r ?? 0) },
      ]} />
      <div style={{ ...mono, fontSize: 11, color: 'var(--fg-2)', margin: '10px 0 14px', lineHeight: 1.6 }}>
        Phim: {c.phim ?? '—'} {c.content_id ? `(content ${c.content_id})` : ''} · {c.ngon_ngu?.toUpperCase() ?? '—'}<br />
        Creative #{c.creative_id ?? '—'} {c.studio_phim_id ? <a href={`https://studio.on.tc/?m=phim&mId=${c.studio_phim_id}`} target="_blank" rel="noreferrer">· mở trong studio</a> : null}<br />
        Trạng thái {c.trang_thai} · giao {c.giao || '—'}{c.loi ? <><br /><span style={{ color: MUC_MAU.dung }}>{c.loi.slice(0, 220)}</span></> : null}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Luật đang áp cho camp này</div>
      {c.luat.map((x) => {
        const l = LUAT_THEO_MA[x.ma]!, mau = x.trang_thai === 'cham' ? MUC_MAU[l.muc] : 'var(--fg-2)';
        return (
          <div key={x.ma} style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: x.dk.length ? 'pointer' : 'default' }} onClick={() => setMo(mo === x.ma ? null : x.ma)}>
              <span style={{ width: 16, textAlign: 'center', color: mau }}>{l.icon}</span>
              <span style={{ ...mono, fontSize: 10, color: mau }}>{l.ma}</span>
              <span style={{ fontSize: 12, flex: 1 }}>{l.ten}</span>
              <span style={{ ...mono, fontSize: 10, color: mau, border: `1px ${x.trang_thai === 'gan' ? 'dashed' : 'solid'} ${x.trang_thai === 'ap' ? 'var(--line)' : mau}`, borderRadius: 3, padding: '0 4px' }}>
                {x.trang_thai === 'cham' ? 'đã chạm' : x.trang_thai === 'gan' ? 'sắp chạm' : 'đang áp'}</span>
              <span style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>{l.gac === 'may' ? 'máy chặn' : 'anh duyệt'}</span>
              {x.dk.length ? <span style={{ color: 'var(--fg-3)' }}>{mo === x.ma ? '▴' : '▾'}</span> : null}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-2)', margin: '2px 0 0 24px' }}>{x.cau}</div>
            {mo === x.ma && (
              <div style={{ margin: '6px 0 0 24px', fontSize: 11 }}>
                {x.dk.map((d) => <div key={d.ten} style={mono}>{d.dat ? '✓' : '○'} {d.ten}: <b>{d.hien}</b> <span style={{ color: 'var(--fg-3)' }}>(ngưỡng {d.nguong})</span></div>)}
                <div style={{ marginTop: 4 }}><span style={{ color: 'var(--fg-3)' }}>Chạm thì:</span> {l.lam}</div>
                <div style={{ color: 'var(--fg-3)' }}>Vì sao: {l.vi} — {l.nguon}</div>
              </div>
            )}
          </div>
        );
      })}
    </Drawer>
  );
}

export function EthopexView({ du }: { du: DuLieuEthopex }) {
  const modal = useModalParam('em');
  const [loc, setLoc] = useState<Loc>('all');
  useEffect(() => { const v = new URLSearchParams(location.search).get('etl') as Loc | null; if (v) setLoc(v); }, []);
  useEffect(() => { const u = new URL(location.href); if (loc === 'all') u.searchParams.delete('etl'); else u.searchParams.set('etl', loc); history.replaceState(history.state, '', u); }, [loc]);
  const dong: Dong[] = useMemo(() => {
    const soCamp = new Map<number, number>();
    for (const c of du.camps) if (c.content_id) soCamp.set(c.content_id, (soCamp.get(c.content_id) ?? 0) + 1);
    return du.camps.map((c) => ({ ...c, luat: chamLuat(c, { soCampPhim: c.content_id ? soCamp.get(c.content_id) ?? 0 : 0, phimThang: !!c.content_id && du.phimThang.includes(c.content_id) }) }));
  }, [du]);
  const coCham = (d: Dong) => d.luat.some((x) => x.trang_thai === 'cham' && LUAT_THEO_MA[x.ma]!.muc !== 'bao');
  const hien = dong.filter((d) => loc === 'all' || (loc === 'chay' ? d.trang_thai === 'ACTIVE' : loc === 'tat' ? d.trang_thai !== 'ACTIVE' : coCham(d)));
  const tong = dong.reduce((a, d) => ({ chi: a.chi + d.thang.chi, thu: a.thu + d.thang.thu }), { chi: 0, thu: 0 });
  const dem = (ma: string) => dong.filter((d) => d.luat.some((x) => x.ma === ma && x.trang_thai === 'cham')).length;
  const dangMo = modal.numId ? dong.find((d) => d.id === modal.numId) : undefined;

  const cot: DataColumn<Dong>[] = [
    { key: 'luat', header: 'Luật', align: 'left', width: 120, cell: (d) => <OLuat ds={d.luat} />, sortValue: (d) => (nangNhat(d.luat) ? 10 : 0) + d.luat.filter((x) => x.trang_thai === 'cham').length },
    { key: 'camp', header: 'Camp', align: 'left', cell: (d) => <span><span style={{ ...mono, color: 'var(--fg-3)' }}>#{d.id}</span> {d.ten}</span>, sortValue: (d) => d.id },
    { key: 'phim', header: 'Phim', align: 'left', cell: (d) => d.phim ?? '—', sortValue: (d) => d.phim ?? '' },
    { key: 'nn', header: 'NN', align: 'center', cell: (d) => d.ngon_ngu?.toUpperCase() ?? '—', sortValue: (d) => d.ngon_ngu ?? '' },
    { key: 'tt', header: 'Trạng thái', align: 'left', cell: (d) => <span style={{ color: d.trang_thai === 'ACTIVE' ? 'var(--fg-1)' : 'var(--fg-3)' }}>{d.trang_thai === 'ACTIVE' ? 'Bật' : 'Tắt'}{d.giao ? ` · ${d.giao}` : ''}</span>, sortValue: (d) => d.trang_thai + d.giao },
    { key: 'ns', header: 'Ngân sách', cell: (d) => `$${d.ngan_sach}`, sortValue: (d) => d.ngan_sach, total: (rs) => `$${rs.filter((r) => r.trang_thai === 'ACTIVE').reduce((a, r) => a + r.ngan_sach, 0)}` },
    { key: 'sp', header: 'Spending hôm nay', title: 'chi hôm nay / ngân sách ngày', cell: (d) => `${d.ngan_sach ? Math.round((d.hom_nay.chi / d.ngan_sach) * 100) : 0}%`, sortValue: (d) => (d.ngan_sach ? d.hom_nay.chi / d.ngan_sach : 0) },
    { key: 'chi', group: 'thang', header: 'Chi', cell: (d) => usd(d.thang.chi), sortValue: (d) => d.thang.chi, total: (rs) => usd(rs.reduce((a, r) => a + r.thang.chi, 0)) },
    { key: 'thu', group: 'thang', header: 'Thu', cell: (d) => usd(d.thang.thu), sortValue: (d) => d.thang.thu, total: (rs) => usd(rs.reduce((a, r) => a + r.thang.thu, 0)) },
    { key: 'lai', group: 'thang', header: 'Lãi', cell: (d) => <span style={{ color: mauTien(d.thang.thu - d.thang.chi) }}>{usd(d.thang.thu - d.thang.chi)}</span>, sortValue: (d) => d.thang.thu - d.thang.chi,
      total: (rs) => { const v = rs.reduce((a, r) => a + r.thang.thu - r.thang.chi, 0); return <span style={{ color: mauTien(v) }}>{usd(v)}</span>; } },
    { key: 'roi', group: 'thang', header: 'ROI', cell: (d) => { const v = roi(d.thang); return <span style={{ color: mauTien(v ?? 0) }}>{pct(v)}</span>; }, sortValue: (d) => roi(d.thang) ?? -1e9 },
    { key: 'roi3', group: 'xu', header: 'ROI 3 ngày', title: '3 ngày gần nhất (giờ VN)', cell: (d) => pct(roi(d.gan)), sortValue: (d) => roi(d.gan) ?? -1e9 },
    { key: 'roi4', group: 'xu', header: 'ROI 4 ngày trước', cell: (d) => pct(roi(d.truoc)), sortValue: (d) => roi(d.truoc) ?? -1e9 },
  ];

  return (
    <div>
      <div style={{ ...mono, fontSize: 11, color: 'var(--fg-3)', marginBottom: 10 }}>
        Số liệu sống từ Ethopex · cập nhật {truoc(du.luc)} · ROI/lãi từ đầu tháng (giờ VN) · luật chỉ báo, tăng / giảm / tắt anh duyệt từng camp
        {du.loi ? <span style={{ color: MUC_MAU.dung }}> · lỗi: {du.loi}</span> : null}
      </div>
      <StatsStrip minColWidth={120} cards={[
        { key: 'chay', label: 'Camp đang bật', value: dong.filter((d) => d.trang_thai === 'ACTIVE').length, sub: `${dong.length} camp` },
        { key: 'chi', label: 'Chi tháng', value: usd(tong.chi) },
        { key: 'lai', label: 'Lãi tháng', value: usd(tong.thu - tong.chi), color: mauTien(tong.thu - tong.chi) },
        { key: 'roi', label: 'ROI tháng', value: pct(roi(tong)), color: mauTien(roi(tong) ?? 0) },
        { key: 'tb', label: 'Đủ đk tăng', value: dem('TB'), color: dem('TB') ? MUC_MAU.len : undefined, title: 'Luật TB — chờ anh duyệt' },
        { key: 'gt', label: 'Cần xem giảm/tắt', value: dem('GT'), color: dem('GT') ? MUC_MAU.ha : undefined },
        { key: 'tc', label: 'Ad bị từ chối', value: dem('TC'), color: dem('TC') ? MUC_MAU.dung : undefined },
      ]} />
      <div style={{ margin: '12px 0 8px' }}>
        <FilterChips<Loc> urlKey="etl" value={loc} onChange={setLoc}
          counts={{ all: dong.length, chay: dong.filter((d) => d.trang_thai === 'ACTIVE').length, tat: dong.filter((d) => d.trang_thai !== 'ACTIVE').length, cham: dong.filter(coCham).length }}
          options={[{ value: 'all', label: 'Tất cả' }, { value: 'chay', label: 'Đang bật' }, { value: 'tat', label: 'Đã tắt' }, { value: 'cham', label: 'Chạm luật', title: 'Có luật tăng / giảm / từ chối đang chạm' }]} />
      </div>
      <DataTable<Dong> rows={hien} columns={cot} getRowKey={(d) => String(d.id)} persistKey="ethopex-camp" minWidth={1100}
        groups={[{ key: 'thang', label: 'Từ đầu tháng' }, { key: 'xu', label: 'Xu hướng ROI' }]}
        searchText={(d) => `${d.id} ${d.ten} ${d.phim ?? ''} ${d.creative_id ?? ''}`} searchPlaceholder="Tìm camp, phim, creative…"
        onRowClick={(d) => modal.open('camp', d.id)} rowStyle={(d) => (d.trang_thai === 'ACTIVE' ? undefined : { opacity: 0.6 })} />
      <div style={{ marginTop: 16 }}>
        <Panel title="Sổ luật Ethopex" subtitle="// kb #261 mục 8–8d · lib/ethopex-luat.ts">
          {LUAT.map((l) => (
            <div key={l.ma} style={{ display: 'grid', gridTemplateColumns: '18px 44px 1fr', gap: 8, padding: '5px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span style={{ color: MUC_MAU[l.muc], textAlign: 'center' }}>{l.icon}</span>
              <span style={{ ...mono, fontSize: 10, color: MUC_MAU[l.muc] }}>{l.ma}</span>
              <div>
                <b>{l.ten}</b> <span style={{ ...mono, fontSize: 10, color: 'var(--fg-3)' }}>{l.gac === 'may' ? 'máy chặn' : 'anh duyệt'} · {l.nguon}</span>
                <div style={{ color: 'var(--fg-2)' }}>Khi {l.khi} → {l.lam}</div>
                <div style={{ color: 'var(--fg-3)', fontSize: 11 }}>Vì sao: {l.vi}</div>
              </div>
            </div>
          ))}
        </Panel>
      </div>
      {dangMo && modal.is('camp') ? <NganCamp c={dangMo} onClose={modal.close} /> : null}
    </div>
  );
}
