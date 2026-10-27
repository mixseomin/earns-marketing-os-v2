// MÁY SINH ĐỀ THEO GÓC (bước 3 Dạng × Góc × Sản phẩm, 27/10/2026): ô kế hoạch tuần = sản phẩm × góc spy × dạng → một ĐỀ cho mẫu dựng tương ứng + chữ đăng,
// viết bằng chữ AI rẻ (claude.ts › sinhJson: Haiku qua ckey, vài chục đồng một đề). Trước đây đề do tác tử viết tay từng đợt 20 góc — nút cổ chai khi lên mọi sản phẩm.
// Phần THUẦN (khuôn, kiểm, slug, ghép mẫu) tách riêng để tự kiểm; phần gọi mô hình chỉ ở sinhDe. Đề ra vẫn qua Phòng Nội dung chấm (cham-dang.mjs) như mọi bài.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-de.test.mts
import { z } from 'zod/v4';
import type { MauMayDung } from './may-dung-mau';
import type { DeNapMay } from './may';

/** Dạng trong kho (scripts/ke-hoach-goc/dang-bai.json) → mẫu studio dựng được. Dạng chưa có mẫu → null (ô để máy đăng dùng bài kho như cũ). */
export const MAU_CUA_DANG: Record<string, MauMayDung | null> = {
  'canh-dong': 'canh-dong', 'the-chu-tren-anh': 'bai-anh', 'ai-con-nho': 'bai-anh', 'doan-nam-gia': 'bai-anh', 'hai-lua-chon': 'bai-anh',
  'top-n': 'top-n', 'lam-tuong': 'lat-dap-an', 'dung-sai': 'lat-dap-an', 'cau-do-meo': 'lat-dap-an', 'so-sanh': 'so-sanh', 'cau-noi-theo-nuoc': 'cau-noi', 'tin-lua-tuan': 'scam-or-real', 'n-buoc': 'before-you-land', 'do-chu': 'do-chu-mot-dung', 'cau-hoi-thi': 'cau-hoi-thi',
};
/** Mẫu máy sinh đề đã viết được prompt (mẫu cũ có đề phức tạp — scam / land / đố chữ — vẫn đi đường cũ). */
export const MAU_SINH = new Set<MauMayDung>(['canh-dong', 'bai-anh', 'top-n', 'lat-dap-an', 'so-sanh', 'cau-noi']);
export const KIEU_ANH: Record<string, string> = { 'the-chu-tren-anh': 'the-chu-tren-anh', 'ai-con-nho': 'ai-con-nho', 'doan-nam-gia': 'doan-nam-gia', 'hai-lua-chon': 'hai-lua-chon' };

export interface SanPhamDe { ma: string; ten: string; ngach: string[]; site: string | null; link: string; nhan: string; mo_ta: string; book?: string }
export interface GocDe { sp: number; id: number; loai: string; ten: string; mo_ta?: string | null }

const TU_MAY = ['delve', 'leverage', 'utilize', 'crucial', 'vital', 'comprehensive', 'robust', 'streamline', 'moreover', 'furthermore', 'seamless', 'elevate', 'unlock', 'game-changer', 'in today\'s', 'dive into', 'tapestry', 'realm', 'testament'];
const LOAI_VI: Record<string, string> = { ai_phan_doi: 'objection / doubt the audience has', ai_chan_dung: 'who the audience is (portrait)', ai_tinh_huong: 'a concrete situation they are in', ai_noi_dau: 'a pain they feel', ai_cach_giai: 'how they try to solve it', ai_tieu_chi: 'what they compare / choose by', ai_mong_muon: 'what they wish for', ai_cu_hich: 'the nudge that makes them act' };

export const DeCanhSchema = z.object({
  truy: z.string().describe('Pexels VIDEO search query, English, 2-4 words, a real place or object that fits the angle (e.g. "rain wooden porch", "kyoto station morning")'),
  moc: z.string().describe('One hook line shown small on the video, 40-70 characters, speaks to the angle, a question or a concrete situation, no brand name'),
  am: z.enum(['mua', 'song', 'gio', 'rung', 'dem', 'pho', 'lua', 'im']).describe('ambient sound: mua=rain song=waves gio=wind rung=forest/birds dem=night pho=street lua=fire im=silent'),
  dai: z.number().int().min(8).max(15).describe('seconds of scene, 8-15'),
  ket: z.array(z.string()).max(2).describe('0-2 closing lines: brand line and site, each under 40 characters'),
});
export const DeAnhSchema = z.object({
  truy: z.string().describe('Pexels PHOTO search query, English, 2-4 words, real scene or object fitting the angle'),
  chu: z.string().describe('Main text on the image, 30-90 characters: the hook (the-chu-tren-anh), a memory question (ai-con-nho), a guess question (doan-nam-gia) or the dilemma (hai-lua-chon)'),
  phu: z.string().describe('small sub line under the main text, under 40 characters, or empty'),
  lua: z.array(z.string()).max(2).describe('hai-lua-chon only: exactly 2 options, each under 60 characters; otherwise empty'),
  dap_an: z.string().describe('doan-nam-gia only: the answer, under 20 characters, factual; otherwise empty'),
});
export const DeTopSchema = z.object({
  tieu_de: z.string().describe('List title with the number N in it, 30-70 characters, e.g. "3 things to do before your plane lands in Japan"'),
  moc: z.string().describe('one short line under the title, under 50 characters, or empty'),
  muc: z.array(z.object({ ten: z.string().describe('item name, under 45 characters'), chu: z.string().describe('one concrete detail, under 60 characters, or empty'), truy: z.string().describe('Pexels PHOTO query for THIS item, English, 2-4 words, a real scene/object') })).min(3).max(5).describe('3-5 items ordered from N down to 1 (the last item is #1, the strongest)'),
  ket: z.array(z.string()).max(2).describe('0-2 closing lines: brand and site, each under 40 characters'),
  am: z.enum(['mua', 'song', 'gio', 'rung', 'dem', 'pho', 'lua', 'im']).describe('ambient sound fitting the list'),
});
export const DeLatSchema = z.object({
  tieu_de: z.string().describe('dung-sai only: short opening title with the number of statements, e.g. "3 hotel booking facts. True or false?"; empty for lam-tuong'),
  cau: z.array(z.object({ khang_dinh: z.string().describe('lam-tuong/dung-sai: a bold statement people commonly believe, under 70 characters, no question mark; cau-do-meo: the riddle question, under 70 characters'), dung: z.boolean().describe('true if the statement is actually true'), ly_do: z.string().describe('lam-tuong/dung-sai: one concrete reason, under 90 characters; cau-do-meo: the answer, under 40 characters'), truy: z.string().describe('Pexels PHOTO query for THIS statement, English, 2-4 words, a real scene/object') })).min(1).max(3).describe('lam-tuong: exactly 1 statement (a myth, dung=false, or a surprising fact); dung-sai: exactly 3 statements, mixed true/false; cau-do-meo: exactly 1 riddle, dung=true'),
  ket: z.array(z.string()).max(2).describe('0-2 closing lines: brand and site, each under 40 characters'),
  am: z.enum(['mua', 'song', 'gio', 'rung', 'dem', 'pho', 'lua', 'im']).describe('ambient sound fitting the scenes'),
});
export const DeSoSanhSchema = z.object({
  tieu_de: z.string().describe('"X vs Y" title, under 45 characters, naming both sides'),
  trai: z.object({ ten: z.string().describe('side X name, under 20 characters'), dong: z.array(z.string()).min(2).max(4).describe('2-4 short concrete points for X, each under 45 characters, same order/topic as side Y'), truy: z.string().describe('Pexels PHOTO query for side X, English, 2-4 words') }),
  phai: z.object({ ten: z.string().describe('side Y name, under 20 characters'), dong: z.array(z.string()).min(2).max(4).describe('2-4 points for Y, SAME COUNT as X, each answering the matching X point, under 45 characters'), truy: z.string().describe('Pexels PHOTO query for side Y, English, 2-4 words, a different scene from X') }),
  ket_luan: z.string().describe('one-line takeaway, under 50 characters, or empty'),
  ket: z.array(z.string()).max(2).describe('0-2 closing lines: brand and site, each under 40 characters'),
  am: z.enum(['mua', 'song', 'gio', 'rung', 'dem', 'pho', 'lua', 'im']).describe('ambient sound fitting the scenes'),
});
export const DeCauNoiSchema = z.object({
  tinh_huong: z.string().describe('the situation in English, under 30 characters, e.g. "At hotel check-in", "Ordering at a ramen shop"'),
  ngon_ngu: z.string().describe('target language name in English, e.g. "Japanese"'),
  cau: z.array(z.object({ ban_ngu: z.string().describe('the phrase in the native script, natural and polite, under 20 characters'), doc: z.string().describe('romanized pronunciation, under 40 characters'), nghia: z.string().describe('English meaning, under 40 characters') })).min(3).max(5).describe('3-5 phrases a traveler actually says in this situation, in the order they would be used'),
  truy: z.string().describe('Pexels PHOTO query for the situation scene, English, 2-4 words, in the right country'),
  ket: z.array(z.string()).max(2).describe('0-2 closing lines: brand and site, each under 40 characters'),
  am: z.enum(['mua', 'song', 'gio', 'rung', 'dem', 'pho', 'lua', 'im']).describe('ambient sound fitting the scene'),
});
export const ChuDangSchema = z.object({
  title: z.string().describe('Post hook, 40-100 characters, English, contains a question mark or a number, speaks to the angle, does NOT start with the brand name, unique'),
  description: z.string().describe('Post text, 150-400 characters, English, plain human voice: concrete, one useful thing, no hype, no hashtags, no em dashes; end with a natural invitation to the destination page (the link is appended by the machine)'),
});

/** Kiểm đề + chữ đăng theo đúng luật Phòng Nội dung (cham-dang.mjs) trước khi nạp — sai thì trả lỗi để sinh lại. Thuần. */
export function kiemDe(x: { mau: MauMayDung; dang_bai: string; de: Record<string, unknown>; title: string; description: string; nhan: string }): string[] {
  const loi: string[] = [], chu = `${x.title}\n${x.description}`, thuong = chu.toLowerCase();
  if (x.title.length < 25) loi.push(`câu móc quá ngắn (${x.title.length})`); if (x.title.length > 110) loi.push(`câu móc dài ${x.title.length}`);
  if (!/[?!]|\d/.test(x.title)) loi.push('câu móc không có câu hỏi / con số');
  if (x.nhan && x.title.toLowerCase().startsWith(x.nhan.toLowerCase())) loi.push('câu móc mở bằng tên thương hiệu');
  if (/[—–]/.test(chu)) loi.push('gạch ngang dài');
  const tm = TU_MAY.filter((w) => thuong.includes(w)); if (tm.length) loi.push(`từ máy: ${tm.join(', ')}`);
  if (x.description.length < 80) loi.push('chữ đăng quá mỏng');
  if ((chu.match(/(^|\s)#\w+/g) || []).length > 3) loi.push('quá 3 hashtag');
  const de = x.de as { truy?: string; moc?: string; chu?: string; lua?: string[]; dap_an?: string };
  if (x.mau !== 'top-n' && x.mau !== 'lat-dap-an' && x.mau !== 'so-sanh' && x.mau !== 'cau-noi' && (!de.truy || de.truy.split(/\s+/).length > 6)) loi.push('từ khoá cảnh thiếu hoặc dài');
  if (x.mau === 'canh-dong' && (!de.moc || de.moc.length < 20 || de.moc.length > 90)) loi.push('câu móc trên video 20–90 ký tự');
  if (x.mau === 'cau-noi') { const t = x.de as { ngon_ngu?: string; cau?: { ban_ngu?: string; doc?: string; nghia?: string }[] }; const n = t.cau?.length ?? 0; if (n < 3 || n > 5) loi.push('câu nói cần 3–5 câu'); if (t.cau?.some((c) => !c.ban_ngu || !c.doc || !c.nghia)) loi.push('mỗi câu cần bản ngữ + cách đọc + nghĩa'); if (t.cau?.some((c) => /^[\x00-\x7F]*$/.test(c.ban_ngu ?? '') && !/^(spanish|french|german|italian|portuguese|indonesian|vietnamese|turkish|dutch)$/i.test(t.ngon_ngu ?? ''))) loi.push('bản ngữ chưa phải chữ của ngôn ngữ đó'); }
  if (x.mau === 'so-sanh') { const t = x.de as { trai?: { dong?: string[]; truy?: string }; phai?: { dong?: string[]; truy?: string } }; const a = t.trai?.dong?.length ?? 0, b = t.phai?.dong?.length ?? 0; if (a < 2 || a !== b) loi.push('so sánh cần 2–4 cặp dòng, hai bên bằng nhau'); if (!t.trai?.truy || !t.phai?.truy || t.trai.truy === t.phai.truy) loi.push('hai bên cần hai từ khoá ảnh khác nhau'); }
  if (x.mau === 'lat-dap-an') { const t = x.de as { cau?: { khang_dinh?: string; ly_do?: string; truy?: string }[] }; const n = t.cau?.length ?? 0; if (x.dang_bai === 'dung-sai' ? n !== 3 : n !== 1) loi.push(x.dang_bai === 'dung-sai' ? 'đúng/sai cần đúng 3 câu' : `${x.dang_bai} cần đúng 1 câu`); if (t.cau?.some((c) => !c.khang_dinh || !c.ly_do || !c.truy)) loi.push('mỗi câu cần khẳng định + lý do + từ khoá ảnh'); }
  if (x.mau === 'top-n') { const t = x.de as { tieu_de?: string; muc?: { ten?: string; truy?: string }[] }; if (!t.tieu_de || !/\d/.test(t.tieu_de)) loi.push('tiêu đề top cần con số'); if (!t.muc || t.muc.length < 3 || t.muc.length > 5 || t.muc.some((m) => !m.ten || !m.truy)) loi.push('top cần 3–5 mục, mỗi mục có tên + từ khoá ảnh'); }
  if (x.mau === 'bai-anh') {
    if (!de.chu || de.chu.length < 20 || de.chu.length > 110) loi.push('chữ trên ảnh 20–110 ký tự');
    if (x.dang_bai === 'hai-lua-chon' && (de.lua?.length !== 2 || de.lua.some((v) => !v || v.length > 70))) loi.push('hai lựa chọn cần đúng 2 vế ≤ 70 ký tự');
    if (x.dang_bai === 'doan-nam-gia' && (!de.dap_an || de.dap_an.length > 24)) loi.push('đoán cần đáp án ≤ 24 ký tự');
  }
  return loi;
}
export const slugDe = (dang: string, gocId: number, chu: string) => `${dang}-${gocId}-${chu.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 3).join('-')}`.slice(0, 60);

/** Prompt hệ thống: luật chữ chung (giọng người thật, Phòng Nội dung) + mô tả sản phẩm + góc + dạng. */
export function vanHeThong(sp: SanPhamDe, dang_bai: string): string {
  return [`You write short social posts for "${sp.nhan}" (${sp.mo_ta}). Destination page: ${sp.link}. Audience market: US, English.`,
    'Rules (hard): plain human voice, concrete and specific, one useful thing per post; no hype, no superlatives, no hashtags, no em dashes (— or –), never these words: ' + TU_MAY.join(', ') + '.',
    'The hook must come from the ANGLE given (a real thing the audience says or faces), be a question or carry a number, and must not open with the brand name. Do not invent statistics, prices or testimonials.',
    `Post format: ${dang_bai}. Fill the schema exactly; empty strings / arrays where a field does not apply.`].join('\n');
}
export function vanNguoiDung(goc: GocDe, dang_bai: string, daDung: string[]): string {
  return [`ANGLE (${LOAI_VI[goc.loai] ?? goc.loai}): "${goc.ten}"${goc.mo_ta ? ` — ${goc.mo_ta}` : ''}.`,
    `Format "${dang_bai}": ${MO_TA_DANG[dang_bai] ?? ''}`,
    daDung.length ? `Hooks already used (write something different): ${daDung.slice(0, 12).map((t) => `"${t}"`).join('; ')}` : '',
    'Return the JSON now.'].filter(Boolean).join('\n');
}
const MO_TA_DANG: Record<string, string> = {
  'canh-dong': 'a calm 8-15s real scene video with ambient sound; one small hook line at the bottom that fits a quiet real scene (a feeling, a question, a situation from the angle) — never an on-screen task or puzzle instruction, nothing that is not in the footage; optional 1-2 closing lines (brand + site).',
  'the-chu-tren-anh': 'one hook sentence placed on a real photo; the sentence IS the content.',
  'ai-con-nho': 'a nostalgic object/scene photo + one memory question the audience will answer in comments; the memory must connect to the angle (same need, same habit, earlier era); sub line = era/detail.',
  'doan-nam-gia': 'a guess question (year, price, count) on a photo; second image reveals the answer — the answer must be a real fact.',
  'hai-lua-chon': 'a dilemma from the angle + exactly two options A/B the audience picks between; the text invites them to choose.',
  'lam-tuong': 'ONE statement people in this angle commonly believe, then the flip: MYTH (false) or FACT (true) with one concrete reason; pick the belief that is most common in the angle.',
  'cau-do-meo': 'ONE classic-style riddle tied to the angle (object, place or habit of this audience), answer is a single everyday thing; no trick that needs a picture.',
  'dung-sai': 'THREE short statements about the angle, a mix of true and false, each flipped TRUE/FALSE with one concrete reason; the viewer keeps score.',
  'cau-noi-theo-nuoc': 'one real situation from the angle in the destination country, 3-5 phrases a traveler says there in the local language (native script + romanization + meaning), polite register, in the order used.',
  'so-sanh': 'two sides of the angle set against each other (old vs new, A vs B, two places on one budget), 2-4 matched points each, one takeaway; both sides real and fair, no made-up numbers.',
  'top-n': 'a countdown list (3-5 items) answering the angle; each item is a real, specific thing with its own real-scene photo; #1 is the strongest; no made-up numbers.',
};

/** Ráp dòng nạp máy từ JSON mô hình trả. Thuần. */
export function rapDe(o: { sp: SanPhamDe; goc: GocDe; dang_bai: string; mau: MauMayDung; de: z.infer<typeof DeCanhSchema> | z.infer<typeof DeAnhSchema> | z.infer<typeof DeTopSchema> | z.infer<typeof DeLatSchema> | z.infer<typeof DeSoSanhSchema> | z.infer<typeof DeCauNoiSchema>; chu: z.infer<typeof ChuDangSchema>; dich?: string | null }): DeNapMay & { mau: MauMayDung } {
  const link = o.dich ?? o.sp.link, mota = o.chu.description.includes(link) ? o.chu.description : `${o.chu.description.trim()} ${link}`;
  const de: Record<string, unknown> = o.mau === 'bai-anh'
    ? (() => { const d = o.de as z.infer<typeof DeAnhSchema>; return { kieu: KIEU_ANH[o.dang_bai] ?? 'the-chu-tren-anh', truy: d.truy, chu: d.chu, ...(d.phu ? { phu: d.phu } : {}), ...(o.dang_bai === 'hai-lua-chon' ? { lua: d.lua } : {}), ...(o.dang_bai === 'doan-nam-gia' && d.dap_an ? { dap_an: d.dap_an } : {}), nhan: o.sp.nhan }; })()
    : o.mau === 'cau-noi' ? (() => { const d = o.de as z.infer<typeof DeCauNoiSchema>; return { tinh_huong: d.tinh_huong, ngon_ngu: d.ngon_ngu, cau: d.cau, truy: d.truy, ...(d.ket?.length ? { ket: d.ket } : {}), am: d.am, nhan: o.sp.nhan }; })()
    : o.mau === 'so-sanh' ? (() => { const d = o.de as z.infer<typeof DeSoSanhSchema>; return { tieu_de: d.tieu_de, trai: d.trai, phai: d.phai, ...(d.ket_luan ? { ket_luan: d.ket_luan } : {}), ...(d.ket?.length ? { ket: d.ket } : {}), am: d.am, nhan: o.sp.nhan }; })()
    : o.mau === 'lat-dap-an' ? (() => { const d = o.de as z.infer<typeof DeLatSchema>; return { kieu: o.dang_bai, cau: d.cau.map((c) => ({ khang_dinh: c.khang_dinh, dung: c.dung, ly_do: c.ly_do, truy: c.truy })), ...(o.dang_bai === 'dung-sai' && d.tieu_de ? { tieu_de: d.tieu_de } : {}), ...(d.ket?.length ? { ket: d.ket } : {}), am: d.am, nhan: o.sp.nhan }; })()
    : o.mau === 'top-n' ? (() => { const d = o.de as z.infer<typeof DeTopSchema>; return { tieu_de: d.tieu_de, muc: d.muc.map((m) => ({ ten: m.ten, ...(m.chu ? { chu: m.chu } : {}), truy: m.truy })), ...(d.moc ? { moc: d.moc } : {}), ...(d.ket?.length ? { ket: d.ket } : {}), am: d.am, nhan: o.sp.nhan }; })()
    : (() => { const d = o.de as z.infer<typeof DeCanhSchema>; return { truy: d.truy, moc: d.moc, am: d.am, dai: d.dai, ...(d.ket?.length ? { ket: d.ket } : {}) }; })();
  return { slug: slugDe(o.dang_bai, o.goc.id, (de.tieu_de as string | undefined) ?? (de.tinh_huong as string | undefined) ?? ((de.cau as { khang_dinh: string }[] | undefined)?.[0]?.khang_dinh) ?? (de.moc as string | undefined) ?? (de.chu as string | undefined) ?? o.goc.ten), chu_de: o.goc.ten, mau: o.mau, de: de as never,
    dang: { title: o.chu.title, description: mota, link, nhom: 'Góc spy', dang_bai: o.dang_bai, goc: { sp: o.goc.sp, id: o.goc.id, loai: o.goc.loai, ten: o.goc.ten }, ...(o.sp.book ? { book: o.sp.book } : {}) } as DeNapMay['dang'] };
}

/** Sinh một đề (gọi mô hình, tối đa 2 lượt nếu lượt đầu sai luật). Trả dòng nạp + tiền. */
export async function sinhDe(o: { sp: SanPhamDe; goc: GocDe; dang_bai: string; dich?: string | null; daDung?: string[] }): Promise<{ ok: true; de: DeNapMay & { mau: MauMayDung }; vnd: number; model: string } | { ok: false; loi: string; vnd: number }> {
  const mau = MAU_CUA_DANG[o.dang_bai]; if (!mau || !MAU_SINH.has(mau)) return { ok: false, loi: `dạng ${o.dang_bai} chưa có mẫu sinh đề`, vnd: 0 };
  const { sinhJson } = await import('./claude');
  const schema = z.object({ de: mau === 'bai-anh' ? DeAnhSchema : mau === 'top-n' ? DeTopSchema : mau === 'lat-dap-an' ? DeLatSchema : mau === 'so-sanh' ? DeSoSanhSchema : mau === 'cau-noi' ? DeCauNoiSchema : DeCanhSchema, chu: ChuDangSchema });
  let vnd = 0, loiCu: string[] = [];
  for (let lan = 0; lan < 2; lan++) {
    const r = await sinhJson({ schema, system: vanHeThong(o.sp, o.dang_bai), user: vanNguoiDung(o.goc, o.dang_bai, o.daDung ?? []) + (loiCu.length ? `\nPrevious attempt was rejected: ${loiCu.join('; ')}. Fix these.` : ''), ten: 'de_bai' });
    if (!r.ok) return { ok: false, loi: r.loi, vnd };
    vnd += r.tokens.vnd ?? 0;
    const de = rapDe({ sp: o.sp, goc: o.goc, dang_bai: o.dang_bai, mau, de: r.data.de, chu: r.data.chu, dich: o.dich });
    loiCu = kiemDe({ mau, dang_bai: o.dang_bai, de: de.de as unknown as Record<string, unknown>, title: de.dang.title ?? '', description: de.dang.description ?? '', nhan: o.sp.nhan });
    if (!loiCu.length) return { ok: true, de, vnd, model: r.model };
  }
  return { ok: false, loi: `đề sai luật sau 2 lượt: ${loiCu.join('; ')}`, vnd };
}
