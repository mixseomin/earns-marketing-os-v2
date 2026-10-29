// HÀNG ĐỢI MÁY SINH KỂ CHUYỆN (anh 29/10/2026 "sinh cho hợp lý về tài nguyên và hiệu quả") — 0đ, chỉ đọc kho. In JSON các phim nên sinh bản kể chuyện kế tiếp, điểm cao trước.
// Nguồn phim = danh sách cầu app gốc (xv_khoa_ngoai ethopex_200_phim) + mọi phim có camp nhà (etp.phim) — cần link trang phim để máy viết kịch bản từ tóm tắt thật.
// ĐIỂM (một chỗ, đổi ở đây) — anh 29/10/2026 "sx loại video KT cho các phim chưa có nhưng đang lên camp live triệt để": hai bậc đầu đứng trên mọi bậc cũ:
//   phim đang cần CAMP THAY (etp.thay_the mở — sắp mất camp cuối)          → 3000 + lãi
//   phim có camp ĐANG CHẠY mà CHƯA có creative kể chuyện nào             → 2000 + lãi
//   (phim đã có creative kể chuyện dùng được → hạ về bậc cũ, không chen trước phim chưa có)
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
const dsCau = ((await q<{ gia_tri: { id: string; ten: string; url: string; nguon: string; locale: string }[] }>(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_200_phim'`))[0]?.gia_tri ?? []);
// + MỌI phim đang có camp nhà có link trang phim (etp.phim) — danh sách cầu chỉ là phim mới, thiếu phim đang lãi nhất (Number One, Nobody lần chạy đầu 29/10)
const dsNha = await q<{ id: string; ten: string; url: string; nguon: string; locale: string }>(sql`SELECT p.content_id::text id, p.ten, p.url, p.nguon, p.locale FROM etp.phim p
  WHERE coalesce(p.url, '') <> '' AND EXISTS (SELECT 1 FROM etp.camp c WHERE c.content_id = p.content_id)`);
const daCo = new Set(dsCau.map((p) => p.id));
const ds = [...dsCau, ...dsNha.filter((p) => !daCo.has(p.id))];
const tt = ((await q<{ gia_tri: Record<string, { tt: string }> }>(sql`SELECT gia_tri FROM xv_khoa_ngoai WHERE ten = 'ethopex_phim_moi_tt'`))[0]?.gia_tri ?? {});
const so14 = new Map((await q<{ content_id: number; chi: number; thu: number }>(sql`SELECT c.content_id, coalesce(sum(n.chi), 0)::float chi, coalesce(sum(n.thu), 0)::float thu
  FROM etp.camp c JOIN etp.so_ngay n USING (camp_id) WHERE n.ngay >= current_date - 14 AND c.content_id IS NOT NULL GROUP BY 1`)).map((r) => [Number(r.content_id), r]));
// bản kể chuyện của phim: thắng / thua theo cùng định nghĩa tab Thư viện (chi 14 ngày ≥ $5, ROI ≥ 0 / < 0)
const kc = new Map((await q<{ content_id: number; thang: number; thua: number }>(sql`WITH s AS (SELECT etp.creative_cua(c.creative_id, c.ten) cr, sum(n.chi) chi, sum(n.thu) thu
    FROM etp.camp c JOIN etp.so_ngay n USING (camp_id) WHERE n.ngay >= current_date - 14 GROUP BY 1)
  SELECT cr.content_id, count(*) FILTER (WHERE s.chi >= 5 AND s.thu >= s.chi)::int thang, count(*) FILTER (WHERE s.chi >= 5 AND s.thu < s.chi)::int thua
  FROM etp.creative cr JOIN s ON s.cr = cr.creative_id WHERE cr.dang = 'kể chuyện' GROUP BY 1`)).map((r) => [Number(r.content_id), r]));
// 'loi_may' = máy sinh hỏng vì lỗi MÁY (br / mạng), không phải phim hỏng → không chặn 3 ngày (29/10/2026: br chưa gắn profile làm bỏ oan 2 phim)
const cho = new Set((await q<{ content_id: number }>(sql`SELECT DISTINCT content_id FROM etp.thu_vien WHERE (trang_thai IN ('dang_sinh', 'san_sang') AND creative_id IS NULL) OR (tao > now() - interval '3 days' AND trang_thai <> 'loi_may')`)).map((r) => Number(r.content_id)));
const live = new Set((await q<{ content_id: number }>(sql`SELECT DISTINCT content_id FROM etp.camp WHERE trang_thai = 'ACTIVE' AND content_id IS NOT NULL`)).map((r) => Number(r.content_id)));
const coKt = new Set((await q<{ content_id: number }>(sql`SELECT DISTINCT content_id FROM etp.creative WHERE dang = 'kể chuyện' AND tu_choi IS NULL AND content_id IS NOT NULL`)).map((r) => Number(r.content_id)));
const thay = new Set((await q<{ content_id: number }>(sql`SELECT content_id FROM etp.thay_the WHERE buoc NOT IN ('chay', 'huy')`).catch(() => [])).map((r) => Number(r.content_id)));
const hang = ds.map((p, i) => {
  const id = Number(p.id), s = so14.get(id), k = kc.get(id), lai = s ? s.thu - s.chi : 0;
  const bo = cho.has(id) ? 'đã có bản chờ chạy / vừa sinh' : tt[p.id]?.tt === 'poster_loai' ? 'poster bị loại (soát phim mới)' : k && k.thua >= 2 && !k.thang ? `kể chuyện đã thua ${k.thua} lần, chưa thắng` : !p.url ? 'thiếu link trang phim' : null;
  const diem = !coKt.has(id) && thay.has(id) ? 3000 + lai : !coKt.has(id) && live.has(id) ? 2000 + lai : !s ? 500 - Math.min(i, 399) : lai > 0 ? 1000 + lai : 100 + lai;
  return { content_id: id, ten: p.ten, url: p.url, nguon: p.nguon, lang: p.locale?.startsWith('es') ? 'es' : 'en', diem: Math.round(diem * 100) / 100, lai14: Math.round(lai * 100) / 100, chi14: Math.round((s?.chi ?? 0) * 100) / 100, kc: k ?? null, bo };
}).filter((x) => !x.bo).sort((a, b) => b.diem - a.diem).slice(0, so);
console.log(JSON.stringify(hang));
process.exit(0);
