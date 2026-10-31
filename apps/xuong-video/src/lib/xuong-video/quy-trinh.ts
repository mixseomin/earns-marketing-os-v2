// QUY TRÌNH CHUẨN NGÀNH của một video (12/10/2026 — anh: "phải có tự động chứ tao cứ phải nhắc từng tí một"). Một bảng duy nhất các bước
// tiền kỳ → sản xuất → hậu kỳ mà đoàn phim/agency làm trước khi tiêu tiền; mỗi bước tốn tiền (keyframe, video, xuất) có CỔNG:
// bước nào gác cổng đó mà chưa đạt thì máy chủ từ chối (sinhKeyframeCanh, batDauVideoCanh) và thanh 🎬 Quy trình trên studio chỉ đúng
// chỗ thiếu + cách làm. Thêm một chuẩn mới = thêm MỘT mục ở đây, không vá từng nút. Khác kiem-qc.ts: bên đó chấm NỘI DUNG quảng cáo
// (hook, CTA, bằng chứng), bên này chấm QUY TRÌNH sản xuất. Thuần — tự kiểm: quy-trinh.test.mts.
import { diCmShot } from './khong-gian';
import { batCamXuc } from './qc-cam-xuc';
import { lintPrompt } from './tu-sua-clip-do';
import { chanKhung } from './khung';
import { maAnimatic, conTapSau } from './ho-so';
import { thanhPhanCanh, cauVideo, type Canh, type NhanVat, type PhanCanh, type KinhThanh } from './kieu';
import { kyThuat, type Beat } from './dien-anh';
import { CU_MAY_KHUNG_KET } from './dien-anh-nganh';
import { dongThoai } from './am-thanh';
import { chamKichBan } from './cham-kich-ban';
import { kiemTieng } from './khop-giong';
import type { Series, TapHoSo, ThuNguoiXem } from './kieu';
import { chanNguoiXem, tomTatNguoiXem, TIEN_TO_NGUOI_XEM, TEN_NUT_NGUOI_XEM, type ShotXem } from './nguoi-xem';
import { chanThamKhao, TIEN_TO_THAM_KHAO } from './tham-khao';
import { loiSanPhamShot } from './san-pham-shot';
import { chanDanDat } from './dan-dat';
import { kiemNguPhapMay, diCm } from './ngu-phap-may';
import { kiemNhipHinh, kiemGiayDoc, kiemDanKhongGian, kiemVaiKe, kiemTheShot, kiemNutDong, kiemKetTap, TIEN_TO_NHIP_HINH, TIEN_TO_DUNG_TRUYEN } from './nhip-hinh';
import { thieuBieuCam, loiMachBieuCam, loiCanCanhDongLon, loiCauTraiBieuCam, soatKeyframe } from './qc-cam-xuc';

export type Cong = 'keyframe' | 'video' | 'xuat';
export type NhomQt = 'Tiền kỳ' | 'Sản xuất' | 'Hậu kỳ';
export type MucQt = { key: string; nhom: NhomQt; ten: string; ok: boolean; thieu: string[]; cong: Cong | null; lam: string };
export type TapQt = { /** sơ đồ 2D theo cảnh (khong-gian.ts) — quãng đi khi không 3D */ khong_gian?: import('./khong-gian').KhongGianTap; ho_so?: TapHoSo; so?: number; brief: string; thu_nguoi_xem?: ThuNguoiXem | null; beats: Pick<Beat, 'ten' | 'cam_xuc'>[]; phan_canh: (Pick<PhanCanh, 'ten'> & Partial<Pick<PhanCanh, 'beat' | 'intro' | 'gag'>>)[]; nhac_url: string | null; nhac_phan_canh: Record<string, string> };
export type PhimQt = { phong_cach?: string; /** thể loại (phim_doc bật bộ chấm phim ngắn dọc) */ the_loai?: string; ti_le?: string; logo_url?: string; laQc: boolean; logline?: string; series?: Series | null; khong_loi?: boolean; /** Murch QC (qc-cam-xuc.ts) */ camXucQc?: boolean };
/** PhimQt từ kinh thánh — MỘT chỗ dựng (thanh 🎬, bảng chọn shot, cổng keyframe máy chủ); trước đây 4 chỗ tự dựng, bảng chọn shot ghi cứng laQc: false. */
export const phimQt = (loai: string, kt: Pick<KinhThanh, 'phong_cach' | 'logline' | 'series' | 'khong_loi' | 'qc'> & Partial<Pick<KinhThanh, 'cam_xuc_qc' | 'the_loai'>>): PhimQt =>
  ({ phong_cach: kt.phong_cach, the_loai: kt.the_loai, logo_url: kt.qc?.logo_url, laQc: loai === 'quang_cao', logline: kt.logline, series: kt.series, khong_loi: kt.khong_loi, camXucQc: batCamXuc(loai, kt) });
type ShotQt = Pick<Canh, 'id' | 'thu_tu' | 'phat_s' | 'thoi_luong_s' | 'thoai_url' | 'nhan_vat' | 'bien_the' | 'prompt_anh' | 'hanh_dong' | 'phan_doan' | 'keyframe_url' | 'trang_thai' | 'ky_thuat' | 'thoai' | 'loi_thoai' | 'chu_man'> & Partial<Pick<Canh, 'kiem_khung' | 'soi_mat' | 'prompt_video' | 'keyframe_ket' | 'bieu_cam' | 'noi_lien' | 'soat' | 'video_url' | 'video_cuoi_url' | 'nhanh'>>;

/** Luật anh 12/10/2026: MỌI video phải có PHÂN CẢNH cụ thể (mục tiêu · xung đột · cảm xúc đầu→cuối) trước khi sinh keyframe —
 *  shot nào không thuộc một phân cảnh đã khai (phan_doan khớp tên trong tap.phan_canh) thì chưa được sinh. MỘT luật cho bảng chọn,
 *  máy chủ (sinhKeyframeCanh) và script nạp shot (nap-canh). null = đạt. */
export function thieuPhanCanh(phanCanh: Pick<PhanCanh, 'ten'>[], c: Pick<Canh, 'phan_doan'>): string | null {
  if (!phanCanh.length) return 'tập chưa có phân cảnh — ✂ Tách cảnh (hoặc nạp kèm phanCanh) trước khi sinh keyframe';
  if (!phanCanh.some((x) => x.ten === c.phan_doan)) return c.phan_doan ? `phân cảnh "${c.phan_doan}" chưa khai trong tập` : 'shot chưa thuộc phân cảnh nào';
  return null;
}

/** Luật anh 12/10/2026 (nhắc hai lần): keyframe phải đứng trên MẪU — mỗi shot sinh ảnh gắn ≥1 anchor Bối cảnh, và đối tượng của phim
 *  (người, sản phẩm, đạo cụ) được nhắc tên trong prompt thì phải gắn mẫu, không để model vẽ theo chữ (mỗi shot một khuôn mặt / một căn phòng).
 *  Ảnh mẫu thiếu thì thanhPhanCanh đã chặn. nhanVat = MỌI anchor của phim. MỘT luật cho bảng chọn, máy chủ và script. */
/** Anchor (không phải bối cảnh) có NHẮC TÊN trong prompt ảnh / hành động mà chưa gắn vào shot — một luật cho cổng (thieuMau) và lúc lưu tách
 *  cảnh (luu-canh.ts tự gắn): trước đây chỉ gắn anchor Claude tự liệt kê, món nhắc trong prompt bị sót → chặn keyframe (Tango & Lint tập 1). */
/** Anchor được NHẮC TÊN trong prompt ảnh mà chưa gắn. Chỉ quét prompt ảnh (thứ có trong khung): chữ hành động nhắc cả người vắng mặt
 *  ("nơi Mr. Wipe sẽ tới") → gắn nhầm, keyframe vẽ thêm nhân vật không có mặt (cổng 3D bắt ở Tango & Lint 7.2a/7.3/4.6, 14/10/2026). */
export function mauNhacTen(c: Pick<Canh, 'nhan_vat' | 'prompt_anh'>, nhanVat: (Pick<NhanVat, 'id' | 'ten' | 'loai'> & { bo_set_id?: number | null })[]): Pick<NhanVat, 'id' | 'ten' | 'loai'>[] {
  const chu = ` ${c.prompt_anh} `.toLowerCase();
  return nhanVat.filter((v) => {
    // đối tượng CỐ ĐỊNH của bộ set (bo_set_id: cửa thang máy, logo, bàn, người phụ — doi-tuong-xuyen-suot.mts) vào shot qua bộ set + khung 3D (doc-db.ts › thayThem), không gắn tay
    if (v.loai === 'boi_canh' || v.loai === 'phong_cach' || v.bo_set_id || c.nhan_vat.includes(v.id) || v.ten.trim().length < 3) return false;
    const t = v.ten.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}])${t}([^\\p{L}]|$)`, 'u').test(chu);
  });
}
/** MÔ TẢ NƯỚC ĐÔI (15/10/2026: 'a flat orange card / card holder' → keyframe lúc thẻ nhựa phẳng lúc ví da): anchor phải tả MỘT kiểu. Trả đoạn nước
 *  đôi ("A / B") hoặc null. */
export const moTaNuocDoi = (mo: string | undefined): string | null => (mo ?? '').match(/[\p{L}-]+(?: [\p{L}-]+)? \/ [\p{L}-]+(?: [\p{L}-]+)?/u)?.[0] ?? null;
/** Chữ trong prompt ảnh cho thấy shot có người (đại từ / người / tay). */
export const CO_NGUOI = /\b(he|she|his|her|him|man|woman|person|people|hands?)\b/i;
/** Có người trong prompt — bỏ cụm PHỦ ĐỊNH trước ('NO people at all', 'without a person': ảnh nền ghép của khuôn đổi nền; 'no hands': tĩnh vật /
 *  end card sản phẩm — 16/10/2026 Jett #61 shot 6, 14 bị chặn nhầm). */
export const coNguoi = (prompt: string): boolean => CO_NGUOI.test(prompt.replace(/\b(no|without|empty of|free of)\s+(\w+\s+)?(people|person|humans?|man|woman|one|hands?)\b/gi, ' '));
export function thieuMau(c: Pick<Canh, 'nhan_vat' | 'prompt_anh' | 'hanh_dong'> & Partial<Pick<Canh, 'ky_thuat'>>, nhanVat: (Pick<NhanVat, 'id' | 'ten' | 'loai'> & Partial<Pick<NhanVat, 'mo_ta'>>)[]): string[] {
  const out: string[] = [];
  const gan = nhanVat.filter((v) => c.nhan_vat.includes(v.id));
  // Shot nền ghép (ky_thuat.nen_ghep — khuôn đổi nền): nơi chốn xuất hiện một lần, keyframe của nó là mẫu → không đòi anchor Bối cảnh
  // (15/10/2026: 7 shot nền của "Một dáng, mọi nơi" bị chặn "phim chưa có anchor Bối cảnh" dù mỗi nơi chỉ hiện 0,8s một lần).
  if (!c.ky_thuat?.nen_ghep && !gan.some((v) => v.loai === 'boi_canh')) out.push(nhanVat.some((v) => v.loai === 'boi_canh') ? 'chưa gắn bối cảnh — gắn một anchor Bối cảnh (tab 📖 Phim) để mọi shot cùng nơi trông như một chỗ' : 'phim chưa có anchor Bối cảnh nào — tả + sinh ảnh mẫu các nơi chốn lặp lại (tab 📖 Phim) trước khi sinh keyframe');
  for (const v of mauNhacTen(c, nhanVat)) out.push(`"${v.ten}" có trong prompt mà chưa gắn mẫu`);
  // Shot CÓ NGƯỜI mà không gắn mẫu người nào → model vẽ người lạ (16/10/2026: JettJeans #54 shot 3 / 6 tả 'he squats…', 'hands…' không nhắc tên Mike
  // nên cổng nhắc tên không bắt, keyframe ra một người đàn ông trẻ tóc đen). Chỉ xét khi phim có anchor người.
  if (nhanVat.some((v) => v.loai === 'nhan_vat') && !gan.some((v) => v.loai === 'nhan_vat') && !c.ky_thuat?.nen_ghep && !mauNhacTen(c, nhanVat).some((v) => v.loai === 'nhan_vat') && coNguoi(c.prompt_anh)) out.push('shot có người (he / she / hands / man…) mà chưa gắn mẫu người — gắn nhân vật để keyframe không vẽ ra người lạ');
  for (const v of gan) { const x = moTaNuocDoi(v.mo_ta); if (x) out.push(`mô tả "${v.ten}" nước đôi ("${x}") — chọn MỘT kiểu khớp ảnh mẫu, không thì keyframe vẽ lúc kiểu này lúc kiểu kia`); }
  return out;
}

/** Shot cần SINH ảnh: chưa có keyframe. Shot dùng ảnh có sẵn (ảnh chụp thật, thẻ kết) đã có keyframe nên không phải qua cổng mẫu. */
const canSinh = (c: ShotQt) => !c.keyframe_url;

/** Cổng tiền kỳ cấp TẬP — áp cho mọi shot trước khi sinh keyframe. */
/** Chấm kịch bản tập (cham-kich-ban.ts) theo dữ liệu cổng. */
const chamTap = (tap: TapQt, phim: PhimQt, canh: (Pick<Canh, 'phat_s' | 'thoi_luong_s' | 'phan_doan' | 'chu_man' | 'thoai' | 'loi_thoai'> & Partial<Pick<Canh, 'hanh_dong'>>)[]) =>
  chamKichBan({ tap: { so: tap.so, beats: tap.beats, phan_canh: tap.phan_canh.map((p) => ({ ten: p.ten, beat: p.beat ?? '' })) }, canh, kt: { logline: phim.logline, series: phim.series, khong_loi: phim.khong_loi, the_loai: phim.the_loai } });
/** `canh` = các shot của tập (theo thứ tự) — có thì chấm cả hook 3 giây đầu. Phim có KINH THÁNH SERIES thì kịch bản chưa đạt (logline, 5 nhịp,
 *  hook) cũng chặn keyframe; phim lẻ chỉ hiện điểm trên thanh 🎬 Quy trình. */
/** canhA = nhánh hook A của tập — bản người xem được kiểm trên nhánh A (kiem-nguoi-xem.ts), nên cổng phải so đúng nhánh đó, kể cả khi đang
 *  sinh shot của nhánh B (truyền canh = nhánh B thì mã phiên bản luôn lệch → chặn oan). Mặc định = canh (tập không có nhánh). */
/** boiCanh = id các anchor Bối cảnh của phim — có thì xét luật dẫn không gian (nhip-hinh.ts › kiemDanKhongGian). */
export function chanTienKy(tap: TapQt, phim: PhimQt, canh: (Pick<Canh, 'phat_s' | 'thoi_luong_s' | 'phan_doan' | 'chu_man' | 'thoai' | 'loi_thoai'> & Partial<Pick<Canh, 'thu_tu' | 'hanh_dong' | 'ky_thuat' | 'nhan_vat' | 'dan_dung' | 'tham_khao' | 'bieu_cam' | 'may_3d'>>)[] = [], canhA = canh, boiCanh?: number[]): string[] {
  const out: string[] = [];
  // QC: mọi câu chữ phải có nguồn tham khảo (tham-khao.ts) — cấm câu tự viết không tham khảo (anh 15/10/2026).
  out.push(...chanThamKhao(canh, phim.laQc));
  // Người xem lần đầu phải hiểu câu chuyện trước khi tiêu tiền hình (nguoi-xem.ts) — mọi phim.
  out.push(...chanNguoiXem(tap.thu_nguoi_xem, canhA.map((c, i) => ({ ...c, thu_tu: c.thu_tu ?? i + 1, hanh_dong: c.hanh_dong ?? '' }))));
  if (phim.series?.dong_co?.trim()) out.push(...chamTap(tap, phim, canh).chan);
  if (tap.brief.trim().length < 20) out.push('chưa có brief (mục tiêu, người xem, thông điệp) — viết ở ô Brief của tập');
  const cx = tap.beats.map((b) => b.cam_xuc);
  if (tap.beats.length < 3) out.push('chưa có khung truyện (≥3 beat: mở – xung đột – giải quyết)');
  // Beat âm + dương là luật KỂ CHUYỆN của phim truyện. QC thắng mở bằng tính năng / ưu đãi (VionB, Huggea) không có nhịp âm — QC chấm theo tiêu chí QC
  // (kiem-qc.ts + người xem bản QC), như cổng kiểm khung đã gỡ cho QC. 15/10/2026: 7/12 template QC (Tính năng mở đầu, 15s, POV, Haul…) bị chặn oan ở đây.
  else if (!phim.laQc && !(Math.min(...cx) < 0 && Math.max(...cx) > 0)) out.push('khung truyện phẳng — phải có beat âm (vấn đề/cao trào) và beat dương (giải quyết)');
  if (!tap.phan_canh.length) out.push('chưa có phân cảnh (mục tiêu · xung đột · cảm xúc đầu→cuối)');
  if ((phim.phong_cach ?? '').trim().length < 30) out.push('chưa chốt phong cách hình (style frame: ánh sáng, màu, chất liệu) — mục 1 Kinh thánh');
  // Nhịp hình (nhip-hinh.ts): shot liền nhau trùng cỡ cảnh + chuyển động máy, quá nhiều shot máy đứng yên — sửa 0đ bằng 🎥 trong thanh 🎬.
  out.push(...kiemNhipHinh(canh.map((c, i) => ({ thu_tu: c.thu_tu ?? i + 1, ky_thuat: c.ky_thuat }))));
  // Ngữ pháp máy theo nhịp kịch (ngu-phap-may.ts, phim ngắn dọc): sốc / sỉ nhục / quyền lực / hé lộ / phán quyết / móc cuối tập phải có chuyển động
  // hợp nhịp — sửa 0đ bằng cùng nút 🎥.
  out.push(...kiemNguPhapMay(canh.map((c, i) => ({ thu_tu: c.thu_tu ?? i + 1, ky_thuat: c.ky_thuat, bieu_cam: c.bieu_cam, dan_dung: c.dan_dung, hanh_dong: c.hanh_dong,
    di_cm: c.may_3d ? diCm(c.may_3d.vi_tri) : diCmShot(tap.khong_gian, c as never), cuoi: i === canh.length - 1 && !!phim.series?.dong_co?.trim() })), phim.the_loai));
  // Nhịp đọc (nhip-hinh.ts › giayDoc): shot phim truyện phát quá ngắn → người xem chưa hiểu đã cắt.
  out.push(...kiemGiayDoc(canh.map((c, i) => ({ thu_tu: c.thu_tu ?? i + 1, phat_s: c.phat_s, thoi_luong_s: c.thoi_luong_s })), phim));
  out.push(...kiemTheShot(canh.map((c, i) => ({ thu_tu: c.thu_tu ?? i + 1, dan_dung: c.dan_dung })), phim));
  out.push(...kiemVaiKe(canh.map((c, i) => ({ thu_tu: c.thu_tu ?? i + 1, phan_doan: c.phan_doan, ky_thuat: c.ky_thuat })), phim));
  // Dựng truyện (nhip-hinh.ts): nút đóng giữa hai mạch truyện trong một cảnh + kết tập ba nhịp (bùng → giữ → móc).
  const dsTruyen = canh.map((c, i) => ({ thu_tu: c.thu_tu ?? i + 1, phan_doan: c.phan_doan, phat_s: c.phat_s, thoi_luong_s: c.thoi_luong_s, ky_thuat: c.ky_thuat }));
  out.push(...kiemNutDong(tap.phan_canh, dsTruyen, phim), ...kiemKetTap(tap.phan_canh, dsTruyen, { laQc: phim.laQc, coMoc: conTapSau(phim.series, tap.so) }));
  if (boiCanh?.length) out.push(...kiemDanKhongGian(canh.map((c, i) => ({ thu_tu: c.thu_tu ?? i + 1, nhan_vat: c.nhan_vat, ky_thuat: c.ky_thuat })), boiCanh, phim));
  return out;
}
/** Cổng tiền kỳ cấp SHOT: phân cảnh + mẫu bối cảnh/đối tượng + ảnh mẫu + ngôn ngữ máy (cỡ cảnh). */
export function chanShot(c: ShotQt, tap: TapQt, nhanVatPhim: NhanVat[], o?: { camXucQc?: boolean; ds?: ShotQt[]; /** dòng phim — khuôn kiểm hợp dòng */ theLoai?: string }): string[] {
  const out: string[] = [];
  // MURCH QC (qc-cam-xuc.ts): kế hoạch biểu cảm đủ người + liền mạch với shot trước — chặn trước khi tiêu tiền keyframe.
  if (o?.camXucQc) {
    const thieu = thieuBieuCam(c, nhanVatPhim);
    if (thieu.length) out.push(`chưa có kế hoạch biểu cảm (đầu → cuối) cho ${thieu.join(', ')} — nét mặt không khai thì model tự chọn, shot sau dễ gãy cảm xúc`);
    if (o.ds) out.push(...(loiMachBieuCam(o.ds.filter((x) => (x.nhanh || '') === (c.nhanh || '') || !x.nhanh), nhanVatPhim)[c.id] ?? []));
    const trai = loiCauTraiBieuCam(c.prompt_anh, c.bieu_cam); if (trai) out.push(`keyframe: ${trai}`);
  }
  const pc = thieuPhanCanh(tap.phan_canh, c); if (pc) out.push(pc);
  out.push(...thieuMau(c, nhanVatPhim));
  out.push(...thanhPhanCanh(c, nhanVatPhim).thieu);
  if (!c.ky_thuat?.co_canh) out.push('chưa chọn cỡ cảnh (shot list: toàn / trung / cận / đặc tả…)');
  // DẪN DẮT + KHUÔN CHUỖI (dan-dat.ts › chanDanDat): điểm cắt vào shot dưới ngưỡng / khuôn chứa shot có lỗi đỏ → chặn trước khi tiêu tiền.
  if (o?.ds) out.push(...chanDanDat(c.id, o.ds as never, tap as never, o.theLoai as never));
  return out;
}
/** Cổng sản xuất cho VIDEO: keyframe duyệt + GIỌNG TRƯỚC VIDEO (Veo tự đọc thoại lơ lớ, in phụ đề giả — mất $0,40 ngày 09/10/2026). */
/** ANIMATIC (14/10/2026 — bước ngành bắt buộc giữa storyboard và quay): phim truyện phải duyệt bản dựng từ keyframe (đúng số giây + âm)
 *  trước khi tốn tiền video; keyframe hay giây đổi sau khi duyệt (mã khác) là phải duyệt lại. Quảng cáo không xét. */
export function chanAnimatic(hoSo: TapHoSo | undefined, ds: Parameters<typeof maAnimatic>[0], laQc: boolean): string[] {
  if (laQc || !ds.length) return [];
  if (!hoSo?.animatic) return ['animatic chưa duyệt — xuất bản dựng từ keyframe (đúng số giây + âm), xem nhịp cả phim rồi bấm Duyệt animatic ở tab 📋 Hồ sơ'];
  return hoSo.animatic.ma === maAnimatic(ds) ? [] : ['keyframe / giây phát đã đổi sau khi duyệt animatic — xuất và duyệt lại animatic'];
}
/** laQc BẮT BUỘC (16/10/2026: thẻ shot + script kiểm gọi không truyền o → quảng cáo vẫn bị chặn "chưa kiểm khung" dù cổng đã gỡ cho QC). */
export function chanVideo(c: ShotQt, nhanVat: NhanVat[], laQc: boolean, o?: { hoSo?: TapHoSo; ds: Parameters<typeof maAnimatic>[0]; camXucQc?: boolean } | { camXucQc?: boolean; hoSo?: undefined; ds?: undefined }): string[] {
  const out: string[] = [];
  if (o?.ds) out.push(...chanAnimatic(o.hoSo, o.ds, laQc));
  if (!c.keyframe_url) out.push('chưa có keyframe');
  else if (c.trang_thai !== 'duyet' && c.trang_thai !== 'loi' && c.trang_thai !== 'xong') out.push('chưa duyệt keyframe');
  // Máy kiểm khung (khung.ts): keyframe chưa kiểm / lệch bố trí, trục, nhân vật → không cho tiêu tiền video lên một khung sai.
  // Quảng cáo KHÔNG xét (anh 15/10/2026: "gỡ cổng kiểm khung cho QC") — luật bố trí set / trục 180° là của phim truyện; QC duyệt keyframe bằng mắt.
  if (c.keyframe_url && !laQc) { const k = chanKhung({ keyframe_url: c.keyframe_url, kiem_khung: c.kiem_khung ?? null, soi_mat: c.soi_mat ?? null }); if (k) out.push(k); }
  // CÚ MÁY LIỀN MẠCH (luật khong_cat_giua_may): chuyển chủ thể / cung kết ở khung khác hẳn khung mở → phải có keyframe KẾT làm ảnh cuối, không thì model tự bịa chỗ dừng.
  const cm = c.ky_thuat?.chuyen_dong;
  if (c.keyframe_url && cm && CU_MAY_KHUNG_KET.includes(cm) && !c.keyframe_ket) out.push(`cú máy "${kyThuat(cm, 'chuyen_dong')?.ten ?? cm}" kết ở khung khác khung mở — cần keyframe KẾT trước khi sinh video (khung 3D có khung kết → chưa có nút trên studio: scripts/sinh-shot.mts --canh=<id> --keyframe-ket)`);
  const thieu = dongThoai(c, nhanVat).filter((d) => d.loi.trim() && !d.url);
  if (thieu.length) out.push(`${thieu.length} dòng thoại/lời dẫn chưa có giọng — sinh giọng trước (độ dài shot khớp theo giọng)`);
  // Quảng cáo: cử chỉ phải dồn vào sản phẩm + máy không đẩy cắt mất sản phẩm mặc trên người (san-pham-shot.ts) — chặn trước khi tiêu tiền clip.
  if (laQc) out.push(...loiSanPhamShot(c, nhanVat));
  // Cận cảnh + động tác lớn → méo thân (qc-cam-xuc.ts) — mọi QC.
  if (laQc) { const cc = loiCanCanhDongLon(c); if (cc) out.push(cc); }
  // Luật prompt học từ clip hỏng (tu-sua-clip-do.ts: nhặt vật, đứng dậy từ ngồi xổm, mở cạp/khoá, từ nhạy cảm) — mọi QC, chặn trước khi tiêu tiền clip.
  if (laQc) for (const l of lintPrompt(cauVideo(c))) out.push(`prompt video: ${l.vi} — ${l.en}`);
  if (o?.camXucQc) { const trai = loiCauTraiBieuCam(cauVideo(c), c.bieu_cam); if (trai) out.push(trai); }
  // Murch QC: keyframe phải SOÁT ĐẠT (Claude trong phiên, scripts/soat-cam-xuc.mts) — trừ shot nối liền (khung đầu = khung cuối clip trước đã soát).
  if (o?.camXucQc && c.keyframe_url && !c.noi_lien) { const k = soatKeyframe(c); if (!k) out.push('keyframe chưa soát (số người · người lạ · mặt · sản phẩm · hành động · nét mặt) — soát rồi mới sinh video'); else if (!k.dat) out.push(`keyframe soát trượt: ${k.loi.join(' · ')}`); }
  return out;
}

/** Tên mục người xem trên thanh 🎬 — cùng kết luận với bảng người xem (nguoi-xem.ts › tomTatNguoiXem): điểm cả tập, hay n cảnh kiểm riêng + khoảng điểm. */
function tenNguoiXem(tap: TapQt, phim: PhimQt, canh: ShotXem[]): string {
  const k = tomTatNguoiXem(tap.thu_nguoi_xem, canh);
  if (k.theoCanh) return `Người xem hiểu · ${k.soCanh} cảnh kiểm riêng${k.diem ? ` ${k.diem[0]}–${k.diem[1]}/10` : ''}`;
  if (tap.thu_nguoi_xem?.ma && k.diem) return `Người xem hiểu ${k.diem[0]}/10`;
  return phim.laQc ? 'Người xem hiểu QC' : 'Người xem hiểu phim';
}
/** Bảng quy trình cả tập — thanh 🎬 trên studio. canh = shot nhánh dựng (thân + hook A). */
export function quyTrinh(o: { tap: TapQt; phim: PhimQt; canh: ShotQt[]; nhanVat: NhanVat[]; canhA?: ShotQt[] }): MucQt[] {
  const { tap, phim, canh, nhanVat } = o;
  const sinh = canh.filter(canSinh);
  const theoShot = (f: (c: ShotQt) => string | string[] | null, ds = canh) => ds.flatMap((c) => { const r = f(c); const a = Array.isArray(r) ? r : r ? [r] : []; return a.map((x) => `#${c.thu_tu}: ${x}`); });
  const tk = chanTienKy(tap, phim, canh, o.canhA ?? canh, nhanVat.filter((v) => v.loai === 'boi_canh').map((v) => v.id));
  const kb = chamTap(tap, phim, canh);
  const m = (key: string, nhom: NhomQt, ten: string, thieu: string[], cong: Cong | null, lam: string): MucQt => ({ key, nhom, ten, ok: !thieu.length, thieu, cong, lam });
  const coGiong = canh.some((c) => dongThoai(c, nhanVat).some((d) => d.loi.trim()));
  const cat = Math.max(0, canh.length - 1);
  const coSfx = canh.slice(1).filter((c) => (c.ky_thuat?.am_thanh ?? []).length).length;
  const coCc = canh.slice(0, -1).filter((c) => c.ky_thuat?.chuyen_canh).length;
  return [
    m('brief', 'Tiền kỳ', 'Brief', tk.filter((x) => x.startsWith('chưa có brief')), 'keyframe', 'Ô Brief của tập: mục tiêu, người xem, thông điệp chính.'),
    m('truyen', 'Tiền kỳ', 'Khung truyện (beat)', tk.filter((x) => x.includes('khung truyện')), 'keyframe', '✂ Tách cảnh (hoặc nạp kèm beats): mở – xung đột – cao trào – giải quyết.'),
    m('kich_ban', 'Tiền kỳ', `Kịch bản ${kb.diem}/100`, kb.muc.filter((x) => !x.dat).map((x) => `${x.ten}: ${x.ghi}`), phim.series?.dong_co?.trim() ? 'keyframe' : null, (phim.the_loai === 'phim_doc' ? 'Phim ngắn dọc: tập 60–120s · móc 3s giữa xung đột · khung móc → sỉ nhục → nút 1 → nút 2 → đánh mặt → cliffhanger · không đoạn nào > 30s không có nút · có khoảnh khắc cảm xúc mạnh · MỌI tập (trừ tập cuối) kết bằng cliffhanger. ' : '') + 'Logline một câu · hook ≤ 3s · đủ 5 nhịp (hook → vấn đề → leo thang → lật ngược → kết/móc) · lật ngược ở 55–92% phim · series: kết bằng móc.'),
    m('nguoi_xem', 'Tiền kỳ', tenNguoiXem(tap, phim, (o.canhA ?? canh).map((c, i) => ({ ...c, thu_tu: c.thu_tu ?? i + 1, hanh_dong: c.hanh_dong ?? '' }))), tk.filter((x) => x.startsWith(TIEN_TO_NGUOI_XEM)), 'keyframe', `${TEN_NUT_NGUOI_XEM}` + (phim.laQc
      ? ': Claude đóng vai người lướt thuộc đúng đối tượng QC, chỉ thấy chữ/lời/hình từng shot — chấm dừng lướt, nhận ra sản phẩm, lợi ích, ưu đãi; phải ≥7/10 và đúng ý QC.'
      : ': Claude chỉ thấy chữ/lời/hình của từng shot, kể lại câu chuyện; phải hiểu ≥7/10 và đúng ý tác giả.')),
    ...(phim.laQc ? [m('tham_khao', 'Tiền kỳ', 'Tham khảo câu chữ', tk.filter((x) => x.startsWith(TIEN_TO_THAM_KHAO)).map((x) => x.slice(TIEN_TO_THAM_KHAO.length)), 'keyframe', 'Mỗi câu chữ màn / lời có nguồn: lời khách thật hoặc QC đang thắng (skill viet-qc-truc-dien). Xem ở panel shot › THAM KHẢO CÂU CHỮ.')] : []),
    m('phan_canh', 'Tiền kỳ', 'Phân cảnh', [...tk.filter((x) => x.includes('phân cảnh') || x.startsWith(TIEN_TO_DUNG_TRUYEN)), ...theoShot((c) => thieuPhanCanh(tap.phan_canh, c))].filter((x, i, a) => a.indexOf(x) === i), 'keyframe', 'Mỗi phân cảnh: mục tiêu nhân vật, xung đột, cảm xúc đổi đầu→cuối; mỗi shot thuộc một phân cảnh.'),
    m('phong_cach', 'Tiền kỳ', 'Phong cách hình', tk.filter((x) => x.includes('phong cách')), 'keyframe', 'Mục 1 Kinh thánh: ánh sáng, bảng màu, chất liệu, ống kính chủ đạo.'),
    m('mau_doi_tuong', 'Tiền kỳ', 'Mẫu nhân vật / sản phẩm', [...nhanVat.filter((v) => v.loai !== 'boi_canh' && v.loai !== 'phong_cach' && (!v.mo_ta.trim() || !v.anh_ref.length)).map((v) => `${v.ten}: ${!v.mo_ta.trim() ? 'chưa tả' : 'chưa có ảnh mẫu'}`), ...theoShot((c) => thieuMau(c, nhanVat).filter((x) => x.includes('có trong prompt')), sinh)], 'keyframe', 'Mục 2: tả đặc tính cố định + sinh ảnh mẫu; shot nhắc tên thì gắn mẫu.'),
    m('mau_boi_canh', 'Tiền kỳ', 'Mẫu bối cảnh', [...nhanVat.filter((v) => v.loai === 'boi_canh' && !v.anh_ref.length).map((v) => `${v.ten}: chưa có ảnh mẫu`), ...theoShot((c) => thieuMau(c, nhanVat).filter((x) => !x.includes('có trong prompt')), sinh)], 'keyframe', 'Mục 2: mỗi nơi chốn lặp lại một anchor Bối cảnh có ảnh mẫu; gắn vào shot.'),
    m('shot_list', 'Tiền kỳ', 'Shot list + nhịp hình', [...theoShot((c) => (c.ky_thuat?.co_canh ? null : 'chưa chọn cỡ cảnh'), sinh), ...tk.filter((x) => x.startsWith(TIEN_TO_NHIP_HINH)).map((x) => x.slice(TIEN_TO_NHIP_HINH.length))], 'keyframe', 'Mỗi shot: cỡ cảnh + chuyển động máy; shot liền nhau không trùng cả hai, tối đa 40% shot máy đứng yên. Sửa nhanh: 🎥 Đa dạng chuyển động máy (0đ).'),
    m('keyframe', 'Sản xuất', 'Storyboard (keyframe đã duyệt)', theoShot((c) => (!c.keyframe_url ? 'chưa có keyframe' : c.trang_thai === 'co_keyframe' || c.trang_thai === 'nhap' ? 'chưa duyệt' : null)), 'video', 'Sinh keyframe, xem từng ảnh, ✓ duyệt (hoặc sinh lại).'),
    m('giong', 'Sản xuất', 'Giọng trước video', coGiong ? theoShot((c) => { const n = dongThoai(c, nhanVat).filter((d) => d.loi.trim() && !d.url).length; return n ? `${n} dòng chưa có giọng` : null; }) : [], 'video', 'Sinh giọng cho lời dẫn/thoại TRƯỚC khi sinh clip; giây phát của shot khớp theo giọng.'),
    m('tieng', 'Hậu kỳ', 'Tiếng nghe rõ (máy kiểm)', kiemTieng(canh, nhanVat), 'xuat', 'Máy đo từng câu: không bị cắt khi sang shot, không đè nhau, không đọc quá nhanh, shot đủ dài cho hình diễn. Sinh giọng xong máy tự khớp; còn lỗi thì ⏱ khớp giây theo giọng.'),
    m('nhac', 'Hậu kỳ', 'Nhạc nền', tap.nhac_url || Object.keys(tap.nhac_phan_canh ?? {}).length ? [] : ['tập chưa có nhạc nền'], 'xuat', 'Làn 🎵 Nhạc: sinh một bài cả tập hoặc theo phân cảnh; rồi 🎯 khớp nhịp.'),
    m('sfx', 'Hậu kỳ', 'Tiếng hiệu ứng', cat && coSfx * 2 < cat ? [`${coSfx}/${cat} điểm cắt có tiếng hiệu ứng`] : [], null, 'Nhóm Âm thanh của shot (đập, vút, dâng…) hoặc ⚡ Nhịp hành động.'),
    m('chuyen_canh', 'Hậu kỳ', 'Chuyển cảnh', cat && coCc * 3 < cat ? [`${coCc}/${cat} điểm cắt có chuyển cảnh`] : [], null, 'Bấm ⇄ ở điểm nối trên làn Hình.'),
    m('logo', 'Hậu kỳ', 'Logo + CTA', phim.laQc ? [...(phim.logo_url ? [] : ['chưa có logo']), ...(canh.length && canh[canh.length - 1]!.chu_man.trim() ? [] : ['shot cuối chưa có chữ CTA'])] : [], null, 'Mục 0: logo PNG nền trong; shot cuối có chữ kêu gọi.'),
  ];
}
