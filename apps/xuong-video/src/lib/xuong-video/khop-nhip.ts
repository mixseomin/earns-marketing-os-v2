// Khớp điểm cắt của tập vào phách nhạc nền (12/10/2026) — phần máy chủ: tải nhạc, giải mã bằng ffmpeg, gọi lõi thuần nhip-nhac.ts,
// ghi giây phát mới + dời lớp phủ theo shot. Chụp trước mỗi thứ sửa (↶ Hoàn tác được). 0đ, không gọi model.
import 'server-only';
import { execFile } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { doPhach, luoiPhach, khopNhip, doiLopTheoCat, SR_PHACH } from './nhip-nhac';
import { giayPhat, locNhanh, type Canh } from './kieu';
import { mapCanh, mapTap, type Db, type Row } from './doc-db';
import { chupTruoc } from './hoan-tac';

async function giaiMa(url: string): Promise<Float32Array> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) }); if (!r.ok) throw new Error(`tải nhạc ${r.status}`);
  const vao = Buffer.from(await r.arrayBuffer());
  return new Promise((ok, hong) => {
    const p = execFile('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', String(SR_PHACH), '-f', 'f32le', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1 << 28 }, (e, ra) => {
      if (e) return hong(e); const b = ra as Buffer; ok(new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 4)));
    });
    p.stdin?.end(vao);
  });
}

export type KqKhopNhip = { bpm: number[]; khop: number; diemCat: number; doi: number };
export async function khopNhipTap(db: Db, tapId: number, nguoi: string): Promise<{ ok: true; data: KqKhopNhip } | { ok: false; loi: string }> {
  const t = (await db.execute(sql`SELECT * FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return { ok: false, loi: 'không thấy tập' };
  const tap = mapTap(t[0]);
  const ds: Canh[] = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[]).map(mapCanh), 'A').sort((a, b) => a.thu_tu - b.thu_tu);
  if (ds.length < 2) return { ok: false, loi: 'tập chưa đủ shot để khớp' };
  const phat = ds.map(giayPhat); const tong = phat.reduce((a, b) => a + b, 0);
  const batDau = phat.map((_, i) => phat.slice(0, i).reduce((a, b) => a + b, 0));
  // Nguồn phách: nhạc theo phân cảnh (mỗi khối một bài, phách lệch theo giây bắt đầu khối) hoặc một bài cả tập.
  const khoi: { url: string; tu: number; den: number }[] = [];
  ds.forEach((c, i) => { const u = tap.nhac_phan_canh?.[c.phan_doan]; const l = khoi[khoi.length - 1]; if (u && l && l.url === u && Math.abs(l.den - batDau[i]!) < 1e-6) l.den = batDau[i]! + phat[i]!; else if (u) khoi.push({ url: u, tu: batDau[i]!, den: batDau[i]! + phat[i]! }); });
  if (!khoi.length && tap.nhac_url) khoi.push({ url: tap.nhac_url, tu: 0, den: tong });
  if (!khoi.length) return { ok: false, loi: 'tập chưa có nhạc nền — sinh/chọn nhạc trước rồi khớp nhịp' };
  const phach: number[] = []; const bpm: number[] = [];
  for (const k of khoi) {
    const d = doPhach(await giaiMa(k.url)); if (!d) continue;
    bpm.push(d.bpm); phach.push(...luoiPhach(d.phach, d.bpm, k.den - k.tu + 0.5, k.tu).filter((p) => p <= k.den + 0.4));
  }
  if (!phach.length) return { ok: false, loi: 'không dò được phách (nhạc quá êm / không có tiếng gõ)' };
  const kq = khopNhip(phat, phach.sort((a, b) => a - b));
  const batDauMoi = kq.phat.map((_, i) => kq.phat.slice(0, i).reduce((a, b) => a + b, 0));
  let doi = 0;
  for (const [i, c] of ds.entries()) {
    const p = kq.phat[i]!; if (Math.abs(p - phat[i]!) < 0.01) continue;
    await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['phat_s', 'thoi_luong_s'], moTa: `khớp nhịp nhạc (#${c.thu_tu} ${phat[i]}s → ${p}s)`, nguoi });
    await db.execute(sql`UPDATE xv_canh SET phat_s = ${p}, thoi_luong_s = GREATEST(thoi_luong_s, ${Math.ceil(p)}), updated_at = now() WHERE id = ${c.id}`);
    doi++;
  }
  if (doi && tap.lop.length) {
    await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['lop'], moTa: 'khớp nhịp nhạc — dời lớp phủ theo shot', nguoi });
    await db.execute(sql`UPDATE xv_tap SET lop = ${JSON.stringify(doiLopTheoCat(tap.lop, batDau, batDauMoi))}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  }
  return { ok: true, data: { bpm, khop: kq.khop, diemCat: ds.length - 1, doi } };
}
