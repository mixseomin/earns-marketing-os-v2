'use client';
// BẢNG TUYẾN + SỔ GÀI / TRẢ (tab 📖 Phim › Tuyến truyện · Gài / trả). Sổ của phòng biên kịch: hàng là tập, cột là tuyến A/B/C; sổ gài / trả
// ghi chi tiết gieo ở tập nào, trả ở tập nào. Luật + trộn AI: lib/xuong-video/tuyen-truyen.ts. Sửa tại chỗ, tự lưu 1,2 giây sau lần gõ cuối.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { suaPhim, aiTuyenTruyen, aiThemTap, aiSapKhung } from '@/lib/actions';
import { gioVN, type GaiTra, type Phim, type Series } from '@/lib/xuong-video/kieu';
import { dsTap, trangThaiGaiTra, tuyenVang, tronAi } from '@/lib/xuong-video/tuyen-truyen';
import { doiKhung, type KhungTuyen } from '@/lib/xuong-video/khung-tuyen';
import { Chon } from './chon';
import { Den, Menu, MucMenu, Nut, Seg, Loi, mono, goiAction } from './ui';
import { useNho } from './nho';

/** Ô chữ TỰ GIÃN theo nội dung — chữ luôn hiện đủ, không bị cắt ở 2 dòng (anh 31/10/2026: "chữ phải rõ ra, đéo đọc được"). */
function ODai({ value, onChange, placeholder, autoFocus, onBlur, dam }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; onBlur?: () => void; dam?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; }, [value]);
  return <textarea ref={ref} className="xv-o-sua" rows={1} autoFocus={autoFocus} onBlur={onBlur} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
    style={{ resize: 'none', overflow: 'hidden', fontSize: 13, lineHeight: 1.45, color: 'var(--fg-1)', fontWeight: dam ? 600 : 400 }} />;
}

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
  return { s, setS, luuLuc, loi, dirty };
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

/** ＋ Viết tiếp tập: AI nối N tập vào bản đồ (sự kiện từng tuyến, gài mới, trả chi tiết treo), ghi thẳng máy chủ rồi tải lại.
 *  Khoá khi sổ đang có chữ chưa lưu — tự lưu xong mới viết, kẻo bản đang gõ đè mất các tập mới. */
export function NutThemTap({ phimId, dangSua, onChanged }: { phimId: number; dangSua: boolean; onChanged: () => Promise<void> }) {
  const [n, setN] = useState(5);
  const [ban, setBan] = useState(false);
  const [kq, setKq] = useState('');
  const chay = async () => {
    setBan(true); setKq('');
    const r = await goiAction(() => aiThemTap(phimId, n));
    setBan(false);
    if (r.loi) { setKq(r.loi); return; }
    const them = r.kq && 'data' in r.kq ? (r.kq.data as number[]) : [];
    setKq(them.length ? `✓ thêm tập ${them[0]}–${them[them.length - 1]}` : '');
    await onChanged();
  };
  return <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
    <Seg value={n} onChange={setN} options={[3, 5, 10].map((x) => ({ value: x, label: String(x), title: `viết tiếp ${x} tập` }))} />
    <Nut ban={ban} ly={dangSua && 'đang lưu chữ vừa gõ — đợi 1 giây'} title="Claude đọc bản đồ + bảng tuyến + sổ gài/trả rồi viết tiếp các tập nối mạch: sự kiện từng tuyến, chi tiết gài mới, trả dần chi tiết đang treo. Tập mới nằm trên bản đồ (chưa tạo), bấm tập trên cây để tạo. Khoảng vài trăm ₫ một lượt qua ckey." onClick={() => void chay()}>{ban ? '… AI đang viết tiếp' : '＋ Viết tiếp tập'}</Nut>
    {kq && <span style={{ ...mono, color: kq.startsWith('✓') ? 'var(--lime)' : 'var(--red)' }}>{kq}</span>}
  </span>;
}

/** 🧩 Sắp theo khung ngành: AI xếp lại làn theo vai ngành của dạng phim, chia lại sự kiện, nêu chi tiết để mở sang tập / mùa sau — ghi thẳng (hoàn tác được). */
export function NutSapKhung({ phimId, khung, dangSua, onChanged }: { phimId: number; khung: KhungTuyen | null; dangSua: boolean; onChanged: () => Promise<void> }) {
  const [ban, setBan] = useState(false);
  const [kq, setKq] = useState('');
  const chay = async () => {
    setBan(true); setKq('');
    const r = await goiAction(() => aiSapKhung(phimId));
    setBan(false);
    if (r.loi) { setKq(r.loi); return; }
    setKq(`✓ sắp xong ${r.kq && 'data' in r.kq ? r.kq.data : ''} tuyến`);
    await onChanged();
  };
  return <>
    <Nut ban={ban} ly={(!khung && 'thể loại phim chưa có khung tuyến ngành trong thư viện') || (dangSua && 'đang lưu chữ vừa gõ — đợi 1 giây')}
      title={khung ? `Claude xếp lại các làn theo khung ngành "${khung.ten}" (${khung.ca_bo[0]}–${khung.ca_bo[1]} tuyến cả bộ), chia lại sự kiện từng tập vào đúng làn, và nêu các chi tiết cố ý để mở sang tập / mùa sau. Hoàn tác được. Khoảng vài trăm ₫ qua ckey.` : undefined}
      onClick={() => void chay()}>{ban ? '… AI đang sắp' : '🧩 Sắp theo khung ngành'}</Nut>
    {kq && <span style={{ ...mono, color: kq.startsWith('✓') ? 'var(--lime)' : 'var(--red)' }}>{kq}</span>}
  </>;
}

/** SƠ ĐỒ LÀN TUYẾN TRUYỆN (anh 31/10/2026: "cái gì trước, cái gì sau? thêm line nối giữa các thành phần"): thời gian chạy TRÁI → PHẢI
 *  (cột = tập, theo thứ tự), mỗi tuyến một LÀN ngang. Sự kiện là thẻ trên làn; các thẻ liên tiếp nối bằng đường có mũi tên. Đoạn tuyến
 *  không có sự kiện = nét đứt (vắng ≥ 3 tập liền = nét đứt vàng — người xem quên tuyến). Bấm thẻ để sửa, bấm ＋ để thêm sự kiện. */
export function BangTuyen({ s, setS, khung }: { s: Series; setS: (s: Series) => void; /** khung tuyến ngành của dạng phim (khung-tuyen.ts) — làn ngành còn thiếu hiện mờ */ khung?: KhungTuyen | null }) {
  const tap = dsTap(s); const tuyen = s.tuyen ?? [];
  const vang = tuyenVang(s);
  const [sua, setSua] = useState<string | null>(null);   // ô đang gõ (ma:so) — ô trống bấm ＋ thì mở ô gõ
  const nhieuMua = new Set(tap.map((t) => t.mua ?? 1)).size > 1;
  const themTuyen = () => { const ma = 'ABCDEFGHIJ'.split('').find((c) => !tuyen.some((t) => t.ma === c)); if (ma) setS({ ...s, tuyen: [...tuyen, { ma, ten: '' }] }); };
  const doiTen = (ma: string, ten: string) => setS({ ...s, tuyen: tuyen.map((t) => (t.ma === ma ? { ...t, ten } : t)) });
  const boTuyen = (ma: string) => setS({ ...s, tuyen: tuyen.filter((t) => t.ma !== ma), tap: s.tap.map((t) => { if (!t.su_kien?.[ma]) return t; const { [ma]: _, ...con } = t.su_kien; return { ...t, su_kien: con }; }) });
  const ghi = (so: number, ma: string, viec: string) => setS({ ...s, tap: s.tap.map((t) => (t.so === so ? { ...t, su_kien: { ...(t.su_kien ?? {}), [ma]: viec } } : t)) });
  const cot = `260px repeat(${tap.length}, minmax(220px, 1fr))`;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div className="xv-lan" style={{ gridTemplateColumns: cot }}>
        <div className="xv-lan-nhan xv-lan-dau" style={mono}>Tuyến ╲ Tập →</div>
        {tap.map((t, i) => (
          <div key={t.so} className="xv-lan-dau" title={`${t.ten}\n${t.logline}`}>
            <span style={mono}>{nhieuMua ? `M${t.mua ?? 1} · ` : ''}Tập {t.so}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.ten}</span>
            {i < tap.length - 1 && <span style={mono}>→</span>}
          </div>
        ))}
        {tuyen.map((x) => {
          const co = tap.map((t) => !!t.su_kien?.[x.ma]?.trim());
          const dau = co.indexOf(true), cuoi = co.lastIndexOf(true);
          const kieu = (i: number) => (vang.some((v) => v.ma === x.ma && tap[i]!.so >= v.tu && tap[i]!.so <= v.den) ? 'vang' : co[i] ? 'lien' : 'ho');
          return [
            <div key={`n${x.ma}`} className="xv-lan-nhan" title={`Tuyến ${x.ma}${x.vai ? ` · vai ngành: ${khung?.tuyen.find((v) => v.vai === x.vai)?.ten ?? x.vai}` : ''}: ${co.filter(Boolean).length}/${tap.length} tập có sự kiện`}>
              <b style={{ color: 'var(--fg-2)', fontSize: 13 }}>{x.ma}</b>
              <ODai dam value={x.ten} placeholder={x.ma === 'A' ? 'tuyến chính…' : 'tuyến phụ…'} onChange={(v) => doiTen(x.ma, v)} />
              <Menu rong={190}><MucMenu nguy goiY="Bỏ làn tuyến này cùng mọi sự kiện đã ghi" onClick={() => boTuyen(x.ma)}>🗑 Bỏ tuyến {x.ma}</MucMenu></Menu>
            </div>,
            ...tap.map((t, i) => {
              const viec = t.su_kien?.[x.ma] ?? ''; const k = `${x.ma}:${t.so}`;
              // nửa trái có đường khi đã có sự kiện trước đó; nửa phải khi còn sự kiện sau — đường mang kiểu của đoạn nó đi qua
              const trai = dau >= 0 && i > dau && i <= cuoi, phai = dau >= 0 && i >= dau && i < cuoi;
              const kTrai = co[i] && co[i - 1] ? 'lien' : kieu(co[i] ? i - 1 : i), kPhai = co[i] && co[i + 1] ? 'lien' : kieu(co[i] ? i + 1 : i);
              const v = vang.find((z) => z.ma === x.ma && t.so >= z.tu && t.so <= z.den);
              return (
                <div key={k} className="xv-lan-o" title={v ? `Tuyến ${x.ma} vắng ${v.n} tập liền (tập ${v.tu}–${v.den}) — người xem quên tuyến này` : undefined}>
                  {trai && <span className="xv-lan-day trai" data-kieu={kTrai} />}
                  {phai && <span className="xv-lan-day phai" data-kieu={kPhai} />}
                  {viec.trim() || sua === k
                    ? <div className={`xv-lan-the${trai ? ' vao' : ''}`}>
                        <ODai autoFocus={sua === k} value={viec} placeholder="sự kiện của tuyến trong tập này" onChange={(v) => ghi(t.so, x.ma, v)} onBlur={() => setSua(null)} />
                      </div>
                    : <button type="button" className="xv-lan-them" title={`Thêm sự kiện của tuyến ${x.ma} ở tập ${t.so}`} onClick={() => setSua(k)}>＋</button>}
                </div>
              );
            }),
          ];
        })}
        {/* LÀN NGÀNH CÒN THIẾU (khung-tuyen.ts): vai mà dạng phim này thường có nhưng bản đồ chưa có làn — hiện mờ, bấm ＋ để mở làn */}
        {doiKhung(s, khung ?? null)?.thieu.map((v) => [
          <div key={`kn${v.vai}`} className="xv-lan-nhan" style={{ opacity: 0.6 }} title={`${v.mo_ta}${v.mo_tu ? ` — ngành thường mở tập ${v.mo_tu[0]}–${v.mo_tu[1]}` : ''}`}>
            <b style={{ color: 'var(--fg-3)', fontSize: 13 }}>{v.ma}</b>
            <span style={{ fontSize: 12.5, flex: 1 }}>{v.ten}<br /><span style={mono}>khung ngành{v.mo_tu ? ` · thường mở tập ${v.mo_tu[0]}–${v.mo_tu[1]}` : ''}</span></span>
            <button type="button" className="xv-btn" style={{ padding: '0 6px' }} title="Mở làn này cho phim" onClick={() => { const ma = tuyen.some((t) => t.ma === v.ma) ? 'ABCDEFGHIJ'.split('').find((c) => !tuyen.some((t) => t.ma === c))! : v.ma; setS({ ...s, tuyen: [...tuyen, { ma, ten: v.ten, vai: v.vai }] }); }}>＋</button>
          </div>,
          <div key={`kno${v.vai}`} className="xv-lan-o" style={{ gridColumn: `span ${Math.max(1, tap.length)}`, justifyContent: 'flex-start', opacity: 0.5 }}><span className="xv-lan-day trai" data-kieu="ho" style={{ right: 0 }} /></div>,
        ])}
      </div>
      <button type="button" className="xv-btn" style={{ marginTop: 8 }} title="Thêm một làn tuyến — A là tuyến chính, B/C là tuyến phụ" onClick={themTuyen}>+ Tuyến</button>
    </div>
  );
}

type LocGt = 'tat_ca' | 'treo' | 'mo' | 'sai';
/** Sổ gài / trả: đèn (xanh đã trả · cam còn treo · xám 🔓 cố ý để mở sang tập/mùa sau · đỏ ghi sai) · chi tiết · tập gieo · trả ở (tập / để mở). Lọc theo trạng thái, xếp theo tập gieo. */
export function SoGaiTra({ s, setS }: { s: Series; setS: (s: Series) => void }) {
  const [loc, setLoc] = useNho<LocGt>('xv-gt-loc', 'tat_ca', ['tat_ca', 'treo', 'mo', 'sai'], 'gt');
  const so = s.so_gai_tra ?? [];
  const tt = (g: GaiTra) => trangThaiGaiTra(s, g);
  const dem = { mo: so.filter((g) => g.chi_tiet.trim() && tt(g).muc === 'mo').length, treo: so.filter((g) => g.chi_tiet.trim() && tt(g).muc === 'treo').length, sai: so.filter((g) => g.chi_tiet.trim() && tt(g).muc === 'loi').length };
  const hien = so.filter((g) => loc === 'tat_ca' || (g.chi_tiet.trim() && tt(g).muc === (loc === 'sai' ? 'loi' : loc))).sort((a, b) => a.gieo - b.gieo || (a.tra ?? 1e9) - (b.tra ?? 1e9));
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
        { value: 'mo', label: 'Để mở', title: `${dem.mo} chi tiết cố ý bỏ ngỏ — móc sang tập sau / mùa sau` },
        { value: 'sai', label: 'Ghi sai', title: `${dem.sai} chi tiết ghi sai (trả trước khi gieo, tập không có trong bản đồ)` },
      ]} />
      <button type="button" className="xv-btn" style={{ marginLeft: 'auto' }} title="Thêm một chi tiết gài" onClick={them}>+ Chi tiết</button>
    </div>
    <table className="xv-tbl dinh">
      <thead><tr><th style={{ width: 22 }} /><th>Chi tiết được gài</th><th style={{ width: 130 }}>Gieo ở</th><th style={{ width: 150 }}>Trả ở · để mở</th><th style={{ width: 34 }} /></tr></thead>
      <tbody>
        {hien.map((g) => { const t = tt(g); return (
          <tr key={g.id}>
            <td><Den muc={!g.chi_tiet.trim() || t.muc === 'mo' ? 'tat' : t.muc === 'da_tra' ? 'ok' : t.muc === 'treo' ? 'cho' : 'loi'} title={g.chi_tiet.trim() ? t.ghi : 'chưa ghi chi tiết'} /></td>
            <td><input className="xv-o-sua" value={g.chi_tiet} placeholder="vd: chìa khoá đồng trong túi áo bà" onChange={(e) => sua(g.id, { chi_tiet: e.target.value })} /></td>
            <td><Chon nho minWidth={120} value={String(g.gieo)} options={lcTap} onChange={(v) => sua(g.id, { gieo: Number(v) })} /></td>
            <td><Chon nho minWidth={140} value={g.tra != null ? String(g.tra) : g.mo ? `mo:${g.mo}` : ''} placeholder="chưa trả"
              options={[{ value: '', label: 'Chưa trả', ngan: 'chưa trả' }, { value: 'mo:tap_sau', label: '🔓 Để mở → tập sau', ngan: '🔓 tập sau', nhom: 'Cố ý để mở' }, { value: 'mo:mua_sau', label: '🔓 Để mở → mùa sau', ngan: '🔓 mùa sau', nhom: 'Cố ý để mở' }, ...lcTap]}
              onChange={(v) => sua(g.id, v.startsWith('mo:') ? { tra: null, mo: v.slice(3) as 'tap_sau' | 'mua_sau' } : { tra: v ? Number(v) : null, mo: undefined })} /></td>
            <td><Menu rong={170}><MucMenu nguy goiY="Bỏ chi tiết này khỏi sổ" onClick={() => setS({ ...s, so_gai_tra: so.filter((x) => x.id !== g.id) })}>🗑 Bỏ chi tiết</MucMenu></Menu></td>
          </tr>); })}
        {!hien.length && <tr><td colSpan={5} style={mono}>{so.length ? 'Không có chi tiết nào ở bộ lọc này.' : <>Sổ trống — <button type="button" className="xv-btn" onClick={them}>+ ghi chi tiết đầu tiên</button> hoặc bấm ✨ AI rút từ bản đồ.</>}</td></tr>}
      </tbody>
    </table>
  </>;
}
