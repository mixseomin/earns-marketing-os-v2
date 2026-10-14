// HỒ SƠ TIỀN KỲ VIẾT TAY → studio (14/10/2026). Một file JSON hồ sơ (scripts/du-lieu/<phim>-tap<n>.json) → ba đầu ra:
//   <ra>.nap.json — tệp nạp shot (đúng dạng kết quả ✂ Tách cảnh) cho scripts/nap-canh.mts --thay: shot + phân cảnh + ho_so của tập
//   <ra>.md       — chữ KỊCH BẢN thuần (screenplay) cho ô Kịch bản của tập
//   <ra>.html     — trang 7 tài liệu (ho-so.ts › hoSoHtml — CÙNG bộ dựng với tab Hồ sơ của studio)
// Cổng: ho-so.ts › kiemHoSo (mã thư viện, nhịp đọc, nhịp hình, vai kể, thẻ shot) + tên anchor theo danh sách anchor của phim. Sai là dừng.
// 0đ, không gọi model:  node_modules/.bin/tsx apps/xuong-video/scripts/kich-ban-the.mts <kb.json> <ra (không đuôi)>
import { readFileSync, writeFileSync } from 'node:fs';
import { hoSoHtml, hoSoKichBan, kiemHoSo, type HoSoVao } from '../src/lib/xuong-video/ho-so';
import { lamTronClip, type PhanCanh, type DongKichBan } from '../src/lib/xuong-video/kieu';

type May = { goc: string; chuyen_dong: string; ong_kinh: string; chuyen_canh: string; mo_ta: string };
type Shot = { may: May; vai: string; co: string; giay: number; luat: string[]; thay: string; thay_en: string; am_en: string; bo_cuc: string; mo: string; ket: string; huong: string; muc_dich: string; motif: string;
  anchor: string[]; thoai: { nhan_vat: string; dien_xuat: string; loi: string }[]; cam_xuc: number };
type Canh = { so: number; ten: string; beat: string; noi: string; luc: string; doi: string; xoay: string; shot: Shot[]; kich_ban: DongKichBan[];
  dao_dien: { muc_tieu: string; xung_dot: string; nhip: string[] }; boc_tach: { hieu_ung: string[] }; mau: { anh_sang: string; mau: string; mo_ta: string }; nhac: string };
type Kb = { ten: string; tap: number; phim: string; khong_loi?: boolean; chu_man_mo?: string; thoi_gian: string; duong_di: string; motif: string; cung: string; canh: Canh[]; anchor_phim: Record<string, string[]> };

const [vao, ra] = process.argv.slice(2);
if (!vao || !ra) { console.error('cần <kb.json> <ra (không đuôi)>'); process.exit(1); }
const kb = JSON.parse(readFileSync(vao, 'utf8')) as Kb;

// id tạm cho anchor (trang duyệt cần loại anchor; tệp nạp ghi TÊN, máy chủ nối về id thật)
const anchor = Object.entries(kb.anchor_phim).flatMap(([loai, ds]) => ds.map((ten) => ({ ten, loai })));
const idCua = new Map(anchor.map((a, i) => [a.ten, i + 1]));
const loi: string[] = [];
const phanCanh: PhanCanh[] = kb.canh.map((c) => ({ ten: c.ten, beat: c.beat, muc_tieu: c.dao_dien.muc_tieu, xung_dot: c.dao_dien.xung_dot, an_y: '', nhip: 'vua',
  cam_xuc_dau: c.shot[0]?.cam_xuc ?? 0, cam_xuc_cuoi: c.shot[c.shot.length - 1]?.cam_xuc ?? 0, noi: c.noi, luc: c.luc, gia_tri_doi: c.doi, diem_xoay: c.xoay, nhip_hd: c.dao_dien.nhip,
  hieu_ung: c.boc_tach.hieu_ung, anh_sang: c.mau.anh_sang, mau: c.mau.mau, mau_mo_ta: c.mau.mo_ta, nhac: c.nhac, kich_ban: c.kich_ban }));
let so = 0;
const shots = kb.canh.flatMap((c) => c.shot.map((s) => {
  so++;
  for (const t of s.anchor) if (!idCua.has(t)) loi.push(`shot ${so}: "${t}" không phải anchor của phim`);
  return {
    thu_tu: so, phan_doan: c.ten, canh: `Cảnh ${c.so} · ${c.ten}`, goc_may: s.may.mo_ta, hanh_dong: s.thay, prompt_anh: s.mo, prompt_video: s.thay_en, am_thanh: s.am_en,
    loi_thoai: '', thoai: s.thoai, phat_s: s.giay, thoi_luong_s: lamTronClip(s.giay), cam_xuc: s.cam_xuc, nhanh: '', trang_phuc: '', bien_the: [] as string[],
    chu_man: so === 1 ? kb.chu_man_mo ?? '' : '', nhan_vat_ten: s.anchor, nhan_vat: s.anchor.map((t) => idCua.get(t) ?? 0),
    ky_thuat: { vai: s.vai, co_canh: s.co, goc: s.may.goc, chuyen_dong: s.may.chuyen_dong, ong_kinh: s.may.ong_kinh, chuyen_canh: s.may.chuyen_canh, anh_sang: c.mau.anh_sang, mau: c.mau.mau, nhac: c.nhac, luat: s.luat },
    dan_dung: { bo_cuc: s.bo_cuc, mo: s.mo, ket: s.ket, huong: s.huong, muc_dich: s.muc_dich, motif: s.motif },
  };
}));
const hs: HoSoVao = { phim: kb.phim, ten: kb.ten, so: kb.tap, khong_loi: kb.khong_loi, ho_so: { thoi_gian: kb.thoi_gian, duong_di: kb.duong_di, motif: kb.motif, cung: kb.cung }, phan_canh: phanCanh, canh: shots, nhanVat: anchor.map((a) => ({ id: idCua.get(a.ten)!, ten: a.ten, loai: a.loai })) };
loi.push(...kiemHoSo(hs));
if (loi.length) { console.error(loi.join('\n')); process.exit(1); }

const tong = shots.reduce((a, s) => a + s.phat_s, 0);
writeFileSync(`${ra}.nap.json`, JSON.stringify({ tomTat: `${kb.ten}: ${kb.cung}`, beats: [...new Map(kb.canh.map((c) => [c.beat, { ten: c.beat, mo_ta: c.doi, cam_xuc: c.shot[c.shot.length - 1]?.cam_xuc ?? 0 }])).values()], phanCanh, ho_so: hs.ho_so,
  canh: shots.map(({ nhan_vat_ten, nhan_vat: _id, thu_tu: _t, ...s }) => ({ ...s, nhan_vat: nhan_vat_ten })) }, null, 2));
writeFileSync(`${ra}.md`, hoSoKichBan(hs));
writeFileSync(`${ra}.html`, hoSoHtml(hs));
console.log(`${kb.canh.length} cảnh · ${shots.length} shot · ${tong}s · đã ghi ${ra}.nap.json / .md / .html`);
