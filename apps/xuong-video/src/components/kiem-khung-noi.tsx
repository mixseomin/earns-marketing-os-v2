'use client';
// Nhãn + thẻ nổi của ô 3D trên lưới (anh 15/10/2026: "cảnh báo khi hover vào ra toàn text + số, viết phức tạp — sửa lại, trình bày rõ ràng, đẹp").
// Một chỗ cho: thấy gì trong khung (chip), chỗ CHẶN (đỏ — sửa mới sinh được), CẢNH BÁO (vàng — Murch xếp cuối, không chặn tiền). Mỗi mục tách từ
// câu cổng (bo-set-3d.ts) theo khuôn "<luật>: <điều gì> — <hậu quả> — <sửa thế nào>" thành ba dòng, không còn chuỗi số thô.
import { useRef, useState } from 'react';
import { useViTriNoi } from './vi-tri-noi';
import { loiHinhHoc, vatChanTienCanh, khoiLapKhung } from '@/lib/xuong-video/bo-set-3d';
import type { Canh } from '@/lib/xuong-video/kieu';

export type MucKiem = { luat: string; dieu: string; hauQua?: string; sua?: string };
const TEN_LUAT: Record<string, string> = { 'luật 30°': 'Luật 30°', 'eye trace': 'Mắt khán giả (eye trace)', headroom: 'Khoảng trên đầu', 'khoảng nhìn': 'Khoảng nhìn', 'chiều cao máy': 'Chiều cao máy', 'bộ ống kính': 'Bộ ống kính', 'cú đối mặt': 'Khớp hướng nhìn' };
/** "<luật>: <điều gì> — <hậu quả> — <sửa>" → ba dòng. Câu không theo khuôn thì cả câu là "điều gì". */
export function tachMuc(s: string): MucKiem {
  const i = s.indexOf(': '); const nhan = i > 0 && i <= 28 && !s.slice(0, i).includes(' — ') ? s.slice(0, i) : '';
  const phan = (nhan ? s.slice(i + 2) : s).split(' — ');
  const luat = TEN_LUAT[nhan] ?? (nhan ? nhan.charAt(0).toUpperCase() + nhan.slice(1) : '');
  if (phan.length >= 3) return { luat, dieu: phan[0]!, hauQua: phan.slice(1, -1).join(' — '), sua: phan[phan.length - 1] };
  if (phan.length === 2) return { luat, dieu: phan[0]!, sua: phan[1] };
  return { luat, dieu: phan[0]! };
}

function Muc({ m, mau }: { m: MucKiem; mau: string }) {
  return (
    <div style={{ display: 'grid', gap: 2, paddingLeft: 9, borderLeft: `2px solid ${mau}` }}>
      <div style={{ fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.35 }}>{m.luat && <b style={{ color: mau }}>{m.luat} · </b>}{m.dieu}</div>
      {m.hauQua && <div style={{ fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.35 }}>→ {m.hauQua}</div>}
      {m.sua && <div style={{ fontSize: 11.5, color: 'var(--cyan)', lineHeight: 1.35 }}>Sửa: {m.sua}</div>}
    </div>
  );
}

/** Nhãn "🧊 3D" ở góc ô khung 3D + thẻ nổi khi rê chuột. loi = chỗ chặn (mạch, hình học); canhBao = cảnh báo (không chặn). */
export function NhanKhung3D({ c, loi, canhBao }: { c: Canh; loi: string[]; canhBao: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [mo, setMo] = useState(false);
  const viTri = useViTriNoi(ref, mo, { rong: 380, caoToiDa: 460 });
  const kx = c.khung_xam;
  // Hình học của chính khung (chủ thể ngoài khung / bị che, vật lấp, vật chắn tiền cảnh) — cùng hàm với cổng, viết lại thành câu ngắn.
  const hinhHoc = [
    ...loiHinhHoc(c).map((k) => (k.trong_khung ? `${k.nhan_vat} là chủ thể mà bị ${k.bi_che_boi.join(', ')} che — dời máy cho thấy rõ` : `${k.nhan_vat} là chủ thể mà nằm ngoài khung — xoay máy / lùi máy`)),
    ...khoiLapKhung(c, null).map((t) => `${t.ten} lấp ${t.pt}% khung — máy dí sát hoặc lọt trong vật — lùi máy hoặc đổi cỡ cảnh`),
    ...vatChanTienCanh(c, null).map((v) => `${v.ten} chắn tiền cảnh mà bố cục không nhắc — máy đang đặt sau đồ đạc — dời máy, hoặc ghi nó vào bố cục nếu cố ý`),
  ];
  const chan = [...hinhHoc, ...loi];
  const trang = chan.length ? { chu: `⚠ ${chan.length} chỗ chặn`, mau: 'var(--red)' } : canhBao.length ? { chu: `⚐ ${canhBao.length} cảnh báo`, mau: 'var(--amber)' } : { chu: '✓ qua', mau: '#4ade80' };
  const thay = [...(kx?.thay ?? [])].filter((t) => t.pt >= 1).sort((a, b) => b.pt - a.pt).slice(0, 8);
  return (<>
    <span ref={ref} className="xv-mono" onMouseEnter={() => setMo(true)} onMouseLeave={() => setMo(false)}
      style={{ position: 'absolute', left: 4, top: 4, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,.72)', color: '#93c5fd', cursor: 'help' }}>
      🧊 3D{chan.length ? <span style={{ color: 'var(--red)' }}> ⚠{chan.length}</span> : canhBao.length ? <span style={{ color: 'var(--amber)' }}> ⚐{canhBao.length}</span> : ''}
    </span>
    {mo && (
      <div role="tooltip" onClick={(e) => e.stopPropagation()} style={{ ...viTri, pointerEvents: 'none', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.55)', padding: '10px 12px', display: 'grid', gap: 8, fontSize: 12, zIndex: 60, textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.35 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span className="xv-mono" style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.3 }}>🧊 Khung 3D · shot #{c.thu_tu}</span>
          <b className="xv-mono" style={{ fontSize: 10.5, color: trang.mau }}>{trang.chu}</b>
        </div>
        {thay.length > 0 && (
          <div style={{ display: 'grid', gap: 4 }}>
            <div className="xv-mono" style={{ fontSize: 10, color: 'var(--fg-4)' }}>THẤY TRONG KHUNG</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {thay.map((t) => <span key={t.ten} className="xv-mono" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: t.tien ? 'rgba(220,38,38,.25)' : 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--fg-2)' }}>{t.ten} <b style={{ color: 'var(--fg-1)' }}>{Math.round(t.pt)}%</b>{t.tien ? ' · tiền cảnh' : ''}</span>)}
            </div>
          </div>
        )}
        {chan.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="xv-mono" style={{ fontSize: 10, color: 'var(--red)' }}>⚠ CHẶN — sửa 3D rồi mới sinh được</div>
            {chan.map((x, i) => <Muc key={i} m={tachMuc(x)} mau="var(--red)" />)}
          </div>
        )}
        {canhBao.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="xv-mono" style={{ fontSize: 10, color: 'var(--amber)' }}>⚐ CẢNH BÁO — không chặn, nên sửa khi rảnh tay</div>
            {canhBao.map((x, i) => <Muc key={i} m={tachMuc(x)} mau="var(--amber)" />)}
          </div>
        )}
        {!chan.length && !canhBao.length && <div style={{ color: 'var(--fg-2)' }}>Bố trí, trục máy, nhịp dẫn, chủ thể: đều qua.</div>}
        <div className="xv-mono" style={{ fontSize: 10, color: 'var(--fg-4)', borderTop: '1px dashed var(--line)', paddingTop: 5 }}>Bấm ô để xoay xem 3D đúng máy của shot</div>
      </div>
    )}
  </>);
}
