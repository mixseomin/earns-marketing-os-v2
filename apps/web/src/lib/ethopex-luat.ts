// SỔ LUẬT ETHOPEX — một nơi khai luật đang áp cho camp FB phim ngắn (kb #261 mục 8–8d) + hàm chấm từng camp, khuôn giống luật camp adfond
// (mã · tên ngắn · điều kiện → hành động · vì sao · mức dung > ha > bao > len). Tab Ethopex trang chủ đọc ở đây.
// Bản Python cùng ngưỡng: apps/xuong-video/scripts/ethopex/kiem-ngan-sach.sh (báo đủ điều kiện tăng / cần xem giảm-tắt) — đổi ngưỡng thì đổi cả hai.
// Luật CHỈ ĐỌC + BÁO: mọi tăng / giảm / tắt phải anh duyệt từng camp (gác 'nguoi'); cổng ở bước lên camp (thoại, số camp) chặn bằng máy (gác 'may').

export const THANG = [1, 3, 5, 7, 10, 15, 20] as const;
export const TRAN_CAMP = 20;
export const ROI_TOI_THIEU = 20;        // % ROI từ đầu tháng — luật GT (theo dõi / tụt)
export const ROI_TANG = 50;             // % ROI tháng tối thiểu để TĂNG BẬC (Support Dol 21/10/2026: "chỉ tăng budget những camp rois > 50%")
export const NGHI_TANG_GIO = 3;         // giờ giữa hai lần tăng (scripts/ethopex/nhip_tang.py)
export const SPENDING_TOI_THIEU = 50;   // % = chi hôm nay / ngân sách ngày
export const TEST_TOI_DA = 2;           // camp / phim đang test (từ 21/10/2026)
export const THANG_TOI_DA = 10;         // camp / phim thắng — ban đầu ~10 camp cho tiêu ổn định (Dol Dang 21/10/2026; trước 30)
export const KHUNG_TANG = [21, 0, 8];   // giờ VN
export const NGAN_SACH_CHUA_CAN_GIO = 3;

export type MucLuat = 'dung' | 'ha' | 'bao' | 'len';
export const MUC_THU_TU: Record<MucLuat, number> = { dung: 4, ha: 3, bao: 2, len: 1 };
export const MUC_MAU: Record<MucLuat, string> = { dung: 'var(--neon-red, #ff5c5c)', ha: 'var(--neon-amber, #ffb020)', bao: 'var(--neon-cyan, #4fd1ff)', len: 'var(--neon-lime, #9be15d)' };

export type Luat = { ma: string; ten: string; icon: string; muc: MucLuat; gac: 'nguoi' | 'may'; khi: string; lam: string; vi: string; nguon: string };

export const LUAT: Luat[] = [
  { ma: 'TB', ten: 'Tăng một bậc', icon: '↑', muc: 'len', gac: 'nguoi', khi: `ROI từ đầu tháng ≥ ${ROI_TANG}% và Spending hôm nay > ${SPENDING_TOI_THIEU}%`,
    lam: `Tăng một bậc ${THANG.map((x) => '$' + x).join(' → ')} — anh duyệt từng camp; hai lần tăng cách nhau ≥ ${NGHI_TANG_GIO} giờ, không giới hạn số lần / ngày`, vi: 'Chi tiêu lên mà ROI vẫn giữ = camp còn sức ăn thêm. 21/10: tăng dồn $1→$3→$5 trong 1–3 giờ làm 7 camp âm.', nguon: 'Support Ads 20–21/10/2026' },
  { ma: 'GB', ten: 'Giảm bậc', icon: '↘', muc: 'ha', gac: 'nguoi', khi: 'Phiên sáng 6–13h, số TRỌN ngày hôm qua: ngân sách > $1, đã tiêu ≥ 50% ngân sách, ROI hôm qua < 0% và ROI 3 ngày < 20%',
    lam: 'Xuống một bậc (lỗ nặng: ROI hôm qua < −50% và tiêu đủ ngân sách → hai bậc); cách lần đổi trước ≥ 6 giờ. Sau giảm khoá tăng 24 giờ, tăng lại phải ROI ≥ 50% trên số SAU lần giảm. ROI 0–50% là vùng giữ.',
    vi: 'Camp set ngân sách vội mà âm thì hạ dần, không tắt ngay; doanh thu về trễ nên chỉ xét số trọn ngày; khoá + ngưỡng sau giảm để không tăng–giảm qua lại.', nguon: 'anh 22/10/2026' },
  { ma: 'LD', ten: 'Lãi đầu phiên → tăng luôn', icon: '⇑', muc: 'len', gac: 'nguoi', khi: 'Camp lãi hôm nay, đã chi ≥ $0,5, ROI hôm nay > 50%, ngân sách < $3',
    lam: 'Tăng luôn lên $2 (ROI 50–100%) hoặc $3 (ROI ≥ 100%) — không chờ Spending > 50%', vi: 'Phim đang trend thắng: đầu phiên đã lãi thì tăng ngay để ăn trọn phiên. Chỉ camp ROI > 50%.', nguon: 'Dol Dang 21/10/2026' },
  { ma: 'M30', ten: 'Mốc $30 / camp', icon: '★', muc: 'bao', gac: 'nguoi', khi: 'Camp đã tiêu ~$30 mà vẫn lãi',
    lam: 'Báo nhóm Support để học cách scale bằng bài viết cũ + bid ROAS (rule mới lúc đó)', vi: 'Camp chịu tiền mà vẫn lãi là lúc chuyển sang cách scale khác.', nguon: 'Dol Dang 21/10/2026' },
  { ma: 'TR20', ten: 'Trần $20 / camp', icon: '⊤', muc: 'bao', gac: 'nguoi', khi: `Ngân sách đã $${TRAN_CAMP}`, lam: 'Không tăng nữa — muốn thêm tiền thì nhân bản camp', vi: 'Giữ ROI cao, không dồn một camp.', nguon: 'anh 20/10/2026' },
  { ma: 'KG', ten: 'Khung giờ tăng', icon: '◷', muc: 'bao', gac: 'nguoi', khi: `Lúc tăng ngân sách (camp > $${NGAN_SACH_CHUA_CAN_GIO})`,
    lam: 'Tăng vào ~21h · ~24h · 8h giờ VN; không thu lại sau khung', vi: 'Camp chạy chủ yếu Mỹ — hiệu suất tốt nhất 21h → 5h sáng giờ VN. Ngân sách $1–3 chưa cần canh giờ.', nguon: 'Dol Dang 21/10/2026' },
  { ma: 'GT', ten: 'Giảm / tắt khi ROI tụt', icon: '↓', muc: 'ha', gac: 'nguoi', khi: `ROI 3 ngày gần tụt ≥ 30 điểm so với 4 ngày trước, hoặc từ ≥ ${ROI_TOI_THIEU}% xuống < 0 (đã chi ≥ $3)`,
    lam: 'Anh xem giảm ngân sách hoặc tắt camp', vi: 'Phim đi xuống hoặc creative bão hoà → CPC/CPA tăng, ROI tụt. Ngoài ca này không cần đụng ngân sách.', nguon: 'Dol Dang 21/10/2026' },
  { ma: 'OFF', ten: 'Tắt camp lỗ sâu', icon: '■', muc: 'dung', gac: 'nguoi', khi: 'Tiêu từ trước tới nay > $10 mà ROI < −50%', lam: 'Tắt camp', vi: 'Đã đủ tiền để biết camp không ăn — tạm thời theo ngưỡng này.', nguon: 'Dol Dang 21/10/2026' },
  { ma: 'TC', ten: 'Ad bị Meta từ chối', icon: '⛔', muc: 'dung', gac: 'nguoi', khi: 'Ad DISAPPROVED', lam: 'Không xoá — Edit camp, thay creative SẠCH cùng phim đã được duyệt, Update cho Meta duyệt lại',
    vi: 'Giữ camp + lịch sử; Meta đôi khi duyệt nhầm, thay creative tuân thủ là qua.', nguon: 'Dol Dang 21/10/2026' },
  { ma: 'SC', ten: 'Số camp / phim', icon: '#', muc: 'bao', gac: 'may', khi: `Phim đang test: tối đa ${TEST_TOI_DA} camp · phim thắng (anh duyệt): tối đa ${THANG_TOI_DA}`,
    lam: 'Đủ trần thì cổng kiem-so-camp.sh chặn camp mới', vi: 'Test rẻ: 1 phim 1 dạng creative, thắng mới scale. Áp cho camp mới từ 21/10/2026.', nguon: 'anh 21/10/2026' },
  { ma: '1AD', ten: 'Một ad / camp', icon: '1', muc: 'bao', gac: 'may', khi: 'Dựng camp', lam: 'Mỗi camp đúng 1 nhóm, 1 ad — cổng kiem-cau-hinh.py chặn camp có ad thứ 2', vi: 'Anh cấm thêm ad thứ 2 vào một camp Ethopex.', nguon: 'anh 21/10/2026' },
  { ma: 'TH', ten: 'Cổng thoại nhạy cảm', icon: '✱', muc: 'bao', gac: 'may', khi: 'Chữ / phụ đề trong video có mua bán dâm, quan hệ, đe doạ lột đồ, bạo lực ("dead", "kill"…)',
    lam: 'Không cắt + không Publish (kiem-thoai.py ở cat-canh.py và dung-camp.sh)', vi: 'Meta từ chối #65717/#65719 "Adult Sexual Exploitation".', nguon: '20–21/10/2026' },
  { ma: 'DC', ten: 'Dạng creative theo phim (đề xuất)', icon: '◇', muc: 'bao', gac: 'nguoi', khi: 'Chấm theo PHIM (gộp mọi camp cùng content): phim thắng / đang test / phim dài lỗ',
    lam: 'Phim chưa thắng: test bằng cảnh thật cắt đoạn sâu (0đ), không làm kể chuyện · Phim thắng: thêm kể chuyện (dùng lại hình bản thắng, thay lời/giọng) · Phim dài 2–3\' lỗ: bỏ dạng này · Mọi dạng đều lỗ sâu: dừng làm creative mới',
    vi: 'Số 01–21/10: kể chuyện +198% trên Number One (cảnh thật +51%) nhưng bỏ Number One ra thì kể chuyện ≈ −46%, cảnh thật ≈ +10%; phim dài −29%. Kể chuyện là bộ khuếch đại phim mạnh, không phải công cụ tìm phim.', nguon: 'anh 22/10/2026' },
  { ma: 'NB', ten: 'Nhân bản phim thắng', icon: '⧉', muc: 'len', gac: 'nguoi', khi: 'Phim có camp đủ điều kiện tăng (TB)', lam: 'Duplicate camp + làm thêm creative cùng phim lên camp mới (trong trần SC)',
    vi: 'Phim có tín hiệu lãi thì mở rộng nhiều creative.', nguon: 'anh 20/10/2026' },
];
export const LUAT_THEO_MA = Object.fromEntries(LUAT.map((l) => [l.ma, l])) as Record<string, Luat>;

export type SoLieu = { chi: number; thu: number };
export type CampEtp = {
  id: number; ten: string; trang_thai: string; giao: string; ngan_sach: number; dong_bo: string | null; tao: string;
  content_id: number | null; creative_id: number | null; phim: string | null; ngon_ngu: string | null; studio_phim_id: number | null;
  link_phim: string | null; video: string | null; anh: string | null; dang_creative: string | null; trang_dich: string | null; fb_ad: string | null; fb_video: string | null;
  loi: string | null; thang: SoLieu; hom_nay: SoLieu; hom_qua: SoLieu; gan: SoLieu; truoc: SoLieu;
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
    { ten: 'ROI từ đầu tháng', hien: pct(r), nguong: `≥ ${ROI_TANG}%`, dat: r != null && r >= ROI_TANG },
    { ten: 'Spending hôm nay', hien: `${sp.toFixed(0)}%`, nguong: `> ${SPENDING_TOI_THIEU}%`, dat: sp > SPENDING_TOI_THIEU },
    { ten: 'Còn bậc trên', hien: `$${c.ngan_sach}`, nguong: `< $${TRAN_CAMP}`, dat: ke != null },
  ];
  const tbDat = tbDk.every((d) => d.dat);
  if (c.trang_thai === 'ACTIVE') out.push({ ma: 'TB', trang_thai: tbDat ? 'cham' : tbDk.filter((d) => d.dat).length >= 2 ? 'gan' : 'ap',
    cau: tbDat ? `Đủ điều kiện: $${c.ngan_sach} → $${ke} — chờ anh duyệt` : `ROI ${pct(r)} · spending ${sp.toFixed(0)}% → chưa tăng`, dk: tbDk });
  const rh = roi(c.hom_nay);
  if (c.trang_thai === 'ACTIVE' && c.ngan_sach < 3) {
    const dich = rh != null && rh >= 100 ? 3 : 2, dat = c.hom_nay.chi >= 0.5 && rh != null && rh > 50 && dich > c.ngan_sach;
    out.push({ ma: 'LD', trang_thai: dat ? 'cham' : rh != null && rh > 0 ? 'gan' : 'ap', cau: dat ? `Lãi đầu phiên: $${c.ngan_sach} → $${dich} — tăng luôn` : `ROI hôm nay ${pct(rh)} · chi $${c.hom_nay.chi.toFixed(2)}`,
      dk: [{ ten: 'Đã chi hôm nay', hien: `$${c.hom_nay.chi.toFixed(2)}`, nguong: '≥ $0,5', dat: c.hom_nay.chi >= 0.5 }, { ten: 'ROI hôm nay', hien: pct(rh), nguong: '> 50%', dat: rh != null && rh > 50 }] });
  }
  // all-time ≈ từ đầu tháng (dự án bắt đầu 19/10/2026) — đổi sang report all-time khi qua tháng
  { const r = roi(c.thang); if (c.thang.chi > 10 && r != null && r < -50) out.push({ ma: 'OFF', trang_thai: 'cham', cau: `Tiêu $${c.thang.chi.toFixed(2)}, ROI ${pct(r)} → tắt`, dk: [{ ten: 'Đã tiêu', hien: `$${c.thang.chi.toFixed(2)}`, nguong: '> $10', dat: true }, { ten: 'ROI', hien: pct(r), nguong: '< −50%', dat: true }] }); }
  if (c.thang.chi >= 30 && c.thang.thu > c.thang.chi) out.push({ ma: 'M30', trang_thai: 'cham', cau: `Đã tiêu $${c.thang.chi.toFixed(2)} mà vẫn lãi — hỏi Support scale bài viết cũ + bid ROAS`, dk: [] });
  if (ke == null) out.push({ ma: 'TR20', trang_thai: 'cham', cau: `Đã ở trần $${TRAN_CAMP}`, dk: [{ ten: 'Ngân sách', hien: `$${c.ngan_sach}`, nguong: `$${TRAN_CAMP}`, dat: true }] });
  if (c.ngan_sach > NGAN_SACH_CHUA_CAN_GIO || tbDat) out.push({ ma: 'KG', trang_thai: 'ap', cau: 'Khi tăng: chọn mốc ~21h · ~24h · 8h giờ VN', dk: [] });
  { const ry = roi(c.hom_qua), r3 = roi(c.gan), du = c.ngan_sach > 1 && c.hom_qua.chi >= 0.5 * c.ngan_sach, dat = du && ry != null && ry < 0 && (r3 == null || r3 < 20);
    if (c.trang_thai === 'ACTIVE' && c.ngan_sach > 1) {
      const xuong = (ns: number, b: number) => { const d = [1, 2, 3, 5, 7, 10, 15, 20, 30].filter((x) => x < ns - 1e-9); return d.length ? d[Math.max(0, d.length - b)]! : null; };
      const buoc = ry != null && ry < -50 && c.hom_qua.chi >= c.ngan_sach ? 2 : 1, dich = xuong(c.ngan_sach, buoc);
      out.push({ ma: 'GB', trang_thai: dat ? 'cham' : ry != null && ry < 0 ? 'gan' : 'ap', cau: dat ? `Giảm $${c.ngan_sach} → $${dich}${buoc === 2 ? ' (lỗ nặng, 2 bậc)' : ''} — phiên sáng, anh duyệt nút ↘` : `ROI hôm qua ${pct(ry)} · 3 ngày ${pct(r3)}`,
        dk: [{ ten: 'Hôm qua đã tiêu ≥ 50% ngân sách', hien: `$${c.hom_qua.chi.toFixed(2)}`, nguong: `≥ $${(0.5 * c.ngan_sach).toFixed(2)}`, dat: du },
             { ten: 'ROI hôm qua (trọn ngày)', hien: pct(ry), nguong: '< 0%', dat: ry != null && ry < 0 }, { ten: 'ROI 3 ngày', hien: pct(r3), nguong: '< 20%', dat: r3 == null || r3 < 20 }] });
    } }
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

// ── LUẬT DC: ĐỀ XUẤT DẠNG CREATIVE THEO PHIM (anh 22/10/2026: "thành rule nhưng ở dạng đề xuất… áp dụng theo film, show trên mos2 tab ethopex") ──
export type DangCr = 'kể chuyện' | 'cảnh thật' | 'cảnh cuối' | 'phim dài' | 'khác';
/** dạng creative của camp: studio (the_loai) trước, không có thì đọc tên camp ("ke chuyen" / "canh that" / "canh cuoi" / "phim dai") */
export function dangCamp(c: Pick<CampEtp, 'dang_creative' | 'ten'>): DangCr {
  const t = c.ten.toLowerCase();
  if (/ke chuyen/.test(t) || c.dang_creative === 'kể chuyện') return 'kể chuyện';
  if (/canh cuoi/.test(t)) return 'cảnh cuối';
  if (/phim dai/.test(t)) return 'phim dài';
  if (/canh that/.test(t) || c.dang_creative === 'cảnh thật') return 'cảnh thật';
  return 'khác';
}
export const DC_CHI_DU = 5;      // $ tiêu tối thiểu của phim để chấm
export const DC_THANG_CHI = 10;  // phim thắng: tiêu ≥ $10 …
export const DC_THANG_ROI = 50;  // … và ROI phim ≥ 50% (hoặc anh đã đưa vào danh sách phim thắng)
export type PhimDeXuat = { content_id: number; phim: string; ngon_ngu: string | null; link: string | null; so_camp: number; tong: SoLieu; thang: boolean;
  theo_dang: Partial<Record<DangCr, SoLieu & { n: number }>>; de_xuat: { muc: MucLuat; cau: string }[] };
export function deXuatPhim(camps: CampEtp[], phimThang: number[]): PhimDeXuat[] {
  const g = new Map<number, PhimDeXuat>();
  for (const c of camps) {
    if (!c.content_id) continue;
    const p = g.get(c.content_id) ?? { content_id: c.content_id, phim: c.phim ?? c.ten.replace(/^(TEST )?\d{4}(ns)? /, '').split(/ (EN|ES) - /)[0]!, ngon_ngu: c.ngon_ngu, link: c.link_phim, so_camp: 0, tong: { chi: 0, thu: 0 }, thang: false, theo_dang: {}, de_xuat: [] };
    const d = dangCamp(c), td = p.theo_dang[d] ?? { chi: 0, thu: 0, n: 0 };
    td.chi += c.thang.chi; td.thu += c.thang.thu; td.n += 1; p.theo_dang[d] = td;
    p.tong.chi += c.thang.chi; p.tong.thu += c.thang.thu; p.so_camp += 1; p.link ??= c.link_phim; if (c.phim) p.phim = c.phim;
    g.set(c.content_id, p);
  }
  const ra = [...g.values()];
  for (const p of ra) {
    const r = roi(p.tong), kc = p.theo_dang['kể chuyện'], ct = p.theo_dang['cảnh thật'] ?? p.theo_dang['cảnh cuối'], pd = p.theo_dang['phim dài'];
    p.thang = phimThang.includes(p.content_id) || (p.tong.chi >= DC_THANG_CHI && r != null && r >= DC_THANG_ROI);
    const dx = p.de_xuat, rr = (s?: SoLieu) => (s ? roi(s) : null);
    if (p.tong.chi < DC_CHI_DU) { dx.push({ muc: 'bao', cau: `Chưa đủ số (tiêu ${p.tong.chi.toFixed(2)} < $${DC_CHI_DU}) — để chạy tiếp${ct ? '' : ', test bằng cảnh thật cắt đoạn sâu'}` }); continue; }
    if (p.thang) {
      if (!kc) dx.push({ muc: 'len', cau: 'Phim thắng chưa có kể chuyện → làm kể chuyện (dùng lại hình bản thắng, thay lời / giọng; hoặc sinh mới qua studio)' });
      else if ((rr(kc) ?? -1e9) >= (rr(ct) ?? -1e9)) dx.push({ muc: 'len', cau: `Kể chuyện ${pct(rr(kc))} ≥ cảnh thật ${pct(rr(ct))} → nhân thêm kể chuyện (bản ngôn ngữ khác, giọng khác)` });
      else dx.push({ muc: 'len', cau: `Cảnh thật ${pct(rr(ct))} > kể chuyện ${pct(rr(kc))} → nhân thêm đoạn cắt cảnh thật (đoạn sâu, đoạn chưa dùng)` });
    } else {
      if (kc && (rr(kc) ?? 0) < 0) dx.push({ muc: 'ha', cau: `Kể chuyện ${pct(rr(kc))} trên phim chưa thắng → không làm thêm kể chuyện` });
      if (!ct && !pd) dx.push({ muc: 'bao', cau: 'Chưa có cảnh thật → test bằng cảnh thật cắt đoạn sâu (0đ)' });
      else if (ct && (rr(ct) ?? -1e9) >= 0) dx.push({ muc: 'bao', cau: `Cảnh thật ${pct(rr(ct))} đang giữ → chạy tiếp, thêm 1 đoạn cắt sâu khác nếu còn trần số camp` });
    }
    if (pd && pd.chi >= 2 && (rr(pd) ?? 0) < 0) dx.push({ muc: 'ha', cau: `Phim dài 2–3' ${pct(rr(pd))} → bỏ dạng phim dài cho phim này` });
    if (!p.thang && p.tong.chi >= DC_THANG_CHI && r != null && r < -30) dx.push({ muc: 'dung', cau: `Mọi dạng đều lỗ (${pct(r)} trên $${p.tong.chi.toFixed(2)}) → dừng làm creative mới cho phim này` });
    if (!dx.length) dx.push({ muc: 'bao', cau: `ROI phim ${pct(r)} — vùng giữ, theo dõi tiếp` });
  }
  return ra.sort((a, b) => b.tong.chi - a.tong.chi);
}
