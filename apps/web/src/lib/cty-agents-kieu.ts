// KIỂU DỮ LIỆU của cổng /api/agents bên cty (repo cty src/lib/agents.ts) — tệp thường, máy chủ lẫn trình duyệt cùng import.
// Hai repo tách nhau nên khai lại ở đây; cty đổi hình dữ liệu thì sửa cùng lượt (tên trường giữ y như phía cty).
export type DapCty<T> = { ok: true; admin: boolean; luc: string; du: T } | { ok: false; loi: string };
export type Lich = { kieu: 'moi'; phut: number } | { kieu: 'luc'; gio: string[]; thu: number[] };
export type TT = { kieu: 'lam' | 'ranh' | 'tat' | 'chua'; viec?: string; tu?: string; phut?: number; them?: number; xong?: string; vua?: { luc: string; ket: string } | null; ket: string[] };
export type Agent = {
  id: string; ten: string; phong: string; phongTen: string; chucDanh: string; vai: string; vaiMa: string; baoCaoCho: string | null;
  loai: 'cli' | 'cong' | 'api' | 'nguoi'; quaCong: boolean; model: string; modelSoul: string; modelTen: string;
  tt: TT; nhip: { bat: boolean; coNut: boolean; muc: string; chu: string; ca?: string; diemDanh?: string; kiemMoi?: number; tanSuat?: string; box?: boolean; soViecMay: number; soChay: number };
  chi: number | null; luot: number | null; tran: number | null;
};
export type SoAgents = { nhanSu: number; cli: number; api: number; nguoi: number; lam: number; ket: number; ranh: number; tat: number;
  viecMay: number; viecMayBat: number; viecMayLoi: number; chiThang: number | null; luotThang: number | null; thang: number; phienNay: number; usdPhienNay: number; goiPhienNay?: number | null };
export type ViecMay = { id: string; ten: string; ma: string; may: string; loai: string; nguoi: string | null; nguoiTen: string | null; phong: string | null; phongTen: string | null; chuaGan: boolean;
  lich: string; lichMo: Lich | null; lichLien: boolean; choAp: boolean; loiAp: string | null; apSau: string; cuoi: string | null; tiep: string | null; ket: string; maThoat: string | null; hong: boolean; bat: boolean; khoa: string | null };
export type ViecNen = { nhan: string; ten: string; may: string; nguoi: string | null; kieu: string; lich: string; lichMo: Lich | null; choAp: boolean; loiAp: string | null;
  tatSo: boolean; tatLyDo: string | null; ghiChu: string | null; cuoi: string | null; ket: string | null; dang: boolean; loi: boolean; tiep: string | null };
export type PhienDoi = { id: string; nguoi: string; batDau: string | null; giay: number | null; viec: string; ket: string | null; luotGoi: number; vao: number; ra: number; usd: number | null; goi?: number | null; model: string[] };
export type Khoang = { phien: number; vao: number; ra: number; usd: number; goi?: number; chuaTinh: number };
export type DuPhien = { tom: { homNay: Khoang; bayNgay: Khoang; tatCa: Khoang }; soKySu: number; ds: PhienDoi[]; hong: string[]; vndUsd: number };
export type SuKien = { ts: string; luot: string | null; loai: string; tu: string | null; toi: string | null; tom: string };
export type PhongSoDo = { id: string; ten: string; nguoi: { id: string; ten: string; chucDanh: string; vai: string; loai: string; kieu: TT['kieu']; ket: boolean; viec: string | null }[] };
export type LanChay = { viec: string; tu: string | null; xong: string | null; ma: number | null; dai: string; tom: string; dang: boolean; mat: boolean; giao: boolean };
export type HoSo = { agent: Agent; heartbeat: string; viecTuLam: { ma: string; ten: string; lich: string; gio: string | null }[]; viecMay: ViecMay[]; lan: LanChay[]; phien: PhienDoi[]; logsLoi: string | null };
/** lệnh ghi — cty chạy ĐÚNG server action của bảng nhân sự (src/lib/nhip-chinh.ts) */
export type LenhAgent =
  | { lenh: 'nhip'; id: string; bat: boolean }
  | { lenh: 'may'; muc: string; bat: boolean }
  | { lenh: 'model'; id: string; model: string }
  | { lenh: 'lich'; muc: string; lich: Lich }
  | { lenh: 'ca'; id: string; ca: string; diem_danh: string };
/** card góp ý kẹt (đọc thẳng DB mos2, lib/card-ket.ts) — cho là id kỹ sư đang được chờ (việc đã chuyển), ten là tên kỹ sư nói cuối */
export type CardKet = { id: number; hom: string; tieuDe: string; treo: boolean; cho: string[]; ten: string | null };
