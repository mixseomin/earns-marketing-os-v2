// Các bước dựng 0đ chạy trên máy chủ cho cả tập (12/10/2026) — gọi từ server action (nút trên studio) và scripts/hau-ky.mts, MỘT đường:
//   khopGiongTap       giây phát mỗi shot ≥ đủ đọc hết giọng (khop-giong.ts), chữ màn co giãn mốc theo, lớp phủ dời theo shot
//   nhipHanhDongTap    ⚡ impact / tiếng vút / âm doạ theo kiểu chuyển cảnh ở mọi điểm cắt (nhip-hanh-dong.ts)
// (khớp nhịp nhạc ở khop-nhip.ts). Mỗi thứ sửa đều chụp trước (↶ Hoàn tác).
import 'server-only';
import { execFile } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { giayPhat, locNhanh, type Canh } from './kieu';
import { dongThoai } from './am-thanh';
import { canPhat, coGianMoc, LOC_GON_GIONG, tocDocTheoLoai } from './khop-giong';
import { docKinhThanh, type KinhThanh } from './kieu';
import { uploadToR2 } from '../r2';
import { randomUUID } from 'node:crypto';
import { doiLopTheoCat } from './nhip-nhac';
import { giayClipCan } from './toc-do';
import { nhipHanhDong } from './nhip-hanh-dong';
import { mapCanh, mapTap, mapNhanVat, type Db, type Row } from './doc-db';
import { chupTruoc } from './hoan-tac';

type Kq<T> = { ok: true; data: T } | { ok: false; loi: string };
const doDai = (url: string) => new Promise<number | null>((ok) => execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', url], { timeout: 30_000 }, (e, ra) => { const g = Number(String(ra).trim()); ok(e || !Number.isFinite(g) ? null : g); }));

async function docTap(db: Db, tapId: number) {
  const t = (await db.execute(sql`SELECT * FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return null;
  const tap = mapTap(t[0]);
  const ds: Canh[] = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh), 'A').sort((a, b) => a.thu_tu - b.thu_tu);
  const nv = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${tap.phim_id}`)) as unknown as Row[]).map(mapNhanVat);
  return { tap, ds, nv };
}
const batDauCua = (phat: number[]) => phat.map((_, i) => phat.slice(0, i).reduce((a, b) => a + b, 0));

/** Gọn một file giọng (LOC_GON_GIONG) → R2 mới; file cũ giữ nguyên. null = không gọn được (giữ url cũ). */
async function gonGiong(url: string, canhId: number): Promise<string | null> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) }); if (!r.ok) return null;
  const vao = Buffer.from(await r.arrayBuffer());
  const ra = await new Promise<Buffer | null>((ok) => {
    const p = execFile('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-af', LOC_GON_GIONG, '-c:a', 'libmp3lame', '-b:a', '160k', '-f', 'mp3', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1 << 26 }, (e, b) => ok(e ? null : (b as Buffer)));
    p.stdin?.end(vao);
  });
  if (!ra || ra.length < 1000) return null;
  return uploadToR2(`xuong-video/am/thoai/${canhId}-gon-${randomUUID()}.mp3`, ra, 'audio/mpeg');
}
export async function khopGiongTap(db: Db, tapId: number, nguoi: string): Promise<Kq<{ doi: number; tong: number; thieu: number }>> {
  const d = await docTap(db, tapId); if (!d) return { ok: false, loi: 'không thấy tập' };
  // 1. Gọn giọng (một lần mỗi dòng): ghi url mới vào thoai, chụp trước để hoàn tác.
  for (const c of d.ds) {
    if (!c.thoai.some((x) => x.url && !x.gon)) continue;
    const moi = await Promise.all(c.thoai.map(async (x) => { if (!x.url || x.gon) return x; const u = await gonGiong(x.url, c.id); return u ? { ...x, url: u, gon: true } : x; }));
    if (JSON.stringify(moi) === JSON.stringify(c.thoai)) continue;
    await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['thoai', 'thoai_url'], moTa: 'gọn giọng (cắt lặng, rút quãng ngắt)', nguoi });
    await db.execute(sql`UPDATE xv_canh SET thoai = ${JSON.stringify(moi)}::jsonb, thoai_url = coalesce(${moi[0]?.url ?? null}, thoai_url), updated_at = now() WHERE id = ${c.id}`);
    c.thoai = moi;
  }
  // 2. Giây phát VỪA KHÍT giọng (co cả hai chiều; tối thiểu 1s) — giọng quyết định nhịp, không để hình chờ hay giọng bị ép.
  const urls = [...new Set(d.ds.flatMap((c) => dongThoai(c, d.nv).map((x) => x.url).filter((u): u is string => !!u)))];
  const dai = new Map<string, number | null>(); for (const u of urls) dai.set(u, await doDai(u));
  const phatCu = d.ds.map(giayPhat); let doi = 0, thieu = 0;
  const kt = docKinhThanh(((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${d.tap.phim_id}`)) as unknown as Row[])[0]?.kinh_thanh as KinhThanh);
  const toc = tocDocTheoLoai(kt.the_loai);
  const phatMoi = d.ds.map((c, i) => { const can = canPhat(c, d.nv, (u) => dai.get(u) ?? null, toc); if (can == null) { if (dongThoai(c, d.nv).some((x) => x.loi.trim())) thieu++; return phatCu[i]!; } return Math.max(1, can); });
  for (const [i, c] of d.ds.entries()) {
    const p = phatMoi[i]!; if (Math.abs(p - phatCu[i]!) < 0.01) continue;
    await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['phat_s', 'thoi_luong_s', 'chu_man'], moTa: `khớp giây theo giọng (#${c.thu_tu} ${phatCu[i]}s → ${p}s)`, nguoi });
    await db.execute(sql`UPDATE xv_canh SET phat_s = ${p}, thoi_luong_s = CASE WHEN video_url IS NULL AND video_cuoi_url IS NULL THEN ${giayClipCan(c.ky_thuat?.toc_do, p)} ELSE GREATEST(thoi_luong_s, ${Math.ceil(p)}) END, chu_man = ${coGianMoc(c.chu_man, p / phatCu[i]!)}, updated_at = now() WHERE id = ${c.id}`);
    doi++;
  }
  if (doi && d.tap.lop.length) {
    await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['lop'], moTa: 'khớp giây theo giọng — dời lớp phủ theo shot', nguoi });
    await db.execute(sql`UPDATE xv_tap SET lop = ${JSON.stringify(doiLopTheoCat(d.tap.lop, batDauCua(phatCu), batDauCua(phatMoi)))}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  }
  return { ok: true, data: { doi, tong: Math.round(phatMoi.reduce((a, b) => a + b, 0) * 10) / 10, thieu } };
}

export async function nhipHanhDongTap(db: Db, tapId: number, nguoi: string): Promise<Kq<{ impact: number; shot: number }>> {
  const d = await docTap(db, tapId); if (!d) return { ok: false, loi: 'không thấy tập' };
  const r = nhipHanhDong(d.ds, batDauCua(d.ds.map(giayPhat)), d.tap.lop);
  if (r.lop.length) {
    await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['lop'], moTa: `⚡ nhịp hành động (+${r.lop.length / 3} impact)`, nguoi });
    await db.execute(sql`UPDATE xv_tap SET lop = ${JSON.stringify([...d.tap.lop, ...r.lop])}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  }
  for (const x of r.kt) {
    await chupTruoc(db, { bang: 'xv_canh', id: x.id, cot: ['ky_thuat'], moTa: '⚡ nhịp hành động — thêm tiếng', nguoi });
    await db.execute(sql`UPDATE xv_canh SET ky_thuat = ${JSON.stringify(x.ky_thuat)}::jsonb, updated_at = now() WHERE id = ${x.id}`);
  }
  return { ok: true, data: { impact: r.lop.length / 3, shot: r.kt.length } };
}
