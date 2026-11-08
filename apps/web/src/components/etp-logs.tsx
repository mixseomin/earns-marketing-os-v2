'use client';
// LOGS — thay "Lên bậc" ở tab Camp (anh 08/11/2026): nhật ký máy nhà gom theo khung 15 phút … 1 ngày (tuỳ chọn); mỗi khung đếm camp mở / tắt / tăng / giảm…,
// creative dựng / chấm qua / trượt / người duyệt, dòng sản xuất, chi / thu nhà. Bấm (điện thoại) hoặc rê chuột vào một ô số → thẻ nổi liệt kê từng việc trong khung đó.
// Số: lib/actions/etp-logs docLogs · loại + gom: lib/etp-logs (bài tự kiểm etp-logs.test.mts). Kỳ + khung gom ghi URL (?lgky= ?lggom=), F5 giữ nguyên.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, Segmented, type DataColumn } from '@/components/ui';
import { KhungNoi, useNoi } from '@/components/etp-noi';
import { KeToan, mauLai, MO_SO } from '@/components/etp-so';
import { docLogs } from '@/lib/actions/etp-logs';
import { gioVn, gomLogs, KHUNG_PHUT, KY_GIO, LOAI_LOG, LOAI_THEO_K, NHOM_LOG, nhanKhung, tenKhung, tenKy, type DuLogs, type HangLog, type KhungLog } from '@/lib/etp-logs';

const U_KY = 'lgky', U_GOM = 'lggom', MAC_KY = 24, MAC_GOM = 60;
const docUrl = (k: string, ds: readonly number[], mac: number) => {
  if (typeof window === 'undefined') return mac;
  const v = Number(new URLSearchParams(window.location.search).get(k)); return ds.includes(v) ? v : mac;
};
const ghiUrl = (k: string, v: number, mac: number) => {
  const u = new URL(window.location.href); if (v === mac) u.searchParams.delete(k); else u.searchParams.set(k, String(v));
  window.history.replaceState(null, '', u.toString());
};
const maCua = (k: string, id: number | null) => (id == null ? '' : LOAI_THEO_K[k]?.ma === 'dong' ? `dòng #${id}` : LOAI_THEO_K[k]?.ma === 'creative' ? `creative #${id}` : `camp #${id}`);
const DO = 'var(--neon-red, #f87171)';

type The = { k: string; nhan: string; ds: HangLog[] };
export function TabLogs() {
  const [ky, setKy] = useState(MAC_KY), [gom, setGom] = useState(MAC_GOM);
  useEffect(() => { setKy(docUrl(U_KY, KY_GIO, MAC_KY)); setGom(docUrl(U_GOM, KHUNG_PHUT, MAC_GOM)); }, []);
  const [du, setDu] = useState<DuLogs | null>(null), [loi, setLoi] = useState<string | null>(null), [dangTai, setDangTai] = useState(false);
  const tai = useCallback(async (h: number) => {
    setDangTai(true);
    try { const r = await docLogs(h); if ('loi' in r) setLoi(r.loi); else { setDu(r); setLoi(null); } }
    catch (e) { setLoi(`không tải được nhật ký: ${String((e as Error)?.message ?? e).slice(0, 160)}`); }
    finally { setDangTai(false); }
  }, []);
  useEffect(() => { void tai(ky); const id = window.setInterval(() => void tai(ky), 60_000); return () => window.clearInterval(id); }, [ky, tai]);
  const hang = useMemo(() => (du ? gomLogs(du, gom) : []), [du, gom]);

  const noi = useNoi<The>();
  // ô số: bấm = mở ngay (điện thoại), rê chuột = mở sau trễ chung (máy tính) — một khuôn thẻ nổi của etp
  const oSo = (k: string, ds: HangLog[] | undefined, nhan: string) => { const n = ds?.length ?? 0;
    if (!n) return <span style={{ color: MO_SO }}>0</span>;
    const t: The = { k, nhan, ds: ds! };
    return <span role="button" tabIndex={0} onClick={(e) => noi.moNgay(t, e)} onMouseEnter={(e) => noi.mo(t, e)} onMouseLeave={noi.dongTre}
      style={{ cursor: 'pointer', fontWeight: 600, color: LOAI_THEO_K[k]?.bao ? DO : undefined, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{n}</span>; };
  const cong = (rows: KhungLog[], k: string) => rows.flatMap((x) => x.dem[k] ?? []);

  const cot: DataColumn<KhungLog>[] = [
    { key: 'khung', header: '🕒 Khung (giờ VN)', align: 'left', cell: (x) => nhanKhung(x.t, gom), sortValue: (x) => x.t, total: () => <b>Cả {tenKy(ky)}</b> },
    { key: 'chi', header: 'Chi', title: gom < 60 ? 'chi / thu nhà chỉ có theo giờ — khung dưới 1 giờ: cả giờ cộng vào khung đầu giờ' : 'chi nhà trong khung', cell: (x) => x.coTien ? <KeToan v={x.chi} /> : null, sortValue: (x) => x.chi, total: (r) => <KeToan v={r.reduce((a, x) => a + x.chi, 0)} /> },
    { key: 'thu', header: 'Thu', cell: (x) => x.coTien ? <KeToan v={x.thu} /> : null, sortValue: (x) => x.thu, total: (r) => <KeToan v={r.reduce((a, x) => a + x.thu, 0)} /> },
    { key: 'lai', header: 'Lãi', cell: (x) => x.coTien ? <KeToan v={x.thu - x.chi} mau={mauLai(x.thu - x.chi)} /> : null, sortValue: (x) => x.thu - x.chi,
      total: (r) => { const v = r.reduce((a, x) => a + x.thu - x.chi, 0); return <KeToan v={v} mau={mauLai(v)} />; } },
    ...LOAI_LOG.map((l): DataColumn<KhungLog> => ({ key: l.k, group: l.nhom, header: `${l.icon} ${l.ten}`, align: 'right',
      cell: (x) => oSo(l.k, x.dem[l.k], nhanKhung(x.t, gom)), sortValue: (x) => x.dem[l.k]?.length ?? 0,
      total: (r) => oSo(l.k, cong(r, l.k), `cả ${tenKy(ky)}`) })),
  ];

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: 'var(--fg-2)' }}>📅 Kỳ</span>
        <Segmented options={KY_GIO.map((h) => ({ value: h, label: tenKy(h) }))} value={ky} onChange={(v) => { setKy(v); ghiUrl(U_KY, v, MAC_KY); }} /></span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: 'var(--fg-2)' }}>🧮 Gom theo</span>
        <Segmented options={KHUNG_PHUT.map((p) => ({ value: p, label: tenKhung(p) }))} value={gom} onChange={(v) => { setGom(v); ghiUrl(U_GOM, v, MAC_GOM); }} /></span>
      <button type="button" onClick={() => void tai(ky)} disabled={dangTai} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'inherit', cursor: dangTai ? 'wait' : 'pointer' }}>
        {dangTai ? '⏳ Đang tải…' : '↻ Tải lại'}</button>
      {du ? <span style={{ color: 'var(--fg-3)' }} title="tự tải lại mỗi phút">cập nhật {gioVn(du.den)}</span> : null}
    </div>
    {loi ? <div style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${DO}`, color: DO, fontSize: 12 }}>⛔ {loi}</div> : null}
    {!du && !loi ? <div style={{ padding: 16, color: 'var(--fg-2)', fontSize: 12 }}>⏳ Đang tải nhật ký…</div> : null}
    {du ? <DataTable rows={hang} columns={cot} groups={NHOM_LOG.map((g) => ({ ...g }))} groupHeader getRowKey={(x) => String(x.t)} persistKey="etp-logs" minWidth={1200}
      defaultSort={[{ key: 'khung', dir: 'desc' }]} locTuDong={false} /> : null}
    {noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={460} cao={420} noi={noi}>
      <div style={{ width: 460, maxWidth: '92vw', padding: '10px 32px 10px 12px', fontSize: 12 }}>
        <div style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
          <b style={{ fontSize: 13, color: LOAI_THEO_K[noi.v.k]?.bao ? DO : undefined }}>{LOAI_THEO_K[noi.v.k]?.icon} {LOAI_THEO_K[noi.v.k]?.ten} · {noi.v.ds.length}</b>
          <span style={{ color: 'var(--fg-2)', marginLeft: 6 }}>{noi.v.nhan}</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {noi.v.ds.slice(0, 300).map((e, i) => <div key={i} style={{ lineHeight: 1.35 }}>
            <span style={{ color: 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>{gioVn(e[0])}</span>
            {e[2] != null ? <b style={{ marginLeft: 6 }}>{maCua(e[1], e[2])}</b> : null}
            {e[3] ? <div style={{ color: 'var(--fg-2)', wordBreak: 'break-word' }}>{e[3]}</div> : null}</div>)}
          {noi.v.ds.length > 300 ? <div style={{ color: 'var(--fg-3)' }}>… còn {noi.v.ds.length - 300} việc — chọn khung gom nhỏ hơn để xem hết</div> : null}
        </div>
      </div>
    </KhungNoi> : null}
  </div>;
}
