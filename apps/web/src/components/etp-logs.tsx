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
import { khungLuc, KHUNG_TEN } from '@/lib/etp-khung';
import { CHIEU_TK, demTk, locCamp, tenLuat, type DemTk, gioVn, gomLogs, KHUNG_PHUT, KY_GIO, LOAI_LOG, LOAI_THEO_K, NHOM_LOG, nhanKhung, tenKhung, tenKy, type DuLogs, type HangLog, type KhungLog } from '@/lib/etp-logs';

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
function ThongKe({ t, luat }: { t: The; luat?: Record<string, string> }) {
  const l = LOAI_THEO_K[t.k]; if (!l) return null;
  const ds = l.ma === 'camp' ? t.ds.map((e): HangLog => { const c = [...e] as HangLog; c[4] = tenLuat(e[4], luat); return c; }) : t.ds;   // mã luật trơ → tên đầy đủ
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
    {bang(chieu[0], demTk(ds, 4))}{bang(chieu[1], demTk(ds, 5))}
  </div>;
}
// hangLoc = HÀNG LỌC CAMP của trang (Lọc · Lãi/lỗ · Tuổi · Luật · Loại · ROAS · A/B · TK — etp-view dựng, cùng state + URL với trang) · campIds = tập camp sau lọc (null = không lọc)
export function TabLogs({ moCamp, hangLoc, campIds }: { moCamp: (id: number) => void; hangLoc: React.ReactNode; campIds: number[] | null }) {
  const [ky, setKy] = useState(MAC_KY), [gom, setGom] = useState(MAC_GOM);
  useEffect(() => { setKy(docUrl(U_KY, KY_GIO, MAC_KY)); setGom(docUrl(U_GOM, KHUNG_PHUT, MAC_GOM)); }, []);
  const khoaIds = campIds == null ? '' : [...campIds].sort((a, b) => a - b).join(',');   // đổi bộ lọc → tải lại tiền đúng tập camp (mảng mới mỗi lần dựng nên so theo chuỗi)
  const [du, setDu] = useState<DuLogs | null>(null), [loi, setLoi] = useState<string | null>(null), [dangTai, setDangTai] = useState(false);
  const tai = useCallback(async (h: number, ids: number[] | null) => {
    setDangTai(true);
    try { const r = await docLogs(h, ids); if ('loi' in r) setLoi(r.loi); else { setDu(r); setLoi(null); } }
    catch (e) { setLoi(`không tải được nhật ký: ${String((e as Error)?.message ?? e).slice(0, 160)}`); }
    finally { setDangTai(false); }
  }, []);
  useEffect(() => { const ids = khoaIds ? khoaIds.split(',').map(Number) : null; void tai(ky, ids); const id = window.setInterval(() => void tai(ky, ids), 60_000); return () => window.clearInterval(id); }, [ky, khoaIds, tai]);
  const loc = useMemo(() => (du ? locCamp(du, campIds) : null), [du, khoaIds]);   // eslint-disable-line react-hooks/exhaustive-deps
  const hang = useMemo(() => (loc ? gomLogs(loc, gom) : []), [loc, gom]);

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
  const O_COT = 51;
  // BẤM MÃ = NGĂN KÉO tại chỗ (anh 08/11/2026 "Bấm vào thì mở ra drawer để tao ko phải sang tab mới"): camp → ngăn camp của trang; dòng / creative → ngăn Sản xuất của phim
  const moNgan = (e: HangLog): (() => void) | null => { const ma = LOAI_THEO_K[e[1]]?.ma;
    if (ma === 'camp' && e[2] != null) return () => moCamp(e[2]!);
    if ((ma === 'dong' || ma === 'creative') && e[6]) return () => openEntityDrawer('etp-sx', e[6]!);
    return null; };
  const cong = (rows: KhungLog[], k: string) => rows.flatMap((x) => x.dem[k] ?? []);

  // NỀN THEO KHUNG GIỜ MÁY (anh 08/11/2026 "background nền theo khung giờ"): khung tăng 21–7h · nạp sáng 7–15h · giảm · tắt 15–21h — cùng nguồn thanh khung giờ của trang
  // (lib/etp-khung khungLuc + KHUNG_TEN, sổ etp-bang-luat.json khung_doi); khung gom ≥ 6 giờ trùm nhiều khung → không tô
  const khungCua = (t: number) => (gom >= 360 ? null : khungLuc(((t + 7 * 3600 + (gom * 60) / 2) / 3600) % 24));
  const nenKhung = (t: number): React.CSSProperties | undefined => { const k = khungCua(t); return k ? { background: `${KHUNG_TEN[k][2]}1a` } : undefined; };
  const nhanKhungIcon = (t: number) => { const k = khungCua(t); return <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
    {k ? <span title={KHUNG_TEN[k][1]} style={{ color: KHUNG_TEN[k][2], width: 14, textAlign: 'center' }}>{KHUNG_TEN[k][0]}</span> : null}{nhanKhung(t, gom)}</span>; };
  const cot: DataColumn<KhungLog>[] = [
    { key: 'khung', header: '🕒 Khung (giờ VN)', title: 'nền dòng = khung máy tự đổi camp: ⬆ tăng 21–7h · ☀ nạp sáng 7–15h · 🔧 giảm · tắt 15–21h', align: 'left', cell: (x) => nhanKhungIcon(x.t), sortValue: (x) => x.t, total: () => <b>Cả {tenKy(ky)}</b> },
    { key: 'chi', header: 'Chi', title: gom < 60 ? 'chi / thu nhà chỉ có theo giờ — khung dưới 1 giờ: cả giờ cộng vào khung đầu giờ' : 'chi nhà trong khung', cell: (x) => x.coTien ? <KeToan v={x.chi} /> : null, sortValue: (x) => x.chi, total: (r) => <KeToan v={r.reduce((a, x) => a + x.chi, 0)} /> },
    { key: 'thu', header: 'Thu', cell: (x) => x.coTien ? <KeToan v={x.thu} /> : null, sortValue: (x) => x.thu, total: (r) => <KeToan v={r.reduce((a, x) => a + x.thu, 0)} /> },
    { key: 'lai', header: 'Lãi', cell: (x) => x.coTien ? <KeToan v={x.thu - x.chi} mau={mauLai(x.thu - x.chi)} /> : null, sortValue: (x) => x.thu - x.chi,
      total: (r) => { const v = r.reduce((a, x) => a + x.thu - x.chi, 0); return <KeToan v={v} mau={mauLai(v)} />; } },
    ...LOAI_LOG.map((l): DataColumn<KhungLog> => ({ key: l.k, group: l.nhom, title: l.ten, align: 'center', headerAlign: 'center', width: O_COT,
      header: <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15, whiteSpace: 'normal' }}><span style={{ color: l.mau, fontSize: 13 }}>{l.icon}</span><span>{l.ngan}</span></span>,
      cell: (x) => oSo(l.k, x.dem[l.k], nhanKhung(x.t, gom)), sortValue: (x) => x.dem[l.k]?.length ?? 0, total: (r) => oSo(l.k, cong(r, l.k), `cả ${tenKy(ky)}`) })),
  ];

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>{hangLoc}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: 'var(--fg-2)' }}>📅 Kỳ</span>
        <Segmented options={KY_GIO.map((h) => ({ value: h, label: tenKy(h) }))} value={ky} onChange={(v) => { setKy(v); ghiUrl(U_KY, v, MAC_KY); }} /></span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ color: 'var(--fg-2)' }}>🧮 Gom theo</span>
        <Segmented options={KHUNG_PHUT.map((p) => ({ value: p, label: tenKhung(p) }))} value={gom} onChange={(v) => { setGom(v); ghiUrl(U_GOM, v, MAC_GOM); }} /></span>
      <button type="button" onClick={() => void tai(ky, khoaIds ? khoaIds.split(',').map(Number) : null)} disabled={dangTai} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'inherit', cursor: dangTai ? 'wait' : 'pointer' }}>
        {dangTai ? '⏳ Đang tải…' : '↻ Tải lại'}</button>
      {du ? <span style={{ color: 'var(--fg-3)' }} title="tự tải lại mỗi phút">cập nhật {gioVn(du.den)}</span> : null}
      {(() => { const cho = (loc?.ev ?? []).filter((e) => e[1] === 'cho'); const l = LOAI_THEO_K.cho!;
        return cho.length ? <span role="button" tabIndex={0} onClick={(e) => noi.moNgay({ k: 'cho', nhan: 'đang chờ', ds: cho }, e)} onMouseEnter={(e) => noi.mo({ k: 'cho', nhan: 'đang chờ', ds: cho }, e)} onMouseLeave={noi.dongTre}
          title="camp đã lên, chưa tới giờ hẹn — bấm xem từng camp" style={{ cursor: 'pointer', padding: '1px 8px', borderRadius: 10, color: l.mau, background: `${l.mau}1f`, border: `1px solid ${l.mau}55`, fontWeight: 600 }}>
          ⏳ {cho.length} camp đã lên đang chờ chạy</span> : null; })()}
      {loc?.chuaCamp ? <span style={{ color: 'var(--fg-3)' }} title="chấm / duyệt / dựng creative, dòng mới… xảy ra trước khi lên camp nên không thuộc camp nào — bỏ ra khi đang lọc camp">· đang lọc {campIds?.length} camp · {loc.chuaCamp} việc chưa gắn camp không tính</span> : null}
    </div>
    {loi ? <div style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${DO}`, color: DO, fontSize: 12 }}>⛔ {loi}</div> : null}
    {!du && !loi ? <div style={{ padding: 16, color: 'var(--fg-2)', fontSize: 12 }}>⏳ Đang tải nhật ký…</div> : null}
    {du && hep ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[{ t: -1, nhan: `Cả ${tenKy(ky)}`, dem: Object.fromEntries(LOAI_LOG.map((l) => [l.k, cong(hang, l.k)])), chi: hang.reduce((a, x) => a + x.chi, 0), thu: hang.reduce((a, x) => a + x.thu, 0), coTien: true },
        ...hang.map((x) => ({ ...x, nhan: nhanKhung(x.t, gom) }))].map((x) => <div key={x.t} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12, background: x.t < 0 ? 'rgba(255,255,255,.04)' : nenKhung(x.t)?.background }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><b style={{ fontVariantNumeric: 'tabular-nums' }}>{x.t < 0 ? x.nhan : nhanKhungIcon(x.t)}</b>
          {x.coTien ? <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}><b style={{ color: mauLai(x.thu - x.chi) }}>{x.thu - x.chi < 0 ? '−' : ''}${Math.abs(x.thu - x.chi).toFixed(2)}</b>
            <span style={{ color: 'var(--fg-3)' }}> · chi ${x.chi.toFixed(2)} · thu ${x.thu.toFixed(2)}</span></span> : null}</div>
        {NHOM_LOG.filter((g) => g.key !== 'khac').map((g) => { const co = LOAI_LOG.filter((l) => l.nhom === g.key && (x.dem[l.k]?.length ?? 0) > 0);
          return co.length ? <div key={g.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3, marginTop: 4 }}>
            <span style={{ color: 'var(--fg-3)', width: 64, flex: 'none' }}>{g.label}</span>
            {co.map((l) => oSo(l.k, x.dem[l.k], x.nhan))}</div> : null; })}
      </div>)}
    </div> : null}
    {du && !hep ? <DataTable rows={hang} columns={cot} groups={NHOM_LOG.map((g) => ({ ...g }))} groupHeader getRowKey={(x) => String(x.t)} rowStyle={(x) => nenKhung(x.t)} persistKey="etp-logs-cot" minWidth={0}
      defaultSort={[{ key: 'khung', dir: 'desc' }]} locTuDong={false} /> : null}
    {/* thẻ nổi nằm TRÊN ngăn kéo Logs (ngăn z ≥ 300; khuôn chung z 60 thì bị ngăn che, bấm mã không được) */}
    {noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={460} cao={420} noi={noi} style={{ zIndex: 2000 }}>
      {/* THẺ NỔI GIẢI THÍCH (anh 08/11/2026 "mày phải giải thích chi tiết khi hover vào" · "trình bày như đầu buồi"): đầu thẻ = câu giải thích loại việc;
          thống kê gom theo luật / lệnh đầy đủ (bỏ ngày, mã luật dịch ra tên); mỗi việc chia ô: giờ · mã · thay đổi · ai làm / tên camp / lý do (giống việc trên thì không lặp) */}
      {(() => { const v = noi.v!, l = LOAI_THEO_K[v.k]; return <div style={{ width: 480, maxWidth: '92vw', padding: '10px 32px 10px 12px', fontSize: 12 }}>
        <div style={{ marginBottom: 6 }}>
          <b style={{ fontSize: 14, color: l?.mau }}>{l?.icon} {l?.ten} · {v.ds.length}</b>
          <span style={{ color: 'var(--fg-2)', marginLeft: 6 }}>{v.nhan}</span></div>
        {l?.giai ? <div style={{ color: 'var(--fg-1)', lineHeight: 1.45, padding: '6px 8px', borderRadius: 6, background: `${l.mau}14`, borderLeft: `3px solid ${l.mau}`, marginBottom: 10 }}>{l.giai}</div> : null}
        <ThongKe t={v} luat={du?.luat} />
        <div style={{ fontWeight: 600, color: 'var(--fg-2)', margin: '2px 0 4px' }}>📋 Từng việc</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {v.ds.slice(0, 300).map((e, i) => { const mo = e[2] != null ? moNgan(e) : null, lyTruoc = i > 0 ? v.ds[i - 1]![3] : null;
            return <div key={i} style={{ padding: '6px 0', borderTop: i ? '1px solid var(--line)' : undefined, lineHeight: 1.4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>{gioVn(e[0])}</span>
                {e[2] != null ? (mo
                  ? <a role="button" onClick={() => { noi.dong(); mo(); }} title={l?.ma === 'camp' ? 'mở ngăn camp' : 'mở ngăn sản xuất của phim'} style={{ fontWeight: 700, cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{maCua(e[1], e[2])}</a>
                  : <b>{maCua(e[1], e[2])}</b>) : null}
                {e[9] ? <span style={{ padding: '0 6px', borderRadius: 10, color: l?.mau, background: `${l?.mau}1f`, border: `1px solid ${l?.mau}55`, fontWeight: 600, whiteSpace: 'nowrap' }}>{e[9]}</span> : null}
                {e[7] ? <span style={{ color: 'var(--fg-3)' }}>bộ {e[7]}</span> : null}
                {e[10] ? <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>· {e[10]}</span> : null}
                {e[6] ? <a role="button" onClick={() => { noi.dong(); openEntityDrawer('etp-phim', e[6]!); }} title="mở ngăn phim" style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--fg-2)' }}>🎬 phim</a> : null}
              </div>
              {e[8] ? <div style={{ color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e[8]}>{e[8]}</div> : null}
              {e[3] && e[3] !== lyTruoc ? <div style={{ color: 'var(--fg-2)', wordBreak: 'break-word' }}><span style={{ color: 'var(--fg-3)' }}>Lý do: </span>{e[3]}</div> : null}
            </div>; })}
          {v.ds.length > 300 ? <div style={{ color: 'var(--fg-3)', paddingTop: 6 }}>… còn {v.ds.length - 300} việc — chọn khung gom nhỏ hơn để xem hết</div> : null}
        </div>
      </div>; })()}
    </KhungNoi> : null}
  </div>;
}
