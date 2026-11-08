'use client';
// LOGS — thay "Lên bậc" ở tab Camp (anh 08/11/2026): nhật ký máy nhà gom theo khung 15 phút … 1 ngày (tuỳ chọn); mỗi khung đếm camp mở / tắt / tăng / giảm…,
// creative dựng / chấm qua / trượt / người duyệt, dòng sản xuất, chi / thu nhà. Bấm (điện thoại) hoặc rê chuột vào một ô số → thẻ nổi liệt kê từng việc trong khung đó.
// Số: lib/actions/etp-logs docLogs · loại + gom: lib/etp-logs (bài tự kiểm etp-logs.test.mts). Kỳ + khung gom ghi URL (?lgky= ?lggom=), F5 giữ nguyên.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, Segmented, type DataColumn } from '@/components/ui';
import { KhungNoi, useNoi } from '@/components/etp-noi';
import { KeToan, mauLai } from '@/components/etp-so';
import { docLogs } from '@/lib/actions/etp-logs';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { CHIEU_TK, demTk, type DemTk, gioVn, gomLogs, KHUNG_PHUT, KY_GIO, LOAI_LOG, LOAI_THEO_K, NHOM_LOG, nhanKhung, tenKhung, tenKy, type DuLogs, type HangLog, type KhungLog } from '@/lib/etp-logs';

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
// THỐNG KÊ ĐẦU THẺ (anh 08/11/2026 "hiện kiểu hover, pop + có thống kê trước khi hiện chi tiết danh sách ở dưới"): số khác nhau + hai chiều gom
// (camp: luật · bậc — dòng: dạng · lý do — creative: dạng · tiêu chí), mỗi nhóm một thanh tỉ lệ trung tính; danh sách từng việc nằm dưới
const TEN_MA: Record<string, string> = { camp: 'camp', dong: 'dòng', creative: 'creative' };
function ThongKe({ t }: { t: The }) {
  const l = LOAI_THEO_K[t.k]; if (!l) return null;
  const khac = new Set(t.ds.map((e) => e[2]).filter((x) => x != null)).size, chieu = CHIEU_TK[t.k] ?? CHIEU_TK[l.ma] ?? ['Nhóm 1', 'Nhóm 2'];
  const bang = (ten: string, ds: DemTk[]) => ds.length ? <div style={{ marginBottom: 8 }}>
    <div style={{ fontWeight: 600, color: 'var(--fg-2)', marginBottom: 3 }}>{ten}</div>
    {ds.map((x) => <div key={x.ten} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 72px 34px', alignItems: 'center', gap: 6, lineHeight: '18px' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.ten}>{x.ten}</span>
      <span style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((x.n / t.ds.length) * 100)}%`, background: 'var(--fg-3)' }} /></span>
      <b style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{x.n}</b></div>)}
  </div> : null;
  return <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
    <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
      <span><b style={{ fontSize: 15 }}>{t.ds.length}</b> <span style={{ color: 'var(--fg-2)' }}>việc</span></span>
      {khac ? <span><b style={{ fontSize: 15 }}>{khac}</b> <span style={{ color: 'var(--fg-2)' }}>{TEN_MA[l.ma]} khác nhau</span></span> : null}
    </div>
    {bang(chieu[0], demTk(t.ds, 4))}{bang(chieu[1], demTk(t.ds, 5))}
  </div>;
}
export function TabLogs({ moCamp }: { moCamp: (id: number) => void }) {
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

  // KHỔ HẸP (điện thoại): bảng 7 cột không vừa 390px → mỗi khung một THẺ (giờ + lãi, rồi mỗi nhóm một hàng ô icon + số) — cùng dữ liệu, cùng thẻ nổi khi bấm
  const [hep, setHep] = useState(false);
  useEffect(() => { const m = window.matchMedia('(max-width: 700px)'); const f = () => setHep(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  const noi = useNoi<The>();
  // ô số: bấm = mở ngay (điện thoại), rê chuột = mở sau trễ chung (máy tính) — một khuôn thẻ nổi của etp
  // NHÃN ICON + SỐ CÓ MÀU (anh 08/11/2026 "Nhìn toàn số cũng đéo hiểu ngay được, phải nhìn vào cột. Cột lại toàn icon. Dùng icon + màu sắc để cho rõ ràng"):
  // mỗi số đi cùng icon + màu của loại (LOAI_LOG.mau) → đọc ngay "⏹ 30" đỏ là 30 camp tắt, không dò tiêu đề; số 0 không hiện; rê / bấm → thẻ nổi
  const oSo = (k: string, ds: HangLog[] | undefined, nhan: string) => { const n = ds?.length ?? 0, l = LOAI_THEO_K[k];
    if (!n || !l) return null;
    const t: The = { k, nhan, ds: ds! };
    return <span key={k} role="button" tabIndex={0} title={`${l.ten}: ${n}`} onClick={(e) => noi.moNgay(t, e)} onMouseEnter={(e) => noi.mo(t, e)} onMouseLeave={noi.dongTre}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0 6px', borderRadius: 10, lineHeight: '18px', cursor: 'pointer', whiteSpace: 'nowrap',
        color: l.mau, background: `${l.mau}1f`, border: `1px solid ${l.mau}55`, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}><span>{l.icon}</span>{n}</span>; };
  // MỖI LOẠI MỘT CỘT HẸP (anh 08/11/2026 "màu thế ok rồi, nhưng để vào từng cột cho cân đối"): nhãn màu nằm giữa ô, cột rộng O_COT, tiêu đề = icon màu + tên ngắn hai dòng
  // → 18 cột + khung + tiền vừa ngăn 1400px, không cuộn ngang (anh: "Trình bày drawer làm sao ko phải scroll sang ngang"); điện thoại dùng thẻ (khổ hẹp) bên dưới
  const O_COT = 54;
  // BẤM MÃ = NGĂN KÉO tại chỗ (anh 08/11/2026 "Bấm vào thì mở ra drawer để tao ko phải sang tab mới"): camp → ngăn camp của trang; dòng / creative → ngăn Sản xuất của phim
  const moNgan = (e: HangLog): (() => void) | null => { const ma = LOAI_THEO_K[e[1]]?.ma;
    if (ma === 'camp' && e[2] != null) return () => moCamp(e[2]!);
    if ((ma === 'dong' || ma === 'creative') && e[6]) return () => openEntityDrawer('etp-sx', e[6]!);
    return null; };
  const cong = (rows: KhungLog[], k: string) => rows.flatMap((x) => x.dem[k] ?? []);

  const cot: DataColumn<KhungLog>[] = [
    { key: 'khung', header: '🕒 Khung (giờ VN)', align: 'left', cell: (x) => nhanKhung(x.t, gom), sortValue: (x) => x.t, total: () => <b>Cả {tenKy(ky)}</b> },
    { key: 'chi', header: 'Chi', title: gom < 60 ? 'chi / thu nhà chỉ có theo giờ — khung dưới 1 giờ: cả giờ cộng vào khung đầu giờ' : 'chi nhà trong khung', cell: (x) => x.coTien ? <KeToan v={x.chi} /> : null, sortValue: (x) => x.chi, total: (r) => <KeToan v={r.reduce((a, x) => a + x.chi, 0)} /> },
    { key: 'thu', header: 'Thu', cell: (x) => x.coTien ? <KeToan v={x.thu} /> : null, sortValue: (x) => x.thu, total: (r) => <KeToan v={r.reduce((a, x) => a + x.thu, 0)} /> },
    { key: 'lai', header: 'Lãi', cell: (x) => x.coTien ? <KeToan v={x.thu - x.chi} mau={mauLai(x.thu - x.chi)} /> : null, sortValue: (x) => x.thu - x.chi,
      total: (r) => { const v = r.reduce((a, x) => a + x.thu - x.chi, 0); return <KeToan v={v} mau={mauLai(v)} />; } },
    ...LOAI_LOG.map((l): DataColumn<KhungLog> => ({ key: l.k, group: l.nhom, title: l.ten, align: 'center', headerAlign: 'center', width: O_COT,
      header: <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15, whiteSpace: 'normal' }}><span style={{ color: l.mau, fontSize: 13 }}>{l.icon}</span><span>{l.ngan}</span></span>,
      cell: (x) => oSo(l.k, x.dem[l.k], nhanKhung(x.t, gom)), sortValue: (x) => x.dem[l.k]?.length ?? 0, total: (r) => oSo(l.k, cong(r, l.k), `cả ${tenKy(ky)}`) })),
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
    {du && hep ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[{ t: -1, nhan: `Cả ${tenKy(ky)}`, dem: Object.fromEntries(LOAI_LOG.map((l) => [l.k, cong(hang, l.k)])), chi: hang.reduce((a, x) => a + x.chi, 0), thu: hang.reduce((a, x) => a + x.thu, 0), coTien: true },
        ...hang.map((x) => ({ ...x, nhan: nhanKhung(x.t, gom) }))].map((x) => <div key={x.t} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12, background: x.t < 0 ? 'rgba(255,255,255,.04)' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><b style={{ fontVariantNumeric: 'tabular-nums' }}>{x.nhan}</b>
          {x.coTien ? <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}><b style={{ color: mauLai(x.thu - x.chi) }}>{x.thu - x.chi < 0 ? '−' : ''}${Math.abs(x.thu - x.chi).toFixed(2)}</b>
            <span style={{ color: 'var(--fg-3)' }}> · chi ${x.chi.toFixed(2)} · thu ${x.thu.toFixed(2)}</span></span> : null}</div>
        {NHOM_LOG.filter((g) => g.key !== 'khac').map((g) => { const co = LOAI_LOG.filter((l) => l.nhom === g.key && (x.dem[l.k]?.length ?? 0) > 0);
          return co.length ? <div key={g.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3, marginTop: 4 }}>
            <span style={{ color: 'var(--fg-3)', width: 64, flex: 'none' }}>{g.label}</span>
            {co.map((l) => oSo(l.k, x.dem[l.k], x.nhan))}</div> : null; })}
      </div>)}
    </div> : null}
    {du && !hep ? <DataTable rows={hang} columns={cot} groups={NHOM_LOG.map((g) => ({ ...g }))} groupHeader getRowKey={(x) => String(x.t)} persistKey="etp-logs-cot" minWidth={0}
      defaultSort={[{ key: 'khung', dir: 'desc' }]} locTuDong={false} /> : null}
    {/* thẻ nổi nằm TRÊN ngăn kéo Logs (ngăn z ≥ 300; khuôn chung z 60 thì bị ngăn che, bấm mã không được) */}
    {noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={460} cao={420} noi={noi} style={{ zIndex: 2000 }}>
      <div style={{ width: 460, maxWidth: '92vw', padding: '10px 32px 10px 12px', fontSize: 12 }}>
        <div style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--line)' }}>
          <b style={{ fontSize: 13, color: LOAI_THEO_K[noi.v.k]?.mau }}>{LOAI_THEO_K[noi.v.k]?.icon} {LOAI_THEO_K[noi.v.k]?.ten} · {noi.v.ds.length}</b>
          <span style={{ color: 'var(--fg-2)', marginLeft: 6 }}>{noi.v.nhan}</span></div>
        <ThongKe t={noi.v} />
        <div style={{ fontWeight: 600, color: 'var(--fg-2)', margin: '2px 0 6px' }}>📋 Chi tiết</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {noi.v.ds.slice(0, 300).map((e, i) => <div key={i} style={{ lineHeight: 1.35 }}>
            <span style={{ color: 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>{gioVn(e[0])}</span>
            {e[2] != null ? (() => { const mo = moNgan(e); return mo
              ? <a role="button" onClick={() => { noi.dong(); mo(); }} title={LOAI_THEO_K[e[1]]?.ma === 'camp' ? 'mở ngăn camp' : 'mở ngăn sản xuất của phim'} style={{ marginLeft: 6, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{maCua(e[1], e[2])}</a>
              : <b style={{ marginLeft: 6 }}>{maCua(e[1], e[2])}</b>; })() : null}
            {e[6] ? <a role="button" onClick={() => { noi.dong(); openEntityDrawer('etp-phim', e[6]!); }} title="mở ngăn phim" style={{ marginLeft: 6, cursor: 'pointer', color: 'var(--fg-2)' }}>🎬 phim</a> : null}
            {e[3] ? <div style={{ color: 'var(--fg-2)', wordBreak: 'break-word' }}>{e[3]}</div> : null}</div>)}
          {noi.v.ds.length > 300 ? <div style={{ color: 'var(--fg-3)' }}>… còn {noi.v.ds.length - 300} việc — chọn khung gom nhỏ hơn để xem hết</div> : null}
        </div>
      </div>
    </KhungNoi> : null}
  </div>;
}
