'use client';

// Report2 (MOS2) — cùng khuôn report2 của be.adfond: THANH ĐẦU dính (khoảng ngày · chip đang lọc · ô lọc từng chiều),
// DẢI KPI, BIỂU ĐỒ theo ngày, ô GỘP + CỘT (nháp → "Cập nhật"), BẢNG chia cụm có dòng tổng. Mọi trạng thái là URL.
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { DataTable, MultiSelect, type DataColumn, type DataGroup } from '@/components/ui';
import { ComboChart, type ChuoiCombo } from '@/components/combo-chart';
import { DUONG_BIEU_DO, KPI, LOC, XUONG } from '@/lib/bao-cao2';

type Kieu = 'tien' | 'so' | 'pt' | 'x';
type Y = { duAn: string[]; tu: string; den: string; gop: string[]; chiSo: string[]; loc: Record<string, string[]> };
type Dong = Record<string, unknown>;
type ChiSoMan = { key: string; nhan: string; kieu: Kieu; cum: string; chuThich: string };
type CampInfo = { ma: string; nhan: string; mau: string; lyDo: string; trangThai: string; nganSach: number | null };
const TRANG_THAI_CAMP: Record<string, string> = { chay: 'đang chạy', tam_dung: 'tạm dừng', nhap: 'nháp', ket_thuc: 'kết thúc' };

const so = (v: unknown) => (v == null || v === '' ? null : Number(v));
function hien(v: unknown, k: Kieu): string {
  const x = so(v);
  if (x == null || Number.isNaN(x)) return '—';
  if (k === 'tien') return (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: Math.abs(x) < 10 && x !== 0 ? 2 : 0, maximumFractionDigits: Math.abs(x) < 1 && x !== 0 ? 4 : 2 });
  if (k === 'pt') return (x * 100).toFixed(2) + '%';
  if (k === 'x') return x.toFixed(2) + '×';
  return Math.round(x).toLocaleString('en-US');
}
const ngayTruoc = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
const KHOANG = [{ d: 0, nhan: 'Hôm nay' }, { d: 6, nhan: '7 ngày' }, { d: 13, nhan: '14 ngày' }, { d: 29, nhan: '30 ngày' }, { d: 89, nhan: '90 ngày' }];
const MAU_TIEN = (k: string) => (['chi', 'gia_von', 'phi', 'hoan', 'cpc', 'cpa'].includes(k) ? '#b45309' : ['thu', 'roas', 'epc'].includes(k) ? '#15803d' : undefined);
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' };
const nhanNho: React.CSSProperties = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-3)' };

export function BaoCao2View({ y, rows, ngayRows, dongTong, chonCho, loi, chieu, chiSo, cum, campInfo }: {
  campInfo: Record<string, CampInfo>;
  y: Y; rows: Dong[]; ngayRows: Dong[]; dongTong: Dong | null; chonCho: Record<string, string[]>; loi: string | null;
  chieu: { key: string; nhan: string }[]; chiSo: ChiSoMan[]; cum: { key: string; nhan: string; mau: string }[];
}) {
  const router = useRouter();
  const [dang, batDau] = useTransition();
  /* Nháp Gộp/Cột: bày xong mới bấm "Cập nhật" (một lượt máy chủ), nút chỉ sáng khi nháp khác URL. */
  const [nhapGop, datNhapGop] = useState<string[]>(y.gop);
  const [nhapCot, datNhapCot] = useState<string[]>(y.chiSo);
  const banNhap = nhapGop.join() !== y.gop.join() || nhapCot.join() !== y.chiSo.join();
  const [moCot, datMoCot] = useState(false);

  const thamSo = () => new URLSearchParams(window.location.search);
  const di = (p: URLSearchParams) => batDau(() => router.push(`/report2?${p.toString()}`, { scroll: false }));
  const capNhat = () => { const p = thamSo(); p.set('gop', nhapGop.join(',') || 'none'); p.set('cot', nhapCot.join(',')); di(p); };
  const doiKhoang = (tu: string, den: string) => { const p = thamSo(); p.set('tu', tu); p.set('den', den); di(p); };
  const datLoc = (k: string, vs: string[]) => { const p = thamSo(); p.delete('f.' + k); vs.forEach((v) => p.append('f.' + k, v)); di(p); };
  const boLoc = (k: string, v: string) => datLoc(k, (y.loc[k] ?? []).filter((x) => x !== v));
  /* Bấm ô chiều = lọc riêng giá trị đó VÀ chia xuống chiều kế (Dự án → Nguồn → Camp → Offer). */
  const themLoc = (k: string, v: string) => {
    const p = thamSo();
    if (!(y.loc[k] ?? []).includes(v)) p.append('f.' + k, v);
    const x = XUONG[k];
    if (x && !y.gop.includes(x)) p.set('gop', y.gop.map((g) => (g === k ? x : g)).join(','));
    di(p);
  };

  const csTheoKhoa = useMemo(() => Object.fromEntries(chiSo.map((m) => [m.key, m])), [chiSo]);
  const kieuCua = (k: string): Kieu => csTheoKhoa[k]?.kieu ?? 'so';
  const duLieuNgay = useMemo(() => [...ngayRows]
    .sort((a, b) => String(a.ngay).localeCompare(String(b.ngay)))
    .map((r) => ({ x: String(r.ngay).slice(5), ...Object.fromEntries(DUONG_BIEU_DO.map((d) => [d.key, so(r[d.key]) ?? 0])) })), [ngayRows]);
  const khoangDang = KHOANG.find((k) => y.tu === ngayTruoc(k.d) && y.den === ngayTruoc(0))?.d;
  const coLoc = Object.values(y.loc).some((v) => v.length);
  const thuTuCum = (k: string) => cum.findIndex((c) => c.key === k);

  const groups: DataGroup[] = cum.map((c) => ({ key: c.key, label: c.nhan, color: c.mau }));
  const columns: DataColumn<Dong>[] = [
    ...y.gop.map((k, i): DataColumn<Dong> | null => {
      const c = chieu.find((x) => x.key === k); if (!c) return null;
      return {
        key: k, header: c.nhan, align: 'left',
        cell: (r) => {
          const v = String(r[k] ?? '—');
          return (
            <button type="button" onClick={() => themLoc(k, v)}
              title={`Lọc riêng "${v}"${XUONG[k] && !y.gop.includes(XUONG[k]) ? ` và chia theo ${chieu.find((x) => x.key === XUONG[k])?.nhan}` : ''}`}
              style={{ background: 'none', border: 0, padding: 0, color: 'var(--fg-1)', cursor: 'pointer', fontSize: 12, textAlign: 'left', fontFamily: k === 'camp' || k === 'ngay' ? 'var(--font-mono)' : undefined }}>
              {v}
            </button>
          );
        },
        sortValue: (r) => String(r[k] ?? ''),
        total: i === 0 ? () => <b>Tổng</b> : undefined,
      };
    }).filter((c): c is DataColumn<Dong> => !!c),
    /* Chia theo Camp: phán xét của BỘ LUẬT (cùng trang chủ) + trạng thái + ngân sách/ngày, cạnh tên camp. */
    ...(y.gop.includes('camp') ? [
      { key: '_px', header: 'Phán xét', align: 'left' as const, title: 'Kết quả bộ luật camp (be.adfond chấm) — cùng cột Phán xét ở tab Campaign trang chủ',
        cell: (r: Dong) => { const c = campInfo[String(r.camp)]; return c ? <span title={c.lyDo} style={{ color: c.mau, fontWeight: 600, fontSize: 11 }}>{c.nhan}</span> : <span style={{ color: 'var(--fg-4, #b8b8b8)' }}>—</span>; },
        sortValue: (r: Dong) => campInfo[String(r.camp)]?.ma ?? '' },
      { key: '_tt', header: 'Trạng thái', align: 'left' as const,
        cell: (r: Dong) => <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{TRANG_THAI_CAMP[campInfo[String(r.camp)]?.trangThai ?? ''] ?? campInfo[String(r.camp)]?.trangThai ?? '—'}</span>,
        sortValue: (r: Dong) => campInfo[String(r.camp)]?.trangThai ?? '' },
      { key: '_ns', header: 'Ngân sách/ngày',
        cell: (r: Dong) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{hien(campInfo[String(r.camp)]?.nganSach, 'tien')}</span>,
        sortValue: (r: Dong) => campInfo[String(r.camp)]?.nganSach ?? null },
    ] as DataColumn<Dong>[] : []),
    ...y.chiSo.filter((k) => csTheoKhoa[k]).sort((a, b) => thuTuCum(csTheoKhoa[a]!.cum) - thuTuCum(csTheoKhoa[b]!.cum)).map((k): DataColumn<Dong> => {
      const m = csTheoKhoa[k]!;
      const o = (v: unknown, dam = false) => {
        const x = so(v);
        const mau = x === 0 ? 'var(--fg-4, #b8b8b8)' : k === 'lai' && x != null ? (x < 0 ? 'var(--bad, #c62828)' : 'var(--ok, #15803d)') : MAU_TIEN(k);
        return <span style={{ fontVariantNumeric: 'tabular-nums', color: mau, fontWeight: dam ? 700 : undefined }}>{hien(v, m.kieu)}</span>;
      };
      return { key: k, header: m.nhan, title: m.chuThich, group: m.cum, cell: (r) => o(r[k]), sortValue: (r) => so(r[k]), total: () => o(dongTong?.[k], true) };
    }),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* THANH ĐẦU — dính khi cuộn: cuộn xuống bảng vẫn thấy đang lọc gì và đổi lọc được. */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Báo cáo</h1>
          <span style={nhanNho}>sổ PHỦ · không gồm adfond</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {KHOANG.map((k) => (
              <button key={k.d} type="button" onClick={() => doiKhoang(ngayTruoc(k.d), ngayTruoc(0))}
                style={{ ...chip, background: khoangDang === k.d ? 'var(--fg-1)' : 'var(--bg-2)', color: khoangDang === k.d ? 'var(--bg-1)' : 'var(--fg-1)' }}>{k.nhan}</button>
            ))}
          </div>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
            <input type="date" value={y.tu} max={y.den} onChange={(e) => e.target.value && doiKhoang(e.target.value, y.den)} aria-label="Từ ngày" />
            →
            <input type="date" value={y.den} min={y.tu} onChange={(e) => e.target.value && doiKhoang(y.tu, e.target.value)} aria-label="Đến ngày" />
          </span>
          {dang && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>đang tính…</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={nhanNho}>Lọc</span>
          {LOC.map((k) => (
            <MultiSelect key={k} compact portal label={chieu.find((c) => c.key === k)?.nhan ?? k}
              options={(chonCho[k] ?? []).map((v) => ({ value: v, label: v }))}
              selected={y.loc[k] ?? []} onChange={(vs) => datLoc(k, vs as string[])} />
          ))}
          <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {!coLoc ? <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>Chưa lọc — đang xem toàn bộ</span>
              : Object.entries(y.loc).flatMap(([k, vs]) => vs.map((v) => (
                <button key={k + v} type="button" onClick={() => boLoc(k, v)} style={chip} title="Bỏ lọc này">
                  <span style={{ color: 'var(--fg-3)' }}>{chieu.find((c) => c.key === k)?.nhan}:</span> {v} ✕
                </button>
              )))}
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, opacity: dang ? 0.55 : 1, transition: 'opacity .15s' }}>
        {loi && (
          <div role="alert" style={{ padding: 12, border: '1px solid var(--bad, #c62828)', borderRadius: 8, color: 'var(--bad, #c62828)', fontSize: 13 }}>
            Không chạy được báo cáo: {loi}
          </div>
        )}

        {/* DẢI KPI — tổng của khoảng đang xem, tỷ lệ chia lại từ tổng (cùng dòng Tổng). */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
          {KPI.map((k) => {
            const m = csTheoKhoa[k]; const x = so(dongTong?.[k]);
            const mau = x === 0 ? 'var(--fg-4, #b8b8b8)' : k === 'lai' && x != null ? (x < 0 ? 'var(--bad, #c62828)' : 'var(--ok, #15803d)') : MAU_TIEN(k);
            return (
              <div key={k} title={m?.chuThich} style={{ background: 'var(--bg-1)', padding: '7px 10px' }}>
                <div style={nhanNho}>{m?.nhan ?? k}</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: mau }}>{hien(dongTong?.[k], m?.kieu ?? 'so')}</div>
              </div>
            );
          })}
        </div>

        {/* BIỂU ĐỒ — chuỗi ngày của đúng bộ lọc đang áp. */}
        {duLieuNgay.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', overflow: 'hidden' }}>
            <ComboChart data={duLieuNgay} series={DUONG_BIEU_DO as unknown as ChuoiCombo[]} dinhDang={(k, v) => hien(v, kieuCua(k))} />
          </div>
        )}

        {/* GỘP + CỘT — nháp, bấm Cập nhật mới hỏi máy chủ. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={nhanNho}>Chia theo</span>
            {chieu.map((c) => {
              const i = nhapGop.indexOf(c.key);
              return (
                <button key={c.key} type="button" onClick={() => datNhapGop((g) => (i >= 0 ? g.filter((x) => x !== c.key) : [...g, c.key].slice(-3)))}
                  style={{ ...chip, background: i >= 0 ? 'var(--fg-1)' : 'var(--bg-2)', color: i >= 0 ? 'var(--bg-1)' : 'var(--fg-1)' }}>
                  {i >= 0 && <b>{i + 1}</b>} {c.nhan}
                </button>
              );
            })}
            <button type="button" onClick={() => datMoCot((m) => !m)} aria-expanded={moCot} style={chip}>Cột ({nhapCot.length}) {moCot ? '▲' : '▼'}</button>
            <button type="button" disabled={!banNhap} onClick={capNhat}
              style={{ ...chip, background: banNhap ? '#2563eb' : 'var(--bg-2)', color: banNhap ? '#fff' : 'var(--fg-3)', borderColor: banNhap ? '#2563eb' : 'var(--line)', cursor: banNhap ? 'pointer' : 'default' }}>
              Cập nhật
            </button>
          </div>
          {moCot && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, border: '1px solid var(--line)', borderRadius: 6, padding: 10 }}>
              {cum.map((u) => (
                <div key={u.key}>
                  <div style={{ ...nhanNho, color: u.mau, marginBottom: 4 }}>{u.nhan}</div>
                  {chiSo.filter((m) => m.cum === u.key).map((m) => (
                    <label key={m.key} title={m.chuThich} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0', cursor: 'pointer' }}>
                      <input type="checkbox" checked={nhapCot.includes(m.key)}
                        onChange={(e) => datNhapCot((c) => (e.target.checked ? [...c, m.key] : c.filter((x) => x !== m.key)))} />
                      {m.nhan}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BẢNG */}
        {!loi && (rows.length ? (
          <DataTable rows={rows} columns={columns} groups={groups} persistKey="mos2-report2"
            getRowKey={(r, i) => y.gop.map((k) => String(r[k])).join('|') || String(i)}
            searchText={(r) => y.gop.map((k) => String(r[k] ?? '')).join(' ')} searchPlaceholder="Tìm trong bảng…" />
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)', border: '1px dashed var(--line)', borderRadius: 6, fontSize: 13 }}>
            Không có số trong khoảng + bộ lọc này. Đổi khoảng ngày hoặc bỏ bớt lọc.
          </div>
        ))}
      </div>
    </div>
  );
}
