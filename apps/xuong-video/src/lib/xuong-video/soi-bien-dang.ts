// MÁY SOI BIẾN DẠNG CLIP (anh 17/10/2026, #120 shot 4: quần phồng / đũng tụt khi đứng dậy — "rất hay bị lỗi này"). Ghép N_KHUNG_BD khung của clip
// thành MỘT ảnh → Gemini 3.8 Flash (nhìn ảnh, đo thật ở script hiệu chỉnh, dưới ngưỡng tự chạy $0.01) chấm theo danh mục lỗi cố định (soi-clip-do.ts › loiDanBienDang),
// trả câu lỗi kèm giây cho soi_clip.loi. Thiếu khoá / lỗi mạng → null (không chặn, không báo đạt giả). Ghi tiền vào xv_job như mọi lượt chữ.
import 'server-only';
import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { khoaGoogle } from './google';
import { nguoiBanTuyen } from './ckey-tuyen';
import { VND_MOI_USD, VND_MOI_USD_SHOPAIKEY } from './cong-ai';
import { loiDanBienDang, LOAI_BD, N_KHUNG_BD, TEN_BD, type LoiBienDang } from './soi-clip-do';
import { ghiTienChu, type Db } from './doc-db';
import { congTk, giaChuCents } from './kieu';
import { xacNhanLoiClaude, MO_HINH_XAC_NHAN_CLAUDE } from './claude';

/** 2.5 Flash đã đóng với khoá mới (404 17/10/2026, Google chỉ sang 3.8 Flash). Suy nghĩ 'low' để mỗi clip dưới ngưỡng tự chạy $0.01. */
export const MO_HINH_BD = 'gemini-3.8-flash';
/** Lấy khung tại các giây `ts` (rộng `w`px) — ảnh RỜI (ghép ảnh bị Gemini nén mất chi tiết chân tay). */
const khungTai = async (url: string, ts: number[], w: number): Promise<string[] | null> => {
  const ra: string[] = [];
  for (const t of ts) {
    const b = await new Promise<Buffer | null>((ok) => execFile('ffmpeg', ['-v', 'error', '-ss', String(Math.max(0, Math.round(t * 100) / 100)), '-i', url, '-frames:v', '1',
      '-vf', `scale=${w}:-2`, '-q:v', '3', '-f', 'mjpeg', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1 << 24, timeout: 60_000 }, (e, x) => ok(e || !(x as Buffer).length ? null : (x as Buffer))));
    if (b) ra.push(b.toString('base64'));
  }
  return ra.length >= ts.length - 1 ? ra : null;
};
/** Lỗi chỉ dính tới ngón tay / bàn tay / cổ tay (không nhắc chân, quần, vật cầm) — loại báo nhầm nhiều nhất, cần Claude xác nhận. */
/** Lỗi "sản phẩm đổi kiểu" chỉ ở chi tiết may (túi, chỉ, đinh tán, khuy, đỉa quần) trong shot KHÔNG phải cận sản phẩm → người xem không thấy. */
export const laChiTietNho = (moTa: string, loai: string, yDo = ''): boolean =>
  loai === 'san_pham_doi_kieu' && /\b(pockets?|stitch\w*|seams?|rivets?|buttons?|belt loops?|coin pocket)\b/i.test(moTa)
  && !/\b(colou?r|different (garment|kind)|shorts|skirt|leggings|(turns?|changes?|becomes?) into)\b/i.test(moTa)
  && !/\b(close-?up|macro|detail shot|insert shot)\b/i.test(yDo);
export const laLoiTay = (moTa: string, loai = 'co_the_meo'): boolean => loai === 'co_the_meo' && /\b(finger|hand|wrist|thumb|palm)s?\b/i.test(moTa) && !/\b(legs?|feet|foot|limbs?)\b/i.test(moTa);
const LOAI_EN: Record<string, string> = { trang_phuc_bien_dang: 'clothing deforming unnaturally', co_the_meo: 'distorted anatomy (limbs merging, missing, duplicated, bending impossibly)',
  chu_tren_vat: 'text or a logo appearing on the clothing or objects', san_pham_doi_kieu: 'the product changing design or color', vat_the_la: 'an object appearing, vanishing, floating or morphing' };

/** MÁY SOI BẢN 3 (anh 17/10/2026: "KO đc bỏ sót — chạy QC tốn tiền nên creative phải đúng"): ưu tiên KHÔNG SÓT.
 *  Quét rộng: 2 lượt × N_KHUNG_BD khung rời LỆCH GIỜ nhau (phủ 2N thời điểm trong đoạn được dùng), GỘP mọi lỗi (hợp, không phải giao — giao bỏ sót
 *  tất lơ lửng / tay méo trên bộ mẫu). Xác nhận: mỗi loại lỗi bị báo soi lại 4 khung nét cao quanh đúng giây đó, hỏi có / không — chỉ lọc báo nhầm.
 *  Đo trên bộ mẫu chuẩn: scripts/kiem-may-soi.mts (phải bắt 100% clip lỗi). */
type KetSoiBd = { loi: string[]; tho: LoiBienDang[]; cents: number; canhBao: string[] };
/** Tải clip về đĩa MỘT lần rồi cắt khung tại chỗ (17/10/2026: ffmpeg đọc thẳng URL mở lại kết nối + tua cho TỪNG khung — 26 khung/clip,
 *  soi lại 14 clip #127 mất 25 phút). Tải hỏng thì đọc thẳng URL như cũ. */
export async function soiBienDang(db: Db | null, o: { url: string; dai: number; sp: string; yDo?: string; phimId?: number | null }): Promise<KetSoiBd | null> {
  if (!coDuongGemini()) return null;
  const tep = join(tmpdir(), `soi-bd-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`);
  const co = /^https?:/.test(o.url) ? await fetch(o.url, { signal: AbortSignal.timeout(120_000) }).then(async (r) => (r.ok ? (await writeFile(tep, Buffer.from(await r.arrayBuffer())), true) : false)).catch(() => false) : false;
  try { return await soiBienDangTep(db, { ...o, url: co ? tep : o.url }); } finally { if (co) await unlink(tep).catch(() => {}); }
}
async function soiBienDangTep(db: Db | null, o: { url: string; dai: number; sp: string; yDo?: string; phimId?: number | null }): Promise<KetSoiBd | null> {
  const N = N_KHUNG_BD, buoc = o.dai / N;
  const tA = Array.from({ length: N }, (_, i) => (i + 0.25) * buoc), tB = Array.from({ length: N }, (_, i) => (i + 0.75) * buoc);
  const [a, b] = await Promise.all([khungTai(o.url, tA, 448), khungTai(o.url, tB, 448)]);
  if (!a || !b) return null;
  const schema = { type: 'OBJECT', properties: { loi: { type: 'ARRAY', items: { type: 'OBJECT',
    properties: { khung: { type: 'INTEGER' }, loai: { type: 'STRING', enum: [...LOAI_BD] }, mo_ta: { type: 'STRING' } }, required: ['khung', 'loai', 'mo_ta'] } } }, required: ['loi'] };
  const goi = (anh: string[]) => goiGeminiJson<{ loi?: LoiBienDang[] }>([{ text: loiDanBienDang(o.sp, o.yDo) }, ...anh.map((d) => ({ inlineData: { mimeType: 'image/jpeg', data: d } }))], schema, 'MEDIA_RESOLUTION_MEDIUM');
  const [x, y] = await Promise.all([goi(a), goi(b)]);
  if (!x || !y) return null;
  const tk = congTk(x.tk, y.tk);
  // gộp: mỗi loại lấy thời điểm sớm nhất mà một trong hai lượt thấy
  const gop = new Map<string, { giay: number; mo_ta: string; khung: number }>();
  for (const [ds, ts] of [[x.data.loi ?? [], tA], [y.data.loi ?? [], tB]] as const) for (const l of ds) {
    if (!LOAI_BD.includes(l.loai) || l.khung < 1 || l.khung > N) continue;
    const g = ts[l.khung - 1]!; const cu = gop.get(l.loai);
    if (!cu || g < cu.giay) gop.set(l.loai, { giay: g, mo_ta: l.mo_ta, khung: l.khung });
  }
  // xác nhận từng loại bằng khung nét cao quanh đúng giây
  const giu: LoiBienDang[] = []; const loi: string[] = []; const canhBao: string[] = []; let tkXn: { in: number; out: number; vnd?: number } | null = null; let modelXn = MO_HINH_XAC_NHAN_CLAUDE;
  for (const [loai, v] of gop) {
    // PHÂN XỬ THEO LOẠI (đo bộ mẫu 17/10/2026): Claude bác nhầm cả 3 ca chân gập ngược / dính liền ở mọi cách xem → lỗi chân, quần, chữ, vật thể, sản phẩm
    // Flash thấy là CHẶN, không cho bác (không sót). Chỉ lỗi dính tới NGÓN TAY / BÀN TAY (nơi báo nhầm nhiều nhất) mới qua Claude xác nhận.
    // chi tiết may (túi, đường chỉ, đinh tán) ở shot KHÔNG cận sản phẩm: người xem không thấy (anh 17/10/2026: lỗi khó để ý không tính) → cảnh báo, không chặn
    if (laChiTietNho(v.mo_ta, loai, o.yDo)) { canhBao.push(`${TEN_BD[loai as keyof typeof TEN_BD] ?? loai} (chi tiết nhỏ, shot không cận) giây ${Math.round(v.giay * 10) / 10}: ${v.mo_ta.slice(0, 140)}`); continue; }
    if (!laLoiTay(v.mo_ta, loai)) { giu.push({ khung: v.khung, loai: loai as LoiBienDang['loai'], mo_ta: v.mo_ta }); loi.push(`${TEN_BD[loai as keyof typeof TEN_BD] ?? loai} từ giây ${Math.round(v.giay * 10) / 10}: ${v.mo_ta.trim().slice(0, 160)}`); continue; }
    const ts = [-0.5, -0.25, 0, 0.25, 0.5, 0.75].map((d) => Math.min(o.dai, Math.max(0, v.giay + d)));
    const anh = await khungTai(o.url, ts, 768);
    // xác nhận bằng CLAUDE nhìn ảnh (claude.ts › xacNhanLoiClaude) — Gemini (cả Pro) gật cả ngón tay bình thường; đúng giá Claude ~1,5¢ vẫn rẻ hơn một lượt sinh lại oan
    const cauHoi = `These 6 images are consecutive frames (0.25 s apart) of ONE AI-generated ad clip.${o.yDo ? ` Shot intent (intentional, not a defect): ${o.yDo}` : ''}
A first automatic check reported: ${LOAI_EN[loai] ?? loai} — "${v.mo_ta}". Look very closely at the hands and fingers in EVERY frame. co=true if that defect is really there; co=false if it looks normal, is only motion blur, or is part of the shot intent. muc: "nang" ONLY if an ordinary viewer watching ONCE at normal speed on a phone would clearly notice it (legs or arms merging, missing or duplicated, a body bending impossibly, clothing ballooning or fusing between the legs, readable text or a logo on clothing, an object floating or popping in / out, the product turning into a different garment or color); otherwise "nhe" (slightly soft fingers, small wrinkle / rip / texture changes, small edge objects, slight color shift, anything smaller than ~5% of the frame).`;
    const c = anh ? await xacNhanLoiClaude({ anh, cauHoi }) : null;
    if (c?.ok) { tkXn = tkXn ? congTk(tkXn, c.tokens) : c.tokens; modelXn = c.model; }
    const cd = c?.ok ? c.data : null;
    // lỗi NHẸ (chỉ thấy khi dừng hình) không chặn — ghi cảnh báo; không xác nhận được (lỗi mạng) → GIỮ lỗi: thà sinh lại oan còn hơn lọt
    if (cd?.co && cd.muc === 'nhe') { canhBao.push(`${TEN_BD[loai as keyof typeof TEN_BD] ?? loai} (nhẹ) giây ${Math.round(v.giay * 10) / 10}: ${cd.ly_do.slice(0, 140)}`); continue; }
    if (!cd || cd.co) { giu.push({ khung: v.khung, loai: loai as LoiBienDang['loai'], mo_ta: v.mo_ta }); loi.push(`${TEN_BD[loai as keyof typeof TEN_BD] ?? loai} từ giây ${Math.round(v.giay * 10) / 10}: ${v.mo_ta.trim().slice(0, 160)}`); }
  }
  let cents = db ? await ghiTienChu(db, o.phimId ?? null, 'soi biến dạng clip', x.model, tk, x.nguon) : tk.vnd != null ? (tk.vnd / VND_MOI_USD) * 100 : giaChuCents(MO_HINH_BD, tk.in, tk.out);
  if (tkXn) cents += db ? await ghiTienChu(db, o.phimId ?? null, 'xác nhận lỗi clip', modelXn, tkXn) : giaChuCents(modelXn, tkXn.in, tkXn.out);
  return { loi, tho: giu, cents, canhBao };
}
/** MỘT lượt Gemini trả JSON theo schema (MO_HINH_BD, suy nghĩ low) — dùng chung cho soi biến dạng, bóc tách / đối chiếu khung, viết lại prompt… null = lỗi / thiếu khoá.
 *  CHUỖI RẺ → CHÍNH HÃNG (anh 31/10/2026: "các luồng AI phải ưu tiên nguồn từ rẻ đến chính hãng"): ckey.vn → ShopAIKey → Google trực tiếp, CÙNG thân
 *  generateContent (hai cổng nhận nguyên đường /v1beta của Google). Trước đó mọi lượt đi thẳng Google — 66 lượt / 3 ngày, khoản chữ lớn nhất của studio.
 *  `model` mang tiền tố đường đã đi ('ckey:…' / 'shopaikey:…', Google = tên trơn), `nguon` = provider ghi sổ; tk.vnd = tiền thật (ckey báo usage.x_ckey.cost;
 *  ShopAIKey = giá niêm yết Google × 3.250₫ mỗi $1 credit). */
export type KqGeminiJson<T> = { data: T; tk: { in: number; out: number; vnd?: number }; model: string; nguon: 'ckey' | 'shopaikey' | 'google' };
export async function goiGeminiJson<T>(parts: unknown[], schema: unknown, mediaResolution?: string, model: string = MO_HINH_BD): Promise<KqGeminiJson<T> | null> {
  const body = JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { ...(mediaResolution ? { mediaResolution } : {}), thinkingConfig: { thinkingLevel: 'low' }, maxOutputTokens: 16384, responseMimeType: 'application/json', responseSchema: schema } });
  const duong: { nguon: KqGeminiJson<T>['nguon']; goc: string; khoa: string | null | undefined; ten: string }[] = [
    // người bán ckey: danh sách sống của Phòng Tài nguyên (ckey-tuyen.ts) trước, tên trơn của ckey sau
    ...[...nguoiBanTuyen(model), model].map((ten) => ({ nguon: 'ckey' as const, goc: 'https://api.xah.io/v1beta', khoa: process.env.CKEY_API_KEY, ten })),
    { nguon: 'shopaikey', goc: 'https://api.shopaikey.com/v1beta', khoa: process.env.SHOPAIKEY_API_KEY, ten: model },
    { nguon: 'google', goc: 'https://generativelanguage.googleapis.com/v1beta', khoa: khoaGoogle(), ten: model },
  ];
  for (const d of duong) {
    if (!d.khoa) continue;
    try {
      const r = await fetch(`${d.goc}/models/${d.ten}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': d.khoa, ...(d.nguon === 'google' ? {} : { authorization: `Bearer ${d.khoa}` }) }, body, signal: AbortSignal.timeout(120_000) });
      if (!r.ok) { console.error(`[gemini json ${d.nguon}]`, r.status, (await r.text()).slice(0, 200)); continue; }
      const j = await r.json() as { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[]; promptFeedback?: { blockReason?: string }; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; x_ckey?: { cost?: number } } };
      const u = j.usageMetadata ?? {};
      // không có chữ (hết token / bị chặn) → đường sau; hết đường thì null có lý do, KHÔNG trả {} (17/10/2026: {} thành điểm NaN, vòng tự làm phim đổ lỗi)
      const txt = (j.candidates?.[0]?.content?.parts ?? []).filter((x) => !x.thought).map((x) => x.text ?? '').join('').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');   // vài người bán ckey bọc ```json
      if (!txt) { console.error(`[gemini json ${d.nguon}] không có chữ —`, j.candidates?.[0]?.finishReason ?? j.promptFeedback?.blockReason ?? 'không rõ'); continue; }
      const data = JSON.parse(txt) as T;
      const tk = { in: u.promptTokenCount ?? 0, out: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) };
      const vnd = d.nguon === 'ckey' && typeof u.x_ckey?.cost === 'number' ? u.x_ckey.cost : d.nguon === 'shopaikey' ? (giaChuCents(model, tk.in, tk.out) / 100) * VND_MOI_USD_SHOPAIKEY : undefined;
      return { data, tk: vnd != null ? { ...tk, vnd } : tk, model: d.nguon === 'google' ? model : `${d.nguon}:${model}`, nguon: d.nguon };
    } catch (e) { console.error(`[gemini json ${d.nguon}]`, e); }
  }
  return null;
}
/** Có ít nhất một đường cho goiGeminiJson (cổng rẻ hoặc Google). */
export const coDuongGemini = (): boolean => !!(process.env.CKEY_API_KEY || process.env.SHOPAIKEY_API_KEY || khoaGoogle());
/** Ý đồ của shot cho máy soi: hành động video + khung hình (bỏ đoạn tả sản phẩm dài — đã có riêng) — để quần cũ / rách / chia đôi khung cố ý không bị báo. */
export const yDoShot = (promptVideo: string, promptAnh: string, spMoTa = ''): string =>
  [promptVideo, spMoTa ? promptAnh.split(spMoTa).join('') : promptAnh].map((x) => x.trim()).filter(Boolean).join(' | ').slice(0, 900);

/** Khuôn zod (v3) → responseSchema của Gemini, GIỮ mô tả từng trường — để bộ chấm Gemini đọc đúng nghĩa trường như bản Claude
 *  (17/10/2026: thiếu mô tả, Gemini hiểu trường `ai` của QC là "ai trong phim" thay vì "sản phẩm là gì" → đối chiếu báo lệch oan). */
export function zodSangGemini(z: unknown): Record<string, unknown> {
  // đọc được cả zod v3 (_def.typeName, shape là hàm, mảng ở _def.type) lẫn v4 (_def.type, shape là đối tượng, mảng ở _def.element, mô tả ở .description)
  // — studio dùng 'zod/v4' (claude.ts); bản đầu chỉ đọc v3 nên cả khuôn thành STRING, Gemini trả một câu văn.
  const zz = z as { description?: string; _def: Record<string, unknown> & { typeName?: string; type?: unknown; description?: string; shape?: unknown; element?: unknown; innerType?: unknown } };
  const d = zz._def; const loai = String(d.typeName ?? d.type ?? '').replace(/^Zod/, '').toLowerCase();
  const moTa = zz.description ?? d.description; const mo = moTa ? { description: moTa } : {};
  switch (loai) {
    case 'object': { const sh = (typeof d.shape === 'function' ? (d.shape as () => Record<string, unknown>)() : d.shape) as Record<string, unknown>;
      return { type: 'OBJECT', ...mo, properties: Object.fromEntries(Object.entries(sh).map(([k, v]) => [k, zodSangGemini(v)])), required: Object.keys(sh) }; }
    case 'array': return { type: 'ARRAY', ...mo, items: zodSangGemini(d.element ?? d.type) };
    case 'string': return { type: 'STRING', ...mo };
    case 'number': return { type: 'NUMBER', ...mo };
    case 'boolean': return { type: 'BOOLEAN', ...mo };
    case 'optional': case 'nullable': case 'default': return zodSangGemini(d.innerType);
    default: return { type: 'STRING', ...mo };
  }
}
