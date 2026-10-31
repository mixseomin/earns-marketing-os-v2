'use client';
// Thư viện ngôn ngữ điện ảnh (#1195) — nội dung dùng chung cho drawer 🎬 (mở từ đầu trang / form shot) và trang /thu-vien.
// Lọc theo thể loại tại chỗ (state), không điều hướng.
import { useEffect, useRef, useState } from 'react';
import { useViTriNoi } from './vi-tri-noi';
import { dsKhuonShot } from '@/lib/actions';
import { moNgan } from './ngan-chung';
import { LOAI_SHOT_MAU } from '@/lib/xuong-video/kieu';
import type { KhuonShot } from '@/lib/xuong-video/khuon-shot';
import { THE_LOAI, NHOM_KY_THUAT, THU_VIEN, CAU_TRUC, hopTheLoai, kyThuat, chiTietKyThuat, type TheLoai, type KyThuat, type KyThuatShot, type NhomKyThuat, type MucKyThuat } from '@/lib/xuong-video/dien-anh';
import { LUAT_DUNG_CANH, luatDung } from '@/lib/xuong-video/luat-dung';
import type { NganhKyThuat } from '@/lib/xuong-video/dien-anh-nganh';
import { viDuCua, linkYt, nhungYt, anhYt } from '@/lib/xuong-video/vi-du-yt';
import { LinkNgoai } from './ui';
import { Chon } from './chon';
import { useNho } from './nho';
import { KHUON_CHUOI } from '@/lib/xuong-video/khuon-chuoi';
import { HIEU_UNG_KHAN_GIA, hieuUngKG } from '@/lib/xuong-video/khan-gia';
import { GOI_THE_LOAI, DIGEN_NHOM, DIGEN_KHONG_TINH, goiTheoKey, kiemGoi, boCucGoi } from '@/lib/xuong-video/goi-the-loai';
import { KHUNG_TUYEN, khungTheoKey, khungTheoTheLoai, type KhungTuyen } from '@/lib/xuong-video/khung-tuyen';

// THƯ VIỆN theo YDNI (anh 18/10/2026 "tổ chức lại thư viện cho dễ tìm, dễ truy cập"): ô tìm luôn trên đầu (tìm cả tên Việt, tên ngành tiếng Anh,
// mã, mô tả — mọi mục cùng lúc); mục lục trái theo câu hỏi người làm phim mang tới, MỖI LẦN MỘT MỤC (không chồng dọc 300 thẻ); thẻ gọn một tên +
// hai dòng mô tả, bấm mở ngăn chi tiết (mô tả ngành + ▶ ví dụ video) — chi tiết sau 1 click. Mục / tìm / thể loại nằm trên URL (tvm / tvq / tvl).
type MucTv = { key: string; ten: string; ic: string };
const NHOM_MUC: { ten: string; muc: string[] }[] = [
  { ten: 'Định dạng', muc: ['goi', 'tuyen'] },
  { ten: 'Dẫn dắt', muc: ['luat', 'khuon_chuoi', 'khan_gia', 'hook', 'beat'] },
  { ten: 'Hình', muc: ['vai', 'co_canh', 'goc', 'chuyen_dong', 'ong_kinh', 'toc_do'] },
  { ten: 'Diễn · sáng · màu', muc: ['dien_xuat', 'anh_sang', 'mau'] },
  { ten: 'Dựng · tiếng', muc: ['chuyen_canh', 'am_thanh', 'nhac'] },
  { ten: 'Kho', muc: ['khuon_shot'] },
];
const MUC_TV: MucTv[] = [
  { key: 'goi', ten: 'Gói thể loại', ic: '📦' }, { key: 'tuyen', ten: 'Khung tuyến truyện', ic: '🧵' }, { key: 'luat', ten: 'Luật dựng cảnh', ic: '📐' }, { key: 'khuon_chuoi', ten: 'Khuôn chuỗi shot', ic: '🧭' }, { key: 'khan_gia', ten: 'Hiệu ứng khán giả', ic: '🎭' }, { key: 'beat', ten: 'Cấu trúc beat', ic: '📖' },
  { key: 'khuon_shot', ten: 'Khuôn shot dùng lại', ic: '🧩' }, ...NHOM_KY_THUAT.map((n) => ({ key: n.key, ten: n.ten, ic: n.icon })),
];
const boDau = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const khop = (q: string, ...ds: (string | undefined)[]) => !q || ds.some((d) => d && boDau(d).includes(q));

export function ThuVienNoiDung({ tlDau = '' }: { tlDau?: string }) {
  const [muc, setMuc] = useNho<string>('xv-tv-muc', 'chuyen_dong', MUC_TV.map((m) => m.key), 'tvm');
  const [qTho, setQ] = useNho<string>('xv-tv-q', '', undefined, 'tvq');
  const [tlNho, setTl] = useNho<string>('xv-tv-tl', tlDau, ['', ...THE_LOAI.map((t) => t.key)], 'tvl');
  const tl = tlNho as TheLoai | '';
  const q = boDau(qTho.trim());
  const kt = (n: string) => THU_VIEN.filter((x) => x.nhom === n && (!tl || hopTheLoai(x, tl)) && khop(q, x.ten, x.key, x.mo_ta, x.nganh?.ten_nganh, x.prompt));
  const luat = LUAT_DUNG_CANH.filter((l) => khop(q, l.ten, l.key, l.luat, l.nganh?.ten_nganh));
  const khuon = KHUON_CHUOI.filter((k) => (!tl || hopKhuon(k, tl)) && khop(q, k.ten, k.key, k.muc_dich, ...k.buoc.map((b) => b.ten)));
  const goi = GOI_THE_LOAI.filter((g) => khop(q, g.ten, g.key, g.mo_ta, g.tham_chieu, g.nhom));
  const ktuyen = KHUNG_TUYEN.filter((k) => khop(q, k.ten, k.key, k.ghi, ...k.tuyen.map((v) => v.ten)));
  const kg = HIEU_UNG_KHAN_GIA.filter((h) => khop(q, h.ten, h.key, h.mo_ta, h.nganh.ten_nganh));
  const dem = (m: string) => (m === 'luat' ? luat.length : m === 'khuon_chuoi' ? khuon.length : m === 'khan_gia' ? kg.length : m === 'goi' ? goi.length : m === 'tuyen' ? ktuyen.length : m === 'beat' || m === 'khuon_shot' ? -1 : kt(m).length);
  const theKt = (x: KyThuat) => <TheMuc key={x.key} ten={x.ten} ma={`${x.nhom}.${x.key}`} moTa={x.mo_ta} ten2={x.nganh?.ten_nganh} />;
  const noiDung = (m: string, tieuDe = false) => {
    const dau = tieuDe ? <div className="xv-mono" style={{ margin: '10px 0 4px', textTransform: 'uppercase' }}>{MUC_TV.find((x) => x.key === m)?.ic} {MUC_TV.find((x) => x.key === m)?.ten}</div> : null;
    if (m === 'luat') return luat.length ? <div key={m}>{dau}<LuoiThe>{luat.map((l) => <TheMuc key={l.key} ten={l.ten} ma={`luat.${l.key}`} moTa={l.luat} ten2={l.nganh?.ten_nganh} />)}</LuoiThe></div> : null;
    if (m === 'khuon_chuoi') return khuon.length ? <div key={m}>{dau}<LuoiThe rong={320}>{khuon.map((k) => <TheKhuon key={k.key} k={k} />)}</LuoiThe></div> : null;
    if (m === 'goi') {
      if (!goi.length) return null;
      const nhomGoi = [...new Set(goi.map((g) => g.nhom))];
      const tinh = DIGEN_NHOM.filter((n) => !DIGEN_KHONG_TINH.includes(n)); const phu = tinh.filter((n) => GOI_THE_LOAI.some((g) => g.digen?.includes(n)));
      return <div key={m}>{dau}
        <div className="xv-mono" title={`Đối chiếu chợ skill Digen (xem 18/10/2026) — mỗi nhóm loại video ngành đang làm có ít nhất một gói.\nGhi chép: apps/xuong-video/tham-khao/digen.md${tinh.length > phu.length ? `\nChưa phủ: ${tinh.filter((n) => !phu.includes(n)).join(', ')}` : ''}`} style={{ fontSize: 11, margin: '0 0 6px' }}>phủ {phu.length}/{tinh.length} nhóm loại video của ngành (đối chiếu Digen)</div>
        {nhomGoi.map((n) => <div key={n}><div className="xv-mono" style={{ fontSize: 10.5, margin: '8px 0 4px', color: 'var(--fg-3)' }}>{n}</div><LuoiThe>{goi.filter((g) => g.nhom === n).map((g) => <TheMuc key={g.key} ten={`${g.ic} ${g.ten}`} ma={`goi.${g.key}`} moTa={`${g.mo_ta} · ${g.ti_le} · ${g.do_dai_s[0]}–${g.do_dai_s[1]}s`} ten2={g.digen?.length ? `Digen: ${g.digen.join(', ')}` : undefined} />)}</LuoiThe></div>)}
      </div>;
    }
    if (m === 'tuyen') return ktuyen.length ? <div key={m}>{dau}<LuoiThe rong={320}>{ktuyen.map((k) => <TheMuc key={k.key} ten={`🧵 ${k.ten}`} ma={`tuyen.${k.key}`} moTa={`${k.ca_bo[0]}–${k.ca_bo[1]} tuyến cả bộ · ${k.moi_tap[0]}–${k.moi_tap[1]} mỗi tập: ${k.tuyen.map((v) => `${v.ma} ${v.ten}`).join(' · ')}`} />)}</LuoiThe></div> : null;
    if (m === 'khan_gia') return kg.length ? <div key={m}>{dau}<LuoiThe>{kg.map((h) => <TheMuc key={h.key} ten={`${h.ic} ${h.ten}`} ma={`khan_gia.${h.key}`} moTa={h.mo_ta} ten2={h.nganh.ten_nganh} />)}</LuoiThe></div> : null;
    if (m === 'beat') return q ? null : <div key={m}>{dau}<BeatKhoi /></div>;
    if (m === 'khuon_shot') return q ? null : <div key={m}>{dau}<KhuonShotKhoi /></div>;
    const ds = kt(m); return ds.length ? <div key={m}>{dau}<LuoiThe>{ds.map(theKt)}</LuoiThe></div> : null;
  };
  const tong = MUC_TV.reduce((a, m) => a + Math.max(0, dem(m.key)), 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 180px) 1fr', gap: 14, alignItems: 'start' }}>
      {/* Mục lục — dính khi cuộn; nhãn chỉ tên, số ở hover */}
      <nav style={{ position: 'sticky', top: 0, display: 'grid', gap: 10, fontSize: 12.5 }}>
        {NHOM_MUC.map((g) => (
          <div key={g.ten} style={{ display: 'grid', gap: 1 }}>
            <div className="xv-mono" style={{ textTransform: 'uppercase', fontSize: 9.5, padding: '0 8px 2px' }}>{g.ten}</div>
            {g.muc.map((k) => { const m = MUC_TV.find((x) => x.key === k)!; const n = dem(k); const on = !q && muc === k;
              return <button key={k} type="button" onClick={() => { setMuc(k); if (q) setQ(''); }} title={n >= 0 ? `${n} mục${q ? ' khớp tìm' : ''}` : undefined}
                style={{ textAlign: 'left', padding: '4px 8px', borderRadius: 6, border: 0, cursor: 'pointer', background: on ? 'var(--bg-2)' : 'transparent', color: on ? 'var(--fg-1)' : n === 0 ? 'var(--fg-4)' : 'var(--fg-2)', fontWeight: on ? 600 : 400 }}>{m.ic} {m.ten}</button>; })}
          </div>
        ))}
        <button type="button" className="xv-btn" style={{ fontSize: 11.5 }} onClick={() => moNgan({ loai: 'kho' })} title="Clip · keyframe · nhạc đã làm, dùng lại được">📦 Kho tài sản</button>
      </nav>
      <div style={{ minWidth: 0 }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-0, var(--bg-1))', paddingBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="xv-in" autoFocus value={qTho} onChange={(e) => setQ(e.target.value)} placeholder={`Tìm trong ${THU_VIEN.length + LUAT_DUNG_CANH.length + KHUON_CHUOI.length} mục — "dolly", "đẩy vào", "hook", "rack focus"…`}
            onKeyDown={(e) => { if (e.key === 'Escape' && qTho) { e.stopPropagation(); setQ(''); } }} style={{ flex: '1 1 260px', minWidth: 0 }} />
          <Chon value={tl} onChange={(v) => setTl(v)} minWidth={170} title="Chỉ hiện kỹ thuật hợp thể loại"
            options={[{ value: '', label: 'Mọi thể loại' }, ...THE_LOAI.map((t) => ({ value: t.key, label: t.ten, title: t.mo_ta }))]} />
        </div>
        {q ? (tong ? MUC_TV.map((m) => noiDung(m.key, true)) : <div className="xv-mono" style={{ padding: 12 }}>Không có mục nào khớp “{qTho}”.</div>)
          : noiDung(muc)}
      </div>
    </div>
  );
}

const hopKhuon = (k: (typeof KHUON_CHUOI)[number], tl: TheLoai) => k.the_loai === 'tat_ca' || k.the_loai.includes(tl);
function LuoiThe({ children, rong = 230 }: { children: React.ReactNode; rong?: number }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${rong}px, 1fr))`, gap: 6 }}>{children}</div>;
}
/** Thẻ gọn: tên (+ ▶ khi có ví dụ video) + hai dòng mô tả — bấm mở ngăn chi tiết (ngành + video). Chiều cao đều để quét ngang được. */
function TheMuc({ ten, ma, moTa, ten2 }: { ten: string; ma: string; moTa: string; ten2?: string }) {
  const vd = viDuCua(ma).length;
  return (
    <button type="button" className="xv-canh" onClick={() => moNgan({ loai: 'ky-thuat', ma })} title={`${ten2 ? `${ten2}\n` : ''}${moTa}\n— bấm xem chi tiết${vd ? ' + video ví dụ' : ''}`}
      style={{ textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 3, alignContent: 'start', font: 'inherit', color: 'inherit' }}>
      <span style={{ display: 'flex', gap: 6, alignItems: 'baseline', minWidth: 0 }}>
        <b style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ten}</b>
        {vd > 0 && <span title="có video ví dụ" style={{ fontSize: 10, color: 'var(--fg-3)' }}>▶</span>}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--fg-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{moTa}</span>
    </button>
  );
}
/** Khuôn chuỗi shot (khuon-chuoi.ts): mục đích + các bước + nguồn — áp trên timeline ở làn 🧭 Khuôn. */
function TheKhuon({ k }: { k: (typeof KHUON_CHUOI)[number] }) {
  return (
    <div className="xv-canh" role="button" tabIndex={0} onClick={() => moNgan({ loai: 'ky-thuat', ma: `khuon.${k.key}` })} title="Bấm xem chi tiết khuôn (bước · vai · luật · máy · nguồn)" style={{ display: 'grid', gap: 4, cursor: 'pointer' }}>
      <b style={{ fontSize: 12 }}>{k.ten}</b>
      <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{k.muc_dich}</span>
      <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{k.buoc.map((b, i) => `${i + 1}. ${b.ten}${b.tuy ? ' (tuỳ)' : b.nen ? ' (nên có)' : ''}`).join(' → ')}{k.ket ? ` · kết: ${k.ket}` : ''}</span>
      <span className="xv-mono" style={{ fontSize: 10 }}>nguồn: {k.nguon.map((n) => n.phim).join(' · ')}</span>
    </div>
  );
}
function BeatKhoi() {
  return <div style={{ display: 'grid', gap: 8 }}>{Object.entries(CAU_TRUC).map(([k, c]) => (
    <div key={k}><b style={{ fontSize: 12 }}>{c.ten}</b>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{c.beats.map((b, i) => <span key={b.ten} className="xv-mono" title={b.mo_ta} style={{ padding: '2px 8px', border: '1px solid var(--line)', borderRadius: 6 }}>{i + 1}. {b.ten}</span>)}</div>
    </div>))}</div>;
}

/** Khuôn shot máy tự ghi từ QC mẫu + cảnh đã tách (xv_khuon_shot) — xem theo loại, hay gặp trước. */
function KhuonShotKhoi() {
  const [ds, setDs] = useState<KhuonShot[] | null>(null);
  const [loai, setLoai] = useState('');
  useEffect(() => { void dsKhuonShot().then(setDs); }, []);
  const ten = (k: string) => LOAI_SHOT_MAU.find((x) => x.key === k)?.ten ?? k;
  const loc = (ds ?? []).filter((k) => !loai || k.loai === loai);
  const cac = [...new Set((ds ?? []).map((k) => k.loai))];
  return (
    <div>
      <div className="xv-mono" style={{ marginBottom: 6 }}>{ds ? 'Máy tự ghi từ QC mẫu và cảnh đã tách, tên riêng đã thay bằng {sản phẩm} {nhân vật}; Claude đọc lại khi tách cảnh' : '…'}</div>
      {!!cac.length && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '8px 0' }}>
        <button type="button" className={`xv-btn${!loai ? ' chinh' : ''}`} style={{ padding: '2px 9px' }} onClick={() => setLoai('')}>Tất cả</button>
        {cac.map((k) => <button key={k} type="button" className={`xv-btn${loai === k ? ' chinh' : ''}`} style={{ padding: '2px 9px' }} onClick={() => setLoai(k)} title={`${(ds ?? []).filter((x) => x.loai === k).length} khuôn`}>{ten(k)}</button>)}
      </div>}
      {ds && !ds.length && <div className="xv-mono">Chưa có khuôn nào — tách cảnh một QC hoặc phân tích một video mẫu là máy tự ghi.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6, marginTop: 6 }}>
        {loc.map((k) => (
          <div key={k.id} className="xv-canh" title={`${k.nguon}${k.dung > 1 ? ` · gặp ${k.dung} lần` : ''}`}>
            <b style={{ fontSize: 12 }}>{k.ten}</b> <span className="xv-mono">{ten(k.loai)} · {k.giay}s{k.dung > 1 ? ` · ×${k.dung}` : ''}</span>
            <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 2 }}>{k.hinh}</div>
            {k.chu_man && <div className="xv-mono" style={{ marginTop: 2 }}>chữ: {k.chu_man}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mô tả ngành của một kỹ thuật (khung mở → kết, cách làm, khi nào dùng, tác động, tránh, nguồn + phần số máy 3D) — MỘT chỗ dựng cho thẻ thư viện và ngăn chi tiết. */
/** Mô tả ngành của một kỹ thuật (x) hoặc một luật dựng cảnh (n) — cùng một bảng. */
function MoTaNganh({ x, n }: { x?: KyThuat; n?: NganhKyThuat }) {
  const g = n ?? x?.nganh; if (!g) return null;
  return (
    <dl style={{ fontSize: 11.5, color: 'var(--fg-2)', margin: '4px 0 0', display: 'grid', gap: 3 }}>
      {([['Mở → kết', g.dau_cuoi], ['Thực hiện', g.thuc_hien], ['Khi nào dùng', g.dong_co], ['Khán giả cảm', g.cam_xuc], ['Tránh', g.tranh], ['Nguồn', g.nguon]] as const).map(([t, v]) => <div key={t}><b>{t}:</b> {v}</div>)}
      {x?.may_di && <div className="xv-mono">máy 3D: {x.may_di.kieu}{x.may_di.ti_le ? ` · chủ thể ×${x.may_di.ti_le}` : ''}{x.may_di.goc ? ` · ${x.may_di.goc}°` : ''} · {x.may_di.toc}</div>}
    </dl>
  );
}

/** Ngăn chi tiết MỘT kỹ thuật / luật đã áp cho shot — mở bằng moNgan({ loai: 'ky-thuat', ma: '<nhóm>.<key>' | 'luat.<key>' }). */
export function ChiTietKyThuatNgan({ ma }: { ma: string }) {
  const [nhom, key] = [ma.slice(0, ma.indexOf('.')), ma.slice(ma.indexOf('.') + 1)];
  const nut = <div style={{ marginTop: 12 }}><button type="button" className="xv-btn" onClick={() => moNgan({ loai: 'thu-vien' })}>🎬 Mở cả thư viện điện ảnh</button></div>;
  if (nhom === 'khuon') {
    const k = KHUON_CHUOI.find((x) => x.key === key);
    if (!k) return <div className="xv-mono">Không còn khuôn “{key}” trong thư viện.</div>;
    return (<div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
      <div className="xv-mono">🧭 Khuôn chuỗi shot · {k.key}</div><b style={{ fontSize: 15 }}>{k.ten}</b>
      <div style={{ color: 'var(--fg-2)' }}>{k.muc_dich}</div>
      <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>{k.buoc.map((b, i) => (
        <li key={i}><b>{b.ten}</b>{b.tuy ? <span className="xv-mono"> · tuỳ chọn</span> : b.nen ? <span className="xv-mono"> · nên có</span> : null}
          <div style={{ color: 'var(--fg-2)', fontSize: 12 }}>{b.ghi}</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
            {b.vai.map((v) => <LinkMa key={v} ma={`vai.${v}`} />)}{(b.luat ?? []).map((l) => <LinkMa key={l} ma={`luat.${l}`} />)}{(b.may ?? []).map((m) => <LinkMa key={m} ma={`chuyen_dong.${m}`} />)}
          </div></li>))}</ol>
      {k.ket && <div className="xv-mono">kết khuôn: {k.ket}</div>}
      <div className="xv-mono">hợp thể loại: {k.the_loai === 'tat_ca' ? 'mọi thể loại' : k.the_loai.map((t) => THE_LOAI.find((y) => y.key === t)?.ten ?? t).join(', ')}</div>
      <div style={{ display: 'grid', gap: 2 }}>{k.nguon.map((n, i) => <div key={i} style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>📚 <b>{n.phim}</b> — {n.ghi}</div>)}</div>
      {nut}
    </div>);
  }
  if (nhom === 'tuyen') {
    const k = khungTheoKey(key);
    if (!k) return <div className="xv-mono">Không còn khung tuyến “{key}” trong thư viện.</div>;
    return (<div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
      <div className="xv-mono">🧵 Khung tuyến truyện · {k.key}</div><b style={{ fontSize: 15 }}>{k.ten}</b>
      <div className="xv-mono">{k.ca_bo[0]}–{k.ca_bo[1]} tuyến cả bộ · mỗi tập đẩy {k.moi_tap[0]}–{k.moi_tap[1]} tuyến · nhiều hơn {k.ca_bo[1]} thì bảng tuyến báo vượt</div>
      <KhungTuyenBang k={k} />
      <div style={{ color: 'var(--fg-2)' }}>{k.ghi}</div>
      <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>📚 {k.nguon}</div>
      <div className="xv-mono">Dùng ở: phim có thể loại này → 📖 Phim › 🧵 Tuyến truyện (làn ngành còn thiếu hiện mờ, nút 🧩 Sắp theo khung ngành).</div>
      {nut}
    </div>);
  }
  if (nhom === 'goi') {
    const g = goiTheoKey(key);
    if (!g) return <div className="xv-mono">Không còn gói “{key}” trong thư viện.</div>;
    const k = kiemGoi(g); const kb = CAU_TRUC[g.khung];
    return (<div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
      <div className="xv-mono">📦 Gói thể loại · {g.nhom} · {g.key}</div><b style={{ fontSize: 15 }}>{g.ic} {g.ten}</b>
      <div style={{ color: 'var(--fg-2)' }}>{g.mo_ta}</div>
      <div className="xv-mono">{THE_LOAI.find((t) => t.key === g.the_loai)?.ten ?? g.the_loai} · khung {g.ti_le} · {g.do_dai_s[0]}–{g.do_dai_s[1]} giây mỗi tập · màn xem timeline: {({ trai: '◧ bên trái', giua: '▣ giữa', phai: '◨ bên phải' } as const)[boCucGoi(g)]}</div>
      {k.thieu.length ? k.thieu.map((t, i) => <div key={i} style={{ color: 'var(--amber)', fontSize: 12 }}>⚠ {t}</div>) : <div style={{ color: 'var(--green, #4ade80)', fontSize: 12 }}>✓ đủ: khung beat riêng, quy chuẩn dòng phim, hiệu ứng và luật đều có thật</div>}
      {kb && <div><b>Khung beat:</b> {kb.ten}<ol style={{ margin: '4px 0 0', paddingLeft: 18, display: 'grid', gap: 2 }}>{kb.beats.map((b, i) => <li key={i}><b>{b.ten}</b> — <span style={{ color: 'var(--fg-2)' }}>{b.mo_ta}</span></li>)}</ol></div>}
      <div><b>Cung khán giả mặc định:</b><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3, alignItems: 'center' }}>{g.khan_gia.map((y, i) => <span key={i} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{i ? '→' : ''}<LinkMa ma={`khan_gia.${y}`} /></span>)}</div></div>
      {k.khuon.length > 0 && <div><b>Khuôn chuỗi hay dùng:</b><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>{k.khuon.map((x) => <LinkMa key={x} ma={`khuon.${x}`} />)}</div></div>}
      {k.quyChuan.length > 0 && <div><b>Quy chuẩn dòng phim:</b> <span style={{ color: 'var(--fg-2)' }}>{k.quyChuan.join(' · ')}</span></div>}
      {(() => { const k = khungTheoTheLoai(g.the_loai); return k ? <div><b>Khung tuyến truyện:</b> <LinkMa ma={`tuyen.${k.key}`} chu={`${k.ten} · ${k.ca_bo[0]}–${k.ca_bo[1]} tuyến`} /><KhungTuyenBang k={k} /></div> : null; })()}
      <div><b>Luật dựng nhấn:</b><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>{g.luat.map((l) => <LinkMa key={l} ma={`luat.${l}`} />)}</div></div>
      <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>📚 Tham chiếu: {g.tham_chieu}</div>
      <div className="xv-mono">Chọn gói ở Kinh thánh của phim (mục 1) — đặt thể loại + khung hình; tách cảnh đọc khung beat, cung khán giả, luật nhấn của gói.</div>
      {nut}
    </div>);
  }
  if (nhom === 'khan_gia') {
    const h = hieuUngKG(key);
    if (!h) return <div className="xv-mono">Không còn hiệu ứng “{key}” trong thư viện.</div>;
    return (<div style={{ display: 'grid', gap: 6, fontSize: 12.5 }}>
      <div className="xv-mono">🎭 Hiệu ứng khán giả · {h.key}</div><b style={{ fontSize: 15 }}>{h.ic} {h.ten}</b>
      <div style={{ color: 'var(--fg-2)' }}>{h.mo_ta}</div>
      <div className="xv-mono" style={{ marginTop: 4 }}>📘 Ngành gọi: {h.nganh.ten_nganh}</div><MoTaNganh n={h.nganh} />{nut}
    </div>);
  }
  if (nhom === 'luat') {
    const l = luatDung(key);
    if (!l) return <div className="xv-mono">Không còn luật “{key}” trong thư viện.</div>;
    return (<div style={{ display: 'grid', gap: 6, fontSize: 12.5 }}>
      <div className="xv-mono">📐 Luật dựng cảnh · {l.key}</div><b style={{ fontSize: 15 }}>{l.ten}</b>
      <div style={{ color: 'var(--fg-2)' }}>{l.luat}</div><div className="xv-mono">máy kiểm: {l.may}</div>
      {l.nganh && <><div className="xv-mono" style={{ marginTop: 4 }}>📘 Ngành gọi: {l.nganh.ten_nganh}</div><MoTaNganh n={l.nganh} /></>}<ViDuVideo ma={ma} />{nut}
    </div>);
  }
  const x = kyThuat(key, nhom as NhomKyThuat); const n = NHOM_KY_THUAT.find((g) => g.key === nhom);
  if (!x) return <div className="xv-mono">Không còn kỹ thuật “{ma}” trong thư viện.</div>;
  return (<div style={{ display: 'grid', gap: 6, fontSize: 12.5 }}>
    <div className="xv-mono">{n?.icon} {n?.ten} · {x.key}</div><b style={{ fontSize: 15 }}>{x.ten}</b>
    <div style={{ color: 'var(--fg-2)' }}>{x.mo_ta}</div>
    {x.nganh ? <><div className="xv-mono" style={{ marginTop: 4 }}>📘 Ngành gọi: {x.nganh.ten_nganh}</div><MoTaNganh x={x} /></> : <div className="xv-mono">Chưa có mô tả ngành chi tiết cho kỹ thuật này.</div>}
    {x.prompt && <div className="xv-mono" style={{ marginTop: 4 }}>prompt gửi model: {x.prompt}</div>}
    <div className="xv-mono">hợp thể loại: {x.the_loai === 'tat_ca' ? 'mọi thể loại' : x.the_loai.map((t) => THE_LOAI.find((y) => y.key === t)?.ten ?? t).join(', ')}</div>
    <ViDuVideo ma={ma} />
    {nut}
  </div>);
}

/** Kỹ thuật + luật ĐÃ ÁP cho một shot: mỗi cái một nhãn, bấm mở ngăn chi tiết (anh 15/10/2026: "những gì áp dụng từ thư viện điện ảnh thì show ở đây,
 *  bấm vào sẽ có thông tin chi tiết"). MỘT thành phần cho hàng shot (canh.tsx) và thẻ lưới (luoi-kich-ban.tsx). nhom = chỉ hiện các nhóm này. */
export function KyThuatApDung({ kt, nhom, nho }: { kt: KyThuatShot | undefined; nhom?: string[]; nho?: boolean }) {
  const ds = chiTietKyThuat(kt).filter((m) => !nhom || nhom.includes(m.ma.slice(0, m.ma.indexOf('.'))));
  if (!ds.length) return null;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: nho ? 2 : 4 }}>
      {ds.map((m) => <NhanKyThuat key={m.ma} m={m} nho={nho} />)}
    </span>
  );
}

/** Kỹ thuật + luật đã áp CHIA THEO NHÓM, có tên nhóm (anh 15/10/2026: "phải ghi tên, chia nhóm rõ ràng ở dưới chân cột bên trái") — chân cột ảnh của
 *  thẻ shot. Cùng dữ liệu chiTietKyThuat với KyThuatApDung; mỗi nhãn bấm mở ngăn chi tiết. */
export function KyThuatTheoNhom({ kt }: { kt: KyThuatShot | undefined }) {
  const ds = chiTietKyThuat(kt);
  if (!ds.length) return null;
  const nhom = [...new Map(ds.map((m) => [m.nhom, m.icon])).entries()];
  return (
    <div style={{ display: 'grid', gap: 5, marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--line)' }}>
      <div className="xv-mono" style={{ fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.3 }}>🎬 Thư viện điện ảnh đã áp</div>
      {nhom.map(([ten, icon]) => (
        <div key={ten} style={{ display: 'grid', gap: 2 }}>
          <div className="xv-mono" style={{ fontSize: 9.5, color: 'var(--fg-3)' }}>{icon} {ten}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {ds.filter((m) => m.nhom === ten).map((m) => <NhanKyThuat key={m.ma} m={m} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** MỘT nhãn kỹ thuật đã áp: rê chuột hiện thẻ mô tả (tên · nhóm · mô tả · tên ngành · mở → kết · khi nào dùng), bấm mở ngăn chi tiết đủ.
 *  Thẻ nổi neo theo nhãn bằng useViTriNoi (fixed, kẹp khung nhìn, thiếu chỗ thì lật lên) — không bị ngăn / lưới cắt. */
function NhanKyThuat({ m, nho }: { m: MucKyThuat; nho?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [mo, setMo] = useState(false);
  // Chữ thẻ nổi theo cỡ nhãn (#1392 "chữ quá to"): nhãn nhỏ 9.5px trên thẻ lưới mà thẻ nổi 12–14px thì to gấp rưỡi mọi thứ quanh nó.
  const co = nho ? { rong: 280, chu: 11, ten: 12.5, phu: 10, nho: 9.5 } : { rong: 340, chu: 12, ten: 14, phu: 11.5, nho: 10 };
  const viTri = useViTriNoi(ref, mo, { rong: co.rong, caoToiDa: 360 });   // hook tự tắt title của thẻ cha khi mở (#1392)
  const [nhom, key] = [m.ma.slice(0, m.ma.indexOf('.')), m.ma.slice(m.ma.indexOf('.') + 1)];
  const x = nhom === 'luat' ? undefined : kyThuat(key, nhom as NhomKyThuat);
  return (<>
    <button ref={ref} type="button" className="xv-mono" onMouseEnter={() => setMo(true)} onMouseLeave={() => setMo(false)} onFocus={() => setMo(true)} onBlur={() => setMo(false)}
      onClick={(e) => { e.stopPropagation(); setMo(false); moNgan({ loai: 'ky-thuat', ma: m.ma }); }}
      style={{ fontSize: nho ? 9.5 : 10.5, lineHeight: nho ? '14px' : '16px', padding: nho ? '0 4px' : '0 6px', border: `1px solid ${mo ? 'var(--cyan)' : 'var(--line)'}`, borderRadius: 4, background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
      {nho && `${m.icon} `}{m.ten.replace(/\s*\(.*\)$/, '')}
    </button>
    {mo && (
      <div role="tooltip" style={{ ...viTri, pointerEvents: 'none', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.55)', padding: '10px 12px', display: 'grid', gap: 6, fontSize: 12, lineHeight: 1.45 }}>
        <div className="xv-mono" style={{ fontSize: co.nho, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{m.icon} {m.nhom}</div>
        <b style={{ fontSize: co.ten, color: 'var(--fg-1)' }}>{m.ten}</b>
        <div style={{ color: 'var(--fg-2)', fontSize: co.chu }}>{m.mo_ta}</div>
        {x?.nganh && <>
          <div className="xv-mono" style={{ color: 'var(--cyan)', fontSize: co.phu }}>📘 {x.nganh.ten_nganh}</div>
          <div style={{ color: 'var(--fg-2)', fontSize: co.phu }}><b style={{ color: 'var(--fg-1)' }}>Mở → kết:</b> {x.nganh.dau_cuoi}</div>
          <div style={{ color: 'var(--fg-2)', fontSize: co.phu }}><b style={{ color: 'var(--fg-1)' }}>Khi nào dùng:</b> {x.nganh.dong_co}</div>
        </>}
        <div className="xv-mono" style={{ fontSize: co.nho, color: 'var(--fg-4)', borderTop: '1px dashed var(--line)', paddingTop: 5 }}>Bấm để xem đủ: cách làm · khán giả cảm · tránh · nguồn</div>
      </div>
    )}
  </>);
}

const mmss = (g: number) => `${Math.floor(g / 60)}:${String(g % 60).padStart(2, '0')}`;
/** ▶ VÍ DỤ VIDEO của một kỹ thuật (khung nhúng gửi referrer CHỈ tên miền: trang studio đặt same-origin, YouTube thiếu referrer thì báo "video unavailable") (vi-du-yt.ts — đoạn ĐÚNG chapter của video YouTube, mốc đọc từ chapter thật): ảnh thu nhỏ của video, bấm phát
 *  ngay tại chỗ đúng đoạn (youtube-nocookie, start → end), ↗ mở YouTube đúng giây. nho = thẻ trong lưới thư viện (ẩn trong <details>). */
function ViDuVideo({ ma, nho }: { ma: string; nho?: boolean }) {
  const ds = viDuCua(ma);
  const [mo, setMo] = useState<number | null>(null);
  if (!ds.length) return null;
  const than = (
    <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
      {ds.map((v, i) => (
        <div key={`${v.yt}${v.tu}`} style={{ display: 'grid', gap: 4 }}>
          {mo === i
            ? <iframe src={nhungYt(v)} title={v.chuong} referrerPolicy="strict-origin" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 6, background: '#000' }} />
            : <button type="button" onClick={() => setMo(i)} title={`Phát đoạn "${v.chuong}" (${mmss(v.tu)}${v.den ? `–${mmss(v.den)}` : ''}) ngay tại đây`}
                style={{ position: 'relative', padding: 0, border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: '#000', aspectRatio: '16 / 9', width: '100%' }}>
                <img src={anhYt(v.yt)} alt="" data-khong-phong-to="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.85 }} />
                <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 26, color: '#fff', textShadow: '0 2px 8px #000' }}>▶</span>
                <span className="xv-mono" style={{ position: 'absolute', left: 6, bottom: 4, color: '#fff', background: 'rgba(0,0,0,.65)', padding: '1px 6px', borderRadius: 4 }}>{mmss(v.tu)}{v.den ? `–${mmss(v.den)}` : ''}</span>
              </button>}
          <span className="xv-mono" style={{ fontSize: 10.5 }}>“{v.chuong}” · {v.video.split(/ [—–-] | \[/)[0]} · <LinkNgoai href={linkYt(v)} title={`Mở YouTube đúng giây ${mmss(v.tu)} · ${v.kenh} · đọc chapter ${v.ngay_doc}`}>↗ YouTube {mmss(v.tu)}</LinkNgoai></span>
        </div>
      ))}
    </div>
  );
  return nho ? <details style={{ marginTop: 4 }}><summary className="xv-mono" style={{ cursor: 'pointer' }}>▶ Ví dụ video</summary>{than}</details> : <div><div className="xv-mono" style={{ marginTop: 6 }}>▶ Ví dụ video (đoạn đúng chapter)</div>{than}</div>;
}

/** Bảng vai tuyến của một khung (mã · vai · mô tả · thường mở tập) — dùng ở trang khung và trang gói. */
function KhungTuyenBang({ k }: { k: KhungTuyen }) {
  return <table className="xv-tbl" style={{ marginTop: 4 }}><tbody>{k.tuyen.map((v) => <tr key={v.vai}>
    <td style={{ width: 24 }}><b>{v.ma}</b></td><td style={{ whiteSpace: 'nowrap' }}><b>{v.ten}</b></td><td style={{ color: 'var(--fg-2)' }}>{v.mo_ta}</td>
    <td className="xv-mono" style={{ whiteSpace: 'nowrap' }}>{v.mo_tu ? `mở tập ${v.mo_tu[0]}–${v.mo_tu[1]}` : 'từ tập 1'}</td></tr>)}</tbody></table>;
}

/** Nhãn bấm được của MỘT mục thư viện ('<nhóm>.<key>', 'luat.<key>', 'khuon.<key>') → mở ngăn chi tiết (dùng ở chi tiết khuôn). */
export function LinkMa({ ma, chu }: { ma: string; chu?: string }) {
  const [nhom, key] = [ma.slice(0, ma.indexOf('.')), ma.slice(ma.indexOf('.') + 1)];
  const ten = chu ?? (nhom === 'luat' ? luatDung(key)?.ten : nhom === 'khan_gia' ? hieuUngKG(key)?.ten : nhom === 'goi' ? goiTheoKey(key)?.ten : nhom === 'tuyen' ? khungTheoKey(key)?.ten : nhom === 'khuon' ? KHUON_CHUOI.find((x) => x.key === key)?.ten : kyThuat(key, nhom as NhomKyThuat)?.ten) ?? key;
  const ic = nhom === 'tuyen' ? '🧵' : nhom === 'luat' ? '📐' : nhom === 'khuon' ? '🧭' : nhom === 'khan_gia' ? '🎭' : nhom === 'goi' ? '📦' : NHOM_KY_THUAT.find((g) => g.key === nhom)?.icon ?? '';
  return <button type="button" className="xv-mono" onClick={(e) => { e.stopPropagation(); moNgan({ loai: 'ky-thuat', ma }); }} title="Mở trong thư viện điện ảnh"
    style={{ fontSize: 10.5, padding: '0 6px', lineHeight: '16px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', color: 'var(--fg-1)', cursor: 'pointer' }}>{ic} {ten.replace(/\s*\(.*\)$/, '')}</button>;
}
