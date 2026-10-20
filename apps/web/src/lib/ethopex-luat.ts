// SỔ LUẬT ETHOPEX — một nơi khai luật đang áp cho camp FB phim ngắn (kb #261 mục 8–8d) + hàm chấm từng camp, khuôn giống luật camp adfond
// (mã · tên ngắn · điều kiện → hành động · vì sao · mức dung > ha > bao > len). Tab Ethopex trang chủ đọc ở đây.
// Bản Python cùng ngưỡng: apps/xuong-video/scripts/ethopex/kiem-ngan-sach.sh (báo đủ điều kiện tăng / cần xem giảm-tắt) — đổi ngưỡng thì đổi cả hai.
// Luật CHỈ ĐỌC + BÁO: mọi tăng / giảm / tắt phải anh duyệt từng camp (gác 'nguoi'); cổng ở bước lên camp (thoại, số camp) chặn bằng máy (gác 'may').

export const THANG = [1, 3, 5, 7, 10, 15, 20] as const;
export const TRAN_CAMP = 20;
export const ROI_TOI_THIEU = 20;        // % ROI từ đầu tháng
export const SPENDING_TOI_THIEU = 50;   // % = chi hôm nay / ngân sách ngày
export const TEST_TOI_DA = 2;           // camp / phim đang test (từ 21/10/2026)
export const THANG_TOI_DA = 30;         // camp / phim thắng
export const KHUNG_TANG = [21, 0, 8];   // giờ VN
export const NGAN_SACH_CHUA_CAN_GIO = 3;

export type MucLuat = 'dung' | 'ha' | 'bao' | 'len';
export const MUC_THU_TU: Record<MucLuat, number> = { dung: 4, ha: 3, bao: 2, len: 1 };
export const MUC_MAU: Record<MucLuat, string> = { dung: 'var(--neon-red, #ff5c5c)', ha: 'var(--neon-amber, #ffb020)', bao: 'var(--neon-cyan, #4fd1ff)', len: 'var(--neon-lime, #9be15d)' };

export type Luat = { ma: string; ten: string; icon: string; muc: MucLuat; gac: 'nguoi' | 'may'; khi: string; lam: string; vi: string; nguon: string };

export const LUAT: Luat[] = [
  { ma: 'TB', ten: 'Tăng một bậc', icon: '↑', muc: 'len', gac: 'nguoi', khi: `ROI từ đầu tháng ≥ ${ROI_TOI_THIEU}% và Spending hôm nay > ${SPENDING_TOI_THIEU}%`,
    lam: `Tăng một bậc ${THANG.map((x) => '$' + x).join(' → ')} — anh duyệt từng camp, tối đa 2–3 lần tăng / ngày`, vi: 'Chi tiêu lên mà ROI vẫn giữ = camp còn sức ăn thêm.', nguon: 'Support Ads 20/10/2026' },
  { ma: 'TR20', ten: 'Trần $20 / camp', icon: '⊤', muc: 'bao', gac: 'nguoi', khi: `Ngân sách đã $${TRAN_CAMP}`, lam: 'Không tăng nữa — muốn thêm tiền thì nhân bản camp', vi: 'Giữ ROI cao, không dồn một camp.', nguon: 'anh 20/10/2026' },
  { ma: 'KG', ten: 'Khung giờ tăng', icon: '◷', muc: 'bao', gac: 'nguoi', khi: `Lúc tăng ngân sách (camp > $${NGAN_SACH_CHUA_CAN_GIO})`,
    lam: 'Tăng vào ~21h · ~24h · 8h giờ VN; không thu lại sau khung', vi: 'Camp chạy chủ yếu Mỹ — hiệu suất tốt nhất 21h → 5h sáng giờ VN. Ngân sách $1–3 chưa cần canh giờ.', nguon: 'Dol Dang 21/10/2026' },
  { ma: 'GT', ten: 'Giảm / tắt khi ROI tụt', icon: '↓', muc: 'ha', gac: 'nguoi', khi: `ROI 3 ngày gần tụt ≥ 30 điểm so với 4 ngày trước, hoặc từ ≥ ${ROI_TOI_THIEU}% xuống < 0 (đã chi ≥ $3)`,
    lam: 'Anh xem giảm ngân sách hoặc tắt camp', vi: 'Phim đi xuống hoặc creative bão hoà → CPC/CPA tăng, ROI tụt. Ngoài ca này không cần đụng ngân sách.', nguon: 'Dol Dang 21/10/2026' },
  { ma: 'TC', ten: 'Ad bị Meta từ chối', icon: '⛔', muc: 'dung', gac: 'nguoi', khi: 'Ad DISAPPROVED', lam: 'Không xoá — Edit camp, thay creative SẠCH cùng phim đã được duyệt, Update cho Meta duyệt lại',
    vi: 'Giữ camp + lịch sử; Meta đôi khi duyệt nhầm, thay creative tuân thủ là qua.', nguon: 'Dol Dang 21/10/2026' },
  { ma: 'SC', ten: 'Số camp / phim', icon: '#', muc: 'bao', gac: 'may', khi: `Phim đang test: tối đa ${TEST_TOI_DA} camp · phim thắng (anh duyệt): tối đa ${THANG_TOI_DA}`,
    lam: 'Đủ trần thì cổng kiem-so-camp.sh chặn camp mới', vi: 'Test rẻ: 1 phim 1 lượt (1 camp – 1 nhóm – 2 ads 20–30s + 2–3\'), thắng mới scale. Áp cho camp mới từ 21/10/2026.', nguon: 'anh 21/10/2026' },
  { ma: 'TH', ten: 'Cổng thoại nhạy cảm', icon: '✱', muc: 'bao', gac: 'may', khi: 'Chữ / phụ đề trong video có mua bán dâm, quan hệ, đe doạ lột đồ, bạo lực ("dead", "kill"…)',
    lam: 'Không cắt + không Publish (kiem-thoai.py ở cat-canh.py và dung-camp.sh)', vi: 'Meta từ chối #65717/#65719 "Adult Sexual Exploitation".', nguon: '20–21/10/2026' },
  { ma: 'NB', ten: 'Nhân bản phim thắng', icon: '⧉', muc: 'len', gac: 'nguoi', khi: 'Phim có camp đủ điều kiện tăng (TB)', lam: 'Duplicate camp + làm thêm creative cùng phim lên camp mới (trong trần SC)',
    vi: 'Phim có tín hiệu lãi thì mở rộng nhiều creative.', nguon: 'anh 20/10/2026' },
];
export const LUAT_THEO_MA = Object.fromEntries(LUAT.map((l) => [l.ma, l])) as Record<string, Luat>;

export type SoLieu = { chi: number; thu: number };
export type CampEtp = {
  id: number; ten: string; trang_thai: string; giao: string; ngan_sach: number; dong_bo: string | null; tao: string;
  content_id: number | null; creative_id: number | null; phim: string | null; ngon_ngu: string | null; studio_phim_id: number | null;
  loi: string | null; thang: SoLieu; hom_nay: SoLieu; gan: SoLieu; truoc: SoLieu;
};
export type DieuKien = { ten: string; hien: string; nguong: string; dat: boolean };
export type LuatCham = { ma: string; trang_thai: 'cham' | 'gan' | 'ap'; cau: string; dk: DieuKien[] };

export const roi = (s: SoLieu) => (s.chi ? ((s.thu - s.chi) / s.chi) * 100 : null);
export const bacKe = (b: number) => THANG.find((x) => x > b + 1e-9) ?? null;
const pct = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`);

/** Chấm mọi luật cho một camp. ctx: số camp của phim + phim có trong danh sách thắng. */
export function chamLuat(c: CampEtp, ctx: { soCampPhim: number; phimThang: boolean }): LuatCham[] {
  const out: LuatCham[] = [];
  const r = roi(c.thang), sp = c.ngan_sach ? (c.hom_nay.chi / c.ngan_sach) * 100 : 0, ke = bacKe(c.ngan_sach);
  const tbDk: DieuKien[] = [
    { ten: 'ROI từ đầu tháng', hien: pct(r), nguong: `≥ ${ROI_TOI_THIEU}%`, dat: r != null && r >= ROI_TOI_THIEU },
    { ten: 'Spending hôm nay', hien: `${sp.toFixed(0)}%`, nguong: `> ${SPENDING_TOI_THIEU}%`, dat: sp > SPENDING_TOI_THIEU },
    { ten: 'Còn bậc trên', hien: `$${c.ngan_sach}`, nguong: `< $${TRAN_CAMP}`, dat: ke != null },
  ];
  const tbDat = tbDk.every((d) => d.dat);
  if (c.trang_thai === 'ACTIVE') out.push({ ma: 'TB', trang_thai: tbDat ? 'cham' : tbDk.filter((d) => d.dat).length >= 2 ? 'gan' : 'ap',
    cau: tbDat ? `Đủ điều kiện: $${c.ngan_sach} → $${ke} — chờ anh duyệt` : `ROI ${pct(r)} · spending ${sp.toFixed(0)}% → chưa tăng`, dk: tbDk });
  if (ke == null) out.push({ ma: 'TR20', trang_thai: 'cham', cau: `Đã ở trần $${TRAN_CAMP}`, dk: [{ ten: 'Ngân sách', hien: `$${c.ngan_sach}`, nguong: `$${TRAN_CAMP}`, dat: true }] });
  if (c.ngan_sach > NGAN_SACH_CHUA_CAN_GIO || tbDat) out.push({ ma: 'KG', trang_thai: 'ap', cau: 'Khi tăng: chọn mốc ~21h · ~24h · 8h giờ VN', dk: [] });
  const rg = roi(c.gan), rt = roi(c.truoc);
  if (c.gan.chi + c.truoc.chi > 0) {
    const du = c.gan.chi >= 1.5 && c.truoc.chi >= 1.5 && c.gan.chi + c.truoc.chi >= 3;
    const tut = rg != null && rt != null && ((rt >= ROI_TOI_THIEU && rg < 0) || rt - rg >= 30);
    out.push({ ma: 'GT', trang_thai: du && tut ? 'cham' : 'ap', cau: du && tut ? `ROI tụt ${pct(rt)} → ${pct(rg)} — anh xem giảm / tắt` : `ROI 4 ngày trước ${pct(rt)} · 3 ngày gần ${pct(rg)}`,
      dk: [{ ten: 'Đã chi đủ (≥ $1,5 mỗi kỳ, ≥ $3 tổng)', hien: `$${c.truoc.chi.toFixed(2)} / $${c.gan.chi.toFixed(2)}`, nguong: '≥ $3', dat: du },
           { ten: 'ROI tụt', hien: `${pct(rt)} → ${pct(rg)}`, nguong: `≥ 30 điểm hoặc ≥ ${ROI_TOI_THIEU}% → < 0`, dat: tut }] });
  }
  if (c.loi && /DISAPPROVED/.test(c.loi) || c.giao === 'DISAPPROVED')
    out.push({ ma: 'TC', trang_thai: 'cham', cau: 'Ad bị từ chối → thay creative sạch đã duyệt cùng phim', dk: [{ ten: 'Trạng thái ad', hien: 'DISAPPROVED', nguong: 'được duyệt', dat: true }] });
  const tran = ctx.phimThang ? THANG_TOI_DA : TEST_TOI_DA;
  out.push({ ma: 'SC', trang_thai: ctx.soCampPhim >= tran ? 'cham' : 'ap', cau: `${ctx.phimThang ? 'Phim thắng' : 'Phim đang test'}: ${ctx.soCampPhim}/${tran} camp`,
    dk: [{ ten: 'Số camp của phim', hien: String(ctx.soCampPhim), nguong: `≤ ${tran}`, dat: ctx.soCampPhim >= tran }] });
  out.push({ ma: 'TH', trang_thai: 'ap', cau: 'Creative đã qua cổng thoại lúc dựng / Publish (camp từ 21/10)', dk: [] });
  if (tbDat) out.push({ ma: 'NB', trang_thai: 'cham', cau: 'Phim có camp đạt → nhân bản + thêm creative', dk: [] });
  return out;
}

/** Luật nặng nhất đang chạm (để tô biểu tượng hàng). */
export function nangNhat(ds: LuatCham[]): Luat | null {
  const cham = ds.filter((x) => x.trang_thai === 'cham').map((x) => LUAT_THEO_MA[x.ma]!).sort((a, b) => MUC_THU_TU[b.muc] - MUC_THU_TU[a.muc]);
  return cham[0] ?? null;
}
