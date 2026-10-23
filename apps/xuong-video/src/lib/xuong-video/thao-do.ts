// ĐỒ ĐỔI TAY + CÁCH THÁO ĐỒ ĐEO (anh 23/10/2026, #132 #15: "sao đoạn lấy thẻ nhân viên không nhấc ra mà kéo phát ra luôn. Sai hẳn logic"). Kịch bản / 3D chỉ
// khai ĐẦU (thẻ đeo cổ Hạ) và KẾT (thẻ trong tay Vivian) — không ai nói thẻ RỜI CỔ bằng cách nào, nên model video nội suy đường ngắn nhất: kéo thẳng, dây
// trượt qua cằm, xuyên đầu. Ngành (biên đạo / giám sát kịch bản) luôn khai CƠ CHẾ vật lý của mọi lần đồ rời người: nhấc qua đầu, giật đứt khoá an toàn,
// mở khoá, tuốt khỏi tay… Đây là sổ duy nhất cho cơ chế đó — câu video, câu ảnh kết và cổng chặn cùng đọc. Thuần — tự kiểm: thao-do.test.mts
export type ViTriDo = { ten: string; tam: number[]; den?: number[]; cam?: string; deo?: string; thao?: string; an?: boolean; dien?: string[] };
export type DoiTay = { mon: string; tu: string; den: string; deo?: string; thao: string | null };
type Cau = (o: { mon: string; tu: string; den: string }) => string;
/** Mã cách tháo → nơi đeo áp được, nhãn Việt, câu diễn (video), câu trạng thái lúc kết (ảnh kết). {mon} là thẻ tên vật (prompt-khoi.ts › dienThe). */
export const CACH_THAO: Record<string, { deo: string[]; vi: string; dien: Cau; ket: Cau }> = {
  giat_dut_khoa: { deo: ['co', 'nguc'], vi: 'giật đứt khoá an toàn sau gáy',
    dien: ({ mon, tu, den }) => `${den} grabs the {${mon}} and yanks it sharply down and away from ${tu}: the plastic safety breakaway clasp at the back of ${tu}'s neck snaps open under the tug, ${tu}'s head jerks forward slightly, and the now-open lanyard slides off around the side of ${tu}'s neck and comes away in ${den}'s fist, its two loose ends swinging. The lanyard leaves the neck only this way, around the side — it never rides up over ${tu}'s chin, face or head.`,
    ket: ({ mon, tu, den }) => `the {${mon}} hangs from ${den}'s fist with its lanyard open at the snapped clasp, two loose ends dangling; nothing is left around ${tu}'s neck` },
  nhac_qua_dau: { deo: ['co', 'nguc'], vi: 'nhấc dây qua đầu',
    dien: ({ mon, tu, den }) => `${den} takes the lanyard of the {${mon}} in both hands and lifts the loop up and over ${tu}'s head — ${tu} dips the head as it clears the hair — then draws it away.`,
    ket: ({ mon, tu, den }) => `the {${mon}} with its closed lanyard loop is in ${den}'s hand; nothing is left around ${tu}'s neck` },
  mo_khoa: { deo: ['cotay_t', 'cotay_p', 'co'], vi: 'mở khoá rồi lấy ra',
    dien: ({ mon, tu, den }) => `${den} unfastens the clasp of the {${mon}} on ${tu} with the fingers, opens it and lifts it away.`,
    ket: ({ mon, tu, den }) => `the opened {${mon}} is in ${den}'s hand; ${tu} no longer wears it` },
  tuot: { deo: ['cotay_t', 'cotay_p'], vi: 'tuốt qua bàn tay',
    dien: ({ mon, tu, den }) => `${den} slides the {${mon}} down over ${tu}'s hand and off the fingers.`,
    ket: ({ mon, tu, den }) => `the {${mon}} is in ${den}'s hand; ${tu} no longer wears it` },
};
/** Cách tháo MẶC ĐỊNH theo nơi đeo + động tác người lấy (mã diễn): giật ở cổ / ngực = giật đứt khoá; lấy êm ở cổ = nhấc qua đầu; cổ tay = mở khoá. */
export function thaoMacDinh(deo: string | undefined, dienNguoiLay: string[] = []): string | null {
  if (!deo) return null;
  const giat = dienNguoiLay.some((d) => d.split('@')[0] === 'giat');
  if (deo === 'co' || deo === 'nguc') return giat ? 'giat_dut_khoa' : 'nhac_qua_dau';
  if (deo === 'cotay_t' || deo === 'cotay_p') return 'mo_khoa';
  return null;
}
/** Món ĐỔI TAY trong shot (cam + den): người đứng gần chỗ kết của món nhất lúc kết là người cầm mới. Món đang ĐEO thì kèm cách tháo (khai vi_tri.thao, không
 *  khai thì mặc định theo nơi đeo + động tác; null = không suy ra được → cổng chặn). */
export function doiTayDo(viTri: ViTriDo[], laNguoi: (ten: string) => boolean): DoiTay[] {
  const nguoi = viTri.filter((p) => !p.an && laNguoi(p.ten));
  return viTri.flatMap((m) => {
    if (!m.cam || !m.den?.length || m.an || laNguoi(m.ten)) return [];
    const gan = nguoi.map((p) => { const c = p.den ?? p.tam; return { p, d: Math.hypot(c[0]! - m.den![0]!, c[1]! - m.den![1]!) }; }).sort((a, b) => a.d - b.d)[0];
    if (!gan || gan.p.ten === m.cam) return [];
    const thao = m.deo ? (m.thao && CACH_THAO[m.thao]?.deo.includes(m.deo) ? m.thao : thaoMacDinh(m.deo, gan.p.dien)) : null;
    return [{ mon: m.ten, tu: m.cam, den: gan.p.ten, ...(m.deo ? { deo: m.deo } : {}), thao }];
  });
}
/** Câu DIỄN (video) cho mọi món đổi tay — đồ đeo theo cơ chế tháo, đồ cầm thì trao / giật từ tay. */
export const cauDoiTayVideo = (ds: DoiTay[]): string => ds.map((x) => (x.deo ? (x.thao ? CACH_THAO[x.thao]!.dien(x) : '') : `${x.den} takes the {${x.mon}} out of ${x.tu}'s hand — it passes from hand to hand, never through a body.`)).filter(Boolean).join(' ');
/** Câu TRẠNG THÁI lúc kết (ảnh kết). */
export const cauDoiTayKet = (ds: DoiTay[]): string[] => ds.map((x) => (x.deo && x.thao ? CACH_THAO[x.thao]!.ket(x) : `the {${x.mon}} is now in ${x.den}'s hand — taken from ${x.tu}, who no longer has it`));
/** Cổng: đồ đeo đổi tay mà không có cơ chế tháo → lý do chặn (không để model tự nội suy đường xuyên người). */
export const thieuCachThao = (ds: DoiTay[]): string | null => {
  const t = ds.filter((x) => x.deo && !x.thao);
  return t.length ? `đồ đeo đổi tay chưa có cách tháo (${t.map((x) => `${x.mon} đeo ở '${x.deo}'`).join(', ')}) — khai vi_tri.thao (${Object.keys(CACH_THAO).join(' / ')})` : null;
};
