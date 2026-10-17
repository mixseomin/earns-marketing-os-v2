// THỬ GIỌNG (casting giọng) tập mẫu tổng tài — bước 3: mỗi ứng viên đọc ĐÚNG một câu thoại thật của nhân vật, kèm chỉ dẫn diễn [dien_xuat]
// như lúc sinh thoại thật (sinh-giong.ts). Ghi sổ job + vào GIỌNG ĐÃ THỬ của nhân vật (hoan-tat.ts) — chọn trên thẻ nhân vật (🗣). TỐN TIỀN:
//   cd apps/xuong-video && DUYET_SINH_1_LAN=1 NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/du-lieu/tong-tai/thu-giong.mts
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { taoJob, type Db, type Row } from '../../../src/lib/xuong-video/doc-db';
import { dayViecAm } from '../../../src/lib/xuong-video/hoan-tat';
import { dauVaoGiongTheoModel, dsMoHinhGiong } from '../../../src/lib/xuong-video/giong';
import { giaGiongTheo } from '../../../src/lib/xuong-video/am-thanh';

// Lượt 2 (anh 17/10/2026 "chọn bộ giọng châu Á"): MiniMax 2.8 HD — giọng gốc Quan Thoại / Hàn / bản ngữ Việt (platform.minimax.io/docs/faq/system-voice-id),
// đọc tiếng Việt nhờ language_boost Vietnamese (giong.ts › dauVaoGiongTheoModel). Lượt 1 (ElevenLabs v3, giọng Mỹ/Anh) anh không chọn.
const PHIM = 119; const MODEL = 'fal-ai/minimax/speech-2.8-hd';
const THU: { ten: string; dien: string; loi: string; giong: string[] }[] = [
  { ten: 'Lâm Hạ', dien: 'bình thản, nhìn thẳng', loi: 'Sáng nay chính chị nhận từ tay tôi.', giong: ['Vietnamese_kindhearted_girl', 'Chinese (Mandarin)_IntellectualGirl'] },
  { ten: 'Lục Thần', dien: 'lạnh, không cao giọng, dứt khoát', loi: 'Chuyện gì? … Cô bị đuổi việc.', giong: ['Korean_ColdYoungMan', 'Korean_DominantMan'] },
  { ten: 'Vivian', dien: 'giọng to cho cả phòng nghe, khinh khỉnh', loi: 'Hồ sơ Harrington đâu? Ngày đầu đi làm đã làm mất tài liệu mật?', giong: ['Arrogant_Miss', 'Korean_HaughtyLady'] },
  { ten: 'Luật sư Trần', dien: 'trang trọng', loi: 'Xin giới thiệu: cô Lâm Hạ, người thừa kế Quỹ Harrington.', giong: ['Chinese (Mandarin)_Gentleman', 'Korean_IntellectualSenior'] },
];
const db = getDb() as Db; if (!db) throw new Error('không có DATABASE_URL');
const dm = await dsMoHinhGiong();
const idNv = async (ten: string) => Number(((await db.execute(sql`SELECT id FROM xv_nhan_vat WHERE phim_id = ${PHIM} AND ten = ${ten}`)) as unknown as Row[])[0]?.id) || undefined;
const jobs: { job: number; nhan: string }[] = [];
for (const t of THU) for (const v of t.giong) {
  const text = /eleven/.test(MODEL) && /v3/.test(MODEL) ? `[${t.dien}] ${t.loi}` : t.loi;   // chỉ ElevenLabs v3 đọc chỉ dẫn trong ngoặc (như sinh-giong.ts)
  const gia = giaGiongTheo(dm, MODEL, text.length) ?? 0;
  const nhan = `Thử giọng · ${t.ten} · ${v}`;
  const job = await taoJob(db, { phim_id: PHIM, nhan_vat_id: await idNv(t.ten), nhan, loai: 'am', provider: 'fal', model: `fal:${MODEL}`, request: { dich: 'thu_giong', gia, ten: t.ten, voice: v, text, giong_model: MODEL }, cents: gia });
  await dayViecAm({ kieu: 'am', job, model: MODEL, input: await dauVaoGiongTheoModel(MODEL, { text, voice: v, ngonNgu: 'vi', camXuc: 0, theLoai: 'phim_doc' }), thuMuc: `giong/thu-${PHIM}` });
  jobs.push({ job, nhan });
}
for (let i = 0; i < 90; i++) {
  const r = (await db.execute(sql`SELECT id, trang_thai, output_url, loi, chi_phi_cents FROM xv_job WHERE id = ANY(${`{${jobs.map((j) => j.job).join(',')}}`}::int[])`)) as unknown as Row[];
  if (r.every((x) => x.trang_thai !== 'cho')) {
    for (const j of jobs) { const x = r.find((y) => Number(y.id) === j.job)!; console.log(`${j.nhan} | ${x.trang_thai} | ${x.output_url ?? x.loi} | ${x.chi_phi_cents}¢`); }
    process.exit(0);
  }
  await new Promise((ok) => setTimeout(ok, 4000));
}
console.log('quá 6 phút chưa xong'); process.exit(1);
