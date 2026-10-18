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

export function ThuVienNoiDung({ tlDau = '' }: { tlDau?: string }) {
  const [tl, setTl] = useState<TheLoai | ''>(tlDau as TheLoai | '');
  const chip = (k: TheLoai | '', chu: string, title?: string) => (
    <button key={k || 'tat'} type="button" title={title} onClick={() => setTl(k)} className={`xv-btn${tl === k ? ' chinh' : ''}`} style={{ padding: '2px 9px' }}>{chu}</button>
  );
  return (
    <div>
      <div style={{ marginBottom: 8 }}><button type="button" className="xv-btn" onClick={() => moNgan({ loai: 'kho' })}>📦 Kho tài sản dùng lại (clip · keyframe · nhạc)</button></div>
      <div className="xv-mono" style={{ marginBottom: 8 }}>Claude chọn kỹ thuật cho từng shot từ thư viện này theo thể loại của phim; đổi được trong form shot. {THU_VIEN.length} kỹ thuật · {THE_LOAI.length} thể loại.</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {chip('', 'Tất cả')}
        {THE_LOAI.map((t) => chip(t.key, t.ten, t.mo_ta))}
      </div>
      <details className="xv-det xv-panel" open>
        <summary>📐 Luật dựng cảnh <small>{LUAT_DUNG_CANH.length} — mỗi shot ghi mã luật mình thực hiện; Claude viết kịch bản, tách cảnh, xem thử đều theo đúng danh sách này</small></summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 6, marginTop: 8 }}>
          {LUAT_DUNG_CANH.map((l, i) => (
            <div key={l.key} className="xv-canh">
              <b style={{ fontSize: 12 }}>{i + 1}. {l.ten}</b> <span className="xv-mono">{l.key}</span>
              <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 2 }}>{l.luat}</div>
              <div className="xv-mono" style={{ marginTop: 2 }}>máy kiểm: {l.may}{l.xem === false ? ' · luật của thợ (không vào người xem ảo)' : ''}</div>
              {l.nganh && <details style={{ marginTop: 4 }}><summary className="xv-mono" style={{ cursor: 'pointer' }}>📘 Ngành mô tả · {l.nganh.ten_nganh}</summary><MoTaNganh n={l.nganh} /></details>}
              <ViDuVideo ma={`luat.${l.key}`} nho />
            </div>
          ))}
        </div>
      </details>
      {NHOM_KY_THUAT.map((n) => {
        const ds = THU_VIEN.filter((x) => x.nhom === n.key && (!tl || hopTheLoai(x, tl)));
        if (!ds.length) return null;
        return (
          <details key={n.key} className="xv-det xv-panel" open={n.key === 'vai'}>
            <summary title={`${ds.length} kỹ thuật`}>{n.icon} {n.ten}</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6, marginTop: 8 }}>
              {ds.map((x) => (
                <div key={x.key} className="xv-canh" title={x.prompt ? `prompt: ${x.prompt}` : undefined}>
                  <b style={{ fontSize: 12 }}>{x.ten}</b> <span className="xv-mono">{x.key}</span>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 2 }}>{x.mo_ta}</div>
                  {x.nganh && <details style={{ marginTop: 4 }}><summary className="xv-mono" style={{ cursor: 'pointer' }}>📘 Ngành mô tả · {x.nganh.ten_nganh}</summary><MoTaNganh x={x} /></details>}
                  <ViDuVideo ma={`${x.nhom}.${x.key}`} nho />
                </div>
              ))}
            </div>
          </details>
        );
      })}
      <KhuonShotKhoi />
      <details className="xv-det xv-panel">
        <summary>📖 Cấu trúc beat theo loại phim <small>{Object.keys(CAU_TRUC).length}</small></summary>
        {Object.entries(CAU_TRUC).map(([k, c]) => (
          <div key={k} style={{ margin: '8px 0' }}><b style={{ fontSize: 12 }}>{c.ten}</b>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{c.beats.map((b, i) => <span key={b.ten} className="xv-mono" title={b.mo_ta} style={{ padding: '2px 8px', border: '1px solid var(--line)', borderRadius: 6 }}>{i + 1}. {b.ten}</span>)}</div>
          </div>
        ))}
      </details>
    </div>
  );
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
    <details className="xv-det xv-panel" open>
      <summary>🧩 Khuôn shot dùng lại <small>{ds ? `${ds.length} khuôn — máy tự ghi từ QC mẫu và cảnh đã tách, tên riêng đã thay bằng {sản phẩm} {nhân vật}; Claude đọc lại khi tách cảnh` : '…'}</small></summary>
      {!!cac.length && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '8px 0' }}>
        <button type="button" className={`xv-btn${!loai ? ' chinh' : ''}`} style={{ padding: '2px 9px' }} onClick={() => setLoai('')}>Tất cả</button>
        {cac.map((k) => <button key={k} type="button" className={`xv-btn${loai === k ? ' chinh' : ''}`} style={{ padding: '2px 9px' }} onClick={() => setLoai(k)}>{ten(k)} <span className="xv-mono">{(ds ?? []).filter((x) => x.loai === k).length}</span></button>)}
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
    </details>
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
/** ▶ VÍ DỤ VIDEO của một kỹ thuật (vi-du-yt.ts — đoạn ĐÚNG chapter của video YouTube, mốc đọc từ chapter thật): ảnh thu nhỏ của video, bấm phát
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
            ? <iframe src={nhungYt(v)} title={v.chuong} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 6, background: '#000' }} />
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
