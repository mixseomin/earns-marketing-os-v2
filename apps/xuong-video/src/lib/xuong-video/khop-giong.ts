// Giây phát theo GIỌNG (12/10/2026 — trước đây làm tay: lời dẫn dài hơn shot thì giọng đè nhau/bị tăng tốc, phim #7). Thuần:
//   canPhat(c, dai)   = giây phát tối thiểu để đọc hết các dòng của shot (nối tiếp, cách 0,15s, tôn trọng tre) ở tốc ≤ TOC_DOC, cộng HOI_SAU_CAU.
//   kiemTieng(ds, nv) = máy nghe thay người: câu bị cắt khi sang shot, giọng đè nhau, đọc quá nhanh, shot quá ngắn (thanh 🎬 + chặn xuất).
//   coGianMoc(chu, k) = co giãn mốc "@giây" của chữ màn theo tỉ lệ giây phát mới/cũ, để chữ vẫn đổi đúng nhịp câu đọc.
// Phần máy chủ (đo độ dài file giọng, ghi DB, dời lớp phủ) ở hau-ky.ts. Tự kiểm: khop-giong.test.mts
import type { Canh, NhanVat } from './kieu';
import { dongThoai, lichGiong } from './am-thanh';
import { giayPhat } from './kieu';

/** Tốc đọc khi tính giây shot: 1 = đọc tự nhiên. Trước là 1,1 — shot được cắt như thể giọng đọc nhanh 10%, nhưng lời dẫn phát ở 1× nên
 *  tràn sang shot sau, chữ cuối bị nuốt (Fox Tales shot 1, 13/10/2026). Hành động / hài vẫn dồn nhịp theo tocDocTheoLoai. */
export const TOC_DOC = 1;
/** Khoảng thở sau câu cuối của shot trước khi cắt (giây) — nghe rõ chữ cuối rồi mới sang shot. */
export const HOI_SAU_CAU = 0.5;
/** Shot có câu nói không co ngắn hơn mức này (giây) — "Ahem" 0,5s không được kéo shot hành động xuống 1,2s. */
export const SHOT_TOI_THIEU = 2;
// Bỏ tocDocTheoLoai (hành động 1,2× / hài + qc_ugc 1,15×) 15/10/2026: cùng lỗi Fox Tales — shot cắt như thể giọng đọc nhanh, nhưng lịch phát
// (lichGiong) chỉ tăng tốc khi hai câu đè nhau, nên giọng vẫn phát 1× và chạm mép cắt; cổng xuất (kiemTieng) chặn mà máy khớp báo "đã vừa"
// (phim #36 shot 1: giọng 2,56s + trễ 0,2 trong shot 3s). Giây khớp tính ĐÚNG tốc phát → hai luật luôn cùng kết luận (khop-giong.test).
export function canPhat(c: Pick<Canh, 'thoai' | 'loi_thoai' | 'nhan_vat' | 'thoai_url'>, nv: NhanVat[], dai: (url: string) => number | null): number | null {
  const toc = TOC_DOC;
  let t = 0, co = false;
  for (const d of dongThoai(c, nv)) {
    if (!d.url) continue; const g = dai(d.url); if (g == null) return null;
    t = Math.max(t + (co ? 0.15 : 0), d.tre ?? 0) + g / toc; co = true;
  }
  return co ? Math.ceil((t + HOI_SAU_CAU) * 10) / 10 : null;
}
/** Bộ lọc ffmpeg gọn giọng: cắt lặng đầu + cuối (dưới -40 dB), rút mọi quãng ngắt > 0,3s về 0,25s — giọng TTS kiểu trailer để
 *  0,3–0,9s lặng đầu file và 0,4–0,6s giữa câu (đo phim #9: ~10s chết trong 67s). */
export const LOC_GON_GIONG = 'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.04,silenceremove=stop_periods=-1:stop_duration=0.3:stop_threshold=-40dB:stop_silence=0.25,areverse,silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.08,areverse';
export const coGianMoc = (chu: string, k: number): string =>
  Math.abs(k - 1) < 1e-6 ? chu : chu.replace(/^(\s*)@(\d+(?:[.,]\d+)?)s?(\s)/gm, (_, a: string, g: string, b: string) => `${a}@${Math.round(Number(g.replace(',', '.')) * k * 10) / 10}${b}`);

/** Máy kiểm tiếng cả tập (thuần): dùng đúng lịch phát của timeline/bản xuất (lichGiong) với độ dài file đã đo (DongThoai.dai).
 *  Trả các lỗi "#shot: …"; dòng chưa đo độ dài thì bỏ qua (khớp giọng chạy tự động sau mỗi lượt giọng sẽ đo). */
export function kiemTieng(ds: Pick<Canh, 'thu_tu' | 'thoai' | 'loi_thoai' | 'nhan_vat' | 'phat_s' | 'thoi_luong_s' | 'hanh_dong'>[], nv: NhanVat[]): string[] {
  const dai = new Map<string, number>();
  for (const c of ds) for (const d of c.thoai ?? []) if (d.url && typeof d.dai === 'number') dai.set(d.url, d.dai);
  const lich = lichGiong(ds as Canh[], nv, (u) => dai.get(u) ?? null).filter((x) => x.dai != null).sort((a, b) => a.tu - b.tu);
  const moc: number[] = []; let t = 0; for (const c of ds) { moc.push(t); t += giayPhat(c); }
  const shotCua = (g: number) => { let i = 0; moc.forEach((m, k) => { if (m <= g + 1e-6) i = k; }); return i; };
  const out: string[] = [];
  const r1 = (x: number) => Math.round(x * 10) / 10;
  lich.forEach((x, k) => {
    const i = shotCua(x.tu); const c = ds[i]!; const het = x.tu + x.dai!; const cuoiShot = moc[i]! + giayPhat(c);
    if (i < ds.length - 1 && het > cuoiShot - 0.3) out.push(`#${c.thu_tu}: câu ${x.loiDan ? 'dẫn' : 'thoại'} chưa dứt đã cắt sang shot sau (thiếu ${r1(het - cuoiShot + HOI_SAU_CAU)}s) — bấm ⏱ khớp giây theo giọng`);
    const ke = lich[k + 1];
    if (ke && het > ke.tu + 0.05) out.push(`#${c.thu_tu}: giọng đè lên câu kế ${r1(het - ke.tu)}s`);
    if (x.nhanh > 1.15) out.push(`#${c.thu_tu}: câu bị đọc nhanh ×${x.nhanh.toFixed(2)} cho vừa shot — khó nghe, nới shot dài ra`);
  });
  for (const c of ds) if (dongThoai(c as Canh, nv).some((d) => d.loi.trim()) && giayPhat(c) < SHOT_TOI_THIEU - 0.05) out.push(`#${c.thu_tu}: shot có câu nói chỉ ${giayPhat(c)}s — hình chưa kịp diễn đã cắt`);
  return [...new Set(out)];
}
