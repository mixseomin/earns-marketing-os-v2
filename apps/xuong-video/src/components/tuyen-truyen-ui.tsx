'use client';
// BẢNG TUYẾN + SỔ GÀI / TRẢ (tab 📖 Phim › Tuyến truyện · Gài / trả). Sổ của phòng biên kịch: hàng là tập, cột là tuyến A/B/C; sổ gài / trả
// ghi chi tiết gieo ở tập nào, trả ở tập nào. Luật + trộn AI: lib/xuong-video/tuyen-truyen.ts. Sửa tại chỗ, tự lưu 1,2 giây sau lần gõ cuối.
import { useEffect, useMemo, useRef, useState } from 'react';
import { suaPhim, aiTuyenTruyen } from '@/lib/actions';
import { gioVN, type GaiTra, type Phim, type Series } from '@/lib/xuong-video/kieu';
import { dsTap, trangThaiGaiTra, tuyenVang, tronAi } from '@/lib/xuong-video/tuyen-truyen';
import { Chon } from './chon';
import { Den, Menu, MucMenu, Nut, Seg, Loi, mono, goiAction } from './ui';
import { useNho } from './nho';

const taoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Bản sửa tại chỗ của kinh_thanh.series: đồng bộ theo NỘI DUNG khi không đang sửa dở (ngăn phim tự làm mới định kỳ), tự lưu sau 1,2 giây. */
export function useSoSeries(phim: Phim, onChanged: () => Promise<void>) {
  const gocJson = JSON.stringify(phim.kinh_thanh?.series ?? null);
  const goc = useMemo(() => JSON.parse(gocJson) as Series | null, [gocJson]);
  const [s, setS] = useState<Series | null>(goc);
  const dirty = JSON.stringify(s) !== gocJson;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  useEffect(() => { if (!dirtyRef.current) setS(goc); }, [goc]);
  const phimRef = useRef(phim); phimRef.current = phim;
  const [luuLuc, setLuuLuc] = useState('');
  const [loi, setLoi] = useState('');
  useEffect(() => {
    if (!dirty || !s) return;
    const t = setTimeout(async () => {
      const p = phimRef.current;
      const r = await goiAction(() => suaPhim(p.id, { kinh_thanh: { ...p.kinh_thanh, series: s } }));
      setLoi(r.loi);
      if (r.loi) return;
      setLuuLuc(gioVN(new Date(), { giay: true, chiGio: true }));
      await onChanged();
    }, 1200);
    return () => clearTimeout(t);
  }, [s, dirty, onChanged]);
  return { s, setS, luuLuc, loi };
}

/** ✨ AI rút tuyến + gài/trả từ bản đồ tập → trộn vào sổ, chỉ điền chỗ trống (không đè chữ đã gõ). */
export function NutAiTuyen({ phimId, s, setS }: { phimId: number; s: Series; setS: (s: Series) => void }) {
  const [ban, setBan] = useState(false);
  const [loi, setLoi] = useState('');
  const chay = async () => {
    setBan(true); setLoi('');
    const r = await goiAction(() => aiTuyenTruyen(phimId));
    setBan(false);
    if (r.loi || !r.kq || !('data' in r.kq) || !r.kq.data) { setLoi(r.loi || 'AI không trả kết quả'); return; }
    setS(tronAi(s, r.kq.data, taoId));
  };
  return <>
    <Nut ban={ban} title="Claude đọc động cơ + bản đồ tập (logline, ô gài/trả) rồi đề xuất tuyến, sự kiện từng tập và sổ gài / trả — chỉ điền ô đang trống, không đè chữ đã gõ. Dùng model chữ của phim; ước ~1.800₫ một lượt theo giá chính hãng (Opus, phim 10 tập), đi cổng rẻ trước (ckey) nên thường thấp hơn." onClick={() => void chay()}>{ban ? '… AI đang đọc bản đồ' : '✨ AI rút từ bản đồ'}</Nut>
    <Loi>{loi}</Loi>
  </>;
}

/** Bảng tuyến: hàng = tập (một dòng), cột = tuyến. Ô vàng mép trái = tuyến vắng ≥ 3 tập liền kể từ lần đầu xuất hiện. */
export function BangTuyen({ s, setS }: { s: Series; setS: (s: Series) => void }) {
  const tap = dsTap(s); const tuyen = s.tuyen ?? [];
  const vang = tuyenVang(s);
  const vangO = (ma: string, so: number) => vang.find((v) => v.ma === ma && so >= v.tu && so <= v.den);
  const nhieuMua = new Set(tap.map((t) => t.mua ?? 1)).size > 1;
  const tenMua = (n: number) => s.mua?.find((m) => m.so === n)?.ten ?? `Mùa ${n}`;
  const themTuyen = () => { const ma = 'ABCDEFGHIJ'.split('').find((c) => !tuyen.some((t) => t.ma === c)); if (ma) setS({ ...s, tuyen: [...tuyen, { ma, ten: '' }] }); };
  const doiTen = (ma: string, ten: string) => setS({ ...s, tuyen: tuyen.map((t) => (t.ma === ma ? { ...t, ten } : t)) });
  const boTuyen = (ma: string) => setS({ ...s, tuyen: tuyen.filter((t) => t.ma !== ma), tap: s.tap.map((t) => { if (!t.su_kien?.[ma]) return t; const { [ma]: _, ...con } = t.su_kien; return { ...t, su_kien: con }; }) });
  const ghi = (so: number, ma: string, viec: string) => setS({ ...s, tap: s.tap.map((t) => (t.so === so ? { ...t, su_kien: { ...(t.su_kien ?? {}), [ma]: viec } } : t)) });
  return (
    <table className="xv-tbl dinh">
      <thead><tr>
        <th style={{ width: 190 }}>Tập</th>
        {tuyen.map((t) => <th key={t.ma} title={`Tuyến ${t.ma}: ${tap.filter((x) => x.su_kien?.[t.ma]?.trim()).length}/${tap.length} tập có sự kiện`}>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <b style={{ color: 'var(--fg-2)' }}>{t.ma}</b>
            <input className="xv-o-sua" style={{ textTransform: 'none', fontFamily: 'inherit' }} value={t.ten} placeholder={t.ma === 'A' ? 'tuyến chính…' : 'tuyến phụ…'} onChange={(e) => doiTen(t.ma, e.target.value)} />
            <Menu rong={190}><MucMenu nguy goiY="Bỏ cột tuyến này cùng mọi sự kiện đã ghi trong cột" onClick={() => boTuyen(t.ma)}>🗑 Bỏ tuyến {t.ma}</MucMenu></Menu>
          </span>
        </th>)}
        <th style={{ width: 90 }}><button type="button" className="xv-btn" title="Thêm một tuyến (cột) — A là tuyến chính, B/C là tuyến phụ" onClick={themTuyen}>+ Tuyến</button></th>
      </tr></thead>
      <tbody>
        {tap.map((t, i) => <FragmentTap key={t.so} dauMua={nhieuMua && (i === 0 || (tap[i - 1]!.mua ?? 1) !== (t.mua ?? 1)) ? tenMua(t.mua ?? 1) : ''} cot={tuyen.length + 2}>
          <tr>
            <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }} title={`${t.ten}\n${t.logline}`}><span style={mono}>{t.so}</span> {t.ten}</td>
            {tuyen.map((x) => { const v = vangO(x.ma, t.so); return (
              <td key={x.ma} className={v ? 'vang' : undefined} title={v ? `Tuyến ${x.ma} vắng ${v.n} tập liền (tập ${v.tu}–${v.den}) — người xem quên tuyến này` : undefined}>
                <input className="xv-o-sua" value={t.su_kien?.[x.ma] ?? ''} placeholder="—" onChange={(e) => ghi(t.so, x.ma, e.target.value)} />
              </td>); })}
            <td />
          </tr>
        </FragmentTap>)}
      </tbody>
    </table>
  );
}
function FragmentTap({ dauMua, cot, children }: { dauMua: string; cot: number; children: React.ReactNode }) {
  return <>{dauMua && <tr><td colSpan={cot} style={{ ...mono, paddingTop: 10 }}>{dauMua}</td></tr>}{children}</>;
}

type LocGt = 'tat_ca' | 'treo' | 'sai';
/** Sổ gài / trả: đèn (xanh đã trả · cam còn treo · đỏ ghi sai) · chi tiết · tập gieo · tập trả. Lọc theo trạng thái, xếp theo tập gieo. */
export function SoGaiTra({ s, setS }: { s: Series; setS: (s: Series) => void }) {
  const [loc, setLoc] = useNho<LocGt>('xv-gt-loc', 'tat_ca', ['tat_ca', 'treo', 'sai'], 'gt');
  const so = s.so_gai_tra ?? [];
  const tt = (g: GaiTra) => trangThaiGaiTra(s, g);
  const dem = { treo: so.filter((g) => g.chi_tiet.trim() && tt(g).muc === 'treo').length, sai: so.filter((g) => g.chi_tiet.trim() && tt(g).muc === 'loi').length };
  const hien = so.filter((g) => loc === 'tat_ca' || (g.chi_tiet.trim() && tt(g).muc === (loc === 'treo' ? 'treo' : 'loi'))).sort((a, b) => a.gieo - b.gieo || (a.tra ?? 1e9) - (b.tra ?? 1e9));
  const tap = dsTap(s);
  const tenMua = (n: number) => s.mua?.find((m) => m.so === n)?.ten ?? `Mùa ${n}`;
  const lcTap = tap.map((t) => ({ value: String(t.so), label: `Tập ${t.so} · ${t.ten}`, ngan: `Tập ${t.so}`, nhom: tenMua(t.mua ?? 1) }));
  const sua = (id: string, p: Partial<GaiTra>) => setS({ ...s, so_gai_tra: so.map((g) => (g.id === id ? { ...g, ...p } : g)) });
  const them = () => setS({ ...s, so_gai_tra: [...so, { id: taoId(), chi_tiet: '', gieo: tap[0]?.so ?? 1, tra: null }] });
  return <>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
      <Seg value={loc} onChange={setLoc} options={[
        { value: 'tat_ca', label: 'Tất cả', title: `${so.length} chi tiết` },
        { value: 'treo', label: 'Còn treo', title: `${dem.treo} chi tiết chưa có tập trả — tập cuối mùa sẽ bị chặn sinh keyframe tới khi trả` },
        { value: 'sai', label: 'Ghi sai', title: `${dem.sai} chi tiết ghi sai (trả trước khi gieo, tập không có trong bản đồ)` },
      ]} />
      <button type="button" className="xv-btn" style={{ marginLeft: 'auto' }} title="Thêm một chi tiết gài" onClick={them}>+ Chi tiết</button>
    </div>
    <table className="xv-tbl dinh">
      <thead><tr><th style={{ width: 22 }} /><th>Chi tiết được gài</th><th style={{ width: 130 }}>Gieo ở</th><th style={{ width: 130 }}>Trả ở</th><th style={{ width: 34 }} /></tr></thead>
      <tbody>
        {hien.map((g) => { const t = tt(g); return (
          <tr key={g.id}>
            <td><Den muc={!g.chi_tiet.trim() ? 'tat' : t.muc === 'da_tra' ? 'ok' : t.muc === 'treo' ? 'cho' : 'loi'} title={g.chi_tiet.trim() ? t.ghi : 'chưa ghi chi tiết'} /></td>
            <td><input className="xv-o-sua" value={g.chi_tiet} placeholder="vd: chìa khoá đồng trong túi áo bà" onChange={(e) => sua(g.id, { chi_tiet: e.target.value })} /></td>
            <td><Chon nho minWidth={120} value={String(g.gieo)} options={lcTap} onChange={(v) => sua(g.id, { gieo: Number(v) })} /></td>
            <td><Chon nho minWidth={120} value={g.tra == null ? '' : String(g.tra)} placeholder="chưa trả" options={[{ value: '', label: 'Chưa trả', ngan: 'chưa trả' }, ...lcTap]} onChange={(v) => sua(g.id, { tra: v ? Number(v) : null })} /></td>
            <td><Menu rong={170}><MucMenu nguy goiY="Bỏ chi tiết này khỏi sổ" onClick={() => setS({ ...s, so_gai_tra: so.filter((x) => x.id !== g.id) })}>🗑 Bỏ chi tiết</MucMenu></Menu></td>
          </tr>); })}
        {!hien.length && <tr><td colSpan={5} style={mono}>{so.length ? 'Không có chi tiết nào ở bộ lọc này.' : <>Sổ trống — <button type="button" className="xv-btn" onClick={them}>+ ghi chi tiết đầu tiên</button> hoặc bấm ✨ AI rút từ bản đồ.</>}</td></tr>}
      </tbody>
    </table>
  </>;
}
