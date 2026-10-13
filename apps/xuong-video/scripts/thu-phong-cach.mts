// THỬ PHONG CÁCH HÌNH cho một phim — TỐN TIỀN (mỗi ảnh = 1 keyframe, ~$0.034 với Nano Banana): sinh keyframe N shot đầu của một tập theo
// vài phong cách, CÙNG prompt shot + ảnh tham chiếu nhân vật như nút sinh keyframe thật (chuanBiKeyframe), chỉ thay câu phong cách.
// Ảnh thử KHÔNG gắn vào shot (job chỉ ghi sổ chi phí của phim). In ra url từng ảnh theo hướng để dựng bảng so sánh.
// cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/thu-phong-cach.mts <tap_id> [so_shot=3]
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { boiCanhCanh, taoJob, type Row } from '../src/lib/xuong-video/doc-db';
import { chuanBiKeyframe } from '../src/lib/xuong-video/sinh-anh';
import { chayViecAnh } from '../src/lib/xuong-video/viec-anh';
import { hoanTatAnh } from '../src/lib/xuong-video/hoan-tat';

const KHONG_CHU = 'vertical 9:16 frame. Clean frames with no text, letters, numbers or logos anywhere.';
/** null = giữ phong cách hiện tại của phim (đối chứng). */
const HUONG: { key: string; ten: string; phong_cach: string | null }[] = [
  { key: 'hien_tai', ten: 'Sáp màu hiện tại', phong_cach: null },
  { key: 'sach_tranh_sap', ten: 'Sách tranh sáp màu (viền đậm, màu kín, nền ít chi tiết)', phong_cach:
    `Children's picture-book illustration drawn in wax crayon: every character has a bold dark crayon outline and is colored in solid, saturated crayon with no white paper showing inside the shapes; backgrounds are fully colored in rich saturated crayon (deep blue sky, deep green hills, warm earth), simple and uncluttered with only a few large shapes so the characters pop; crayon texture and paper grain visible only as surface texture, never as messy scribbles; consistent, appealing character design with big expressive eyes; warm, high-contrast, eye-catching colors that read clearly on a small phone screen; ${KHONG_CHU}` },
  { key: 'cat_giay', ten: 'Cắt giấy dán (paper cut-out)', phong_cach:
    `Handmade paper cut-out collage look: characters and scenery built from layered cut and torn colored construction paper with visible paper fibers and slightly uneven scissor edges, soft drop shadows between paper layers giving gentle depth, bold flat saturated colors, simple readable shapes, big expressive eyes, cozy storybook feel that reads clearly on a small phone screen; ${KHONG_CHU}` },
];

const db = getDb()!;
const tapId = Number(process.argv[2]); const so = Number(process.argv[3] ?? 3);
if (!tapId) { console.error('cần tap_id'); process.exit(1); }
const phimId = Number(((await db.execute(sql`SELECT phim_id FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0]?.phim_id);
const ids = ((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id LIMIT ${so}`)) as unknown as Row[]).map((r) => Number(r.id));
const ra: Record<string, { shot: number; url: string | null; loi?: string }[]> = {};
for (const h of HUONG) {
  ra[h.key] = [];
  await Promise.all(ids.map(async (id) => {
    const bc = await boiCanhCanh(db, id); if (!bc) return;
    if (h.phong_cach) bc.kt.phong_cach = h.phong_cach;
    const { prompt, urlRef } = chuanBiKeyframe(bc);
    const job = await taoJob(db, { phim_id: phimId, nhan: `Thử phong cách · ${h.ten} · shot #${bc.canh.thu_tu}`, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { dich: 'thu_phong_cach', huong: h.key, canh: id, prompt, thamChieuUrl: urlRef } });
    const kq = await chayViecAnh({ job, model: bc.kt.mo_hinh_anh, prompt, thamChieuUrl: urlRef, tiLe: bc.kt.ti_le, thuMuc: `thu-phong-cach/${tapId}-${h.key}-${bc.canh.thu_tu}` });
    await hoanTatAnh(kq);   // job không gắn shot → chỉ ghi sổ tiền + làm sẵn ảnh nhỏ
    ra[h.key]!.push({ shot: bc.canh.thu_tu, url: kq.ok ? kq.url : null, ...(kq.ok ? {} : { loi: kq.loi }) });
  }));
  ra[h.key]!.sort((a, b) => a.shot - b.shot);
}
console.log(JSON.stringify(ra));
process.exit(0);
