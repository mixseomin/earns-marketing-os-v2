// Tab Lịch của phòng: mỗi hạn là một card followup thật (đọc từ DB), xếp theo tháng, đếm ngày còn lại theo giờ VN.
// Thêm/đổi hạn = `followup add|at|done` — trang tự theo, không có bảng chữ nào phải sửa tay.
import { hrefThe } from '@/lib/ngan';
import { Nguoi } from './nguoi';
import type { chuCard } from '@/lib/trach-nhiem';
import type { lichPhong } from '@/lib/do-dac';

export type MucLich = NonNullable<Awaited<ReturnType<typeof lichPhong>>>[number];
const XONG = ['done', 'completed', 'verified'];
export const conNgay = (han: string, hom: string) => Math.round((Date.parse(han) - Date.parse(hom)) / 86_400_000);
/** Số mục cần để mắt: chưa xong và quá hạn hoặc còn ≤ 30 ngày. */
export const demGap = (ds: MucLich[], hom: string) => ds.filter((m) => !XONG.includes(m.status) && m.han && conNgay(m.han, hom) <= 30).length;

function Dem({ m, hom }: { m: MucLich; hom: string }) {
  if (XONG.includes(m.status)) return <span className="cty-pill cty-pill-kind">xong</span>;
  if (!m.han) return <span className="cty-pill cty-pill-kind">chưa hẹn</span>;
  const d = conNgay(m.han, hom);
  if (d < 0) return <span className="cty-pill cty-pill-loi">quá {-d} ngày</span>;
  if (d === 0) return <span className="cty-pill cty-pill-loi">hôm nay</span>;
  return <span className={`cty-pill${d <= 30 ? ' cty-pill-off' : ''}`}>còn {d} ngày</span>;
}

export type ChuLich = Record<number, ReturnType<typeof chuCard>>;
/** chu: id card → quy trình + người chủ trì (the_loc). Hạn không thuộc quy trình nào = "chưa giao" đỏ: mọi hạn phải có MỘT người chịu. */
export function LichPhong({ ds, hom, chu }: { ds: MucLich[] | null; hom: string; chu: ChuLich }) {
  if (ds === null) return <p className="cty-bao-loi" data-loi>Không đọc được lịch (human_tasks, DB MOS2) — xem journal mos2-cty.</p>;
  if (!ds.length) return <p className="cty-muted">Chưa có hạn nào. Thêm bằng <code>followup add &lt;dự án&gt; "&lt;tựa khớp lich_loc&gt;" --due YYYY-MM-DD</code>.</p>;
  const thang = new Map<string, MucLich[]>();
  for (const m of ds) { const k = m.han ? m.han.slice(0, 7) : 'chưa hẹn'; thang.set(k, [...(thang.get(k) ?? []), m]); }
  return (
    <div className="cty-lich">
      {[...thang].map(([k, ms]) => (
        <section key={k} className="cty-lich-thang">
          <h3>{k === 'chưa hẹn' ? k : `Tháng ${k.slice(5)}/${k.slice(0, 4)}`}</h3>
          {ms.map((m) => (
            <div key={m.id} className={`cty-lich-muc${XONG.includes(m.status) ? ' cty-lich-xong' : ''}`}>
              <span className="cty-lich-ngay">{m.han ? `${m.han.slice(8, 10)}/${m.han.slice(5, 7)}` : '—'}</span>
              <span className="cty-lich-tua"><a href={hrefThe(m.id)}>{m.title}</a>{chu[m.id] && <span className="cty-muted cty-nho"> · {chu[m.id]!.ten}</span>}</span>
              <span className="cty-lich-ai">{chu[m.id]?.nguoi ? <Nguoi id={chu[m.id]!.nguoi!} /> : <span className="cty-pill cty-pill-loi">chưa giao</span>}</span>
              <Dem m={m} hom={hom} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
