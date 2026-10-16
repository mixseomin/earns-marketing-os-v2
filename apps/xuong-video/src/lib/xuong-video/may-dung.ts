// DỰNG VIDEO MÁY (0đ, không AI): đề của mẫu → ASS + ffmpeg trên box3 → MP4 + 3 khung (giữa từng shot của mẫu) → R2.
// Dùng ở hai chỗ: video của MÁY (may.ts › xuatVideo — đường chính từ 17/10/2026) và phim Máy Dựng cũ đã lưu trữ (tab ⬇ Xuất của tập,
// xuat-tap.ts › xuatMayDungTap — để phim cũ mở ra vẫn xuất được).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { getDb } from '@mos2/db';
import { uploadToR2 } from '../r2';
import { assMotDung, kichBanMotDung, lenhMotDung, DAI, type DeMotDung } from './may-dung-do-chu';
import type { KinhThanh } from './kieu';

type Db = NonNullable<ReturnType<typeof getDb>>;
type Row = Record<string, unknown>;
const run = promisify(execFile);
const FONTS_DIR = [`${process.cwd()}/public/fonts`, `${process.cwd()}/apps/xuong-video/public/fonts`, '/opt/earns-marketing-os-v2/apps/xuong-video/public/fonts'].find((d) => existsSync(d));

/** Dựng MỘT video từ đề: MP4 cả video + mỗi shot của mẫu một khung (giây giữa shot), đẩy lên R2. */
export async function dungVideo(o: { de: DeMotDung; nenUrl?: string | null; slug: string }): Promise<{ ok: true; url: string; khung: string[]; giay: number } | { ok: false; loi: string }> {
  if (!FONTS_DIR) return { ok: false, loi: 'máy chủ thiếu thư mục font (apps/xuong-video/public/fonts)' };
  const thuMuc = `${tmpdir()}/xv-may-${o.slug}-${randomUUID().slice(0, 8)}`;
  await mkdir(thuMuc, { recursive: true });
  try {
    let nen: string | null = null;
    if (o.nenUrl) {
      const t = await fetch(o.nenUrl, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
      if (!t?.ok) return { ok: false, loi: `không tải được ảnh nền (${t?.status ?? 'mạng'})` };
      nen = `${thuMuc}/nen.${(o.nenUrl.split('?')[0]!.split('.').pop() || 'jpg').slice(0, 4)}`;
      await writeFile(nen, Buffer.from(await t.arrayBuffer()));
    }
    const ass = `${thuMuc}/de.ass`, ra = `${thuMuc}/ra.mp4`;
    await writeFile(ass, assMotDung(o.de), 'utf8');
    try { await run('ffmpeg', lenhMotDung({ de: o.de, ass, nen, fontsDir: FONTS_DIR, ra }), { timeout: 5 * 60_000, maxBuffer: 8 << 20 }); }
    catch (e) { const err = e as { stderr?: string; message?: string }; return { ok: false, loi: `ffmpeg: ${(err.stderr || err.message || String(e)).trim().split('\n').slice(-2).join(' · ').slice(0, 300)}` }; }
    const goc = `xuong-video/may/${o.slug}-${randomUUID().slice(0, 8)}`;
    const url = await uploadToR2(`${goc}.mp4`, await readFile(ra), 'video/mp4');
    if (!url) return { ok: false, loi: 'không đẩy được video lên R2' };
    const khung: string[] = [];
    for (const [i, s] of kichBanMotDung(o.de).shots.entries()) {
      const kf = `${thuMuc}/kf${i}.jpg`;
      try { await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(s.tu + (s.den - s.tu) / 2), '-i', ra, '-frames:v', '1', '-q:v', '3', kf], { timeout: 60_000 }); }
      catch (e) { return { ok: false, loi: `cắt khung shot #${i + 1} hỏng: ${(e as Error).message.slice(0, 120)}` }; }
      const u = await uploadToR2(`${goc}-s${i + 1}.jpg`, await readFile(kf), 'image/jpeg');
      if (!u) return { ok: false, loi: `không đẩy được khung shot #${i + 1} lên R2` };
      khung.push(u);
    }
    return { ok: true, url, khung, giay: DAI };
  } finally { await rm(thuMuc, { recursive: true, force: true }).catch(() => {}); }
}

/** ⬇ Xuất của phim Máy Dựng CŨ (đã lưu trữ, trước khi có máy): dựng lại từ đề trong kinh thánh, khung vào keyframe 3 shot của tập. */
export async function xuatMayDungTap(db: Db, tapId: number): Promise<{ ok: true; url: string; giay: number; canhThieu: string[]; canhBao: string[] } | { ok: false; loi: string }> {
  const r = ((await db.execute(sql`SELECT p.kinh_thanh->'may_dung' AS may_dung FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId} AND p.loai = 'may_dung'`)) as unknown as Row[])[0];
  const k = r?.may_dung as NonNullable<KinhThanh['may_dung']> | undefined;
  if (!k?.de) return { ok: false, loi: 'tập này không phải phim Máy Dựng (thiếu đề)' };
  const v = await dungVideo({ de: k.de, nenUrl: k.nen_url, slug: k.slug });
  if (!v.ok) return v;
  const shots = ((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map((x) => Number(x.id));
  for (const [i, u] of v.khung.entries()) if (shots[i] != null) await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${u}, keyframe_uv = ${JSON.stringify([u])}::jsonb, updated_at = now() WHERE id = ${shots[i]}`);
  return { ok: true, url: v.url, giay: v.giay, canhThieu: [], canhBao: [] };
}
