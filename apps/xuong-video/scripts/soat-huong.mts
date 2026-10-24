// CỔNG HƯỚNG + NỐI CẮT trên HÌNH THẬT (0đ — soi mặt YuNet + SFace + hướng nhìn, soi-mat.ts) so với KỲ VỌNG từ sơ đồ cảnh (so-do-canh.ts › kyVong):
//   khung đầu  (keyframe_url)  ↔ ky_thuat.huong_so        · khung cuối (keyframe_ket) ↔ huong_so_ket
//   clip ĐÃ DÙNG: khung mở đoạn (vao_s) ↔ huong_so · khung đóng đoạn (vao_s + phat_s) ↔ huong_so_ket — đúng hai đầu mỗi ĐƯỜNG CẮT trong phim dựng
// (anh 24/10/2026: "ngay 2 shot đầu hướng nhìn đã lệch hẳn nhau" — cổng cũ chỉ soi khung đầu, còn soát nối cắt là con tự cắt khung xem bằng mắt).
// Đo cả DÁNG so sổ dáng (khong-gian.ts › kyVongDang): đầu cúi / ngẩng (MediaPipe mặt) + tay giơ / buông (MediaPipe tư thế). Chỉ tin mặt giống ảnh mẫu
// đạt ngưỡng VÀ hơn hẳn tên kế (tin — hai nữ chính AI vẽ na ná nhau); người quay lưng không đưa cho bộ so mặt; số MẶT nhiều hơn số người sơ đồ
// cho thấy mặt → có người chen vào khung (#16 cũ: Hạ đứng cạnh Vivian dù đã quay đi) — đếm mặt, không đoán danh tính người thừa.
// In từng shot + từng đường cắt ✓ / ✗, ghi ky_thuat.soat_noi (timeline › nhánh kiểm).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/soat-huong.mts <tap_id> [--khong-clip]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { soiAnh } from '../src/lib/xuong-video/soi-mat';
import { loiDoHuong, type KyVong } from '../src/lib/xuong-video/so-do-canh';
import { dang, kgCua, kyVongDang, loiDoDang, type KhongGianTap } from '../src/lib/xuong-video/khong-gian';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import type { SoiMat } from '../src/lib/xuong-video/kieu';

const tap = Number(process.argv[2]); if (!tap) { console.error('cần <tap_id>'); process.exit(1); }
const coClip = !process.argv.includes('--khong-clip');
const db = getDb()!;
const kgt = (((await db.execute(sql`SELECT khong_gian FROM xv_tap WHERE id = ${tap}`)) as unknown as Row[])[0]?.khong_gian ?? null) as KhongGianTap | null;
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
type Luc = 'dau' | 'ket' | 'clip_dau' | 'clip_ket'; const LUC: Luc[] = ['dau', 'ket', 'clip_dau', 'clip_ket'];
const laDau = (l: Luc) => l === 'dau' || l === 'clip_dau';
const kyVong = (c: (typeof ds)[number], l: Luc) => ((laDau(l) ? c.ky_thuat?.huong_so : c.ky_thuat?.huong_so_ket ?? c.ky_thuat?.huong_so) ?? {}) as Record<string, KyVong>;
/** số mặt sơ đồ cho thấy ở lúc đó (người trong khung, không quay lưng; cận chèn = 0) */
const soMat = (c: (typeof ds)[number], l: Luc) => (c.ky_thuat?.co_canh === 'insert' ? 0 : Object.values(kyVong(c, l)).filter((v) => !v.lung).length);
const thuMuc = `/tmp/soat-noi-${tap}`; mkdirSync(thuMuc, { recursive: true });
const anh: { id: number; url: string; ten: string[]; tu_the: boolean }[] = []; const ma = (c: number, l: Luc) => c * 10 + LUC.indexOf(l);
const cat = (url: string, giay: number, ra: string) => { try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, giay)), '-i', url, '-frames:v', '1', '-q:v', '3', ra], { timeout: 60_000 }); return true; } catch { return false; } };
for (const c of ds) {
  const vao = Number(c.ky_thuat?.vao_s ?? 0), phat = Number(c.phat_s ?? 0) || 2;
  const nguon: Record<Luc, () => string | null> = { dau: () => c.keyframe_url ?? null, ket: () => c.keyframe_ket ?? null,
    clip_dau: () => (coClip && c.video_url && cat(c.video_url, vao + 0.04, `${thuMuc}/${c.id}-clip_dau.jpg`) ? `${thuMuc}/${c.id}-clip_dau.jpg` : null),
    clip_ket: () => (coClip && c.video_url && cat(c.video_url, vao + phat - 0.08, `${thuMuc}/${c.id}-clip_ket.jpg`) ? `${thuMuc}/${c.id}-clip_ket.jpg` : null) };
  for (const l of LUC) { const kv = kyVong(c, l); if (!Object.keys(kv).length) continue; const url = nguon[l](); if (!url) continue;
    anh.push({ id: ma(c.id, l), url, ten: Object.keys(kv).filter((n) => !kv[n]!.lung), tu_the: true }); }
}
const do_ = await soiAnh(db, tap, anh);
const NHAN: Record<Luc, string> = { dau: 'khung đầu', ket: 'khung cuối', clip_dau: 'clip mở', clip_ket: 'clip đóng' };
const ketQua = (c: (typeof ds)[number], l: Luc) => {
  const kv = kyVong(c, l); const r0 = do_.get(ma(c.id, l)); if (!Object.keys(kv).length || !r0) return null; const k0 = r0.ket;
  const k: SoiMat['ket'] = k0.filter((x) => x.tin);   // chỉ mặt giống ảnh mẫu đạt ngưỡng
  const loi = loiDoHuong(Object.fromEntries(Object.entries(kv).filter(([, v]) => !v.lung)), k);
  const kg = kgCua(kgt, c);
  if (r0.mat > soMat(c, l)) loi.push(`thấy ${r0.mat} mặt mà sơ đồ chỉ cho thấy ${soMat(c, l)} — có người chen vào khung (người ngoài khung / người lạ)`);
  for (const x of k) {
    const d = kg ? dang(kg, c.thu_tu, x.ten, laDau(l) ? 'dau' : 'ket') : null; if (d) loi.push(...loiDoDang(x.ten, kyVongDang(d.en), x)); }
  return { loi, so: k0.map((x) => `${x.ten}${x.tin ? '' : '(?)'} x=${x.o?.x?.toFixed(2) ?? '?'} nhìn=${x.nhin?.g ?? '?'}° ngẩng=${x.nhin?.doc ?? '?'}°${x.tay ? ` tay P/T=${x.tay.phai ?? '?'}/${x.tay.trai ?? '?'}` : ''}`).join(' · ') };
};
let truot = 0;
for (const c of ds) {
  const loi: string[] = []; const dong: string[] = [];
  for (const l of LUC) { const k = ketQua(c, l); if (!k) continue; dong.push(`${NHAN[l]} ${k.loi.length ? '✗' : '✓'} ${k.so || '(không đo được mặt)'}`); loi.push(...k.loi.map((x) => `${NHAN[l]}: ${x}`)); }
  if (!dong.length) continue; if (loi.length) truot++;
  console.log(`#${c.thu_tu} ${loi.length ? '✗' : '✓'}\n    ${dong.join('\n    ')}${loi.length ? `\n    → ${loi.join('; ')}` : ''}`);
  await db.execute(sql`UPDATE xv_canh SET ky_thuat = coalesce(ky_thuat, '{}'::jsonb) || jsonb_build_object('soat_noi', ${JSON.stringify({ luc: new Date().toISOString(), video_url: c.video_url ?? null, keyframe_ket: c.keyframe_ket ?? null, loi })}::jsonb) WHERE id = ${c.id}`);
}
// ĐƯỜNG CẮT: clip đóng của shot trước ↔ clip mở của shot sau (cùng cảnh) — chỗ khán giả thật sự thấy
console.log('\nĐƯỜNG CẮT (clip đã dùng):');
for (let i = 1; i < ds.length; i++) { const a = ds[i - 1]!, b = ds[i]!; if (a.phan_doan !== b.phan_doan) continue; const ka = ketQua(a, 'clip_ket'), kb = ketQua(b, 'clip_dau'); if (!ka && !kb) continue;
  const l = [...(ka?.loi ?? []).map((x) => `cuối #${a.thu_tu}: ${x}`), ...(kb?.loi ?? []).map((x) => `đầu #${b.thu_tu}: ${x}`)]; console.log(`  #${a.thu_tu}→#${b.thu_tu} ${l.length ? `✗ ${l.join('; ')}` : '✓'}`); }
console.log(`\n${truot} shot trượt cổng hướng / dáng`);
process.exit(0);
