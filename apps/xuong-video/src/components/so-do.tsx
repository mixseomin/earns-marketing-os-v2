'use client';
// SƠ ĐỒ SERIES (anh 14/10/2026 — "cần một bảng kiểu sơ đồ cả bộ phim, từng season, rồi đến tập"): hàng đầu là cả bộ phim, mỗi mùa một hàng
// thẻ tập. Thẻ = số · tên · loại (phiêu lưu / nguồn gốc / kết mùa) · mặt nhân vật · logline · gài/trả · tập đang ở khâu nào. Bấm thẻ: tập đã có
// thì mở (nút 📝 Kịch bản của tập (trên cây)), chưa có thì tạo từ bản đồ (tên + brief từ logline, 0đ). Dữ liệu: kinh_thanh.series (kieu.ts › muaSeries).
// Ba mặt (anh 31/10/2026): Tập (thẻ theo mùa) · Tuyến truyện (bảng tuyến A/B/C × tập) · Gài / trả (sổ setup–payoff) — tuyen-truyen-ui.tsx.
// Mặt nào hiện do CÂY PHIM chọn (cay-phim.tsx, tab 📖 Phim): mỗi mặt là một nút trên cây, không còn thanh chọn riêng.
import { useState } from 'react';
import { docKinhThanh, muaSeries, type NhanVat, type Phim, type Tap, type TapBanDo } from '@/lib/xuong-video/kieu';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { taoTapTuBanDo } from '@/lib/actions';
import { Pill, Loi, mono, goiAction } from './ui';
import { BangTuyen, SoGaiTra, NutAiTuyen, NutThemTap, NutSapKhung, useSoSeries } from './tuyen-truyen-ui';
import { khungCuaPhim, doiKhung } from '@/lib/xuong-video/khung-tuyen';
import { moNgan } from './ngan-chung';
import { trangThaiGaiTra, tuyenVang } from '@/lib/xuong-video/tuyen-truyen';

export type MatSoDo = 'tap' | 'tuyen' | 'gai_tra';
export const LOAI: Record<string, string> = { phieu_luu: 'Phiêu lưu', nguon_goc: 'Nguồn gốc', ket_mua: 'Kết mùa' };
/** Khâu của tập theo dữ liệu thật — trơn trừ khi đã xuất (xong) — màu chỉ báo nghĩa. */
export function khau(t: Tap | undefined): { chu: string; xong: boolean } {
  if (!t) return { chu: 'bản đồ', xong: false };
  if (t.xuat?.some((b) => !b.long_tieng && !b.phu_de)) return { chu: '✓ đã xuất', xong: true };
  if (t.so_canh) return { chu: `${t.so_canh} cảnh`, xong: false };
  if (t.kich_ban?.trim()) return { chu: 'kịch bản', xong: false };
  return { chu: 'đã tạo', xong: false };
}

export function SoDoSeries({ phim, tap, nhanVat, onMoTap, onChanged, mat: matSd, onMat }: { phim: Phim; tap: Tap[]; nhanVat: NhanVat[]; onMoTap: (tapId: number) => void; onChanged: () => Promise<void>; mat: MatSoDo; onMat: (m: MatSoDo) => void }) {
  const kt = docKinhThanh(phim.kinh_thanh);
  const ds = muaSeries(kt.series);
  const [dang, setDang] = useState<number | null>(null);
  const [loi, setLoi] = useState('');
  const setMatSd = onMat;
  const so = useSoSeries(phim, onChanged);
  const mat = (ten: string) => nhanVat.find((v) => v.loai === 'nhan_vat' && v.ten === ten);
  const tapCua = (b: TapBanDo) => tap.find((t) => t.so === b.so);
  const tongTap = ds.reduce((a, m) => a + m.tap.length, 0);
  const daXuat = ds.flatMap((m) => m.tap).filter((b) => khau(tapCua(b)).xong).length;
  const coKb = ds.flatMap((m) => m.tap).filter((b) => (tapCua(b)?.kich_ban ?? '').trim()).length;
  const sv = so.s;
  const gt = (sv?.so_gai_tra ?? []).filter((g) => g.chi_tiet.trim()).map((g) => trangThaiGaiTra(sv!, g).muc);
  const nTreo = gt.filter((m) => m === 'treo').length, nSai = gt.filter((m) => m === 'loi').length;
  const vang = tuyenVang(sv);
  const khung = khungCuaPhim(kt); const dk = doiKhung(sv, khung);
  if (!ds.length) return <div className="xv-panel" style={mono}>Phim chưa có bản đồ series — viết kinh thánh mùa (động cơ + danh sách tập) ở nút 📜 Kinh thánh trên cây.</div>;
  const bam = async (b: TapBanDo) => {
    const t = tapCua(b);
    if (t) { onMoTap(t.id); return; }
    setDang(b.so); setLoi('');
    const r = await goiAction(() => taoTapTuBanDo(phim.id, b.so));
    setDang(null);
    if (r.loi) { setLoi(r.loi); return; }
    await onChanged();
    if (r.kq && 'data' in r.kq && typeof r.kq.data === 'number') onMoTap(r.kq.data);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>   {/* minmax(0,1fr): ô không nở theo nội dung → lưới thẻ tự xuống dòng */}
      {matSd === 'tap' && <div className="xv-panel" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '8px 12px' }}>
        {phim.poster_url && <img src={anhNho(phim.poster_url, 160)} alt="" style={{ height: 52, aspectRatio: '2 / 3', objectFit: 'cover', borderRadius: 4 }} />}
        <div style={{ flex: 1, minWidth: 240 }}>
          <b style={{ fontSize: 14 }}>{kt.series?.ten || phim.ten}</b>
          <div style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{kt.logline}</div>
        </div>
        <span style={mono}>{ds.length} mùa · {tongTap} tập · {coKb} có kịch bản · {daXuat} đã xuất</span>
        <NutThemTap phimId={phim.id} dangSua={so.dirty} onChanged={onChanged} />
      </div>}
      {/* cảnh báo nằm TRÊN nội dung, bấm là tới đúng mặt (YDNI luật 4) */}
      {(nTreo > 0 || nSai > 0 || vang.length > 0 || !!dk?.vuot) && <div className="xv-banner" style={{ margin: 0, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {nTreo > 0 && <a style={{ cursor: 'pointer' }} title="Tập cuối mùa bị chặn sinh keyframe tới khi các chi tiết này có tập trả" onClick={() => setMatSd('gai_tra')}>⚠ {nTreo} chi tiết còn treo</a>}
        {nSai > 0 && <a style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => setMatSd('gai_tra')}>⚠ {nSai} chi tiết ghi sai</a>}
        {dk?.vuot && <a style={{ cursor: 'pointer' }} onClick={() => setMatSd('tuyen')}>⚠ {dk.vuot}</a>}
        {vang.slice(0, 3).map((v) => <a key={`${v.ma}${v.tu}`} style={{ cursor: 'pointer' }} title="Từ lần đầu xuất hiện, tuyến này không có sự kiện nào trong ngần ấy tập liền — người xem quên mất nó" onClick={() => setMatSd('tuyen')}>⚠ tuyến {v.ma} vắng tập {v.tu}–{v.den}</a>)}
      </div>}
      <Loi>{loi || so.loi}</Loi>
      {matSd !== 'tap' && sv && <div className="xv-panel" style={{ padding: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <b style={{ fontSize: 13 }}>{matSd === 'tuyen' ? 'Bảng tuyến truyện' : 'Sổ gài / trả'}</b>
          <span style={{ ...mono, flex: 1 }}>{matSd === 'tuyen' ? 'thời gian chạy trái → phải theo tập; mỗi tuyến một làn, sự kiện nối nhau bằng mũi tên — nét đứt vàng là tuyến đang bị bỏ quên' : 'tập cuối mùa còn chi tiết treo thì máy chấm kịch bản chặn sinh keyframe'}</span>
          {so.luuLuc && <span style={mono} title="Tự lưu sau mỗi lần gõ">✓ đã lưu {so.luuLuc}</span>}
          <NutThemTap phimId={phim.id} dangSua={so.dirty} onChanged={onChanged} />
          {matSd === 'tuyen' && <NutSapKhung phimId={phim.id} khung={khung} dangSua={so.dirty} onChanged={onChanged} />}
          <NutAiTuyen phimId={phim.id} s={sv} setS={so.setS} />
        </div>
        {matSd === 'tuyen' && khung && <div style={{ ...mono, marginBottom: 6 }}>
          <a style={{ cursor: 'pointer', textDecoration: 'underline dotted' }} title="Mở khung tuyến ngành trong thư viện điện ảnh" onClick={() => moNgan({ loai: 'ky-thuat', ma: `tuyen.${khung.key}` })}>📚 Khung ngành: {khung.ten}</a>
          {' '}· {khung.ca_bo[0]}–{khung.ca_bo[1]} tuyến cả bộ · {khung.moi_tap[0]}–{khung.moi_tap[1]} tuyến mỗi tập · phim đang có {dk?.co ?? 0}{dk?.thieu.length ? ` · làn ngành chưa mở: ${dk.thieu.map((v) => v.ma).join(', ')} (hiện mờ cuối bảng)` : ''}
        </div>}
        {matSd === 'tuyen' ? <BangTuyen s={sv} setS={so.setS} khung={khung} /> : <SoGaiTra s={sv} setS={so.setS} />}
      </div>}
      {matSd === 'tap' && ds.map((m) => (
        <div key={m.so} className="xv-panel" style={{ padding: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
            <b style={{ fontSize: 13 }}>{m.ten}</b>
            <span style={{ ...mono, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.dong_co || kt.series?.dong_co}>{m.ghi_chu || m.dong_co || (m.so === 1 ? kt.series?.dong_co : '')}</span>
            <span style={mono}>{m.tap.length} tập</span>
          </div>
          {!m.tap.length ? <div style={mono}>Mùa này đang lên ý — chưa có danh sách tập.</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {m.tap.map((b) => {
                const t = tapCua(b); const k = khau(t);
                return (
                  <button key={b.so} type="button" onClick={() => void bam(b)} disabled={dang != null}
                    title={`${b.logline}${b.gai_tra ? `\n\nGài / trả: ${b.gai_tra}` : ''}${b.boi_canh?.length ? `\nBối cảnh: ${b.boi_canh.join(', ')}` : ''}\n\n${t ? 'Bấm để mở tập' : 'Bấm để tạo tập từ bản đồ (0đ)'}`}
                    style={{ all: 'unset', cursor: 'pointer', display: 'grid', gap: 4, alignContent: 'start', padding: 8, borderRadius: 8, border: `1px ${t ? 'solid' : 'dashed'} var(--line)`, background: 'var(--bg-1)' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={mono}>{b.so}</span>
                      <b style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.ten}</b>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {b.loai && <Pill color="var(--fg-3)">{LOAI[b.loai] ?? b.loai}</Pill>}
                      <span style={{ ...mono, marginLeft: 'auto', color: k.xong ? 'var(--lime)' : undefined }}>{dang === b.so ? 'đang tạo…' : k.chu}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {(b.nhan_vat ?? []).map((ten) => { const v = mat(ten); return v?.anh_ref[0]
                        // Ảnh nhân vật là character sheet (4 góc nhìn hàng trên) → chỉ lấy hình chính diện ở góc trái trên.
                        ? <span key={ten} title={ten} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--line)', background: `#ddd url(${anhNho(v.anh_ref[0], 320)}) 4% 12% / 420% auto no-repeat`, flexShrink: 0 }} />
                        : <span key={ten} style={{ ...mono, fontSize: 10 }}>{ten}</span>; })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.logline}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Một tập trên bản đồ CHƯA tạo (nút mờ trên cây): xem logline / loại / nhân vật / gài-trả, bấm để tạo tập từ bản đồ (0đ). */
export function BanDoTap({ phim, so, onTao }: { phim: Phim; so: number; onTao: (tapId: number) => Promise<void> }) {
  const b = docKinhThanh(phim.kinh_thanh).series?.tap.find((t) => t.so === so);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState('');
  if (!b) return <div className="xv-panel" style={mono}>Tập {so} không còn trên bản đồ.</div>;
  const tao = async () => {
    setDang(true); setLoi('');
    const r = await goiAction(() => taoTapTuBanDo(phim.id, b.so));
    setDang(false);
    if (r.loi) { setLoi(r.loi); return; }
    if (r.kq && 'data' in r.kq && typeof r.kq.data === 'number') await onTao(r.kq.data);
  };
  return (
    <div className="xv-panel" style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={mono}>Tập {b.so}</span><b style={{ fontSize: 14 }}>{b.ten}</b>
        {b.loai && <Pill color="var(--fg-3)">{LOAI[b.loai] ?? b.loai}</Pill>}
      </div>
      <div style={{ fontSize: 12.5 }}>{b.logline}</div>
      {!!b.nhan_vat?.length && <div style={mono}>Nhân vật: {b.nhan_vat.join(', ')}</div>}
      {!!b.boi_canh?.length && <div style={mono}>Bối cảnh / đạo cụ: {b.boi_canh.join(', ')}</div>}
      {b.gai_tra && <div style={mono}>Gài / trả: {b.gai_tra}</div>}
      <div><button type="button" className="xv-btn chinh" disabled={dang} title="Tạo tập với tên + brief lấy từ bản đồ — không tốn tiền" onClick={() => void tao()}>{dang ? 'đang tạo…' : '＋ Tạo tập từ bản đồ'}</button></div>
      <Loi>{loi}</Loi>
    </div>
  );
}
