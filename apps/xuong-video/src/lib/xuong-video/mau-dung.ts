// BỘ DỰNG theo mẫu máy (may-dung-mau.ts khai tên) — THUẦN (client + máy chủ cùng đọc): mỗi mẫu = vẽ ASS + lệnh ffmpeg + 3 shot kịch bản.
// Thêm kiểu video máy mới = viết một tệp may-dung-<kiểu>.ts rồi thêm một dòng ở đây; may-dung.ts (dựng), may.ts (máy → video), may-ui.tsx (màn) không đổi.
// LUẬT ĐỌC (anh 17/10/2026): nhịp + thời lượng của mẫu TÍNH THEO ĐỀ bằng may-dung-ass.ts › giayDoc (mỗi khối chữ đứng đủ thời gian đọc + 1,5s đệm
// rồi mới chuyển); test của mẫu phải kiểm điều đó (xem may-dung-scam.test.mts / may-dung-land.test.mts). Không đặt mốc giây cứng cho khối có chữ.
import { assMotDung, kichBanMotDung, lenhMotDung, DAI as DAI_DO_CHU, T_DEM as T_DEM_DC, DEM as DEM_DC, T_LO as T_LO_DC, type DeMotDung } from './may-dung-do-chu';
import { anhScam, assScam, kichBanScam, lenhScam, nhipScam, tuNguonScam, type DeScam } from './may-dung-scam';
import { anhLand, assLand, kichBanLand, lenhLand, nhipLand, tuNguonLand, type DeLand } from './may-dung-land';
import { anhThi, assThi, kichBanThi, lenhThi, nhipThi, truyVanThi, tuNguonThi, type DeThi } from './may-dung-thi';
import { anhCanh, assCanh, kichBanCanh, lenhCanh, nhipCanh, truyVanCanh, type DeCanh } from './may-dung-canh';
import { anhAnh, assAnh, kichBanAnh, lenhAnh, truyVanBaiAnh, type DeAnh } from './may-dung-anh';
import { anhTop, assTop, kichBanTop, lenhTop, nhipTop, truyVanThemTop, truyVanTop, type DeTop } from './may-dung-top';
import { anhLat, assLat, kichBanLat, lenhLat, nhipLat, truyVanLat, truyVanThemLat, type DeLat } from './may-dung-lat';
import { anhSoSanh, assSoSanh, kichBanSoSanh, lenhSoSanh, nhipSoSanh, truyVanSoSanh, truyVanThemSoSanh, type DeSoSanh } from './may-dung-so-sanh';
import { anhCauNoi, assCauNoi, kichBanCauNoi, lenhCauNoi, nhipCauNoi, truyVanCauNoi, type DeCauNoi } from './may-dung-cau-noi';
import { anhGia, assGia, kichBanGia, lenhGia, nhipGia, truyVanGia, type DeGia } from './may-dung-gia';
import { anhLacLoai, assLacLoai, kichBanLacLoai, lenhLacLoai, nhipLacLoai, truyVanLacLoai, type DeLacLoai } from './may-dung-lac-loai';
import type { MauMayDung } from './may-dung-mau';

export type DeMay = DeMotDung | DeScam | DeLand | DeThi | DeCanh | DeAnh | DeTop | DeLat | DeSoSanh | DeCauNoi | DeGia | DeLacLoai | DePoll;
/** Đề bình chọn (X poll): không tệp. loai 'binh-chon' để xuatVideo / Phòng Nội dung nhận ra. */
export interface DePoll { loai: 'binh-chon'; cau_hoi: string; lua: string[]; ngay?: number }
export type ShotMau = { tu: number; den: number; canh: string; hanh_dong: string };
type LenhVao = { de: DeMay; ass: string; nen: string | null; /** ảnh nền THÊM (mẫu nhiều cảnh — nen_them) */ nenThem?: string[]; /** tệp tiếng nền thu thật (mẫu nenVideo / amThat) */ am?: string | null; fontsDir: string; ra: string; khung?: number };
/** tuNguon: một dòng tệp nguồn đề của mẫu → dòng nạp máy { slug, chu_de, de, dang } (may-dung.mts --nap-nguon). */
type BoDung = { ass: (de: DeMay) => string; lenh: (o: LenhVao) => string[]; shots: (de: DeMay) => ShotMau[]; /** thời lượng theo đề (luật đọc: nhịp tính theo chữ) */ dai: (de: DeMay) => number; /** ảnh tĩnh cắt từ video cho bài ảnh (nền x_anh): giây + khung cắt [x, y, w, h] */ anh?: (de: DeMay) => { t: number; cat: [number, number, number, number] }[]; tuNguon?: (x: never) => { slug: string; chu_de: string; de: DeMay; dang: Record<string, string> }; /** truy vấn ảnh nền Pexels khi video chưa có nen_url (anh-nen.ts) — mặc định chu_de */ truyVanAnh?: (de: DeMay, chuDe: string) => string; /** nền là VIDEO Pexels (anh-nen.ts › timVideoNen) thay vì ảnh */ nenVideo?: boolean; /** mẫu CHỈ RA ẢNH (bài ảnh): không dựng MP4, `anh` là bản xuất, video_url NULL */ chiAnh?: boolean; /** mẫu nhiều cảnh: từ khoá ảnh thêm cho từng mục (may.ts lấy Pexels → nen_them) */ truyVanThem?: (de: DeMay) => string[]; /** mẫu ảnh tĩnh vẫn ghép tiếng nền thu thật (am-nen.ts) */ amThat?: boolean };

export const BO_DUNG: Record<MauMayDung, BoDung> = {
  'do-chu-mot-dung': { ass: (de) => assMotDung(de as DeMotDung), lenh: (o) => lenhMotDung({ ...o, de: o.de as DeMotDung }), shots: (de) => kichBanMotDung(de as DeMotDung).shots, dai: () => DAI_DO_CHU, truyVanAnh: (_de, chuDe) => `${chuDe} cozy`,
    // ảnh tĩnh cho bài album Page (S06 đan xen format, 25/10/2026): khung giữa lúc đếm (chưa lộ) + khung sau khi lộ đáp án, cắt 3:4 giữa khung dọc
    anh: () => [{ t: T_DEM_DC + DEM_DC * 0.5, cat: [0, 120, 1080, 1440] }, { t: T_LO_DC + 1.4, cat: [0, 120, 1080, 1440] }] },
  'scam-or-real': { ass: (de) => assScam(de as DeScam), lenh: (o) => lenhScam({ ...o, de: o.de as DeScam }), shots: (de) => kichBanScam(de as DeScam).shots, dai: (de) => nhipScam(de as DeScam).DAI, anh: (de) => anhScam(de as DeScam), tuNguon: tuNguonScam as never },
  'before-you-land': { ass: (de) => assLand(de as DeLand), lenh: (o) => lenhLand({ ...o, de: o.de as DeLand }), shots: (de) => kichBanLand(de as DeLand).shots, dai: (de) => nhipLand(de as DeLand).DAI, anh: (de) => anhLand(de as DeLand), tuNguon: tuNguonLand as never },
  'canh-dong': { ass: (de) => assCanh(de as DeCanh), lenh: (o) => lenhCanh({ ...o, de: o.de as DeCanh }), shots: (de) => kichBanCanh(de as DeCanh).shots, dai: (de) => nhipCanh(de as DeCanh).DAI, anh: (de) => anhCanh(de as DeCanh), truyVanAnh: (de) => truyVanCanh(de as DeCanh), nenVideo: true },
  'bai-anh': { ass: (de) => assAnh(de as DeAnh), lenh: (o) => lenhAnh({ ...o, de: o.de as DeAnh }), shots: (de) => kichBanAnh(de as DeAnh).shots, dai: () => 2, anh: (de) => anhAnh(de as DeAnh), truyVanAnh: (de) => truyVanBaiAnh(de as DeAnh), chiAnh: true },
  'top-n': { ass: (de) => assTop(de as DeTop), lenh: (o) => lenhTop({ ...o, de: o.de as DeTop }), shots: (de) => kichBanTop(de as DeTop).shots, dai: (de) => nhipTop(de as DeTop).DAI, anh: (de) => anhTop(de as DeTop), truyVanAnh: (de) => truyVanTop(de as DeTop), truyVanThem: (de) => truyVanThemTop(de as DeTop), amThat: true },
  'binh-chon': { ass: () => '', lenh: () => { throw new Error('bình chọn không dựng tệp (xuatVideo chốt bản trực tiếp)'); }, shots: (de) => [{ tu: 0, den: 0, canh: 'Poll', hanh_dong: `${(de as DePoll).cau_hoi} — ${(de as DePoll).lua.join(' / ')}` }], dai: () => 0 },
  'lac-loai': { ass: (de) => assLacLoai(de as DeLacLoai), lenh: (o) => lenhLacLoai({ ...o, de: o.de as DeLacLoai }), shots: (de) => kichBanLacLoai(de as DeLacLoai).shots, dai: (de) => nhipLacLoai(de as DeLacLoai).DAI, anh: (de) => anhLacLoai(de as DeLacLoai), truyVanAnh: (de) => truyVanLacLoai(de as DeLacLoai), amThat: true },
  'cai-nao-gia': { ass: (de) => assGia(de as DeGia), lenh: (o) => lenhGia({ ...o, de: o.de as DeGia }), shots: (de) => kichBanGia(de as DeGia).shots, dai: (de) => nhipGia(de as DeGia).DAI, anh: (de) => anhGia(de as DeGia), truyVanAnh: (de) => truyVanGia(de as DeGia), amThat: true },
  'cau-noi': { ass: (de) => assCauNoi(de as DeCauNoi), lenh: (o) => lenhCauNoi({ ...o, de: o.de as DeCauNoi }), shots: (de) => kichBanCauNoi(de as DeCauNoi).shots, dai: (de) => nhipCauNoi(de as DeCauNoi).DAI, anh: (de) => anhCauNoi(de as DeCauNoi), truyVanAnh: (de) => truyVanCauNoi(de as DeCauNoi), amThat: true },
  'so-sanh': { ass: (de) => assSoSanh(de as DeSoSanh), lenh: (o) => lenhSoSanh({ ...o, de: o.de as DeSoSanh }), shots: (de) => kichBanSoSanh(de as DeSoSanh).shots, dai: (de) => nhipSoSanh(de as DeSoSanh).DAI, anh: (de) => anhSoSanh(de as DeSoSanh), truyVanAnh: (de) => truyVanSoSanh(de as DeSoSanh), truyVanThem: (de) => truyVanThemSoSanh(de as DeSoSanh), amThat: true },
  'lat-dap-an': { ass: (de) => assLat(de as DeLat), lenh: (o) => lenhLat({ ...o, de: o.de as DeLat }), shots: (de) => kichBanLat(de as DeLat).shots, dai: (de) => nhipLat(de as DeLat).DAI, anh: (de) => anhLat(de as DeLat), truyVanAnh: (de) => truyVanLat(de as DeLat), truyVanThem: (de) => truyVanThemLat(de as DeLat), amThat: true },
  'cau-hoi-thi': { ass: (de) => assThi(de as DeThi), lenh: (o) => lenhThi({ ...o, de: o.de as DeThi }), shots: (de) => kichBanThi(de as DeThi).shots, dai: (de) => nhipThi(de as DeThi).DAI, anh: (de) => anhThi(de as DeThi), truyVanAnh: (de) => truyVanThi(de as DeThi), tuNguon: tuNguonThi as never },
};
/** 3 shot kịch bản của một video theo mẫu của máy (tab Mẫu, ngăn video). */
/** Truy vấn ảnh nền thật cho video chưa có nen_url (xuatVideo → anh-nen.ts). */
export const truyVanAnhMau = (mau: MauMayDung, de: DeMay, chuDe: string): string => (BO_DUNG[mau]?.truyVanAnh ?? ((_d: DeMay, c: string) => c))(de, chuDe);
export const shotsMau = (mau: MauMayDung, de: DeMay): ShotMau[] => (BO_DUNG[mau] ?? BO_DUNG['do-chu-mot-dung']).shots(de);
