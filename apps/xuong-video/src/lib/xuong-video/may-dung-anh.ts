// MẪU MÁY DỰNG "Bài ảnh" (bước 3 Dạng × Góc × Sản phẩm, 27/10/2026) — MỘT mẫu chung cho bốn dạng bài ảnh trong kho dang-bai.json:
//   the-chu-tren-anh (một câu móc của góc trên ảnh thật) · ai-con-nho ("Nhận ra cái này không?" + câu hỏi ký ức) · doan-nam-gia (câu hỏi đoán, ảnh 2 lộ đáp án)
//   · hai-lua-chon (A hay B? hai vế trên cùng ảnh). THUẦN: đề → ASS (một hoặc hai "khung" theo mốc giây) + lệnh ffmpeg xuất KHUNG ẢNH 1080×1350 (4:5 — Facebook / X / IG
//   đều hiện trọn), không dựng MP4 (mau-dung › chiAnh). Nền = ảnh thật Pexels (anh-nen.ts) hoặc ảnh đã AI sửa theo góc; chữ đọc được nhờ dải tối mỏng, không phủ cả ảnh.
//   node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-anh.test.mts
import { alpha, bo, chu, mauAss, ngat, rapAss, thoatLoc, type DongAss } from './may-dung-ass';

export type KieuAnh = 'the-chu-tren-anh' | 'ai-con-nho' | 'doan-nam-gia' | 'hai-lua-chon';
export interface DeAnh {
  kieu: KieuAnh;
  truy: string;            // từ khoá ảnh nền Pexels (theo góc)
  chu: string;             // câu chính: câu móc (thẻ chữ) · câu hỏi ký ức · câu hỏi đoán · câu hỏi chọn
  phu?: string;            // dòng phụ nhỏ (tên nơi, gợi ý…)
  lua?: [string, string];  // hai-lua-chon: vế A / vế B
  dap_an?: string;         // doan-nam-gia: đáp án — ảnh 2 lộ đáp án (đăng kèm hoặc để bình luận)
  nhan?: string;           // dòng thương hiệu nhỏ góc dưới (esimfares.com · Front Porch Puzzles)
}
export const W = 1080, H = 1350, T_DAP = 1;   // ảnh 1 tại 0,5s; ảnh 2 (đáp án) tại 1,5s
const EM = 1.25, fs = (px: number) => `\\fs${Math.round(px * EM)}`, TRANG = '#F4F6F8', NHAN = '#FCA311';
/** Cỡ chữ câu chính theo độ dài (vừa 3 dòng × 26 ký tự ở cỡ 64; dài hơn thu dần). */
export function coChu(s: string): { dong: string[]; co: number } {
  const t = s.replace(/\s+/g, ' ').trim();
  for (const [rong, co] of [[22, 68], [26, 60], [32, 50], [40, 42], [52, 34]] as const) { const dong = ngat(t, rong); if (dong.length <= 3) return { dong, co }; }
  return { dong: ngat(t, 52).slice(0, 4), co: 30 };
}
export const NHAN_KIEU: Record<KieuAnh, string> = { 'the-chu-tren-anh': '', 'ai-con-nho': 'Do you remember this?', 'doan-nam-gia': 'Take a guess', 'hai-lua-chon': 'A or B?' };

export function assAnh(de: DeAnh): string {
  const d: DongAss[] = [], { dong, co } = coChu(de.chu), nhan = NHAN_KIEU[de.kieu], DAI = 2;
  const yChu = de.kieu === 'hai-lua-chon' ? 300 : 980, caoDai = 60 + Math.round(co * 1.5) * dong.length + (nhan ? 56 : 0) + (de.phu ? 50 : 0);
  // dải tối mỏng sau khối chữ (mép dưới cho thẻ chữ / ký ức / đoán; mép trên cho hai lựa chọn)
  d.push([1, 0, DAI, 'Ve', `{\\an${de.kieu === 'hai-lua-chon' ? 8 : 2}\\pos(540,${de.kieu === 'hai-lua-chon' ? 120 : 1290})\\1c&H000000&\\1a${alpha(0.45)}\\p1}${bo(1000, caoDai, 26)}`]);
  let y = de.kieu === 'hai-lua-chon' ? 150 : 1290 - caoDai + 40;
  if (nhan) { d.push([2, 0, DAI, 'Chu', `{\\an8\\pos(540,${y})\\b1${fs(30)}\\1c${mauAss(NHAN)}}${chu(nhan.toUpperCase())}`]); y += 56; }
  d.push([2, 0, DAI, 'Den', `{\\an8\\pos(540,${y})${fs(co)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\q2}${dong.map(chu).join('\\N')}`]); y += Math.round(co * 1.5) * dong.length;
  if (de.phu) d.push([2, 0, DAI, 'Chu', `{\\an8\\pos(540,${y + 6})\\b1${fs(30)}\\1c${mauAss(TRANG)}\\1a&H40&}${chu(de.phu)}`]);
  void yChu;
  if (de.kieu === 'hai-lua-chon' && de.lua) {
    // hai ô A / B ở nửa dưới ảnh
    for (const [i, v] of de.lua.entries()) {
      const yo = 1040 + i * 130;
      d.push([3, 0, DAI, 'Ve', `{\\an4\\pos(60,${yo})\\1c&H000000&\\1a${alpha(0.5)}\\p1}${bo(960, 104, 20)}`]);
      d.push([4, 0, DAI, 'Ve', `{\\an4\\pos(84,${yo})\\1c${mauAss(NHAN)}\\p1}${bo(72, 72, 36)}`]);
      d.push([5, 0, DAI, 'Den', `{\\an5\\pos(120,${yo + 52})${fs(40)}\\1c&H111111&}${'AB'[i]}`]);
      d.push([5, 0, DAI, 'Chu', `{\\an4\\pos(180,${yo + 52})\\b1${fs(38)}\\1c${mauAss(TRANG)}}${chu(ngat(v, 34)[0] ?? v)}`]);
    }
  }
  if (de.kieu === 'doan-nam-gia' && de.dap_an) {
    // ảnh 2 (từ T_DAP): đáp án đè lên dải chữ
    d.push([6, T_DAP, DAI, 'Ve', `{\\an5\\pos(540,675)\\1c${mauAss(NHAN)}\\p1}${bo(860, 150, 24)}`]);
    d.push([7, T_DAP, DAI, 'Den', `{\\an5\\pos(540,677)${fs(64)}\\1c&H111111&}${chu(de.dap_an)}`]);
  }
  if (de.nhan) d.push([2, 0, DAI, 'Chu', `{\\an${de.kieu === 'hai-lua-chon' ? 2 : 8}\\pos(540,${de.kieu === 'hai-lua-chon' ? 1320 : 30})\\b1${fs(26)}\\1c${mauAss(TRANG)}\\3c&H000000&\\bord2\\1a&H30&}${chu(de.nhan)}`]);
  return rapAss(W, H, d);
}
/** Khung ảnh xuất: ảnh 1 (câu hỏi) luôn; doan-nam-gia có đáp án thì thêm ảnh 2. Khung đầy 1080×1350. */
export const anhAnh = (de: DeAnh): { t: number; cat: [number, number, number, number] }[] => (de.kieu === 'doan-nam-gia' && de.dap_an ? [{ t: 0.5, cat: [0, 0, W, H] }, { t: 1.5, cat: [0, 0, W, H] }] : [{ t: 0.5, cat: [0, 0, W, H] }]);
/** Lệnh ffmpeg: ảnh thật phủ kín 1080×1350, tối nhẹ → ass → MỘT khung JPG tại `khung` giây (mẫu chỉ ảnh — không có nhánh MP4). */
export function lenhAnh(o: { de: DeAnh; ass: string; nen?: string | null; fontsDir: string; ra: string; khung?: number }): string[] {
  if (!o.nen) throw new Error('mẫu bai-anh cần ảnh nền thật (nen_url) — anh-nen.ts');
  const loc = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},eq=brightness=-0.03:saturation=1.02,ass='${thoatLoc(o.ass)}':fontsdir='${thoatLoc(o.fontsDir)}',format=yuv420p[v]`;
  return ['-y', '-hide_banner', '-loglevel', 'error', '-loop', '1', '-framerate', '2', '-t', '2', '-i', o.nen, '-filter_complex', loc, '-map', '[v]', '-ss', String(o.khung ?? 0.5), '-frames:v', '1', '-q:v', '2', o.ra];
}
export const kichBanAnh = (de: DeAnh) => ({ tom_tat: `Bài ảnh · ${de.kieu} · ${de.chu.slice(0, 60)}`, shots: [{ tu: 0, den: T_DAP, canh: 'Ảnh 1', hanh_dong: `Ảnh thật "${de.truy}" + ${de.kieu === 'hai-lua-chon' ? `hai vế A/B: ${de.lua?.join(' / ')}` : `câu "${de.chu}"`}` }, ...(de.kieu === 'doan-nam-gia' && de.dap_an ? [{ tu: T_DAP, den: 2, canh: 'Ảnh 2 · đáp án', hanh_dong: `Lộ đáp án: ${de.dap_an}` }] : [])] });
export const truyVanBaiAnh = (de: DeAnh) => de.truy;
