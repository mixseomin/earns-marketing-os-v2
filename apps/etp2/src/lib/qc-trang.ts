// CHẨN ĐOÁN TRANG PHIM / FACEBOOK (anh 23/11/2026 "làm đi", card etp:qc-adsense-camp-2311).
// Bản TypeScript của hàm SQL etp.qc_chi_so (migration 0461) — cùng công thức, cùng ngưỡng (etp-bang-luat.json › qc_trang),
// để bảng camp / phim tính theo đúng khoảng thời gian đang chọn mà không phải hỏi lại máy chủ.
import BANG_LUAT from './etp-bang-luat.json';

export type NguongQc = { yeu_kem: number; yeu_hien: number; fb_dat: number; fb_bam_min: number; hong_xem: number; hong_fill: number };
export type NhanQc = 'trang hỏng' | 'trang yếu' | 'FB đắt' | null;
/** một dòng camp × ngày: chi / thu ($) + AdSense x lượt xem trang · q lượt xin QC · h QC hiện · b lượt bấm Facebook */
export type DongQc = { d: string; chi: number; thu: number; x?: number; q?: number; h?: number; b?: number };
export type ChoNgay = { i: number | null; f: number | null; p: number | null; t: number | null };
/** tổng cộng một camp / một phim trong khoảng: số nhà + chợ đã cân theo trọng số (irpm theo QC hiện, fill theo lượt xin, prpm theo lượt xem, CPC theo lượt bấm) */
export type GopQc = { chi: number; thu: number; x: number; q: number; h: number; b: number; choI: number | null; choF: number | null; choP: number | null; choT: number | null; ngay: number };
export type ChiSoQc = { roi: number | null; irpm: number | null; fill: number | null; prpm: number | null; qcXem: number | null; cpc: number | null;
  irpmLech: number | null; fillLech: number | null; prpmLech: number | null; cpcLech: number | null; nhan: NhanQc };

export const NGUONG_QC = (BANG_LUAT as unknown as { qc_trang: NguongQc }).qc_trang;

/** cộng dồn các dòng có số AdSense (x khác rỗng) — dòng không có số trang bị bỏ để chi / thu không lệch mẫu số */
export function gopQc(rows: DongQc[], cho: Record<string, ChoNgay> = {}): GopQc | null {
  const g: GopQc = { chi: 0, thu: 0, x: 0, q: 0, h: 0, b: 0, choI: null, choF: null, choP: null, choT: null, ngay: 0 };
  const w: Record<'i' | 'f' | 'p' | 't', [number, number]> = { i: [0, 0], f: [0, 0], p: [0, 0], t: [0, 0] };
  const can = (k: keyof typeof w, v: number | null | undefined, ts: number) => { if (v != null && ts > 0) { w[k][0] += v * ts; w[k][1] += ts; } };
  for (const r of rows) {
    if (r.x == null) continue;
    g.chi += r.chi; g.thu += r.thu; g.x += r.x; g.q += r.q ?? 0; g.h += r.h ?? 0; g.b += r.b ?? 0; g.ngay++;
    const c = cho[r.d];
    can('i', c?.i, r.h ?? 0); can('f', c?.f, r.q ?? 0); can('p', c?.p, r.x); can('t', c?.t, r.b ?? 0);
  }
  if (!g.ngay) return null;
  const tb = (k: keyof typeof w) => (w[k][1] > 0 ? w[k][0] / w[k][1] : null);
  g.choI = tb('i'); g.choF = tb('f'); g.choP = tb('p'); g.choT = tb('t');
  return g;
}

const lech = (v: number | null, cho: number | null) => (v == null || cho == null || cho <= 0 ? null : ((v - cho) / cho) * 100);

/** cùng công thức etp.qc_chi_so — đổi ở đây thì đổi cả hàm SQL (migration 0461) */
export function chiSo(g: GopQc, t: NguongQc = NGUONG_QC): ChiSoQc {
  const roi = g.chi > 0 ? ((g.thu - g.chi) / g.chi) * 100 : null;
  const irpm = g.h > 0 ? (g.thu / g.h) * 1000 : null;
  const fill = g.q > 0 ? (g.h / g.q) * 100 : null;
  const prpm = g.x > 0 ? (g.thu / g.x) * 1000 : null;
  const qcXem = g.x > 0 ? g.h / g.x : null;
  const cpc = g.b >= t.fb_bam_min && g.b > 0 ? g.chi / g.b : null;
  const hong = g.x >= t.hong_xem && (g.q === 0 || (fill != null && fill < t.hong_fill));
  const yeu = !hong && g.h >= t.yeu_hien && ((irpm != null && g.choI != null && irpm < g.choI * (1 - t.yeu_kem)) || (fill != null && g.choF != null && fill < g.choF * (1 - t.yeu_kem)));
  const dat = cpc != null && g.choT != null && cpc > g.choT * (1 + t.fb_dat);
  return { roi, irpm, fill, prpm, qcXem, cpc, irpmLech: lech(irpm, g.choI), fillLech: lech(fill, g.choF), prpmLech: lech(prpm, g.choP), cpcLech: lech(cpc, g.choT),
    nhan: hong ? 'trang hỏng' : yeu ? 'trang yếu' : dat ? 'FB đắt' : null };
}

/** chuỗi theo ngày cho biểu đồ ngăn kéo: IRPM + fill của nhà và của chợ từng ngày */
export function chuoiQc(rows: DongQc[], cho: Record<string, ChoNgay> = {}) {
  const theoNgay = new Map<string, DongQc[]>();
  for (const r of rows) if (r.x != null) theoNgay.set(r.d, [...(theoNgay.get(r.d) ?? []), r]);
  return [...theoNgay.keys()].sort().map((d) => {
    const g = gopQc(theoNgay.get(d)!, cho)!;
    const s = chiSo(g);
    return { d, irpm: s.irpm, fill: s.fill, choI: cho[d]?.i ?? null, choF: cho[d]?.f ?? null };
  });
}
