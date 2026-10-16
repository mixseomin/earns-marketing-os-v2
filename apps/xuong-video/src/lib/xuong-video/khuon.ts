// KHUÔN VIDEO — sổ xv_khuon + chạy: nạp đề, xuất (khuon-mot-dung.ts → ffmpeg trên box3 → R2, 0đ), sinh ảnh nền theo chủ đề (AI, ghi sổ chi).
// Nguồn đề Front Porch Puzzles = puzzle-books/scripts/de-short.mjs (day-studio.mjs đẩy qua scripts/khuon.mts --nap). Bên đăng
// (dang-short.mjs trên iMac / MacBook) đọc danh sách bằng scripts/khuon.mts --ds rồi tải file_url.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { uploadToR2 } from '../r2';
import { assMotDung, lenhMotDung, DAI, type DeMotDung } from './khuon-mot-dung';
import { sinhAnh } from './google';
import { taoJob, xongJob } from './doc-db';
import { VND_MOI_USD } from './cong-ai';

type Db = NonNullable<ReturnType<typeof getDb>>;
const run = promisify(execFile);
const FONTS_DIR = [`${process.cwd()}/public/fonts`, `${process.cwd()}/apps/xuong-video/public/fonts`, '/opt/earns-marketing-os-v2/apps/xuong-video/public/fonts'].find((d) => existsSync(d));
export const KHUON = { 'mot-dung': 'Only ONE is spelled right' } as const;
export type LoaiKhuon = keyof typeof KHUON;

export interface DongKhuon {
  id: number; du_an: string; khuon: LoaiKhuon; slug: string; chu_de: string; de: DeMotDung;
  dang: { title?: string; description?: string; link?: string; book?: string; words?: string[] };
  nen_url: string | null; nen_prompt: string | null; file_url: string | null; giay: number | null; xuat_luc: string | null; loi: string | null; updated_at: string;
}
const map = (r: Record<string, unknown>): DongKhuon => ({
  id: Number(r.id), du_an: String(r.du_an), khuon: r.khuon as LoaiKhuon, slug: String(r.slug), chu_de: String(r.chu_de ?? ''), de: r.de as DeMotDung,
  dang: (r.dang ?? {}) as DongKhuon['dang'], nen_url: (r.nen_url as string) ?? null, nen_prompt: (r.nen_prompt as string) ?? null, file_url: (r.file_url as string) ?? null,
  giay: r.giay == null ? null : Number(r.giay), xuat_luc: r.xuat_luc ? String(r.xuat_luc) : null, loi: (r.loi as string) || null, updated_at: String(r.updated_at),
});

export async function dsKhuon(db: Db, duAn?: string): Promise<DongKhuon[]> {
  const rows = (await db.execute(duAn ? sql`SELECT * FROM xv_khuon WHERE du_an = ${duAn} ORDER BY chu_de, slug` : sql`SELECT * FROM xv_khuon ORDER BY du_an, chu_de, slug`)) as unknown as Record<string, unknown>[];
  return rows.map(map);
}

/** Nạp / cập nhật đề (khoá = slug). Đề đổi → bản xuất cũ hết đúng: xoá file_url để lần xuất sau dựng lại; đề y hệt thì giữ nguyên. */
export async function napDe(db: Db, ds: { du_an: string; khuon: LoaiKhuon; slug: string; chu_de: string; de: DeMotDung; dang: DongKhuon['dang'] }[]): Promise<{ moi: number; doi: number; giu: number }> {
  let moi = 0, doi = 0, giu = 0;
  for (const x of ds) {
    if (!KHUON[x.khuon]) throw new Error(`khuôn lạ: ${x.khuon}`);
    const cu = ((await db.execute(sql`SELECT de, dang FROM xv_khuon WHERE slug = ${x.slug}`)) as unknown as { de: unknown; dang: unknown }[])[0];
    if (!cu) {
      await db.execute(sql`INSERT INTO xv_khuon (du_an, khuon, slug, chu_de, de, dang) VALUES (${x.du_an}, ${x.khuon}, ${x.slug}, ${x.chu_de}, ${JSON.stringify(x.de)}::jsonb, ${JSON.stringify(x.dang)}::jsonb)`);
      moi++; continue;
    }
    const deDoi = JSON.stringify(cu.de) !== JSON.stringify(x.de), dangDoi = JSON.stringify(cu.dang) !== JSON.stringify(x.dang);
    if (!deDoi && !dangDoi) { giu++; continue; }
    await db.execute(sql`UPDATE xv_khuon SET chu_de = ${x.chu_de}, de = ${JSON.stringify(x.de)}::jsonb, dang = ${JSON.stringify(x.dang)}::jsonb,
      file_url = CASE WHEN ${deDoi} THEN NULL ELSE file_url END, updated_at = now() WHERE slug = ${x.slug}`);
    doi++;
  }
  return { moi, doi, giu };
}

/** Xuất một video khuôn: ASS + ffmpeg (box3, ~15 giây cho 12 giây video) → R2. 0đ. */
export async function xuatKhuon(db: Db, id: number): Promise<{ ok: true; url: string } | { ok: false; loi: string }> {
  const d = ((await db.execute(sql`SELECT * FROM xv_khuon WHERE id = ${id}`)) as unknown as Record<string, unknown>[])[0];
  if (!d) return { ok: false, loi: 'không thấy video khuôn' };
  const k = map(d);
  if (!FONTS_DIR) return { ok: false, loi: 'máy chủ thiếu thư mục font (apps/xuong-video/public/fonts)' };
  const thuMuc = `${tmpdir()}/xv-khuon-${k.id}-${randomUUID().slice(0, 8)}`;
  await mkdir(thuMuc, { recursive: true });
  try {
    let nen: string | null = null;
    if (k.nen_url) {
      const r = await fetch(k.nen_url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
      if (!r?.ok) return ghiLoi(db, k.id, `không tải được ảnh nền (${r?.status ?? 'mạng'})`);
      nen = `${thuMuc}/nen.${(k.nen_url.split('?')[0]!.split('.').pop() || 'jpg').slice(0, 4)}`;
      await writeFile(nen, Buffer.from(await r.arrayBuffer()));
    }
    const ass = `${thuMuc}/khuon.ass`, ra = `${thuMuc}/ra.mp4`;
    await writeFile(ass, assMotDung(k.de), 'utf8');
    try { await run('ffmpeg', lenhMotDung({ de: k.de, ass, nen, fontsDir: FONTS_DIR, ra }), { timeout: 5 * 60_000, maxBuffer: 8 << 20 }); }
    catch (e) { const err = e as { stderr?: string; message?: string }; return ghiLoi(db, k.id, `ffmpeg: ${(err.stderr || err.message || String(e)).trim().split('\n').slice(-2).join(' · ').slice(0, 300)}`); }
    const url = await uploadToR2(`xuong-video/khuon/${k.slug}-${randomUUID().slice(0, 8)}.mp4`, await readFile(ra), 'video/mp4');
    if (!url) return ghiLoi(db, k.id, 'không đẩy được bản xuất lên R2');
    await db.execute(sql`UPDATE xv_khuon SET file_url = ${url}, giay = ${DAI}, xuat_luc = now(), loi = NULL, updated_at = now() WHERE id = ${k.id}`);
    return { ok: true, url };
  } finally { await rm(thuMuc, { recursive: true, force: true }).catch(() => {}); }
}
async function ghiLoi(db: Db, id: number, loi: string): Promise<{ ok: false; loi: string }> {
  await db.execute(sql`UPDATE xv_khuon SET loi = ${loi}, updated_at = now() WHERE id = ${id}`);
  return { ok: false, loi };
}

/** Prompt ảnh nền: cảnh theo chủ đề, KHÔNG chữ (lưới chữ do máy vẽ đè lên), phần giữa thoáng vì bảng trắng che gần hết khung. */
export const promptNen = (chuDe: string, goi: string) =>
  `Vertical 9:16 cozy illustrated background scene for a ${goi.toLowerCase()} themed puzzle video (${chuDe}). Warm, inviting, nostalgic American home atmosphere, `
  + `soft painterly style, rich but gentle colors, subtle depth of field. Decorative details around the edges and corners, calm uncluttered center. `
  + `Absolutely no text, no letters, no words, no numbers, no logos, no watermark.`;

/** Sinh MỘT ảnh nền cho một chủ đề (dùng chung cho mọi video cùng chu_de của dự án) — chuỗi cổng rẻ (ckey ~110₫) trước, ghi sổ chi xv_job. */
export async function sinhNenKhuon(db: Db, duAn: string, chuDe: string, prompt?: string): Promise<{ ok: true; url: string; vnd: number | null } | { ok: false; loi: string }> {
  const mot = ((await db.execute(sql`SELECT de FROM xv_khuon WHERE du_an = ${duAn} AND chu_de = ${chuDe} LIMIT 1`)) as unknown as { de: DeMotDung }[])[0];
  if (!mot) return { ok: false, loi: `không có video khuôn nào chủ đề "${chuDe}"` };
  const p = (prompt ?? '').trim() || promptNen(chuDe, mot.de.goi);
  const job = await taoJob(db, { nhan: `Nền khuôn · ${chuDe}`, loai: 'anh', provider: 'ckey', model: 'gemini-nano-banana-2.1', request: { dich: 'khuon_nen', du_an: duAn, chu_de: chuDe, prompt: p }, cents: 0.5 });
  const kq = await sinhAnh({ model: 'gemini-nano-banana-2.1', prompt: p, tiLe: '9:16' });
  if (!kq.ok) { await xongJob(db, job, { loi: kq.loi }); return { ok: false, loi: kq.loi }; }
  const url = await uploadToR2(`xuong-video/khuon-nen/${duAn}-${chuDe.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.${kq.mimeType.includes('png') ? 'png' : 'jpg'}`, kq.data, kq.mimeType);
  if (!url) { await xongJob(db, job, { loi: 'không đẩy được ảnh nền lên R2' }); return { ok: false, loi: 'không đẩy được ảnh nền lên R2' }; }
  const vnd = kq.nguon?.vnd ?? null, cents = vnd != null ? (vnd / VND_MOI_USD) * 100 : (kq.nguon?.cents ?? 0.5);
  await xongJob(db, job, { output_url: url, model: kq.nguon ? `${kq.nguon.cong}:${kq.nguon.model}` : kq.model, chi_phi_cents: cents });
  await db.execute(sql`UPDATE xv_khuon SET nen_url = ${url}, nen_prompt = ${p}, updated_at = now() WHERE du_an = ${duAn} AND chu_de = ${chuDe}`);
  return { ok: true, url, vnd };
}
