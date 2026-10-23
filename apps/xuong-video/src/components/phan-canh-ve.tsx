'use client';
// 🎬 PHÂN CẢNH — tab Storyboard (anh 24/10/2026: "phải drilldown từ tổng quan trước rồi mới vào chi tiết… đọc như truyện tranh để hiểu", "phải show nó
// ra trong studio của phim luôn"). Mỗi cảnh một khối, đọc từ trên xuống: 1 tờ phác bố trí (máy vẽ từ sơ đồ — ai đứng đâu, nhìn đâu, nền nào) →
// 2 thumbnail cả cảnh (AI) → 3 bảng khối → 4 khung chi tiết = keyframe từng shot kèm hành động · thoại · cớ cắt (đọc không cũng nắm được mạch).
// Dữ liệu: xv_tap.phan_canh_ve (scripts/bang-gom.mts ghi) + xv_canh. Ảnh bấm = mở cỡ thật.
import type { Canh, Tap } from '@/lib/xuong-video/kieu';
import { TEN_NOI } from '@/lib/xuong-video/noi-nhip';
import { mono } from './ui';

const Anh = ({ url, cao, tieuDe }: { url: string; cao: number; tieuDe: string }) => (
  <a href={url} target="_blank" rel="noreferrer" title={`${tieuDe} — mở cỡ thật`} style={{ flex: '0 0 auto' }}>
    <img src={url} alt={tieuDe} style={{ height: cao, width: 'auto', borderRadius: 4, border: '1px solid var(--line)', display: 'block' }} />
  </a>
);
const Tang = ({ so, ten, mo, children }: { so: number; ten: string; mo: string; children: React.ReactNode }) => (
  <div style={{ display: 'grid', gap: 4 }}>
    <div style={{ fontSize: 12, fontWeight: 600 }}>{so} · {ten} <span style={{ ...mono, fontWeight: 400 }}>{mo}</span></div>
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>{children}</div>
  </div>
);

export function PhanCanhVe({ tap, canh, onMo }: { tap: Tap; canh: Canh[]; onMo: (id: number) => void }) {
  const cacCanh = [...new Set(canh.map((c) => c.phan_doan))];
  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
      {cacCanh.map((pd) => {
        const ve = (tap.phan_canh_ve ?? []).find((x) => x.phan_doan === pd); const ds = canh.filter((c) => c.phan_doan === pd);
        return (
          <div key={pd} className="xv-panel" style={{ display: 'grid', gap: 10, padding: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Cảnh: {pd || '(chưa đặt tên)'} <span style={{ ...mono, fontWeight: 400 }}>{ds.length} shot{ve ? ` · phân cảnh lúc ${new Date(ve.luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : ''}</span></div>
            {!ve && <div style={mono}>Cảnh này chưa có phân cảnh vẽ (tờ phác / thumbnail / bảng khối) — chạy scripts/bang-gom.mts với bảng mảnh có sơ đồ cảnh. Bên dưới là keyframe hiện có.</div>}
            {ve?.phac && <Tang so={1} ten="Tổng quan — tờ phác bố trí" mo="máy vẽ từ sơ đồ cảnh: tường · cửa · ai đứng đâu (bóng màu) · mũi tên = hướng nhìn"><Anh url={ve.phac} cao={360} tieuDe="Tờ phác bố trí" /></Tang>}
            {ve?.t1 && <Tang so={2} ten="Thumbnail cả cảnh" mo="AI vẽ cả cảnh trong một ảnh theo tờ phác — chốt bố cục, trạng thái đồ"><Anh url={ve.t1} cao={360} tieuDe="Thumbnail cả cảnh" /></Tang>}
            {!!ve?.khoi?.length && <Tang so={3} ten="Bảng khối" mo="từng khối khung vẽ lại chi tiết, giữ bố cục tầng trên">{ve.khoi.map((k) => <Anh key={k.url} url={k.url} cao={300} tieuDe={`Khối #${k.tu}–#${k.den}`} />)}</Tang>}
            <Tang so={ve ? 4 : 1} ten="Khung chi tiết — đọc như truyện tranh" mo="keyframe từng shot · hành động · thoại · cớ cắt sang khung sau; bấm chữ để mở shot">
              {ds.map((c) => (
                <div key={c.id} style={{ width: 170, flex: '0 0 auto', display: 'grid', gap: 3, alignContent: 'start' }}>
                  {c.keyframe_url ? <Anh url={c.keyframe_url} cao={300} tieuDe={`#${c.thu_tu}`} /> : <div style={{ height: 300, border: '1px dashed var(--line)', borderRadius: 4, display: 'grid', placeItems: 'center', ...mono }}>chưa có keyframe</div>}
                  <button type="button" onClick={() => onMo(c.id)} style={{ all: 'unset', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, lineHeight: 1.35 }}>#{c.thu_tu} · {c.hanh_dong}</button>
                  {c.thoai.filter((t) => t.loi.trim()).map((t, i) => <div key={i} style={{ fontSize: 11, color: 'var(--amber, #b8860b)', lineHeight: 1.35 }}>{t.nhan_vat}: “{t.loi}”</div>)}
                  {c.dan_dung?.noi && <div style={mono}>↳ cắt {TEN_NOI[c.dan_dung.noi]}</div>}
                </div>
              ))}
            </Tang>
          </div>
        );
      })}
    </div>
  );
}
