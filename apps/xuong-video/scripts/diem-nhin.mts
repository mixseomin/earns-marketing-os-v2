// ĐIỂM NHÌN QUA CÚ CẮT cả tập (diem-nhin.ts — eye trace, anh 25/10/2026 "tao cần sự liền mạch về hướng chú ý của khán giả"). 0đ.
// Mỗi shot: cắt khung MỞ và ĐÓNG của đúng đoạn clip bản dựng dùng (cùng phép tính điểm vào với xuat.ts), soi mặt (soi-mat.py) → điểm chú ý = mặt người
// đang nói trong khung, không thì người đầu tiên quay mặt ra máy theo sơ đồ (ky_thuat.huong_so). Cận đồ vật / không thấy mặt → không đo (giữ nguyên).
// In bảng lệch từng cú cắt (gốc → sau khi dựng lại khung); --ghi: ghi ky_thuat.khung_lai để bản dựng phóng + dịch đúng chỗ (xuat.ts).
//   cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; cd apps/xuong-video && \
//     NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/diem-nhin.mts <tap_id> [--ghi]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { soiAnh } from '../src/lib/xuong-video/soi-mat';
import { mapCanh, type Row } from '../src/lib/xuong-video/doc-db';
import { giayPhat } from '../src/lib/xuong-video/kieu';
import { DUOI_CLIP_BO } from '../src/lib/xuong-video/xuat';
import { khungCanh, NGUONG_LECH, type Diem, type DiemShot } from '../src/lib/xuong-video/diem-nhin';

const tap = Number(process.argv[2]); if (!tap) { console.error('cần <tap_id>'); process.exit(1); }
const ghi = process.argv.includes('--ghi');
const db = getDb()!; const thu = `/tmp/diem-nhin-${tap}`; mkdirSync(thu, { recursive: true });
const ds = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tap} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh);
const tai = (url: string) => { const f = `${thu}/${createHash('sha1').update(url).digest('hex').slice(0, 12)}.mp4`; if (!existsSync(f)) execFileSync('curl', ['-sfL', '-o', f, url]); return f; };
const dai = (f: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim());
const cat = (f: string, g: number, ra: string) => { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(Math.max(0, g)), '-i', f, '-frames:v', '1', '-q:v', '3', ra]); return ra; };
type HS = Record<string, { lung?: boolean }>;

const anh: { id: number; url: string; ten: string[] }[] = []; const tenNhin = new Map<number, string[]>(); let id = 1; const khoa = new Map<string, number>();
for (const c of ds) {
  const url = c.video_cuoi_url || c.video_url; if (!url) continue;
  const f = tai(url); const d = dai(f); const phat = giayPhat(c);
  // CÙNG phép tính điểm vào với xuat.ts (vao_s khai tay, không thì bỏ ≤ 0,5 s đầu; không lấn đuôi hỏng DUOI_CLIP_BO)
  const vao = c.ky_thuat?.vao_s; const boDau = vao != null && vao >= 0 ? Math.max(0, Math.min(vao, d - phat - DUOI_CLIP_BO)) : Math.max(0, Math.min(0.5, d - phat - DUOI_CLIP_BO));
  if (c.ky_thuat?.co_canh === 'insert') continue;
  const noi = (c.thoai ?? []).filter((t) => t.loi?.trim() && t.nhan_vat?.trim()).map((t) => t.nhan_vat.trim());
  for (const [luc, g, hs] of [['dau', boDau + 0.06, c.ky_thuat?.huong_so], ['cuoi', boDau + phat - 0.1, (c.ky_thuat as { huong_so_ket?: HS } | undefined)?.huong_so_ket ?? c.ky_thuat?.huong_so]] as const) {
    const thay = Object.entries((hs ?? {}) as HS).filter(([, v]) => !v.lung).map(([t]) => t); if (!thay.length) continue;
    // ưu tiên người đang nói có mặt trong khung, rồi theo thứ tự sơ đồ
    const uu = [...noi.filter((t) => thay.includes(t)), ...thay.filter((t) => !noi.includes(t))];
    khoa.set(`${c.id}:${luc}`, id); tenNhin.set(id, uu); anh.push({ id: id++, url: cat(f, g, `${thu}/${c.thu_tu}-${luc}.jpg`), ten: thay });
  }
}
const soi = await soiAnh(db, tap, anh);
const diem = (cid: number, luc: 'dau' | 'cuoi'): { p: Diem; ten: string } | null => {
  const k = khoa.get(`${cid}:${luc}`); if (k == null) return null; const kq = soi.get(k)?.ket ?? [];
  for (const t of tenNhin.get(k) ?? []) { const m = kq.find((x) => x.ten === t && x.o); if (m?.o) return { p: { x: m.o.x, y: m.o.y }, ten: t }; }
  return null;
};
const dsDiem: (DiemShot & { tenDau?: string; tenCuoi?: string })[] = ds.map((c) => { const a = diem(c.id, 'dau'), b = diem(c.id, 'cuoi'); return { thu_tu: c.thu_tu, dau: a?.p ?? null, cuoi: b?.p ?? null, tenDau: a?.ten, tenCuoi: b?.ten }; });
const kq = khungCanh(dsDiem);
const pt = (p: Diem | null) => (p ? `${p.x.toFixed(2)},${p.y.toFixed(2)}` : '—');
console.log(`ngưỡng lệch ${NGUONG_LECH} khung · shot: điểm mở (ai) → điểm đóng · lệch gốc với cuối shot trước → sau khi dựng lại · khung`);
for (const [i, d] of dsDiem.entries()) { const k = kq[i]!;
  console.log(`#${d.thu_tu}: ${pt(d.dau)} (${d.tenDau ?? '—'}) → ${pt(d.cuoi)} · lệch ${k.lech_goc ?? '—'} → ${k.lech_truoc ?? '—'}${k.lech_goc != null && k.lech_goc > NGUONG_LECH ? ' ⚠' : ''} · ${k.k.s > 1 ? `phóng ${k.k.s} tâm ${k.k.cx},${k.k.cy}` : 'giữ'}`); }
if (ghi) {
  for (const [i, c] of ds.entries()) { const k = kq[i]!.k;
    await db.execute(k.s > 1 ? sql`UPDATE xv_canh SET ky_thuat = coalesce(ky_thuat, '{}'::jsonb) || jsonb_build_object('khung_lai', ${JSON.stringify(k)}::jsonb), updated_at = now() WHERE id = ${c.id}`
      : sql`UPDATE xv_canh SET ky_thuat = coalesce(ky_thuat, '{}'::jsonb) - 'khung_lai', updated_at = now() WHERE id = ${c.id}`); }
  console.log('đã ghi khung_lai');
}
process.exit(0);
