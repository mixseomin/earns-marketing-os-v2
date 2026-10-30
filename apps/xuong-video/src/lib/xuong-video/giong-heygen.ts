// GIỌNG LỜI DẪN CHO MẪU MÁY (bước 6 Dạng × Góc × Sản phẩm, 30/10/2026): anh nghe hai mẫu (inworld Hank / heygen Vincent) rồi chọn "heygen đi".
// fal heygen/heygen-voice/turbo, giọng Vincent: ~$0,002 / 1.000 ký tự (đang giảm 50% tới 31/10, sau đó ~$0,004) → một video ~450 ký tự dưới $0,01.
// Sinh MỘT lần cho mỗi video (xuatVideo ghi de.giong_url + de.giong_giay), dựng lại dùng lại tệp — không tốn lại. Tệp giữ trên R2 (link fal là tạm).
import 'server-only';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { uploadToR2 } from '../r2';
import { dsMoHinhGiong } from './giong';
import { giaGiongTheo } from './am-thanh';
import { VND_MOI_USD } from './cong-ai';

export const GIONG_LOI_DAN = { model: 'heygen/heygen-voice/turbo', voice: 'Vincent' } as const;
const chay = promisify(execFile);

/** Đọc `loi` bằng giọng lời dẫn → tệp mp3 trên R2 + số giây thật + tiền VNĐ (theo bảng giá fal đang niêm yết). */
export async function sinhGiongLoiDan(loi: string, slug: string): Promise<{ ok: true; url: string; giay: number; vnd: number } | { ok: false; loi: string }> {
  const key = process.env.FAL_KEY; if (!key) return { ok: false, loi: 'thiếu FAL_KEY — không sinh được giọng lời dẫn' };
  const chu = loi.trim(); if (chu.length < 20) return { ok: false, loi: 'lời dẫn quá ngắn để đọc' };
  const r = await fetch(`https://fal.run/${GIONG_LOI_DAN.model}`, { method: 'POST', headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: chu, voice: GIONG_LOI_DAN.voice }), signal: AbortSignal.timeout(180_000) }).catch((e: Error) => e);
  if (r instanceof Error) return { ok: false, loi: `fal giọng: ${r.message}` };
  const j = (await r.json().catch(() => ({}))) as { audio?: { url?: string } | string; detail?: unknown };
  const amUrl = typeof j.audio === 'string' ? j.audio : j.audio?.url;
  if (!r.ok || !amUrl) return { ok: false, loi: `fal giọng ${r.status}: ${JSON.stringify(j.detail ?? j).slice(0, 200)}` };
  const tai = await fetch(amUrl, { signal: AbortSignal.timeout(60_000) }); if (!tai.ok) return { ok: false, loi: `tải tệp giọng ${tai.status}` };
  const buf = Buffer.from(await tai.arrayBuffer()), dir = await mkdtemp(join(tmpdir(), 'giong-')), tep = join(dir, 'giong.mp3');
  try {
    await writeFile(tep, buf);
    const { stdout } = await chay('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', tep]);
    const giay = Number(Number(stdout.trim()).toFixed(2)); if (!(giay > 1)) return { ok: false, loi: `tệp giọng hỏng (${stdout.trim()} giây)` };
    const url = await uploadToR2(`xuong-video/may/${slug}-giong-${randomUUID().slice(0, 8)}.mp3`, buf, 'audio/mpeg'); if (!url) return { ok: false, loi: 'không đẩy được tệp giọng lên R2' };
    const cents = giaGiongTheo(await dsMoHinhGiong(), GIONG_LOI_DAN.model, chu.length) ?? (chu.length / 1000) * 0.4;   // fal không trả giá → giá thường (sau khuyến mãi) $0,004/1k
    return { ok: true, url, giay, vnd: Math.round((cents / 100) * VND_MOI_USD) };
  } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
