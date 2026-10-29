// HÀNG ĐỢI MÁY SINH KỂ CHUYỆN (anh 29/10/2026 "sinh cho hợp lý về tài nguyên và hiệu quả") — 0đ, chỉ đọc kho. In JSON các phim nên sinh bản kể chuyện kế tiếp, điểm cao trước.
// Nguồn phim = danh sách cầu app gốc (xv_khoa_ngoai ethopex_200_phim: id, tên, link trang phim, nguồn, tiếng) — có link trang phim thì máy viết được kịch bản từ tóm tắt thật.
// ĐIỂM (một chỗ, đổi ở đây):
//   phim đang LÃI 14 ngày trên camp nhà       → 1000 + lãi   (đã có khách, thêm góc kể chuyện $0 để mở rộng)
//   phim CHƯA có camp nhà (cầu app gốc cao)    → 500 − thứ hạng trong danh sách cầu
//   phim đang lỗ                               → 100 + lãi (âm) — xếp cuối, vẫn có thể cứu bằng góc mới
// LOẠI KHỎI HÀNG: đã có bản thư viện CHƯA chạy / đang sinh (không chất đống bản chưa ai dùng) · bản kể chuyện của phim đã THUA ≥ 2 mà chưa thắng lần nào
//   · poster bị loại ở quy trình phim mới (gợi dục / máu — ethopex_phim_moi_tt poster_loai) · đã sinh trong 3 ngày qua cho phim đó.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/ethopex/hang-ke-chuyen.mts [--so=10]
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

const so = Number(process.argv.find((a) => a.startsWith('--so='))?.slice(5) ?? 10);
const db = getDb()!;
const q = async <T,>(s: ReturnType<typeof sql>) => (await db.execute(s)) as unknown as T[];
const ds = ((await q<{ gia_tri: { id: string; ten: string; url: string; nguon: string; locale: string }[] }>(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_200_phim'`))[0]?.gia_tri ?? []);
const tt = ((await q<{ gia_tri: Record<string, { tt: string }> }>(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_phim_moi_tt'`))[0]?.gia_tri ?? {});
const so14 = new Map((await q<{ content_id: number; chi: number; thu: number }>(sql`SELECT c.content_id, coalesce(sum(n.chi), 0)::float chi, coalesce(sum(n.thu), 0)::float thu
  FROM etp.camp c JOIN etp.so_ngay n USING (camp_id) WHERE n.ngay >= current_date - 14 AND c.content_id IS NOT NULL GROUP BY 1`)).map((r) => [Number(r.content_id), r]));
// bản kể chuyện của phim: thắng / thua theo cùng định nghĩa tab Thư viện (chi 14 ngày ≥ $5, ROI ≥ 0 / < 0)
const kc = new Map((await q<{ content_id: number; thang: number; thua: number }>(sql`WITH s AS (SELECT etp.creative_cua(c.creative_id, c.ten) cr, sum(n.chi) chi, sum(n.thu) thu
    FROM etp.camp c JOIN etp.so_ngay n USING (camp_id) WHERE n.ngay >= current_date - 14 GROUP BY 1)
  SELECT cr.content_id, count(*) FILTER (WHERE s.chi >= 5 AND s.thu >= s.chi)::int thang, count(*) FILTER (WHERE s.chi >= 5 AND s.thu < s.chi)::int thua
  FROM etp.creative cr JOIN s ON s.cr = cr.creative_id WHERE cr.dang = 'kể chuyện' GROUP BY 1`)).map((r) => [Number(r.content_id), r]));
const cho = new Set((await q<{ content_id: number }>(sql`SELECT DISTINCT content_id FROM etp.thu_vien WHERE (trang_thai IN ('dang_sinh', 'san_sang') AND creative_id IS NULL) OR tao > now() - interval '3 days'`)).map((r) => Number(r.content_id)));
const hang = ds.map((p, i) => {
  const id = Number(p.id), s = so14.get(id), k = kc.get(id), lai = s ? s.thu - s.chi : 0;
  const bo = cho.has(id) ? 'đã có bản chờ chạy / vừa sinh' : tt[p.id]?.tt === 'poster_loai' ? 'poster bị loại (soát phim mới)' : k && k.thua >= 2 && !k.thang ? `kể chuyện đã thua ${k.thua} lần, chưa thắng` : !p.url ? 'thiếu link trang phim' : null;
  const diem = !s ? 500 - i : lai > 0 ? 1000 + lai : 100 + lai;
  return { content_id: id, ten: p.ten, url: p.url, nguon: p.nguon, lang: p.locale?.startsWith('es') ? 'es' : 'en', diem: Math.round(diem * 100) / 100, lai14: Math.round(lai * 100) / 100, chi14: Math.round((s?.chi ?? 0) * 100) / 100, kc: k ?? null, bo };
}).filter((x) => !x.bo).sort((a, b) => b.diem - a.diem).slice(0, so);
console.log(JSON.stringify(hang));
process.exit(0);
