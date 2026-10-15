'use client';
// Thư viện ngôn ngữ điện ảnh (#1195) — nội dung dùng chung cho drawer 🎬 (mở từ đầu trang / form shot) và trang /thu-vien.
// Lọc theo thể loại tại chỗ (state), không điều hướng.
import { useEffect, useState } from 'react';
import { dsKhuonShot } from '@/lib/actions';
import { moNgan } from './ngan-chung';
import { LOAI_SHOT_MAU } from '@/lib/xuong-video/kieu';
import type { KhuonShot } from '@/lib/xuong-video/khuon-shot';
import { THE_LOAI, NHOM_KY_THUAT, THU_VIEN, CAU_TRUC, hopTheLoai, kyThuat, chiTietKyThuat, type TheLoai, type KyThuat, type KyThuatShot, type NhomKyThuat } from '@/lib/xuong-video/dien-anh';
import { LUAT_DUNG_CANH, luatDung } from '@/lib/xuong-video/luat-dung';

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
              <div className="xv-mono" style={{ marginTop: 2 }}>máy kiểm: {l.may}</div>
            </div>
          ))}
        </div>
      </details>
      {NHOM_KY_THUAT.map((n) => {
        const ds = THU_VIEN.filter((x) => x.nhom === n.key && (!tl || hopTheLoai(x, tl)));
        if (!ds.length) return null;
        return (
          <details key={n.key} className="xv-det xv-panel" open={n.key === 'vai'}>
            <summary>{n.icon} {n.ten} <small>{ds.length}</small></summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6, marginTop: 8 }}>
              {ds.map((x) => (
                <div key={x.key} className="xv-canh" title={x.prompt ? `prompt: ${x.prompt}` : undefined}>
                  <b style={{ fontSize: 12 }}>{x.ten}</b> <span className="xv-mono">{x.key}</span>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 2 }}>{x.mo_ta}</div>
                  {x.nganh && <details style={{ marginTop: 4 }}><summary className="xv-mono" style={{ cursor: 'pointer' }}>📘 Ngành mô tả · {x.nganh.ten_nganh}</summary><MoTaNganh x={x} /></details>}
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
function MoTaNganh({ x }: { x: KyThuat }) {
  if (!x.nganh) return null;
  return (
    <dl style={{ fontSize: 11.5, color: 'var(--fg-2)', margin: '4px 0 0', display: 'grid', gap: 3 }}>
      {([['Mở → kết', x.nganh.dau_cuoi], ['Thực hiện', x.nganh.thuc_hien], ['Khi nào dùng', x.nganh.dong_co], ['Khán giả cảm', x.nganh.cam_xuc], ['Tránh', x.nganh.tranh], ['Nguồn', x.nganh.nguon]] as const).map(([t, v]) => <div key={t}><b>{t}:</b> {v}</div>)}
      {x.may_di && <div className="xv-mono">máy 3D: {x.may_di.kieu}{x.may_di.ti_le ? ` · chủ thể ×${x.may_di.ti_le}` : ''}{x.may_di.goc ? ` · ${x.may_di.goc}°` : ''} · {x.may_di.toc}</div>}
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
      <div style={{ color: 'var(--fg-2)' }}>{l.luat}</div><div className="xv-mono">máy kiểm: {l.may}</div>{nut}
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
      {ds.map((m) => (
        <button key={m.ma} type="button" className="xv-mono" title={`${m.nhom}: ${m.mo_ta}\nBấm xem chi tiết`} onClick={(e) => { e.stopPropagation(); moNgan({ loai: 'ky-thuat', ma: m.ma }); }}
          style={{ fontSize: nho ? 9.5 : 10.5, lineHeight: nho ? '14px' : '16px', padding: nho ? '0 4px' : '0 6px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.icon} {m.ten.replace(/\s*\(.*\)$/, '')}
        </button>
      ))}
    </span>
  );
}
