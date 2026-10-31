// KIỂM HOOK QC — MỘT bộ luật cho cả hai khâu (anh 31/10/2026: "cơ chế chấm phải tự làm việc này chứ ko phải đến lúc tao hỏi show ra mới phát hiện"):
//   máy sinh   apps/xuong-video/src/lib/xuong-video/may-de.ts › kiemDe   (sai thì sinh lại)
//   Phòng Nội dung   apps/cty/worker/cham-dang.mjs luật 8                 (chấm độc lập dang.hook.goc với chữ bài thật)
// Mọi dòng hook người xem thấy (tiêu đề bài + câu hook trên màn de.moc) phải bám hook QC gốc — trước đây chỉ cần MỘT dòng giống là qua, câu trên màn tự viết lọt.
//   node apps/xuong-video/src/lib/xuong-video/hook-qc.mjs --tu-kiem

const TU_RONG = new Set('a an the to of and or for in on at is are be you your yours it this that with what how why do does i me my we our he she his her they them'.split(' '));
export const tuNoiDung = (v) => String(v ?? '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1 && !TU_RONG.has(w));
/** Mức GIỮ bản gốc: tỉ lệ từ nội dung của hook gốc còn trong dòng mới (0–1). */
export const giuHook = (moi, goc) => { const g = [...new Set(tuNoiDung(goc))]; if (!g.length) return 0; const m = new Set(tuNoiDung(moi)); return g.filter((w) => m.has(w)).length / g.length; };
/** "Sửa không quá nhiều": giữ ít nhất 35% từ nội dung của hook gốc. */
export const GIU_HOOK_TOI_THIEU = 0.35;
/** Dòng đầu QC sạch: bỏ đuôi nhãn của nền tảng ("| ad", "| Sponsored") — #851 mang nguyên "| ad?" lên tiêu đề. */
export const sachHook = (v) => String(v ?? '').replace(/\s+/g, ' ').replace(/\s*[|｜]\s*(ads?|sponsored|promoted|paid)\s*\??\s*$/i, '').trim();
const cacSo = (v) => new Set(String(v ?? '').match(/\d+(?:[.,]\d+)?/g) ?? []);
/** Dòng hook người xem thấy: tiêu đề bài + câu hook trên màn (de.moc, nếu mẫu có). */
export const dongHookBai = (title, de) => [title, de?.moc].map((x) => String(x ?? '').trim()).filter(Boolean);

/** Lỗi của các dòng hook so với hook QC gốc. [] = đạt. */
export function loiHook(dong, goc) {
  const g = sachHook(goc), soGoc = cacSo(g), loi = [];
  for (const d of dong) {
    const ngan = d.length > 60 ? `${d.slice(0, 57)}…` : d, giu = giuHook(d, g);
    if (giu < GIU_HOOK_TOI_THIEU) loi.push(`"${ngan}" sửa quá xa hook QC gốc (giữ ${Math.round(giu * 100)}% chữ, cần ≥ ${GIU_HOOK_TOI_THIEU * 100}%): "${g.slice(0, 80)}"`);
    // con số không có trong QC gốc = số liệu bịa (#856 "what 3 REAL customers say" — gốc không có số, shop chưa có lời khách nào)
    const soMoi = [...cacSo(d)].filter((x) => !soGoc.has(x)); if (soMoi.length) loi.push(`"${ngan}" thêm con số không có trong hook gốc (${soMoi.join(', ')})`);
    if (/\s[|｜]\s*\S{0,12}\s*\??\s*$/.test(d)) loi.push(`"${ngan}" dính đuôi nhãn của QC gốc`);
  }
  return loi;
}

/** Con số trong dòng hook mà tệp SỰ THẬT của máy (apps/xuong-video/su-that/<máy>.md) không có — lời hứa sản phẩm chưa kiểm
 *  (#855 Saidly "165+ languages" chép từ QC máy phiên dịch đeo tai, sự thật: ~100 ngôn ngữ). Máy chưa có tệp sự thật → [] (không đoán). */
export function soNgoaiSuThat(dong, suThat) {
  if (!suThat) return [];
  const co = cacSo(suThat); return [...new Set(dong.flatMap((d) => [...cacSo(d)]))].filter((x) => !co.has(x));
}

if (process.argv[1]?.endsWith('hook-qc.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  const goc = 'Did you know that the moment you were born is the most important moment of your life?';
  t.deepEqual(loiHook([goc, goc], goc), [], 'nguyên văn = đạt');
  t.equal(loiHook([goc, 'Your chart can answer more than you think'], goc).length, 1, 'tiêu đề giống mà câu trên màn tự viết = chặn (#845 / #882 / #885)');
  t.ok(loiHook(["Here's what 3 REAL customers say 👇"], "Here's what REAL customers say about TurboScribe 👇").some((x) => x.includes('con số')), 'thêm số = chặn (#856)');
  t.deepEqual(loiHook(['Get flight deals up to 72% off'], 'Get mind-blowing flight deals up to 72% off'), [], 'số có sẵn trong gốc = đạt');
  t.ok(loiHook(['This might be the most underrated productivity tool this year | ad?'], 'This might be the most underrated productivity tool this year | ad').some((x) => x.includes('đuôi')), 'đuôi "| ad" = chặn (#851)');
  t.equal(sachHook('Best tool this year | ad'), 'Best tool this year');
  t.deepEqual(dongHookBai('T', { moc: '' }), ['T'], 'mẫu không có câu trên màn = chỉ kiểm tiêu đề');
  t.deepEqual(soNgoaiSuThat(['AI translator 165+ languages'], '- Recognizes about 100 spoken languages.'), ['165'], 'số ngoài sự thật = lộ (#855)');
  t.deepEqual(soNgoaiSuThat(['AI translator 165+ languages'], null), [], 'chưa có tệp sự thật = không đoán');
  console.log('hook-qc: 9 ca đạt'); process.exit(0);
}
