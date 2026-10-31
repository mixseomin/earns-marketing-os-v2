// TUYẾN TRUYỆN + SỔ GÀI / TRẢ (anh 31/10/2026: "sự kiện chính trong phim, ngành có sổ theo dõi không" → làm): hai sổ xuyên tập của phòng
// biên kịch. Bảng tuyến = hàng là tập, cột là tuyến A/B/C, ô là sự kiện của tuyến trong tập đó → thấy tuyến nào bị bỏ quên. Sổ gài / trả
// (script editor) = chi tiết gieo ở tập nào, trả ở tập nào, cái nào còn treo. Dữ liệu ở kinh_thanh.series (kieu.ts › TuyenTruyen, GaiTra,
// TapBanDo.su_kien). Máy chấm kịch bản (cham-kich-ban.ts) đọc chamTuyenTruyen: tập cuối mùa mà còn chi tiết treo thì CHẶN keyframe.
// Thuần — tự kiểm: node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/tuyen-truyen.test.mts
import type { GaiTra, Series, TapBanDo } from './kieu';
import type { MucKb } from './cham-kich-ban';

/** Số tập liền nhau không có sự kiện (tính từ lần đầu tuyến xuất hiện) để coi là tuyến bị bỏ quên. */
export const NGUONG_VANG = 3;

export const dsTap = (s: Series | null | undefined): TapBanDo[] => [...(s?.tap ?? [])].sort((a, b) => a.so - b.so);
const muaCua = (s: Series, so: number) => s.tap.find((t) => t.so === so)?.mua ?? 1;
/** Tập cuối của mùa chứa tập `so` (theo bản đồ). */
export const tapCuoiMua = (s: Series, so: number): number => { const m = muaCua(s, so); return Math.max(so, ...s.tap.filter((t) => (t.mua ?? 1) === m).map((t) => t.so)); };

export type TrangThaiGaiTra = { muc: 'da_tra' | 'treo' | 'mo' | 'loi'; ghi: string };
/** Trạng thái một chi tiết: đã trả (đèn xanh) · còn treo (cam) · sai (đỏ: trả trước khi gieo, tập không có trong bản đồ). */
export function trangThaiGaiTra(s: Series, g: GaiTra): TrangThaiGaiTra {
  const co = (so: number) => s.tap.some((t) => t.so === so);
  if (!g.chi_tiet.trim()) return { muc: 'loi', ghi: 'chưa ghi chi tiết' };
  if (!co(g.gieo)) return { muc: 'loi', ghi: `tập ${g.gieo} không có trong bản đồ` };
  if (g.tra == null && g.mo) return { muc: 'mo', ghi: `gieo ở tập ${g.gieo}, cố ý để mở — móc sang ${g.mo === 'mua_sau' ? 'mùa sau' : 'tập sau'}` };
  if (g.tra == null) return { muc: 'treo', ghi: `gieo ở tập ${g.gieo}, chưa có tập trả — mùa kết ở tập ${tapCuoiMua(s, g.gieo)}` };
  if (!co(g.tra)) return { muc: 'loi', ghi: `tập trả ${g.tra} không có trong bản đồ` };
  if (g.tra < g.gieo) return { muc: 'loi', ghi: `trả ở tập ${g.tra} trước khi gieo (tập ${g.gieo})` };
  return { muc: 'da_tra', ghi: `gieo tập ${g.gieo} → trả tập ${g.tra}` };
}

export type TuyenVang = { ma: string; tu: number; den: number; n: number };
/** Tuyến bị bỏ quên: từ lần đầu xuất hiện, có ≥ NGUONG_VANG tập liền nhau không ghi sự kiện (kể cả đoạn cuối bản đồ). */
export function tuyenVang(s: Series | null | undefined, nguong = NGUONG_VANG): TuyenVang[] {
  const tap = dsTap(s); const out: TuyenVang[] = [];
  for (const t of s?.tuyen ?? []) {
    const co = tap.map((x) => !!x.su_kien?.[t.ma]?.trim());
    const dau = co.indexOf(true); if (dau < 0) continue;
    let i = dau + 1;
    while (i < tap.length) {
      if (co[i]) { i++; continue; }
      let j = i; while (j < tap.length && !co[j]) j++;
      if (j - i >= nguong) out.push({ ma: t.ma, tu: tap[i]!.so, den: tap[j - 1]!.so, n: j - i });
      i = j;
    }
  }
  return out;
}

/** Mục chấm cho MỘT tập: nhắc gài/trả của tập (gợi ý) + chặn tập cuối mùa còn chi tiết treo + báo chi tiết ghi sai chạm tập này. */
export function chamTuyenTruyen(s: Series | null | undefined, tapSo: number | undefined): MucKb[] {
  const so = s?.so_gai_tra ?? [];
  if (!s || !so.length || tapSo == null) return [];
  const m: MucKb[] = [];
  const tra = so.filter((g) => g.tra === tapSo && g.chi_tiet.trim()), gieo = so.filter((g) => g.gieo === tapSo && g.chi_tiet.trim());
  if (tra.length || gieo.length) m.push({ key: 'gai_tra_tap', ten: 'Gài / trả của tập', dat: true, cung: false,
    ghi: [tra.length ? `phải trả: ${tra.map((g) => `${g.chi_tiet} (gieo tập ${g.gieo})`).join(' · ')}` : '', gieo.length ? `gieo: ${gieo.map((g) => g.chi_tiet).join(' · ')}` : ''].filter(Boolean).join(' — ') });
  if (tapCuoiMua(s, tapSo) === tapSo) {
    const mua = muaCua(s, tapSo);
    const treo = so.filter((g) => g.tra == null && g.mo !== 'mua_sau' && g.chi_tiet.trim() && g.gieo <= tapSo && muaCua(s, g.gieo) === mua);
    m.push({ key: 'treo_cuoi_mua', ten: 'Hết chi tiết treo cuối mùa', dat: !treo.length, cung: true,
      ghi: treo.length ? `tập cuối mùa mà còn ${treo.length} chi tiết chưa có tập trả: ${treo.map((g) => `${g.chi_tiet} (gieo tập ${g.gieo})`).join(' · ')} — trả trong tập này, ghi tập trả ở mùa sau, hoặc đánh dấu "để mở sang mùa sau" (📖 Phim › 📌 Gài / trả)` : 'mọi chi tiết gieo trong mùa đã có tập trả' });
  }
  const sai = so.filter((g) => (g.gieo === tapSo || g.tra === tapSo) && trangThaiGaiTra(s, g).muc === 'loi');
  if (sai.length) m.push({ key: 'gai_tra_sai', ten: 'Sổ gài / trả ghi đúng', dat: false, cung: false, ghi: sai.map((g) => `${g.chi_tiet || '(trống)'}: ${trangThaiGaiTra(s, g).ghi}`).join(' · ') });
  return m;
}

/** Kết quả AI rút từ bản đồ (claude.ts › goiYTuyenTruyen). */
export type AiTuyenTruyen = { tuyen: { ma: string; ten: string }[]; su_kien: { so: number; ma: string; viec: string }[]; gai_tra: { chi_tiet: string; gieo: number; tra: number | null }[] };
/** Trộn đề xuất AI vào sổ: CHỈ điền chỗ trống — tuyến mới (mã chưa có), ô sự kiện đang rỗng, chi tiết chưa ghi. Không đè thứ người đã gõ. */
export function tronAi(s: Series, ai: AiTuyenTruyen, taoId: () => string): Series {
  const tuyen = [...(s.tuyen ?? [])];
  for (const t of ai.tuyen) if (t.ma.trim() && !tuyen.some((x) => x.ma === t.ma.trim())) tuyen.push({ ma: t.ma.trim(), ten: t.ten.trim() });
  const ma = new Set(tuyen.map((t) => t.ma));
  const tap = s.tap.map((t) => {
    const them = ai.su_kien.filter((k) => k.so === t.so && ma.has(k.ma) && k.viec.trim() && !t.su_kien?.[k.ma]?.trim());
    return them.length ? { ...t, su_kien: { ...(t.su_kien ?? {}), ...Object.fromEntries(them.map((k) => [k.ma, k.viec.trim()])) } } : t;
  });
  const da = new Set((s.so_gai_tra ?? []).map((g) => g.chi_tiet.trim().toLowerCase()));
  const moi = ai.gai_tra.filter((g) => g.chi_tiet.trim() && !da.has(g.chi_tiet.trim().toLowerCase())).map((g) => ({ id: taoId(), chi_tiet: g.chi_tiet.trim(), gieo: g.gieo, tra: g.tra ?? null }));
  return { ...s, tuyen, tap, so_gai_tra: [...(s.so_gai_tra ?? []), ...moi] };
}

/** Kết quả AI viết tiếp tập (claude.ts › vietThemTap). */
export type AiThemTap = {
  tap: { so: number; ten: string; logline: string; loai: 'phieu_luu' | 'nguon_goc' | 'ket_mua'; nhan_vat: string[]; boi_canh: string[]; gai_tra: string }[];
  su_kien: { so: number; ma: string; viec: string }[]; gai_tra_moi: { chi_tiet: string; gieo: number; tra: number | null }[]; tra_cu: { chi_tiet: string; tra: number }[];
};
/** Nối các tập AI viết vào bản đồ: số tập luôn nối tiếp tập cuối (AI đánh số lệch cũng không đè tập cũ), cùng mùa với tập cuối; sự kiện chỉ cho tuyến
 *  đã có; chi tiết treo được trả khớp theo nguyên văn (không phân biệt hoa thường) và chỉ khi tập trả ≥ tập gieo. */
export function themTapAi(s: Series, ai: AiThemTap, taoId: () => string): { s: Series; them: number[] } {
  const cuoi = Math.max(0, ...s.tap.map((t) => t.so));
  const mua = s.tap.find((t) => t.so === cuoi)?.mua;
  const doiSo = new Map<number, number>(); [...ai.tap].sort((a, b) => a.so - b.so).forEach((t, i) => doiSo.set(t.so, cuoi + 1 + i));
  const ma = new Set((s.tuyen ?? []).map((t) => t.ma));
  const tapMoi = [...ai.tap].sort((a, b) => a.so - b.so).map((t) => {
    const so = doiSo.get(t.so)!;
    const sk = Object.fromEntries(ai.su_kien.filter((k) => k.so === t.so && ma.has(k.ma) && k.viec.trim()).map((k) => [k.ma, k.viec.trim()]));
    return { so, ten: t.ten, logline: t.logline, ...(mua ? { mua } : {}), loai: t.loai, nhan_vat: t.nhan_vat, boi_canh: t.boi_canh, gai_tra: t.gai_tra, ...(Object.keys(sk).length ? { su_kien: sk } : {}) };
  });
  const quy = (n: number | null) => (n == null ? null : doiSo.get(n) ?? n);
  const so = (s.so_gai_tra ?? []).map((g) => {
    if (g.tra != null) return g;
    const t = ai.tra_cu.find((x) => x.chi_tiet.trim().toLowerCase() === g.chi_tiet.trim().toLowerCase());
    const tra = t ? quy(t.tra) : null;
    return tra != null && tra >= g.gieo ? { ...g, tra } : g;
  });
  const moi = ai.gai_tra_moi.filter((g) => g.chi_tiet.trim()).map((g) => ({ id: taoId(), chi_tiet: g.chi_tiet.trim(), gieo: quy(g.gieo)!, tra: quy(g.tra) }));
  return { s: { ...s, tap: [...s.tap, ...tapMoi], so_gai_tra: [...so, ...moi] }, them: tapMoi.map((t) => t.so) };
}

/** Kết quả AI sắp tuyến theo KHUNG NGÀNH (claude.ts › sapKhungTuyen): làn mới gắn vai ngành, sự kiện TRỌN bản đồ theo làn mới, các chi tiết để mở. */
export type AiSapKhung = { tuyen: { ma: string; ten: string; vai: string }[]; su_kien: { so: number; ma: string; viec: string }[];
  mo: { chi_tiet: string; gieo: number; mo: 'tap_sau' | 'mua_sau' }[] };
/** Áp sắp khung: THAY làn + sự kiện theo AI (đây là thao tác sắp lại, có chụp hoàn tác ở nơi gọi); chi tiết treo khớp nguyên văn được đánh dấu để mở;
 *  chi tiết để mở mới thêm vào sổ. Sự kiện của mã làn lạ / tập không có trên bản đồ bị bỏ. */
export function apSapKhung(s: Series, ai: AiSapKhung, taoId: () => string): Series {
  const tuyen = ai.tuyen.filter((t) => t.ma.trim()).map((t) => ({ ma: t.ma.trim(), ten: t.ten.trim(), vai: t.vai.trim() || undefined }));
  const ma = new Set(tuyen.map((t) => t.ma)); const coTap = new Set(s.tap.map((t) => t.so));
  const tap = s.tap.map((t) => {
    const sk = Object.fromEntries(ai.su_kien.filter((k) => k.so === t.so && ma.has(k.ma) && k.viec.trim()).map((k) => [k.ma, k.viec.trim()]));
    const { su_kien: _bo, ...con } = t;
    return Object.keys(sk).length ? { ...con, su_kien: sk } : con;
  });
  const cu = s.so_gai_tra ?? [];
  const khop = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const so = cu.map((g) => { const m = g.tra == null ? ai.mo.find((x) => khop(x.chi_tiet, g.chi_tiet)) : undefined; return m ? { ...g, mo: m.mo } : g; });
  const moi = ai.mo.filter((m) => m.chi_tiet.trim() && coTap.has(m.gieo) && !cu.some((g) => khop(g.chi_tiet, m.chi_tiet)))
    .map((m) => ({ id: taoId(), chi_tiet: m.chi_tiet.trim(), gieo: m.gieo, tra: null, mo: m.mo }));
  return { ...s, tuyen, tap, so_gai_tra: [...so, ...moi] };
}
