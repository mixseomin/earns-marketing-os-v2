// MÁY SOI BIẾN DẠNG CLIP (anh 17/10/2026, #120 shot 4: quần phồng / đũng tụt khi đứng dậy — "rất hay bị lỗi này"). Ghép N_KHUNG_BD khung của clip
// thành MỘT ảnh → Gemini Flash (nhìn ảnh, ~$0.001/clip, dưới ngưỡng tự chạy $0.01) chấm theo danh mục lỗi cố định (soi-clip-do.ts › loiDanBienDang),
// trả câu lỗi kèm giây cho soi_clip.loi. Thiếu khoá / lỗi mạng → null (không chặn, không báo đạt giả). Ghi tiền vào xv_job như mọi lượt chữ.
import 'server-only';
import { execFile } from 'node:child_process';
import { khoaGoogle } from './google';
import { loiDanBienDang, loiTuBienDang, LOAI_BD, N_KHUNG_BD, type LoiBienDang } from './soi-clip-do';
import { ghiTienChu, type Db } from './doc-db';

export const MO_HINH_BD = 'gemini-2.5-flash';
const anhGhep = (url: string, dai: number) => new Promise<Buffer | null>((ok) => execFile('ffmpeg', ['-v', 'error', '-i', url,
  '-vf', `fps=${N_KHUNG_BD / dai},scale=270:-2,tile=6x2`, '-frames:v', '1', '-q:v', '4', '-f', 'mjpeg', 'pipe:1'],
  { encoding: 'buffer', maxBuffer: 1 << 25, timeout: 90_000 }, (e, b) => ok(e || !(b as Buffer).length ? null : (b as Buffer))));

export async function soiBienDang(db: Db | null, o: { url: string; dai: number; sp: string; phimId?: number | null }): Promise<{ loi: string[]; tho: LoiBienDang[]; cents: number } | null> {
  const key = khoaGoogle(); if (!key) return null;
  const anh = await anhGhep(o.url, o.dai); if (!anh) return null;
  const body = { contents: [{ role: 'user', parts: [{ text: loiDanBienDang(o.sp) }, { inlineData: { mimeType: 'image/jpeg', data: anh.toString('base64') } }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { loi: { type: 'ARRAY', items: { type: 'OBJECT',
      properties: { khung: { type: 'INTEGER' }, loai: { type: 'STRING', enum: [...LOAI_BD] }, mo_ta: { type: 'STRING' } }, required: ['khung', 'loai', 'mo_ta'] } } }, required: ['loi'] } } };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MO_HINH_BD}:generateContent?key=${key}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });
    if (!r.ok) { console.error('[soi biến dạng]', r.status, (await r.text()).slice(0, 200)); return null; }
    const j = await r.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } };
    const tho = (JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}') as { loi?: LoiBienDang[] }).loi ?? [];
    const u = j.usageMetadata ?? {};
    const tk = { in: u.promptTokenCount ?? 0, out: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) };
    const cents = db ? await ghiTienChu(db, o.phimId ?? null, 'soi biến dạng clip', MO_HINH_BD, tk, 'google') : (tk.in * 0.3 + tk.out * 2.5) / 10_000;
    return { loi: loiTuBienDang(tho, o.dai), tho, cents };
  } catch (e) { console.error('[soi biến dạng]', e); return null; }
}
