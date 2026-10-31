'use client';
// 🎬 PHÂN CẢNH — nút 🎞 Storyboard của tập (anh 24/10/2026: "phải drilldown từ tổng quan trước rồi mới vào chi tiết… đọc như truyện tranh để hiểu", "phải show nó
// ra trong studio của phim luôn"). Mỗi cảnh một khối, đọc từ trên xuống: 1 tờ phác bố trí (máy vẽ từ sơ đồ — ai đứng đâu, nhìn đâu, nền nào) →
// 2 thumbnail cả cảnh (AI) → 3 bảng khối → 4 khung chi tiết = keyframe từng shot kèm hành động · thoại · cớ cắt (đọc không cũng nắm được mạch).
// Dữ liệu: xv_tap.phan_canh_ve (scripts/bang-gom.mts ghi) + xv_canh. Ảnh bấm = ngăn xem to (ngan-chung › moNgan). Link: ?tab=storyboard&sbx=phan_canh.
import type { Canh, Tap } from '@/lib/xuong-video/kieu';
import { khungDoc } from '@/lib/xuong-video/khung-doc';
import { mono } from './ui';
import { moNgan } from './ngan-chung';

const Anh = ({ url, cao, tieuDe }: { url: string; cao: number; tieuDe: string }) => (
  <img src={url} alt={tieuDe} title={`${tieuDe} — bấm để xem to`} onClick={() => moNgan({ loai: 'xem', url, ten: tieuDe })}
    style={{ height: cao, width: 'auto', flex: '0 0 auto', borderRadius: 4, border: '1px solid var(--line)', display: 'block', cursor: 'zoom-in' }} />
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
        // số tầng theo những tầng THỰC có (tổng quan → chi tiết), không đánh số cứng
        const tang = [ve?.phac && 'phac', ve?.t1 && 't1', ve?.khoi?.length && 'khoi', 'kf'].filter(Boolean) as string[]; const soT = (k: string) => tang.indexOf(k) + 1;
        return (
          <div key={pd} className="xv-panel" style={{ display: 'grid', gap: 10, padding: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Cảnh: {pd || '(chưa đặt tên)'} <span style={{ ...mono, fontWeight: 400 }}>{ds.length} shot{ve ? ` · phân cảnh lúc ${new Date(ve.luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : ''}</span></div>
            {!ve && <div style={mono}>Cảnh này chưa có phân cảnh vẽ (tờ phác / thumbnail / bảng khối) — chạy scripts/bang-gom.mts với bảng mảnh có sơ đồ cảnh. Bên dưới là keyframe hiện có.</div>}
            {/* tầng 1–3 cạnh nhau một hàng (tổng quan → chi tiết đọc trái sang phải), khung chi tiết ngay dưới — cả cảnh trong một màn */}
            {ve && <div style={{ display: 'flex', gap: 18, overflowX: 'auto', alignItems: 'flex-start' }}>
              {ve.phac && <Tang so={soT('phac')} ten="Tổng quan — tờ phác bố trí" mo="máy vẽ từ sơ đồ: nền · ai đứng đâu · mũi tên = hướng nhìn · #N = số shot"><Anh url={ve.phac} cao={300} tieuDe="Tờ phác bố trí" /></Tang>}
              {ve.t1 && <Tang so={soT('t1')} ten="Thumbnail cả cảnh" mo="AI vẽ cả cảnh một ảnh theo tờ phác"><Anh url={ve.t1} cao={300} tieuDe="Thumbnail cả cảnh" /></Tang>}
              {!!ve.khoi?.length && <Tang so={soT('khoi')} ten="Bảng khối" mo="AI vẽ từng khối theo tờ phác · số #N = số shot">{ve.khoi.map((k) => <Anh key={k.url} url={k.url} cao={300} tieuDe={`Bảng khối shot #${k.tu}–#${k.den}`} />)}</Tang>}
            </div>}
            <Tang so={soT('kf')} ten="Khung chi tiết — đọc như truyện tranh" mo="mỗi shot: khung đầu → giữa → cuối · trạng thái đồ (⚡ = vừa đổi) · thoại · cớ cắt; bấm chữ để mở shot">
              {/* mỗi shot một cụm: khung đầu → giữa → cuối liền nhau (khung-doc.ts — cùng hàm với bảng truyện tranh) */}
              {ds.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 4, flex: '0 0 auto', padding: 4, border: '1px solid var(--line)', borderRadius: 6 }}>
                  {khungDoc(c).map((k) => (
                    <div key={k.luc} style={{ width: 140, display: 'grid', gap: 3, alignContent: 'start' }}>
                      {k.url ? <Anh url={k.url} cao={248} tieuDe={k.nhan} /> : <div style={{ height: 248, border: '1px dashed var(--line)', borderRadius: 4, display: 'grid', placeItems: 'center', ...mono }}>chưa có khung</div>}
                      <button type="button" onClick={() => onMo(c.id)} style={{ all: 'unset', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, lineHeight: 1.35 }}>{k.nhan} · {k.vi}</button>
                      {k.vat.map((v, i) => <div key={i} style={{ fontSize: 10.5, lineHeight: 1.3, color: v.startsWith('⚡') ? 'var(--red, #d9534f)' : 'var(--green, #3a8f3a)' }}>{v}</div>)}
                      {k.thoai.map((t, i) => <div key={i} style={{ fontSize: 11, color: 'var(--amber, #b8860b)', lineHeight: 1.35 }}>{t}</div>)}
                      {k.noi && <div style={mono}>{k.noi}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </Tang>
          </div>
        );
      })}
    </div>
  );
}
