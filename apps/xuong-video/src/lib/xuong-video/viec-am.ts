// Một việc sinh ÂM (giọng / hiệu ứng / nhạc) gói thành dữ liệu thuần — chạy ở Cloudflare Worker (xv-worker) hoặc hàng nền studio,
// cùng đường với việc ảnh (viec-anh.ts). Gọi fal đồng bộ (fal.run) vì âm thanh ngắn; tải file về rồi đẩy lên R2 img.on.tc.
// Không đụng DB: kết quả trả về để studio ghi sổ + gắn vào shot/tập (hoan-tat.ts).
import { uploadToR2 } from '../r2';
import { ttsElevenTrucTiep } from './giong';

export type ViecAm = {
  kieu: 'am'; job: number; model: string; input: Record<string, unknown>;
  /** tiền tố khoá R2 sau 'xuong-video/am/', vd 'thoai/12' */
  thuMuc: string;
};
export type KqViecAm = { job: number; ok: true; url: string; model: string } | { job: number; ok: false; loi: string };

/** Tìm URL file âm thanh trong kết quả fal (mỗi model một khuôn: audio.url · audio_file.url · audios[0].url · audio[0][0].url…). */
function timUrl(o: unknown): string | null {
  if (!o || typeof o !== 'object') return null;
  if (Array.isArray(o)) { for (const x of o) { const u = timUrl(x); if (u) return u; } return null; }
  const r = o as Record<string, unknown>;
  if (typeof r.url === 'string' && /^https?:\/\//.test(r.url)) return r.url;
  for (const k of ['audio', 'audio_file', 'audios', 'audio_url', 'output', 'sound']) {
    const v = r[k];
    if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
    const u = timUrl(v); if (u) return u;
  }
  return null;
}

export async function chayViecAm(v: ViecAm): Promise<KqViecAm> {
  // ElevenLabs trực tiếp (giọng trong tài khoản anh, tính vào gói ElevenLabs).
  if (v.model.startsWith('elevenlabs:')) {
    const k = process.env.ELEVENLABS_API_KEY;
    if (!k) return { job: v.job, ok: false, loi: 'Thiếu ELEVENLABS_API_KEY trên máy chủ' };
    try {
      const r = await ttsElevenTrucTiep(v.input as { text: string; voice_id: string; model_id: string }, k);
      if (!r.ok) return { job: v.job, ok: false, loi: r.loi };
      const url = await uploadToR2(`xuong-video/am/${v.thuMuc}-${crypto.randomUUID()}.mp3`, Buffer.from(r.data), 'audio/mpeg');
      return url ? { job: v.job, ok: true, url, model: v.model } : { job: v.job, ok: false, loi: 'R2 không nhận file âm thanh' };
    } catch (e) { return { job: v.job, ok: false, loi: `ElevenLabs: ${e instanceof Error ? e.message : String(e)}` }; }
  }
  const key = process.env.FAL_KEY;
  if (!key) return { job: v.job, ok: false, loi: 'Thiếu FAL_KEY' };
  try {
    const r = await fetch(`https://fal.run/${v.model}`, {
      method: 'POST', headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(v.input),
      signal: AbortSignal.timeout(300_000),
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      const d = j.detail; const m = typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => (x as { msg?: string }).msg ?? '').join('; ') : JSON.stringify(j).slice(0, 200);
      return { job: v.job, ok: false, loi: `fal ${r.status}: ${m}`.slice(0, 300) };
    }
    const nguon = timUrl(j);
    if (!nguon) return { job: v.job, ok: false, loi: 'fal không trả file âm thanh' };
    const f = await fetch(nguon);
    if (!f.ok) return { job: v.job, ok: false, loi: `không tải được file âm thanh (${f.status})` };
    const mime = f.headers.get('content-type')?.split(';')[0] || 'audio/mpeg';
    const duoi = /wav/.test(mime) ? 'wav' : /flac/.test(mime) ? 'flac' : /aac|mp4/.test(mime) ? 'm4a' : 'mp3';
    const url = await uploadToR2(`xuong-video/am/${v.thuMuc}-${crypto.randomUUID()}.${duoi}`, Buffer.from(await f.arrayBuffer()), mime);
    if (!url) return { job: v.job, ok: false, loi: 'R2 không nhận file âm thanh' };
    return { job: v.job, ok: true, url, model: `fal:${v.model}` };
  } catch (e) {
    return { job: v.job, ok: false, loi: `lỗi khi chạy: ${e instanceof Error ? e.message : String(e)}` };
  }
}
