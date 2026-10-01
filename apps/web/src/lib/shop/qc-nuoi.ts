// NUÔI TÀI KHOẢN MỚI (via · BM · TK QC · Trang) — lộ trình chặng + tính hành trình, THUẦN (không DB). Cùng khuôn bảng đơn hàng:
// mỗi mảnh đứng ở MỘT chặng, có hạn (ngày thứ N kể từ lúc bắt đầu nuôi), trễ hạn = đỏ, tới hạn hôm nay = vàng.
// Sổ mốc: migration 0212 (shop_qc_nuoi). Lộ trình là KẾ HOẠCH MẶC ĐỊNH đã bàn 02/10/2026 (nhận → khoá quyền → nuôi → mới chạy),
// không phải số đo — mảnh nào nuôi khác thì ghi chú vào nhật ký, hạn chỉ để nhắc.
// Kiểm: node_modules/.bin/tsx apps/web/src/lib/shop/qc-nuoi.test.mts

export type LoaiNuoi = 'nguoi' | 'bm' | 'tk' | 'trang';
export type ChangNuoi = { key: string; nhan: string; ngay: number; chuThich: string };

export const TEN_NUOI: Record<LoaiNuoi, string> = { nguoi: 'Via / tài khoản', bm: 'BM', tk: 'TK QC', trang: 'Trang' };

/** `ngay` = hạn của chặng: phải xong trước hết ngày thứ N (ngày bắt đầu = ngày 0). */
export const LO_NUOI: Record<LoaiNuoi, ChangNuoi[]> = {
  nguoi: [
    { key: 'khoa', nhan: 'Nhận + khoá quyền', ngay: 0, chuThich: 'Trong đúng browser profile + proxy của nó: đổi mật khẩu, đổi email sang email mới của mình, bật 2FA bằng app, đăng xuất mọi phiên của người bán.' },
    { key: 'ho_so', nhan: 'Hoàn thiện hồ sơ', ngay: 2, chuThich: 'Ảnh đại diện, ảnh bìa, vài thông tin cơ bản — nơi ở khớp bang của IP proxy.' },
    { key: 'tuong_tac', nhan: 'Tương tác nhẹ', ngay: 5, chuThich: 'Mỗi ngày 10-15 phút: lướt, like, xem video, vào vài group, kết bạn vài người. Không chạy gì liên quan quảng cáo.' },
    { key: 'on_dinh', nhan: 'Ổn định 7 ngày', ngay: 7, chuThich: 'Qua 7 ngày không checkpoint, không bị đòi xác minh danh tính.' },
    { key: 'vao_bm', nhan: 'Tạo / vào BM', ngay: 8, chuThich: 'Tạo BM của shop, hoặc nhận quyền quản trị BM đã mua.' },
  ],
  bm: [
    { key: 'nhan', nhan: 'Tạo / nhận BM', ngay: 0, chuThich: 'BM mua: vào bằng via của mình rồi gỡ ngay tài khoản người bán.' },
    { key: 'admin2', nhan: 'Đủ 2 quản trị', ngay: 1, chuThich: 'Thêm quản trị phụ (via thứ hai, proxy riêng). BM một quản trị: người đó dính khoá là mất cả BM.' },
    { key: 'thong_tin', nhan: 'Thông tin DN + xác minh miền', ngay: 2, chuThich: 'Tên / địa chỉ doanh nghiệp của shop, website; thêm bản ghi DNS xác minh tên miền.' },
    { key: 'pixel_token', nhan: 'Pixel + token hệ thống', ngay: 3, chuThich: 'Tạo pixel trong BM, gắn vào site + CAPI; tạo System User, sinh token, dán vào ô Token của BM.' },
  ],
  tk: [
    { key: 'the', nhan: 'Gắn thẻ', ngay: 0, chuThich: 'Tiền USD, múi giờ Mỹ. Anh tự nhập thẻ trên Facebook — ở đây chỉ chọn thẻ (nhãn + 4 số cuối).' },
    { key: 'moi', nhan: 'Chạy mồi ≤ $10/ngày', ngay: 3, chuThich: 'Một campaign nhỏ (tương tác bài / lượt xem trang), creative sạch.' },
    { key: 'tru_tien', nhan: 'Qua lần trừ tiền đầu', ngay: 5, chuThich: 'Facebook trừ tiền ngưỡng đầu tiên thành công, không bị treo thanh toán.' },
    { key: 'thu', nhan: 'Chạy thử $20-30/ngày', ngay: 10, chuThich: 'Campaign chuyển đổi thật, không tăng ngân sách mạnh trong tuần đầu.' },
    { key: 'tang', nhan: 'Tăng dần · 14 ngày sạch', ngay: 14, chuThich: 'Tăng tối đa ~20-30% mỗi lần; qua 14 ngày không hạn chế = TK đã ấm.' },
  ],
  trang: [
    { key: 'tao', nhan: 'Tạo / nhận Trang', ngay: 0, chuThich: 'Trang mới mang tên shop, do via của bộ tạo.' },
    { key: 'trang_tri', nhan: 'Ảnh + giới thiệu + link', ngay: 1, chuThich: 'Logo, ảnh bìa, giới thiệu, nút liên kết về site.' },
    { key: 'bai', nhan: 'Đăng 3-5 bài', ngay: 5, chuThich: 'Rải 3-5 bài trong vài ngày trước khi chạy quảng cáo.' },
    { key: 'vao_bm', nhan: 'Gắn vào BM', ngay: 6, chuThich: 'Trang nằm trong BM của shop.' },
  ],
};

export type MocNuoi = { id: number; loai: LoaiNuoi; doiTuongId: number; buoc: string; xong: boolean; luc: string; ghiChu: string | null; nguoiGhi: string | null };
export type ChangHt = ChangNuoi & { xong: boolean; luc: string | null; han: string | null };
export type HanhTrinhNuoi = {
  batDau: string | null;          // ngày bắt đầu nuôi (YYYY-MM-DD, giờ VN); null = chưa nuôi
  chang: ChangHt[];
  hienTai: number;                // chặng đầu tiên chưa xong; = chang.length khi đã xong hết
  ngayThu: number | null;         // hôm nay là ngày thứ mấy kể từ lúc bắt đầu
  tre: boolean;                   // chặng đang đứng đã quá hạn
  denHan: boolean;                // chặng đang đứng hạn đúng hôm nay
  xong: boolean;
};

/** Ngày giờ VN của một mốc (cột timestamptz đọc ra ISO). */
export const ngayVn = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);
const cong = (ngay: string, n: number) => new Date(Date.parse(`${ngay}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const cach = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);

/** Hành trình của MỘT mảnh từ sổ mốc: mốc mới nhất của từng chặng quyết định xong hay chưa (mở lại = mốc xong=false). */
export function hanhTrinhNuoi(loai: LoaiNuoi, moc: MocNuoi[], homNay: string): HanhTrinhNuoi {
  const theoLuc = [...moc].sort((a, b) => a.luc.localeCompare(b.luc) || a.id - b.id);
  const cuoi = new Map<string, MocNuoi>();
  for (const m of theoLuc) if (m.buoc !== 'ghi') cuoi.set(m.buoc, m);
  const bd = cuoi.get('bat_dau');
  const batDau = bd && bd.xong ? ngayVn(bd.luc) : null;
  const chang: ChangHt[] = LO_NUOI[loai].map((c) => {
    const m = cuoi.get(c.key);
    return { ...c, xong: !!m?.xong, luc: m?.xong ? m.luc : null, han: batDau ? cong(batDau, c.ngay) : null };
  });
  const i = chang.findIndex((c) => !c.xong);
  const hienTai = i < 0 ? chang.length : i;
  const han = chang[hienTai]?.han ?? null;
  return {
    batDau, chang, hienTai, ngayThu: batDau ? cach(batDau, homNay) : null,
    tre: !!han && homNay > han, denHan: !!han && homNay === han, xong: i < 0,
  };
}
