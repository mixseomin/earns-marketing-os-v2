// NHỊP CẮT ĐOẠN THOẠI (anh 19/10/2026, đo phim ngắn dọc NetShort "Karma at the Crossroad": 78 shot / 209 s — trung bình 2,7 s, thoại cắt
// theo từng câu, gần như mọi shot ≤ 4 s). Ngành: độ dài shot trung bình (ASL — Barry Salt, *Film Style and Technology*; Bordwell,
// "Intensified Continuity", 2002: phim Mỹ 2000s ASL 3–6 s, phim hành động 2–3 s; Cutting & cộng sự 2011 đo ASL giảm đều qua các thập kỷ) là
// thước đo nhịp; phim ngắn dọc xem trên điện thoại cắt nhanh hơn nữa — khán giả lướt đi khi một khung đứng lâu không có thông tin mới.
// Chỉ CẢNH BÁO (không chặn), chỉ cho gói có trần nhịp (phim ngắn dọc); đoạn thoại = các shot liền nhau có lời thoại. Thuần, có test.
import type { TheLoai } from './dien-anh';

/** Trần nhịp theo thể loại: tb = trần độ dài trung bình một đoạn thoại (s), le = trần một shot thoại lẻ (s). Thể loại không có = không đo. */
export const TRAN_NHIP: Partial<Record<TheLoai, { tb: number; le: number }>> = {
  phim_doc: { tb: 2.5, le: 5 },   // 26/10/2026: phim AI ReelShort / Trung Quốc đo 1,3–2,5 s/shot (tham-khao/reelshort.md)
};
type ShotNhip = { id: number; thu_tu: number; phat_s?: number | null; thoi_luong_s?: number | null; thoai?: unknown[] | null };
export type CanhBaoNhip = { tu: number; den: number; chu: string };
const giay = (c: ShotNhip) => Number(c.phat_s || c.thoi_luong_s || 0);

/** ASL cả tập + cảnh báo nhịp đoạn thoại. tu / den = thu_tu shot đầu / cuối của đoạn. */
export function nhipCat(canh: ShotNhip[], theLoai?: TheLoai | ''): { asl: number; asl_thoai: number | null; canhBao: CanhBaoNhip[] } {
  const ds = [...canh].sort((a, b) => a.thu_tu - b.thu_tu).filter((c) => giay(c) > 0);
  const tb = (x: ShotNhip[]) => (x.length ? Math.round((x.reduce((s, c) => s + giay(c), 0) / x.length) * 10) / 10 : 0);
  const thoai = ds.filter((c) => (c.thoai?.length ?? 0) > 0);
  const out = { asl: tb(ds), asl_thoai: thoai.length ? tb(thoai) : null, canhBao: [] as CanhBaoNhip[] };
  const tran = theLoai ? TRAN_NHIP[theLoai] : undefined; if (!tran) return out;
  let doan: ShotNhip[] = [];
  const dong = () => {
    if (doan.length >= 2 && tb(doan) > tran.tb) out.canhBao.push({ tu: doan[0]!.thu_tu, den: doan[doan.length - 1]!.thu_tu, chu: `đoạn thoại #${doan[0]!.thu_tu}–#${doan[doan.length - 1]!.thu_tu} trung bình ${tb(doan)} s/shot (trần ${tran.tb} s) — cắt theo từng câu: tách shot ở chỗ đổi người nói, chèn phản ứng` });
    doan = [];
  };
  for (const c of ds) {
    if ((c.thoai?.length ?? 0) > 0) {
      doan.push(c);
      if (giay(c) > tran.le) out.canhBao.push({ tu: c.thu_tu, den: c.thu_tu, chu: `shot thoại #${c.thu_tu} dài ${giay(c)} s (trần ${tran.le} s) — tách làm hai góc hoặc chèn phản ứng của người nghe` });
    } else dong();
  }
  dong();
  return out;
}
