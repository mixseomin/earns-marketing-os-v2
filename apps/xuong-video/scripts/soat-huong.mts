// CỔNG HƯỚNG + NỐI CẮT trên HÌNH THẬT (0đ — soi mặt YuNet + SFace + hướng nhìn, soi-mat.ts) so với KỲ VỌNG từ sơ đồ cảnh (so-do-canh.ts › kyVong):
//   khung đầu  (keyframe_url)  ↔ ky_thuat.huong_so        · khung cuối (keyframe_ket) ↔ huong_so_ket
//   clip ĐÃ DÙNG: khung mở đoạn (vao_s) ↔ huong_so · khung đóng đoạn (vao_s + phat_s) ↔ huong_so_ket — đúng hai đầu mỗi ĐƯỜNG CẮT trong phim dựng
// (anh 24/10/2026: "ngay 2 shot đầu hướng nhìn đã lệch hẳn nhau" — cổng cũ chỉ soi khung đầu, còn soát nối cắt là con tự cắt khung xem bằng mắt).
// In từng shot + từng đường cắt ✓ / ✗, ghi ky_thuat.soat_noi (timeline › nhánh kiểm). Dáng (đầu cúi / tay) chưa đo được bằng máy này — sổ dáng
// đưa vào câu hỏi kiểm khung (cau-hoi-khung.ts) cho người chấm.
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/soat-huong.mts <tap_id> [--khong-clip]
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { soiAnh, soiMatTap } from '../src/lib/xuong-video/soi-mat';
import { loiDoHuong, type KyVong } from '../src/lib/xuong-video/so-do-canh';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import type { SoiMat } from '../src/lib/xuong-video/kieu';

const tap = Number(process.argv[2]); if (!tap) { console.error('cần <tap_id>'); process.exit(1); }
const coClip = !process.argv.includes('--khong-clip');
const db = getDb()!;
const r = await soiMatTap(db, tap, { tatCa: true, ghi: true }); if (!r.ok) { console.error(r.loi); process.exit(1); }
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
type Luc = 'dau' | 'ket' | 'clip_dau' | 'clip_ket';
const kyVong = (c: (typeof ds)[number], l: Luc) => ((l === 'dau' || l === 'clip_dau' ? c.ky_thuat?.huong_so : c.ky_thuat?.huong_so_ket ?? c.ky_thuat?.huong_so) ?? {}) as Record<string, KyVong>;
// ẢNH cần soi thêm: khung cuối + hai đầu đoạn clip đã dùng (cắt bằng ffmpeg trên máy chủ)
const thuMuc = `/tmp/soat-noi-${tap}`; mkdirSync(thuMuc, { recursive: true });
const anh: { id: number; url: string; ten: string[] }[] = []; const ma = (c: number, l: Luc) => c * 10 + ['dau', 'ket', 'clip_dau', 'clip_ket'].indexOf(l);
const cat = (url: string, giay: number, ra: string) => { try { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, giay)), '-i', url, '-frames:v', '1', '-q:v', '3', ra], { timeout: 60_000 }); return true; } catch { return false; } };
for (const c of ds) {
  if (c.keyframe_ket && Object.keys(kyVong(c, 'ket')).length) anh.push({ id: ma(c.id, 'ket'), url: c.keyframe_ket, ten: Object.keys(kyVong(c, 'ket')) });
  if (coClip && c.video_url) { const vao = Number(c.ky_thuat?.vao_s ?? 0), phat = Number(c.phat_s ?? 0) || 2;
    for (const [l, g] of [['clip_dau', vao + 0.04], ['clip_ket', vao + phat - 0.08]] as [Luc, number][]) { const kv = kyVong(c, l); if (!Object.keys(kv).length) continue; const f = `${thuMuc}/${c.id}-${l}.jpg`; if (cat(c.video_url, g, f)) anh.push({ id: ma(c.id, l), url: f, ten: Object.keys(kv) }); } }
}
const do_ = await soiAnh(db, tap, anh);
const dauCua = (c: (typeof ds)[number]): SoiMat['ket'] => (c.soi_mat?.url === c.keyframe_url ? c.soi_mat!.ket : []);
const ketQua = (c: (typeof ds)[number], l: Luc) => { const kv = kyVong(c, l); if (!Object.keys(kv).length) return null; const k = l === 'dau' ? dauCua(c) : do_.get(ma(c.id, l)); if (!k) return null;
  return { loi: loiDoHuong(kv, k), thieu: Object.keys(kv).filter((t) => !k.some((x) => x.ten === t)), so: k.map((x) => `${x.ten} x=${x.o?.x?.toFixed(2) ?? '?'} nhìn=${x.nhin?.g ?? '?'}°`).join(' · ') }; };
let truot = 0; const NHAN: Record<Luc, string> = { dau: 'khung đầu', ket: 'khung cuối', clip_dau: 'clip mở', clip_ket: 'clip đóng' };
for (const c of ds) {
  const loi: string[] = []; const dong: string[] = [];
  for (const l of ['dau', 'ket', 'clip_dau', 'clip_ket'] as Luc[]) { const k = ketQua(c, l); if (!k) continue; dong.push(`${NHAN[l]} ${k.loi.length ? '✗' : '✓'} ${k.so || '(không đo được mặt)'}`); loi.push(...k.loi.map((x) => `${NHAN[l]}: ${x}`)); }
  if (!dong.length) continue; if (loi.length) truot++;
  console.log(`#${c.thu_tu} ${loi.length ? '✗' : '✓'}\n    ${dong.join('\n    ')}${loi.length ? `\n    → ${loi.join('; ')}` : ''}`);
  await db.execute(sql`UPDATE xv_canh SET ky_thuat = coalesce(ky_thuat, '{}'::jsonb) || jsonb_build_object('soat_noi', ${JSON.stringify({ luc: new Date().toISOString(), video_url: c.video_url ?? null, keyframe_ket: c.keyframe_ket ?? null, loi })}::jsonb) WHERE id = ${c.id}`);
}
// ĐƯỜNG CẮT: clip đóng của shot trước ↔ clip mở của shot sau (cùng cảnh) — chỗ khán giả thật sự thấy
console.log('\nĐƯỜNG CẮT (clip đã dùng):');
for (let i = 1; i < ds.length; i++) { const a = ds[i - 1]!, b = ds[i]!; if (a.phan_doan !== b.phan_doan) continue; const ka = ketQua(a, 'clip_ket'), kb = ketQua(b, 'clip_dau'); if (!ka && !kb) continue;
  const l = [...(ka?.loi ?? []).map((x) => `cuối #${a.thu_tu}: ${x}`), ...(kb?.loi ?? []).map((x) => `đầu #${b.thu_tu}: ${x}`)]; console.log(`  #${a.thu_tu}→#${b.thu_tu} ${l.length ? `✗ ${l.join('; ')}` : '✓'}`); }
console.log(`\n${truot} shot trượt cổng hướng`);
process.exit(0);
