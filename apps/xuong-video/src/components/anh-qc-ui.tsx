'use client';
// ẢNH QC của phim quảng cáo (anh-qc.ts): khuôn = ảnh QC đang thắng; bấm "＋ khuôn" là có thẻ (0đ) với ảnh mẫu + chữ sẵn → sửa chữ → Sinh (giá
// trên nút). Thẻ: ảnh mẫu | bản đang dùng · dải bản đã sinh (bấm để dùng) · chữ từng dòng · khổ · model. Không xoá — chỉ ẩn (↶ hoàn tác được).
import { useCallback, useEffect, useState } from 'react';
import { dsAnhQc, themAnhQc, suaAnhQc, sinhAnhQc, chonAnhQc, taiAnhLen, type DsAnhQc } from '@/lib/actions';
import { KHUON_ANH_QC, TI_LE_ANH_QC, khuonAnhQc, sanPhamAnhQc, type AnhQc } from '@/lib/xuong-video/anh-qc';
import { giaAnhCents, tien, MO_HINH_ANH, type NhanVat, type Phim } from '@/lib/xuong-video/kieu';
import { Nut, Loi, Seg, mono, goiAction } from './ui';
import { Chon } from './chon';
import { ImageAttach } from './image-attach';
import { moNgan, linkTai } from './ngan-chung';
import { useNho } from './nho';
import { useDinhKy } from './dinh-ky';
import { anhNho } from '@/lib/xuong-video/anh-nho';

const tiLeCss = (t: string) => t.replace(':', ' / ');
const LUA_MODEL = MO_HINH_ANH.map((m) => ({ value: m.key, label: `${m.label} · ${tien(m.gia1k)}`, ngan: `${m.label.split(' (')[0]} · ${tien(m.gia1k)}` }));

export function AnhQcPhim({ phim, nhanVat }: { phim: Phim; nhanVat: NhanVat[] }) {
  const [d, setD] = useState<DsAnhQc | null>(null);
  const [loi, setLoi] = useState('');
  const [moNho, setMo] = useNho<'0' | '1'>(`xv-anh-qc-mo-${phim.id}`, '0', ['0', '1']);
  const [hienAn, setHienAn] = useState(false);
  const tai = useCallback(async () => { const r = await dsAnhQc(phim.id); if (r.ok) setD(r.data); else setLoi(r.loi); }, [phim.id]);
  useEffect(() => { void tai(); }, [tai]);
  useDinhKy(tai, d?.dang.length ? 4000 : null);
  const lam = async (fn: () => Promise<{ ok: boolean; loi?: string }>) => { setLoi((await goiAction(fn)).loi); await tai(); };
  const sp = sanPhamAnhQc(nhanVat);
  const ly = !sp.length && 'chưa có anchor SẢN PHẨM có ảnh (mục 2) — ảnh QC cần ảnh thật để không vẽ sai món';
  const ds = (d?.ds ?? []).filter((a) => hienAn || !a.an);
  const soAn = (d?.ds ?? []).filter((a) => a.an).length;

  if (moNho !== '1' && !d?.dang.length) return (
    <div className="xv-panel" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', flexWrap: 'wrap' }}>
      <span style={mono}>🖼</span><b style={{ fontSize: 13 }}>Ảnh QC</b><span style={mono}>{d ? `${d.ds.filter((a) => !a.an).length} ảnh · ${d.ds.reduce((t, a) => t + a.uv.length, 0)} bản đã sinh` : '…'}</span>
      {d?.ds.filter((a) => !a.an && a.url).slice(0, 8).map((a) => <img key={a.id} src={anhNho(a.url!, 160)} alt="" style={{ height: 40, aspectRatio: tiLeCss(a.ti_le), objectFit: 'cover', borderRadius: 4 }} />)}
      <button type="button" className="xv-btn" onClick={() => setMo('1')}>▾ {d?.ds.length ? 'Mở / làm thêm' : 'Làm ảnh QC'}</button>
    </div>
  );
  return (
    <div className="xv-panel">
      <h3><button type="button" className="xv-btn" style={{ marginRight: 6 }} onClick={() => setMo('0')} title="Gập">▴</button>🖼 Ảnh QC
        <small>chép bố cục một ảnh QC đang thắng · sản phẩm theo ảnh thật: {sp.map((x) => x.v.ten).join(', ') || '—'} · chữ in đúng từng dòng</small></h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <span style={mono}>＋ từ khuôn:</span>
        {KHUON_ANH_QC.map((k) => <button key={k.key} type="button" className="xv-btn" title={k.mo} onClick={() => void lam(() => themAnhQc(phim.id, { khuon: k.key }))}>{k.nhan}</button>)}
        <span style={{ ...mono, marginLeft: 8 }}>hoặc ảnh QC mẫu khác:</span>
        <div style={{ width: 220 }}>
          <ImageAttach value={[]} max={1} onChange={(u) => { if (u[0]) void lam(() => themAnhQc(phim.id, { mau_url: u[0]! })); }}
            upload={async (du) => { const r = await taiAnhLen(du); return r.ok ? { ok: true, url: r.data } : { ok: false, error: r.loi }; }} />
        </div>
        {soAn > 0 && <button type="button" className="xv-btn" onClick={() => setHienAn(!hienAn)}>{hienAn ? 'Giấu ảnh đã ẩn' : `Hiện ${soAn} ảnh đã ẩn`}</button>}
      </div>
      {ly && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 6 }}>{ly}</div>}
      <Loi>{loi}</Loi>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 10 }}>
        {ds.map((a) => <TheAnhQc key={a.id} a={a} dang={!!d?.dang.includes(a.id)} loiNen={d?.loi[a.id] ?? ''} ly={ly} lam={lam} />)}
      </div>
      {d && !d.ds.length && <div style={mono}>Chưa có ảnh QC — bấm một khuôn ở trên (0đ), sửa chữ rồi mới sinh.</div>}
    </div>
  );
}

function TheAnhQc({ a, dang, loiNen, ly, lam }: { a: AnhQc; dang: boolean; loiNen: string; ly: string | false; lam: (fn: () => Promise<{ ok: boolean; loi?: string }>) => Promise<void> }) {
  const [chu, setChu] = useState(a.chu);
  const [yTuong, setYTuong] = useState(a.y_tuong);
  const [ten, setTen] = useState(a.ten);
  // Máy chủ đổi (lưu xong / ↶ hoàn tác) → ô nhập theo giá trị mới
  useEffect(() => { setChu(a.chu); }, [a.chu]);
  useEffect(() => { setYTuong(a.y_tuong); }, [a.y_tuong]);
  useEffect(() => { setTen(a.ten); }, [a.ten]);
  const gia = giaAnhCents(a.mo_hinh);
  const k = khuonAnhQc(a.khuon);
  const luu = (p: Parameters<typeof suaAnhQc>[1]) => lam(() => suaAnhQc(a.id, p));
  const doi = chu !== a.chu || yTuong !== a.y_tuong;
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, display: 'grid', gap: 6, opacity: a.an ? 0.55 : 1 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input className="xv-in" value={ten} onChange={(e) => setTen(e.target.value)} onBlur={() => ten !== a.ten && void luu({ ten })} style={{ fontWeight: 600 }} />
        <span style={mono}>#{a.id}</span>
      </div>
      {k && <div style={mono}>{k.mo}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <figure style={{ margin: 0 }}>
          <img src={anhNho(a.mau_url, 640)} alt="" title="Ảnh mẫu — bấm để xem to" onClick={() => moNgan({ loai: 'xem', url: a.mau_url })} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in', display: 'block' }} />
          <figcaption style={mono}>mẫu</figcaption>
        </figure>
        <figure style={{ margin: 0 }}>
          {a.url
            ? <img src={anhNho(a.url, 640)} alt="" title="Bản đang dùng — bấm để xem to" onClick={() => moNgan({ loai: 'xem', url: a.url! })} style={{ width: '100%', aspectRatio: tiLeCss(a.ti_le), objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in', display: 'block' }} />
            : <div style={{ width: '100%', aspectRatio: tiLeCss(a.ti_le), borderRadius: 6, background: 'var(--bg-2)', display: 'grid', placeItems: 'center' }}><span style={mono}>{dang ? '⏳ đang sinh…' : 'chưa sinh'}</span></div>}
          <figcaption style={mono}>{a.url ? <>bản đang dùng · <a href={linkTai(a.url)} download className="xv-lienket">⬇ tải ảnh gốc</a></> : 'của mình'}</figcaption>
        </figure>
      </div>
      {a.uv.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {a.uv.map((u) => <img key={u} src={anhNho(u, 160)} alt="" title={u === a.url ? 'bản đang dùng' : 'bấm để dùng bản này'} onClick={() => u !== a.url && void lam(() => chonAnhQc(a.id, u))}
            style={{ width: 44, aspectRatio: tiLeCss(a.ti_le), objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: `2px solid ${u === a.url ? 'var(--cyan)' : 'transparent'}` }} />)}
        </div>
      )}
      <textarea className="xv-ta" rows={6} value={chu} onChange={(e) => setChu(e.target.value)} onBlur={() => chu !== a.chu && void luu({ chu })}
        placeholder="Mỗi dòng = một chữ in trên ảnh. Để trống = giữ nguyên văn chữ của ảnh mẫu. (Trong ngoặc) = chỉ dẫn, không in." />
      <input className="xv-in" value={yTuong} onChange={(e) => setYTuong(e.target.value)} onBlur={() => yTuong !== a.y_tuong && void luu({ y_tuong: yTuong })}
        placeholder="Thêm ý (không bắt buộc) — vd: người mẫu da màu ~65 tuổi, nền phòng khách mùa đông" />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Seg options={TI_LE_ANH_QC} value={a.ti_le} onChange={(v) => void luu({ ti_le: v })} />
        <Chon value={a.mo_hinh} options={LUA_MODEL} onChange={(v) => void luu({ mo_hinh: v })} minWidth={170} title="Model ảnh — Gemini 3 Pro vẽ chữ đúng nhất" />
        <Nut chinh gia={gia} ly={ly || (dang && 'đang sinh — đợi xong') || (doi && 'chữ chưa lưu — bấm ra ngoài ô để lưu')}
          title={`${a.mo_hinh} · ảnh mẫu + ảnh sản phẩm + logo làm tham chiếu`} onClick={() => void lam(() => sinhAnhQc(a.id))}>🖼 {a.uv.length ? 'Sinh thêm' : 'Sinh'} · {tien(gia)}</Nut>
        <button type="button" className="xv-btn" title={a.an ? 'Hiện lại ảnh này' : 'Ẩn khỏi danh sách (không xoá, hiện lại được)'} onClick={() => void luu({ an: !a.an })}>{a.an ? '👁 Hiện' : '🙈 Ẩn'}</button>
      </div>
      <Loi>{dang ? '' : loiNen && `Lượt sinh gần nhất lỗi: ${loiNen}`}</Loi>
    </div>
  );
}
