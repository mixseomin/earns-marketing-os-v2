// Phần MÁY CHỦ của cách dựng nền cố định + lớp nhân vật (dung-lop.ts): dựng tấm nền, ghép ảnh / clip lớp nền xanh lên nền bằng ffmpeg.
import 'server-only';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { uploadToR2 } from '@/lib/r2';
import { sinhAnhQuaCong } from './cong-ai';
import { phongCachHinh } from './kieu';
import { taoJob, xongJob, type Db, type boiCanhCanh } from './doc-db';
import { boiCanhCua, cauDoMang, coGhep, khoaNen, locGhep, promptLop, promptNen, thanhPhanLop } from './dung-lop';
import { dayViecAnh } from './hoan-tat';

const run = promisify(execFile);
type Bc = NonNullable<Awaited<ReturnType<typeof boiCanhCanh>>>;

/** Tấm nền của shot: có sẵn trên anchor bối cảnh (cùng góc) thì dùng lại, chưa có thì dựng một lần (tốn 1 ảnh) từ ảnh thật của nơi đó. Ghi vào
 *  xv_nhan_vat.nen + xv_canh.lop.nen. */
export async function damBaoNen(db: Db, bc: Bc): Promise<{ ok: true; url: string } | { ok: false; loi: string }> {
  const bcv = boiCanhCua(bc.canh, bc.nhanVat);
  if (!bcv) return { ok: false, loi: 'shot dựng lớp cần một anchor Bối cảnh để dựng tấm nền' };
  const khoa = khoaNen(bcv.id, bc.canh.ky_thuat);
  let url = bcv.nen?.[khoa] ?? null;
  if (!url) {
    const refs = [...(bcv.anh_that ?? []).slice(0, 2), ...bcv.anh_ref.slice(0, 1)].slice(0, 3);
    const prompt = promptNen(phongCachHinh(bc.kt.phong_cach).replace(/[.\s]+$/, ''), bcv.mo_ta, bc.canh.ky_thuat);
    const job = await taoJob(db, { phim_id: bcv.phim_id, nhan: `Tấm nền · ${bcv.ten} · ${khoa}`, nhan_vat_id: bcv.id, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { prompt, dich: 'nen_lop', khoa, thamChieuUrl: refs } });
    const k = await sinhAnhQuaCong(bc.kt.mo_hinh_anh, { prompt, thamChieuUrl: refs, tiLe: bc.kt.ti_le === '16:9' ? '16:9' : '9:16' });
    if (!k.anh) { const l = `không dựng được tấm nền (${k.thu.map((t) => `${t.cong}: ${t.loi ?? ''}`).join(' · ')})`; await xongJob(db, job, { loi: l }); return { ok: false, loi: l }; }
    url = await uploadToR2(`xuong-video/nen/${bcv.id}-${randomUUID()}.png`, k.anh.data, k.anh.mimeType);
    if (!url) { await xongJob(db, job, { loi: 'lưu tấm nền hỏng' }); return { ok: false, loi: 'lưu tấm nền hỏng' }; }
    await xongJob(db, job, { output_url: url, chi_phi_cents: k.nguon?.cents ?? 0 });
    await db.execute(sql`UPDATE xv_nhan_vat SET nen = coalesce(nen, '{}'::jsonb) || jsonb_build_object(${khoa}::text, ${url}::text), updated_at = now() WHERE id = ${bcv.id}`);
  }
  await db.execute(sql`UPDATE xv_canh SET lop = coalesce(lop, '{}'::jsonb) || jsonb_build_object('nen', ${url}::text) WHERE id = ${bc.canh.id}`);
  return { ok: true, url };
}

async function tai(url: string, p: string) { const r = await fetch(url, { signal: AbortSignal.timeout(120_000) }); if (!r.ok) throw new Error(`tải ${url}: ${r.status}`); await writeFile(p, Buffer.from(await r.arrayBuffer())); }

/** Ghép ẢNH lớp nền xanh lên tấm nền → url ảnh ghép (null nếu hỏng). */
export async function ghepAnhLop(nenUrl: string, lopUrl: string, tiLe: string | undefined, thuMuc: string): Promise<string | null> {
  const thu = await mkdtemp(join(tmpdir(), 'ghep-lop-'));
  try {
    const [w, h] = coGhep(tiLe); const n = join(thu, 'nen'), l = join(thu, 'lop'), ra = join(thu, 'ra.jpg');
    await Promise.all([tai(nenUrl, n), tai(lopUrl, l)]);
    await run('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', n, '-i', l, '-filter_complex', locGhep(w, h, false), '-map', '[v]', '-frames:v', '1', '-q:v', '2', ra], { timeout: 60_000 });
    return await uploadToR2(`xuong-video/${thuMuc}/ghep-${randomUUID()}.jpg`, await readFile(ra), 'image/jpeg');
  } catch (e) { console.error('[ghép lớp ảnh] hỏng', lopUrl, e); return null; }
  finally { await rm(thu, { recursive: true, force: true }).catch(() => {}); }
}

/** Ghép CLIP lớp nền xanh lên tấm nền đứng yên → MP4 (giữ tiếng của clip nếu có). */
export async function ghepVideoLop(nenUrl: string, clip: Buffer, tiLe: string | undefined): Promise<Buffer | null> {
  const thu = await mkdtemp(join(tmpdir(), 'ghep-lop-v-'));
  try {
    const [w, h] = coGhep(tiLe); const n = join(thu, 'nen'), l = join(thu, 'lop.mp4'), ra = join(thu, 'ra.mp4');
    await tai(nenUrl, n); await writeFile(l, clip);
    await run('ffmpeg', ['-hide_banner', '-nostats', '-y', '-loop', '1', '-i', n, '-i', l, '-filter_complex', locGhep(w, h, true), '-map', '[v]', '-map', '1:a?', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-shortest', ra], { timeout: 300_000 });
    return await readFile(ra);
  } catch (e) { console.error('[ghép lớp video] hỏng', e); return null; }
  finally { await rm(thu, { recursive: true, force: true }).catch(() => {}); }
}

/** KEYFRAME LỚP: dựng / lấy tấm nền rồi gửi ảnh lớp nền xanh (người + vật của shot); về tới hoan-tat.ts › 'keyframe_lop' thì ghép lên nền. */
export async function sinhKeyframeLop(db: Db, bc: Bc, so: number): Promise<{ ok: true; data: number[] } | { ok: false; loi: string }> {
  const nen = await damBaoNen(db, bc);
  if (!nen.ok) return nen;
  const tp = thanhPhanLop(bc.canh, bc.nhanVat);
  if (!tp.length) return { ok: false, loi: 'shot dựng lớp không có nhân vật / vật nào ngoài bối cảnh' };
  const coRef = tp.filter((v) => v.anh_ref[0]).slice(0, 3); const refs = coRef.map((v) => v.anh_ref[0]!);
  const ai = tp.map((v) => { const i = coRef.indexOf(v); return `${(v.mo_ta.split(/(?<=\.)\s/)[0] ?? v.mo_ta).trim()}${i >= 0 ? ` (reference image ${i + 1})` : ''}`; }).join('; ');
  const dd = bc.canh.dan_dung;
  const moTa = `${[dd?.mo, dd?.bo_cuc].filter((x) => x?.trim()).join(' ')}${ai ? ` In the cel: ${ai}.` : ''}`;
  const prompt = promptLop(phongCachHinh(bc.kt.phong_cach).replace(/[.\s]+$/, ''), moTa, bc.canh.ky_thuat, cauDoMang(tp), refs.length);
  const jobs: number[] = [];
  for (let i = 0; i < Math.max(1, Math.min(3, so)); i++) {
    const job = await taoJob(db, { nhan: `Keyframe lớp · cảnh #${bc.canh.thu_tu} ${bc.canh.canh}`, canh_id: bc.canh.id, loai: 'anh', provider: 'google', model: bc.kt.mo_hinh_anh, request: { prompt, dich: 'keyframe_lop', thamChieu: refs.length, thamChieuUrl: refs, nen: nen.url } });
    jobs.push(job);
    await dayViecAnh({ job, model: bc.kt.mo_hinh_anh, prompt, thamChieuUrl: refs, tiLe: bc.kt.ti_le, thuMuc: `keyframe/${bc.canh.id}` });
  }
  return { ok: true, data: jobs };
}
