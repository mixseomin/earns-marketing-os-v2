'use server';
import type { SoLieuQc } from '@/lib/xuong-video/nhom-phim';

// Xưởng video AI — server actions: phim (bộ) · anchor (nhân vật/sản phẩm/bối cảnh) · tập · cảnh (storyboard) · job (ảnh/video).
// Mạch: kịch bản → tachCanhTap (Claude) → sinhKeyframe (Gemini, ứng viên → chọn) → duyệt → sinhVideoCanh (Veo, async) → kiemVideo (poll).
// Admin-only. Mọi lần gọi model ghi xv_job kèm tiền (cents) để bảng tổng kết chi phí của phim không phải đoán.
import { khuonTheoKey, type ApKhuon } from '@/lib/xuong-video/khuon-chuoi';
import { lamSachKhanGia, type YDoKhanGia } from '@/lib/xuong-video/khan-gia';
import { napRef2v, guiRef2v, dsRef2v, type KetRef2v } from '@/lib/xuong-video/ref2v-chay';
import { tachShotDb, chenShotKhuonDb } from '@/lib/xuong-video/tach-shot';
import 'server-only';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { uploadToR2 } from '@/lib/r2';
import { dayViecAm, chayNen } from '@/lib/xuong-video/hoan-tat';
import { gopAm } from '@/lib/xuong-video/xuat-chay';
import { batDauXuatTap } from '@/lib/xuong-video/xuat-tap';
import { MO_HINH_AM, giaAm, moHinhAm, dongThoai, giaGiongTheo, timNv, giayNhac } from '@/lib/xuong-video/am-thanh';
import { locNhanh, giayPhat, laTiengViet, type ThuNguoiXem, type KiemKhung } from '@/lib/xuong-video/kieu';
import { sinhNhacTap } from '@/lib/xuong-video/sinh-nhac';
import { dsKho, luuShotVaoKho, dungTaiSan, boKhoiKho, luuKhuonQc, taoTapTuKhuon, apKieuChuThuongHieu } from '@/lib/xuong-video/kho';
import { dsMoHinhGiong, giongCua, dauVaoGiongTheoModel, type MoHinhGiong } from '@/lib/xuong-video/giong';
import { boVaoThungRac, boAnhVaoThungRac, dsRac, khoiPhucRac, type MucRac } from '@/lib/xuong-video/thung-rac';
import { batDauNangCap, danhMucFal, guiFal, type ModelFal } from '@/lib/xuong-video/fal';
import { type DungChu } from '@/lib/xuong-video/claude';
import { docTrangSanPham, doiChieuAnchor as doiChieuAnchorClaude } from '@/lib/xuong-video/claude';
import { kiemNguoiXemTap, kiemNguoiXemCanh, suaTheoNguoiXemTap } from '@/lib/xuong-video/kiem-nguoi-xem';
import { soiMatTap, duyetMatTay, suaMatCanh } from './xuong-video/soi-mat';
import { kiemKhungTap, duyetKhungTay } from '@/lib/xuong-video/kiem-khung';
import { chanKhung, TEN_NUT_KHUNG } from '@/lib/xuong-video/khung';
import { xuatLongTiengTap } from '@/lib/xuong-video/long-tieng';
import { lamSanNho } from '@/lib/xuong-video/anh-nho-may';
import { dichMoTaVi } from '@/lib/xuong-video/claude';
import { coKhoa, DON_SO_DU, LOAI_NGUON, TEN_TRANG_THAI, type SoDu, type Nguon, type NguonModel, type TrangThaiNguon, type LoaiNguon, type O } from '@/lib/xuong-video/nguon-ai';
import { vietKichBan, vietBaiDang, phanTichMau, goiYBienThe, goiYKinhThanh, goiYAnchor, goiYBoAnchor, goiYBrief, goiYCanh, goiYTuyenTruyen, vietThemTap } from '@/lib/xuong-video/claude';
import { themTapAi, type AiTuyenTruyen } from '@/lib/xuong-video/tuyen-truyen';
import { MAU_PHIM } from '@/lib/xuong-video/mau';
import { lamSachKyThuat, khoaKyThuatForm, promptKyThuatVideo } from '@/lib/xuong-video/dien-anh';
import { ghepThoai, thieuQc, type BaiDang, type MauQc } from '@/lib/xuong-video/kieu';
import { maAnimatic } from '@/lib/xuong-video/ho-so';
import type { BanXuat, BoSet, May3d } from '@/lib/xuong-video/kieu';
import { soLienMach, type SoLienMach as SoLienMachT } from '@/lib/xuong-video/so-lien-mach';
import { boSetCuaShot, lookMang, type LookMang } from '@/lib/xuong-video/bo-set-3d';
import type { PhanCanh } from '@/lib/xuong-video/kieu';
import { mapBoSet } from '@/lib/xuong-video/bo-set-3d-may';
import { chupTruoc, ganNhat, hoanTacGanNhat, type MucHoanTac } from '@/lib/xuong-video/hoan-tac';
import { apCtaPhim } from '@/lib/xuong-video/cta-db';
import { docPhimDich, uocDichCents, chayDichPhim } from '@/lib/xuong-video/dich-phim';
import { NGON_NGU, type LoaiTaiSan, type Lop, type TaiSan } from '@/lib/xuong-video/kieu';
import { type Row, n, s, arr, mangInt, nguCanhPhimDb, mapBienThe, mapNhanVat, mapTap, mapCanh, kemBienThe, boiCanhTap, boiCanhCanh, taoJob } from '@/lib/xuong-video/doc-db';
import { kgCua } from '@/lib/xuong-video/khong-gian';
import { bocTachKhung } from '@/lib/xuong-video/boc-tach-khung';
import { doiChieuKhung, thanhPhanDuKien, apDungSoBang, type MucDuKien } from '@/lib/xuong-video/doi-chieu-khung';
import type { BocTachCanh, BocTachKhung, DongDoiChieu } from '@/lib/xuong-video/kieu';
import { sinhAnhGoc, sinhKeyframeCanh, sinhPosterPhim, sinhAnhQcDb, sinhAnhBienTheDb } from '@/lib/xuong-video/sinh-anh';
import { phanRaTapDb, baoCaoChuanBiDb, type KqPhanRa, type BaoCaoPhim } from '@/lib/xuong-video/phan-ra';
import { songSong } from '@/lib/xuong-video/song-song';
import { khuonAnhQc, MO_HINH_ANH_QC, TI_LE_ANH_QC, type AnhQc } from '@/lib/xuong-video/anh-qc';
import { docGocSpy, xepGocSpy, nhomCuaGoc, type GocSpy } from '@/lib/xuong-video/goc-spy';
import { sanPhamPhim } from '@/lib/xuong-video/nhom-phim';
import { dongCreative, gomThanhPhan, type AnchorKho, type CreativeKho, type CumGoc, type DongCreative, type ShotKho, type ThanhPhan , type EtpCr } from '@/lib/xuong-video/kho-creative';
import { docOTemplate, chepPhim, type KetQuaChep, type ShotKhung } from '@/lib/xuong-video/template-db';
import { giaTriSanPhamDb } from '@/lib/xuong-video/concept-db';
import { diemNhan } from '@/lib/xuong-video/diem-nhan';
import { MO_HINH_CONG, coCong, centsCong, chuoiAnh, chuoiVideo, taNguon, taNguonNgan, taThu, type CongKey, type NguonSinh } from '@/lib/xuong-video/cong-ai';
import { oThieu, nhomCuaO, type OTemplateDs } from '@/lib/xuong-video/template';
import type { CauHinhTemplate } from '@/lib/xuong-video/kieu';
import type { MauPoster } from '@/lib/xuong-video/poster';
import { batDauVideoCanh, kiemVideoTap } from '@/lib/xuong-video/sinh-video';
import { nguonShot } from '@/lib/xuong-video/nguon-shot';
import { khopNhipTap, type KqKhopNhip } from '@/lib/xuong-video/khop-nhip';
import { khopGiongTap, daDangMayTapDb } from '@/lib/xuong-video/hau-ky';
import type { NguonShot } from '@/lib/xuong-video/phu-thuoc';
import { sinhGiongShots, MODEL_GIONG_MAC_DINH, type TuyGiong } from '@/lib/xuong-video/sinh-giong';
import { xongJob as xongJobDb, mapJob, jobDangCho, ghiTienChu } from '@/lib/xuong-video/doc-db';
export type { TuyGiong };
import { dsKhuon, ghiKhuonTuMau, type KhuonShot } from '@/lib/xuong-video/khuon-shot';
import { tachCanhTapDb } from '@/lib/xuong-video/tach-canh-tap';
import {
  docKinhThanh, giaAnhCents, giaVideoCents, MO_HINH_ANH, MO_HINH_VIDEO, NANG_CAP, KHOP_MIENG, NHOM_BIEN_THE,
  type Phim, type NhanVat, type Tap, type Canh, type Job, type KinhThanh, type LoaiPhim, type LoaiNhanVat, 
} from '@/lib/xuong-video/kieu';

export type Kq<T = undefined> = { ok: true; data: T } | { ok: false; loi: string };
/** Mảng số → literal mảng Postgres dạng chuỗi ('{1,2}'). Truyền mảng JS thẳng vào sql`` thì postgres-js gửi phần tử số thô
 *  và ném ERR_INVALID_ARG_TYPE ("Received type number (4)") — sinh keyframe hỏng 08/10/2026. */
/** Giá theo danh mục fal (động) nếu là model fal:, không thì bảng tĩnh. */

/** Danh mục model cho ô chọn: Google/OpenAI (cố định) + fal (động, ~100 model) kèm giá. */
export type MoHinhChon = { key: string; label: string; nhom: string; giaCents: number | null; donVi: 'giay' | 'anh' | 'clip' | 'khac'; giaText?: string; gia?: import('@/lib/xuong-video/gia-fal').GiaTom; chuoi?: string[] };
export async function dsMoHinh(): Promise<{ anh: MoHinhChon[]; video: MoHinhChon[] }> {
  if (!(await admin())) return { anh: [], video: [] };
  const fal: ModelFal[] = await danhMucFal().catch(() => []);
  const nhomFal = (id: string) => (id.split('/')[0] === 'fal-ai' ? id.split('/')[1] : id.split('/')[0]) ?? 'fal';
  // Cổng giá rẻ (cong-ai.ts): mỗi cổng một nhóm, giá = tiền THẬT; model Google trần = "tự chọn rẻ nhất" (chuỗi cổng → Google), giá = bậc rẻ nhất
  // của chuỗi; thêm 'google:<model>' = Google trực tiếp (bỏ qua cổng). 15/10/2026 — anh: "cùng 1 shot có thể tạo từ nhiều model, nhà cung cấp".
  const cong = MO_HINH_CONG.filter((m) => coCong(m.key.split(':')[0] as CongKey));
  const congAnh = cong.filter((m) => m.donVi === 'anh'), congVideo = cong.filter((m) => m.donVi === 'clip');
  const giaChuoiAnh = (k: string) => { const c = chuoiAnh(k)[0]; const m = c && MO_HINH_CONG.find((x) => x.key === `${c.cong}:${c.model}`); return m ? centsCong(m.vnd) : null; };
  const giaChuoiVideo = (k: string) => { const c = chuoiVideo(k, false)[0]; const m = c && MO_HINH_CONG.find((x) => x.key === `${c.cong}:${c.model}`); return m ? centsCong(m.vnd) : null; };
  return {
    anh: [
      ...MO_HINH_ANH.flatMap((m) => {
        const re = !m.key.startsWith('gpt') ? giaChuoiAnh(m.key) : null;
        const goc = { key: m.key, label: m.label.split(' (')[0]!, nhom: m.key.startsWith('gpt') ? 'OpenAI' : 'Google', giaCents: m.gia1k, donVi: 'anh' as const };
        return re == null ? [goc] : [{ ...goc, label: `${goc.label} · tự chọn rẻ nhất (ckey → ShopAIKey → Google)`, nhom: 'Tự chọn nguồn', giaCents: re }, { ...goc, key: `google:${m.key}`, nhom: 'Google (trực tiếp)' }];
      }),
      ...congAnh.map((m) => ({ key: m.key, label: m.label, nhom: m.nhom, giaCents: centsCong(m.vnd), donVi: 'anh' as const })),
      ...fal.filter((m) => m.loai === 'anh').map((m) => ({ key: `fal:${m.id}`, label: m.ten, nhom: `fal · ${nhomFal(m.id)}`, giaCents: m.giaCents, donVi: m.donVi, giaText: m.giaText, gia: m.gia })),
    ],
    video: [
      ...MO_HINH_VIDEO.filter((m) => !m.key.startsWith('fal:')).flatMap((m) => {
        const re = giaChuoiVideo(m.key);
        const goc = { key: m.key, label: m.label.split(' (')[0]!, nhom: 'Google', giaCents: m.giaGiay['720p'], donVi: 'giay' as const };
        return re == null ? [goc] : [{ ...goc, label: `${goc.label} · tự chọn rẻ nhất (Grok/ShopAIKey → Google)`, nhom: 'Tự chọn nguồn', giaCents: re, donVi: 'clip' as const, chuoi: chuoiVideo(m.key, false).map((c) => `${c.cong}:${c.model}`) }, { ...goc, key: `google:${m.key}`, nhom: 'Google (trực tiếp)' }];
      }),
      ...congVideo.map((m) => ({ key: m.key, label: m.label, nhom: m.nhom, giaCents: centsCong(m.vnd), donVi: 'clip' as const })),
      ...fal.filter((m) => m.loai === 'video').map((m) => ({ key: `fal:${m.id}`, label: m.ten, nhom: `fal · ${nhomFal(m.id)}`, giaCents: m.giaCents, donVi: m.donVi, giaText: m.giaText, gia: m.gia })),
    ],
  };
}

const loi = (m: string): { ok: false; loi: string } => ({ ok: false, loi: m });

async function admin() {
  const me = await getCurrentUser();
  return me && me.role === 'admin' ? me : null;
}
/** Email người đang sửa (ghi vào sổ hoàn tác) — gọi sau khi đã qua admin(). */
const ai = async () => (await admin())?.email ?? '';

// ── Đọc ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const KHO = 'studio';   // xv_phim.project khi tạo mới. Danh sách hiện MỌI phim (kể cả phim tạo lúc còn nằm trong mos2, project='bra') — app riêng = một kho.

/** Lưu trữ / bỏ lưu trữ một phim (ẩn khỏi danh sách mặc định, không xoá gì). */
export async function luuTruPhim(id: number, bat: boolean): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{luu_tru}', ${JSON.stringify(bat)}::jsonb), updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}
// ── Template (template.ts · template-db.ts) ───────────────────────────────────────────────────────────────────────

/** Ô của một template (dò trong mọi chữ của phim) + cấu hình nhãn/gợi ý. */
export async function docTemplate(phimId: number): Promise<Kq<{ cfg: CauHinhTemplate | null; o: OTemplateDs[]; khung: ShotKhung[]; phimDung: { id: number; ten: string; luu_tru: boolean }[] }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = await docOTemplate(db, phimId);
  if (!r) return loi('không thấy phim');
  // Phim đang dùng template này (tạo từ nó) — mới nhất trước; phim đã lưu trữ vẫn hiện, gạch mờ.
  const dung = (await db.execute(sql`SELECT id, ten, coalesce((kinh_thanh->>'luu_tru')::boolean, false) AS luu_tru FROM xv_phim
    WHERE kinh_thanh->'tu_template'->>'id' = ${String(phimId)} ORDER BY id DESC`)) as unknown as Row[];
  return { ok: true, data: { ...r, phimDung: dung.map((x) => ({ id: Number(x.id), ten: String(x.ten), luu_tru: !!x.luu_tru })) } };
}
/** Sửa nhãn / gợi ý / giá trị mẫu của các ô + mô tả template (có ↶ hoàn tác). */
export async function luuCauHinhTemplate(phimId: number, cfg: CauHinhTemplate): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_phim', id: phimId, cot: ['kinh_thanh'], moTa: 'sửa ô template', nguoi: await ai() });
  // GỘP vào cấu hình cũ — trước đây ghi đè cả khối: lưu nhãn ô trên panel là mất mẫu QC thắng (mau_qc) do script dựng ghi.
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{template}', coalesce(kinh_thanh->'template', '{}'::jsonb) || ${JSON.stringify(cfg)}::jsonb), updated_at = now() WHERE id = ${phimId}`);
  return { ok: true, data: undefined };
}
/** Lưu một phim thành template MỚI (bản sao, phim gốc không bị đụng) — sau đó gõ {{ô}} vào chỗ cần đổi. */
export async function luuThanhTemplate(phimId: number, ten: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!ten.trim()) return loi('thiếu tên template');
  const r = await chepPhim(db, phimId, { ten: ten.trim(), gt: {}, laTemplate: true });
  return r ? { ok: true, data: r.phimId } : loi('không thấy phim');
}
/** Tạo phim từ template: chép + điền ô. Ô đang dùng mà chưa điền → chặn (phim mới không được còn {{x}}). 0đ. */
export async function taoPhimTuTemplate(templateId: number, ten: string, gt: Record<string, string>): Promise<Kq<KetQuaChep>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!ten.trim()) return loi('thiếu tên phim');
  const t = await docOTemplate(db, templateId);
  if (!t) return loi('không thấy template');
  const thieu = oThieu(t.o, gt);
  if (thieu.length) return loi(`chưa điền: ${thieu.map((o) => o.ten).join(', ')}`);
  // chepPhim ném lỗi có chữ khi template hỏng (anchor sản phẩm ghi cứng) — đưa nguyên câu đó ra nút, không để thành lỗi máy chủ chung.
  try {
    const r = await chepPhim(db, templateId, { ten: ten.trim(), gt, laTemplate: false });
    return r ? { ok: true, data: r } : loi('không thấy template');
  } catch (e) { return loi(e instanceof Error ? e.message : String(e)); }
}
export async function dsPhim(): Promise<Phim[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  try {
    const r = await db.execute(sql`
      SELECT p.*,
        (SELECT count(*) FROM xv_tap t WHERE t.phim_id = p.id) AS so_tap,
        (SELECT count(*) FROM xv_nhan_vat v WHERE v.phim_id = p.id) AS so_nhan_vat,
        (SELECT count(*) FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = p.id) AS so_canh,
        (SELECT coalesce(sum(j.chi_phi_cents), 0) FROM xv_job j WHERE j.phim_id = p.id AND j.tinh_chi) AS chi_phi_cents,
        (SELECT coalesce(json_agg(json_build_object('id', t.id, 'so', t.so, 'ten', t.ten,
            'so_canh', (SELECT count(*) FROM xv_canh c WHERE c.tap_id = t.id),
            'so_hinh', (SELECT count(*) FROM xv_canh c WHERE c.tap_id = t.id AND c.keyframe_url IS NOT NULL),
            'so_clip', (SELECT count(*) FROM xv_canh c WHERE c.tap_id = t.id AND (c.video_url IS NOT NULL OR c.video_cuoi_url IS NOT NULL))) ORDER BY t.so), '[]'::json)
          FROM xv_tap t WHERE t.phim_id = p.id) AS tap_tom,
        (SELECT c.keyframe_url FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = p.id AND c.keyframe_url IS NOT NULL ORDER BY c.updated_at DESC, c.id DESC LIMIT 1) AS anh_dai_dien,
        (SELECT count(*) FROM xv_anh_qc a WHERE a.phim_id = p.id AND NOT a.an) AS so_anh_qc,
        (SELECT coalesce(json_agg(json_build_object('id', a.id, 'url', a.url, 'ti_le', a.ti_le) ORDER BY a.id), '[]'::json)
          FROM xv_anh_qc a WHERE a.phim_id = p.id AND NOT a.an AND a.url IS NOT NULL) AS anh_qc_tom
      FROM xv_phim p WHERE p.loai <> 'may_dung' ORDER BY p.updated_at DESC`);   // video máy ở cửa ⚙ Tự động (xv_may_video); phim Máy Dựng cũ mở qua mId vẫn được
    return (r as unknown as Row[]).map(mapPhim);
  } catch { return []; }
}
const mapPhim = (r: Row): Phim => ({
  id: n(r.id), project: s(r.project), ten: s(r.ten), loai: s(r.loai) as LoaiPhim, mo_ta: s(r.mo_ta),
  kinh_thanh: (r.kinh_thanh && typeof r.kinh_thanh === 'object' ? r.kinh_thanh : {}) as KinhThanh, trang_thai: s(r.trang_thai),
  so_tap: n(r.so_tap), so_nhan_vat: n(r.so_nhan_vat), so_canh: n(r.so_canh), chi_phi_cents: n(r.chi_phi_cents), updated_at: s(r.updated_at),
  tap_tom: arr<NonNullable<Phim['tap_tom']>[number]>(r.tap_tom).map((t) => ({ ...t, so_canh: Number(t.so_canh), so_hinh: Number(t.so_hinh), so_clip: Number(t.so_clip) })),
  poster_url: r.poster_url ? s(r.poster_url) : null, poster_uv: arr<string>(r.poster_uv),
  anh_dai_dien: r.anh_dai_dien ? s(r.anh_dai_dien) : null,
  so_anh_qc: n(r.so_anh_qc), anh_qc_tom: arr<NonNullable<Phim['anh_qc_tom']>[number]>(r.anh_qc_tom),
  goc_spy: docGocSpy(r.goc_spy),
});

/** dangSinh: job ảnh còn chạy (≤10 phút) — F5 vẫn thấy "đang sinh" vì trạng thái ở sổ job máy chủ, không ở trình duyệt. */
/** Thống kê gọn cả phim cho đầu ngăn phim (anh yêu cầu 08/10/2026). */
export type ThongKePhim = { soCanh: number; giay: number; coKf: number; duyet: number; nhap: number; cuoi: number; anhGoc: number; bienThe: number; btCoAnh: number; soLanSinh: number; tienAnh: number; tienVideo: number; tienChu: number;
  /** Chi phí THỰC TẾ nếu không phải sinh lại: chỉ lượt sinh ra thứ đang nằm trong phim (keyframe/clip/giọng/hiệu ứng/nhạc/ảnh anchor đang dùng)
   *  + lượt Claude mới nhất của mỗi việc. Khác tongTien = tiền mất vì sinh lại / bỏ / lỗi. */
  tienDung: number };
export type PhimDayDu = { thongKe: ThongKePhim; phim: Phim; nhanVat: NhanVat[]; tap: Tap[]; dangSinh: { nhanVat: number[]; bienThe: number[]; poster: number }; loiAnh: { nhanVat: Record<number, string>; bienThe: Record<number, string> }; ganDay: Job[]; tongTien: number; loiPoster: string };
export async function docPhim(id: number): Promise<PhimDayDu | null> {
  const db = getDb();
  if (!db || !(await admin())) return null;
  try {
    const p = (await db.execute(sql`SELECT p.*, 0 AS so_tap, 0 AS so_nhan_vat, 0 AS so_canh, 0 AS chi_phi_cents FROM xv_phim p WHERE p.id = ${id}`)) as unknown as Row[];
    if (!p[0]) return null;
    const [nv, tap] = await Promise.all([
      db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${id} ORDER BY loai, id`),
      db.execute(sql`SELECT t.*, (SELECT count(*) FROM xv_canh c WHERE c.tap_id = t.id) AS so_canh FROM xv_tap t WHERE t.phim_id = ${id} ORDER BY so`),
    ]);
    const nvs = (nv as unknown as Row[]).map(mapNhanVat);
    const [bt, ds, gd, tg, la, tkc, tdg, tkj, dp] = await Promise.all([
      db.execute(sql`SELECT b.* FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id WHERE v.phim_id = ${id} ORDER BY b.nhom, b.id`),
      db.execute(sql`SELECT j.nhan_vat_id, j.bien_the_id FROM xv_job j JOIN xv_nhan_vat v ON v.id = j.nhan_vat_id
        WHERE v.phim_id = ${id} AND j.loai = 'anh' AND ${jobDangCho('j')}`),
      db.execute(sql`SELECT * FROM xv_job WHERE phim_id = ${id} ORDER BY id DESC LIMIT 6`),
      db.execute(sql`SELECT coalesce(sum(chi_phi_cents), 0) AS t FROM xv_job WHERE phim_id = ${id} AND tinh_chi`),
      // Lần sinh ảnh gần nhất của mỗi anchor/biến thể — lỗi thì hiện dưới thẻ (việc chạy nền nên lỗi không trả về nút nữa).
      db.execute(sql`SELECT DISTINCT ON (j.nhan_vat_id, coalesce(j.bien_the_id, 0)) j.nhan_vat_id, j.bien_the_id, j.trang_thai, j.loi
        FROM xv_job j JOIN xv_nhan_vat v ON v.id = j.nhan_vat_id WHERE v.phim_id = ${id} AND j.loai = 'anh'
        ORDER BY j.nhan_vat_id, coalesce(j.bien_the_id, 0), j.id DESC`),
      db.execute(sql`SELECT count(*) AS so, coalesce(sum(c.thoi_luong_s), 0) AS giay, count(c.keyframe_url) AS kf,
          count(*) FILTER (WHERE c.trang_thai = 'duyet') AS duyet, count(c.video_url) AS nhap, count(c.video_cuoi_url) AS cuoi
        FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${id}`),
      // Tiền của thứ ĐANG DÙNG: job có output_url nằm trong tập url đang gắn vào phim (không lọc tinh_chi — tài sản đang dùng sinh từ trước
      // lúc đặt lại sổ vẫn là tiền của phim) + lượt Claude mới nhất mỗi việc (nhãn bỏ phần ngoặc cuối).
      db.execute(sql`WITH c AS (SELECT c.* FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${id}),
          dung AS (
            SELECT keyframe_url AS u FROM c UNION SELECT video_url FROM c UNION SELECT video_cuoi_url FROM c UNION SELECT thoai_url FROM c UNION SELECT am_thanh_url FROM c
            UNION SELECT d->>'url' FROM c, jsonb_array_elements(CASE WHEN jsonb_typeof(c.thoai) = 'array' THEN c.thoai ELSE '[]'::jsonb END) d
            UNION SELECT nhac_url FROM xv_tap WHERE phim_id = ${id}
            UNION SELECT x.value FROM xv_tap t, jsonb_each_text(coalesce(t.nhac_phan_canh, '{}'::jsonb)) x WHERE t.phim_id = ${id}
            UNION SELECT jsonb_array_elements_text(anh_ref) FROM xv_nhan_vat WHERE phim_id = ${id}
            UNION SELECT b.anh_url FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id WHERE v.phim_id = ${id}
            UNION SELECT poster_url FROM xv_phim WHERE id = ${id})
        SELECT coalesce((SELECT sum(j.chi_phi_cents) FROM xv_job j WHERE j.trang_thai = 'xong' AND j.output_url IN (SELECT u FROM dung WHERE u IS NOT NULL)
            AND (j.phim_id = ${id} OR j.canh_id IN (SELECT id FROM c) OR j.nhan_vat_id IN (SELECT id FROM xv_nhan_vat WHERE phim_id = ${id}))), 0)
          + coalesce((SELECT sum(x.chi_phi_cents) FROM (SELECT DISTINCT ON (regexp_replace(nhan, '[[:space:]]*[(].*[)][[:space:]]*$', '')) chi_phi_cents FROM xv_job
            WHERE phim_id = ${id} AND loai = 'chu' AND trang_thai = 'xong' ORDER BY regexp_replace(nhan, '[[:space:]]*[(].*[)][[:space:]]*$', ''), id DESC) x), 0) AS dung`),
      db.execute(sql`SELECT count(*) AS so, coalesce(sum(chi_phi_cents) FILTER (WHERE loai = 'anh'), 0) AS anh,
          coalesce(sum(chi_phi_cents) FILTER (WHERE loai IN ('video', 'nang_cap')), 0) AS video,
          coalesce(sum(chi_phi_cents) FILTER (WHERE loai NOT IN ('anh', 'video', 'nang_cap')), 0) AS chu
        FROM xv_job WHERE phim_id = ${id} AND trang_thai = 'xong' AND tinh_chi`),
      // poster đang sinh (≤10 phút) + lỗi của lượt poster gần nhất
      db.execute(sql`SELECT trang_thai, loi, (${jobDangCho()}) AS dang FROM xv_job WHERE phim_id = ${id} AND request->>'dich' = 'poster' ORDER BY id DESC LIMIT 5`),
    ]);
    const loiAnh = { nhanVat: {} as Record<number, string>, bienThe: {} as Record<number, string> };
    for (const r of la as unknown as Row[]) {
      if (s(r.trang_thai) !== 'loi') continue;
      if (r.bien_the_id == null) loiAnh.nhanVat[n(r.nhan_vat_id)] = s(r.loi); else loiAnh.bienThe[n(r.bien_the_id)] = s(r.loi);
    }
    const bts = (bt as unknown as Row[]).map(mapBienThe);
    for (const v of nvs) v.bien_the = bts.filter((b) => b.nhan_vat_id === v.id);
    const dsr = ds as unknown as Row[];
    const c0 = (tkc as unknown as Row[])[0] ?? {}; const j0 = (tkj as unknown as Row[])[0] ?? {};
    const thongKe: ThongKePhim = {
      soCanh: n(c0.so), giay: n(c0.giay), coKf: n(c0.kf), duyet: n(c0.duyet), nhap: n(c0.nhap), cuoi: n(c0.cuoi),
      anhGoc: nvs.reduce((a, v) => a + v.anh_ref.length, 0), bienThe: bts.length, btCoAnh: bts.filter((b) => b.anh_url).length,
      soLanSinh: n(j0.so), tienAnh: n(j0.anh), tienVideo: n(j0.video), tienChu: n(j0.chu), tienDung: n(((tdg as unknown as Row[])[0] ?? {}).dung),
    };
    return {
      thongKe, phim: mapPhim(p[0]), nhanVat: nvs, tap: (tap as unknown as Row[]).map(mapTap),
      ganDay: (gd as unknown as Row[]).map(mapJob), tongTien: n((tg as unknown as Row[])[0]?.t), loiAnh,
      dangSinh: { nhanVat: dsr.filter((r) => r.bien_the_id == null).map((r) => n(r.nhan_vat_id)), bienThe: dsr.filter((r) => r.bien_the_id != null).map((r) => n(r.bien_the_id)), poster: (dp as unknown as Row[]).filter((r) => r.dang === true).length },
      loiPoster: (() => { const r0 = (dp as unknown as Row[])[0]; return r0 && s(r0.trang_thai) === 'loi' ? s(r0.loi) : ''; })(),
    };
  } catch { return null; }
}

export async function dsCanh(tapId: number): Promise<Canh[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  try {
    const r = await db.execute(sql`SELECT c.*, EXISTS (SELECT 1 FROM xv_job j WHERE j.canh_id = c.id AND j.loai = 'anh' AND ${jobDangCho('j')}) AS dang_sinh_anh,
      -- Cờ riêng từng loại âm (#1217: sinh giọng mà khối hiệu ứng cũng báo đang sinh).
      EXISTS (SELECT 1 FROM xv_job j WHERE j.canh_id = c.id AND j.loai = 'am' AND j.request->>'dich' = 'thoai' AND ${jobDangCho('j')}) AS dang_sinh_giong,
      EXISTS (SELECT 1 FROM xv_job j WHERE j.canh_id = c.id AND j.loai = 'am' AND j.request->>'dich' = 'sfx' AND ${jobDangCho('j')}) AS dang_sinh_sfx,
      -- Lúc sinh xong keyframe / clip đang dùng (#1384: rê vào thẻ lưới thấy "sinh 12 phút trước", shot vừa sinh được tô sáng).
      (SELECT max(j.updated_at) FROM xv_job j WHERE j.canh_id = c.id AND j.loai = 'anh' AND j.trang_thai = 'xong' AND j.output_url = c.keyframe_url) AS keyframe_luc,
      (SELECT max(j.updated_at) FROM xv_job j WHERE j.canh_id = c.id AND j.loai = 'video' AND j.trang_thai = 'xong' AND j.output_url IN (c.video_url, c.video_cuoi_url)) AS video_luc
      FROM xv_canh c WHERE c.tap_id = ${tapId} ORDER BY c.thu_tu, c.id`);
    const ds = (r as unknown as Row[]).map(mapCanh);
    // Nguồn từng tệp (15/10/2026 — anh: "cùng 1 shot có thể tạo từ nhiều model, nhà cung cấp"): job nào sinh ra keyframe/clip nào.
    if (ds.length) {
      const jobs = (await db.execute(sql`SELECT canh_id, output_url, provider, model, nguon FROM xv_job WHERE canh_id = ANY(${mangInt(ds.map((c) => c.id))}::int[])
        AND output_url IS NOT NULL AND trang_thai = 'xong' AND loai IN ('anh', 'video')`)) as unknown as Row[];
      const theoCanh = new Map<number, Record<string, { ngan: string; day: string }>>();
      for (const j of jobs) {
        const m = theoCanh.get(n(j.canh_id)) ?? {};
        const ng = (j.nguon ?? null) as NguonSinh | null;
        m[s(j.output_url)] = { ngan: taNguonNgan(ng, s(j.provider), s(j.model)), day: [taNguon(ng) || `${s(j.provider)} · ${s(j.model)}`, taThu(ng)].filter(Boolean).join('\n') };
        theoCanh.set(n(j.canh_id), m);
      }
      for (const c of ds) c.nguon_tep = theoCanh.get(c.id) ?? {};
      // Video ĐANG chạy ở đâu (anh 15/10/2026: "vì có fallback nên lúc bấm sinh phải show model, ncc đang áp dụng") — job video mới nhất còn chạy.
      const dang = (await db.execute(sql`SELECT DISTINCT ON (canh_id) canh_id, provider, model, nguon FROM xv_job WHERE canh_id = ANY(${mangInt(ds.map((c) => c.id))}::int[])
        AND loai = 'video' AND trang_thai IN ('cho', 'chay') ORDER BY canh_id, id DESC`)) as unknown as Row[];
      for (const j of dang) {
        const c = ds.find((x) => x.id === n(j.canh_id)); if (!c) continue;
        const ng = (j.nguon ?? null) as NguonSinh | null;
        c.video_dang = { ngan: taNguonNgan(ng, s(j.provider), s(j.model)), day: [taNguon(ng) || `${s(j.provider)} · ${s(j.model)}`, taThu(ng)].filter(Boolean).join('\n') };
      }
    }
    return ds;
  } catch { return []; }
}

export async function dsJobPhim(phimId: number): Promise<Job[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  try {
    const r = await db.execute(sql`
      SELECT j.* FROM xv_job j
      LEFT JOIN xv_canh c ON c.id = j.canh_id LEFT JOIN xv_tap t ON t.id = c.tap_id LEFT JOIN xv_nhan_vat v ON v.id = j.nhan_vat_id
      WHERE t.phim_id = ${phimId} OR v.phim_id = ${phimId} ORDER BY j.id DESC LIMIT 200`);
    return (r as unknown as Row[]).map(mapJob);
  } catch { return []; }
}

/** Sổ chi phí (trang /log): mọi lần gọi AI, mới nhất trước. */
export async function soChiPhi(opts: { phimId?: number; ngay?: number }): Promise<{ jobs: Job[]; theoNgay: { ngay: string; tien: number; so: number }[]; theoLoai: { loai: string; tien: number; so: number }[] }> {
  const db = getDb();
  if (!db || !(await admin())) return { jobs: [], theoNgay: [], theoLoai: [] };
  const ngay = Math.max(1, Math.min(365, opts.ngay ?? 30));
  const loc = opts.phimId ? sql`AND j.phim_id = ${opts.phimId}` : sql``;
  const [jobs, nd, ll] = await Promise.all([
    db.execute(sql`SELECT j.*, p.ten AS phim_ten FROM xv_job j LEFT JOIN xv_phim p ON p.id = j.phim_id
      WHERE j.created_at > now() - make_interval(days => ${ngay}) ${loc} ORDER BY j.id DESC LIMIT 1000`),
    db.execute(sql`SELECT to_char(j.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS ngay, sum(j.chi_phi_cents) AS tien, count(*) AS so
      FROM xv_job j WHERE j.created_at > now() - make_interval(days => ${ngay}) ${loc} GROUP BY 1 ORDER BY 1 DESC`),
    db.execute(sql`SELECT j.loai, sum(j.chi_phi_cents) AS tien, count(*) AS so FROM xv_job j WHERE j.created_at > now() - make_interval(days => ${ngay}) ${loc} GROUP BY 1 ORDER BY 2 DESC`),
  ]);
  return {
    jobs: (jobs as unknown as Row[]).map(mapJob),
    theoNgay: (nd as unknown as Row[]).map((r) => ({ ngay: s(r.ngay), tien: n(r.tien), so: n(r.so) })),
    theoLoai: (ll as unknown as Row[]).map((r) => ({ loai: s(r.loai), tien: n(r.tien), so: n(r.so) })),
  };
}

/** Trạng thái khoá: trang báo thiếu gì thay vì để nút Sinh lỗi âm thầm. Chỉ trả có/không, không trả giá trị. */
export async function trangThaiKhoa(): Promise<{ google: boolean; anthropic: boolean; r2: boolean; openai: boolean; fal: boolean; ckey?: boolean; shopaikey?: boolean }> {
  if (!(await admin())) return { google: false, anthropic: false, r2: false, openai: false, fal: false };
  return {
    fal: !!process.env.FAL_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    google: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    r2: !!(process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET),
    ckey: !!process.env.CKEY_API_KEY,
    shopaikey: !!process.env.SHOPAIKEY_API_KEY,
  };
}

// ── Phim ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function taoPhim(ten: string, loai: LoaiPhim): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!ten.trim()) return loi('thiếu tên');
  // Quảng cáo: ảnh mặc định đi fal (Seedream) khi có khoá — Google Nano Banana chặn đồ lót/đồ bơi (IMAGE_SAFETY, 4 lần hỏng 08/10/2026).
  const kt: KinhThanh = loai === 'quang_cao' ? { ti_le: '9:16', ...(process.env.FAL_KEY ? { mo_hinh_anh: 'fal:bytedance/seedream/v5/pro/edit' as KinhThanh['mo_hinh_anh'] } : {}) } : {};
  const r = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, kinh_thanh) VALUES (${KHO}, ${ten.trim()}, ${loai}, ${JSON.stringify(kt)}::jsonb) RETURNING id`)) as unknown as Row[];
  // Short / quảng cáo: một tập sẵn, khỏi bắt người bấm "thêm tập".
  const id = n(r[0]?.id);
  if (loai !== 'phim') await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten) VALUES (${id}, 1, ${ten.trim()})`);
  return { ok: true, data: id };
}

/** Tạo phim từ mẫu dựng sẵn (mỗi định dạng một mẫu): kinh thánh + anchor + kịch bản tập 1 đã điền. */
export async function taoPhimMau(key: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const m = MAU_PHIM.find((x) => x.key === key) ?? MAU_PHIM.find((x) => x.loai === key);
  if (!m) return loi('không có mẫu cho loại này');
  const r = (await db.execute(sql`INSERT INTO xv_phim (project, ten, loai, mo_ta, kinh_thanh) VALUES (${KHO}, ${m.ten}, ${m.loai}, ${m.mo_ta}, ${JSON.stringify(m.kinh_thanh)}::jsonb) RETURNING id`)) as unknown as Row[];
  const id = n(r[0]?.id);
  for (const v of m.nhan_vat) await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, giong) VALUES (${id}, ${v.loai}, ${v.ten}, ${v.mo_ta}, ${v.giong ?? ''})`);
  let so = 0;
  const tapIds: number[] = [];
  for (const t of m.tap) {
    so += 1;
    const tr = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, kich_ban) VALUES (${id}, ${so}, ${t.ten}, ${t.kich_ban}) RETURNING id`)) as unknown as Row[];
    tapIds.push(n(tr[0]?.id));
  }
  // Mẫu phải mở ra là có storyboard ngay (anh hỏi "storyboard chưa có à?" 08/10/2026): tách cảnh bằng Claude luôn; lỗi (thiếu khoá) thì phim vẫn tạo, bảng cảnh trống + báo lỗi ở drawer.
  for (const tapId of tapIds) await tachCanhTap(tapId, 0).catch(() => undefined);
  return { ok: true, data: id };
}

export async function suaPhim(id: number, d: { ten?: string; loai?: LoaiPhim; mo_ta?: string; kinh_thanh?: KinhThanh; trang_thai?: string }): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_phim', id, cot: Object.keys(d), moTa: `sửa phim: ${Object.keys(d).join(', ')}`, nguoi: await ai() });
  await db.execute(sql`UPDATE xv_phim SET
    ten = coalesce(${d.ten ?? null}, ten), loai = coalesce(${d.loai ?? null}, loai), mo_ta = coalesce(${d.mo_ta ?? null}, mo_ta),
    kinh_thanh = coalesce(${d.kinh_thanh ? JSON.stringify(d.kinh_thanh) : null}::jsonb
      -- giọng lời dẫn đã khoá (sinh-giong ghi) không bị form kinh thánh đang mở từ trước ghi đè thành rỗng
      || CASE WHEN coalesce(${d.kinh_thanh ? JSON.stringify(d.kinh_thanh) : null}::jsonb->'giong_dan', 'null'::jsonb) = 'null'::jsonb AND coalesce(kinh_thanh->'giong_dan', 'null'::jsonb) <> 'null'::jsonb
         THEN jsonb_build_object('giong_dan', kinh_thanh->'giong_dan') ELSE '{}'::jsonb END
      -- đề của phim Máy Dựng (may-dung.ts, máy đẩy) không bị form mở từ trước ghi đè mất
      || CASE WHEN coalesce(${d.kinh_thanh ? JSON.stringify(d.kinh_thanh) : null}::jsonb->'may_dung', 'null'::jsonb) = 'null'::jsonb AND kinh_thanh ? 'may_dung'
         THEN jsonb_build_object('may_dung', kinh_thanh->'may_dung') ELSE '{}'::jsonb END, kinh_thanh), trang_thai = coalesce(${d.trang_thai ?? null}, trang_thai),
    updated_at = now() WHERE id = ${id}`);
  if (d.kinh_thanh?.qc) await apKieuChuThuongHieu(db, id).catch(() => false);   // chưa có kiểu chữ → lấy preset của thương hiệu
  // Quảng cáo: sản phẩm khai ở kinh thánh → anchor sản phẩm cùng tên (tạo nếu chưa có), ảnh thật lên ĐẦU anh_ref để mọi keyframe tham chiếu đúng hàng.
  const q = d.kinh_thanh?.qc;
  if (q?.mau?.shots?.length) {
    const nvK = (await db.execute(sql`SELECT ten, loai FROM xv_nhan_vat WHERE phim_id = ${id}`)) as unknown as Row[];
    await ghiKhuonTuMau(db, q.mau.shots, nvK.map((v) => ({ ten: s(v.ten), loai: s(v.loai) as NhanVat['loai'] })), q.ten ?? '', `QC mẫu${q.mau.nguon ? ` · ${q.mau.nguon.slice(0, 60)}` : ''}`, id);
  }
  if (q?.ten.trim()) {
    const co = (await db.execute(sql`SELECT id, anh_ref, mo_ta FROM xv_nhan_vat WHERE phim_id = ${id} AND loai = 'san_pham' ORDER BY (lower(ten) = lower(${q.ten.trim()})) DESC, id LIMIT 1`)) as unknown as Row[];
    const anh = [...new Set([...q.anh, ...arr<string>(co[0]?.anh_ref)])].slice(0, 10);
    if (co[0]) await db.execute(sql`UPDATE xv_nhan_vat SET ten = ${q.ten.trim()}, anh_ref = ${JSON.stringify(anh)}::jsonb, mo_ta = CASE WHEN mo_ta = '' THEN ${q.diem_noi_bat} ELSE mo_ta END, updated_at = now() WHERE id = ${n(co[0].id)}`);
    else await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref) VALUES (${id}, 'san_pham', ${q.ten.trim()}, ${q.diem_noi_bat}, ${JSON.stringify(anh)}::jsonb)`);
  }
  return { ok: true, data: undefined };
}

export async function xoaPhim(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boVaoThungRac(db, 'phim', [id], me.email);   // vào thùng rác, khôi phục được — không xoá thật (#1192)
  return { ok: true, data: undefined };
}

// ── Anchor ───────────────────────────────────────────────────────────────────────────────────────────────────────

export async function luuNhanVat(d: { id?: number; phim_id: number; loai: LoaiNhanVat; ten: string; mo_ta: string; anh_ref: string[]; giong: string; tieu_su?: string; thuoc_id?: number | null }): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!d.ten.trim()) return loi('thiếu tên');
  const anh = JSON.stringify(d.anh_ref.filter(Boolean).slice(0, 10));
  const thuoc = d.thuoc_id && d.thuoc_id !== d.id ? d.thuoc_id : null;   // không tự làm cha của chính mình
  if (d.id) {
    // Mô tả hay ảnh gốc đổi → kết quả đối chiếu cũ hết giá trị, xoá để thẻ không hiện "khớp" sai.
    await db.execute(sql`UPDATE xv_nhan_vat SET doi_chieu = CASE WHEN mo_ta IS DISTINCT FROM ${d.mo_ta} OR anh_ref::text IS DISTINCT FROM ${anh} THEN NULL ELSE doi_chieu END,
      loai = ${d.loai}, ten = ${d.ten.trim()}, mo_ta = ${d.mo_ta}, anh_ref = ${anh}::jsonb, giong = ${d.giong}, tieu_su = ${d.tieu_su ?? ''}, thuoc_id = ${thuoc}, updated_at = now() WHERE id = ${d.id}`);
    return { ok: true, data: d.id };
  }
  const r = (await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, anh_ref, giong, tieu_su, thuoc_id) VALUES (${d.phim_id}, ${d.loai}, ${d.ten.trim()}, ${d.mo_ta}, ${anh}::jsonb, ${d.giong}, ${d.tieu_su ?? ''}, ${thuoc}) RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]?.id) };
}

export async function xoaNhanVat(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boVaoThungRac(db, 'nhan_vat', [id], me.email);   // vào thùng rác, khôi phục được — không xoá thật (#1192)
  return { ok: true, data: undefined };
}


/** Bỏ ảnh vào thùng rác (ảnh gốc / ảnh biến thể / ứng viên keyframe): gỡ khỏi danh sách, khôi phục được; file R2 giữ nguyên (#1192). */
export async function xoaAnhGoc(nhanVatId: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boAnhVaoThungRac(db, 'anh_goc', nhanVatId, url, me.email);
  return { ok: true, data: undefined };
}
export async function xoaAnhBienThe(bienTheId: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boAnhVaoThungRac(db, 'anh_bien_the', bienTheId, '', me.email);
  return { ok: true, data: undefined };
}
export async function xoaKeyframe(canhId: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boAnhVaoThungRac(db, 'keyframe', canhId, url, me.email);
  return { ok: true, data: undefined };
}
/** Thư viện khuôn shot (máy tự ghi từ QC mẫu + cảnh đã tách) — cho drawer Thư viện và ô chọn ở mục 0. */
export async function dsKhuonShot(loai?: string): Promise<KhuonShot[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  return dsKhuon(db, { loai: loai || undefined });
}
/** Thùng rác: phimId = null → các PHIM đã xoá (trang chủ); có phimId → mọi thứ đã xoá trong phim đó. */
export async function dsThungRac(phimId: number | null): Promise<MucRac[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  return dsRac(db, phimId);
}
export async function khoiPhuc(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = await khoiPhucRac(db, id);
  return r.ok ? { ok: true, data: undefined } : loi(r.loi);
}

/** Chọn một ảnh gốc làm ảnh chính (đưa lên đầu anh_ref) — ảnh đầu là ảnh thẻ hiện + tham chiếu ưu tiên khi sinh cảnh. */
export async function datAnhChinh(nhanVatId: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_nhan_vat', id: nhanVatId, cot: ['anh_ref'], moTa: 'đặt ảnh chính của anchor', nguoi: await ai() });
  await db.execute(sql`UPDATE xv_nhan_vat SET anh_ref = (${JSON.stringify([url])}::jsonb || (anh_ref - ${url})), updated_at = now()
    WHERE id = ${nhanVatId} AND anh_ref ? ${url}`);
  return { ok: true, data: undefined };
}

// ── Biến thể anchor (biểu cảm · trang phục · tư thế · góc máy · thời điểm…) ───────────────────────────────────────

export async function luuBienThe(d: { id?: number; nhan_vat_id: number; nhom: string; ten: string; mo_ta: string; dung_tap?: number[] | null }): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (d.id) await chupTruoc(db, { bang: 'xv_bien_the', id: d.id, cot: ['nhom', 'ten', 'mo_ta', 'dung_tap'], moTa: `sửa biến thể ${d.ten.trim()}`, nguoi: await ai() });
  if (!d.ten.trim()) return loi('thiếu tên biến thể');
  const tap = d.dung_tap === undefined ? undefined : JSON.stringify((d.dung_tap ?? []).filter((x) => Number.isFinite(x)));   // undefined = không đụng cột; [] / null = mọi tập
  if (d.id) {
    await db.execute(sql`UPDATE xv_bien_the SET nhom = ${d.nhom}, ten = ${d.ten.trim()}, mo_ta = ${d.mo_ta}${tap === undefined ? sql`` : sql`, dung_tap = ${tap === '[]' ? null : tap}::jsonb`}, updated_at = now() WHERE id = ${d.id}`);
    return { ok: true, data: d.id };
  }
  const r = (await db.execute(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta, dung_tap) VALUES (${d.nhan_vat_id}, ${d.nhom}, ${d.ten.trim()}, ${d.mo_ta}, ${tap && tap !== '[]' ? tap : null}::jsonb) RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]?.id) };
}

export async function xoaBienThe(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boVaoThungRac(db, 'bien_the', [id], me.email);   // vào thùng rác, khôi phục được — không xoá thật (#1192)
  return { ok: true, data: undefined };
}

// 📍 MỐC XUẤT HIỆN của mỗi biến thể: shot ĐẦU TIÊN (theo tập.so, thu_tu) có dùng nó trong c.bien_the + số shot dùng + dải tập. Cho bảng Thiết kế sản xuất
// hiện "vết cafe xuất hiện từ shot #N, tập 1" — thấy ngay look nào bật từ mốc nào, ở tập nào. Chỉ đọc, không tốn tiền.
export async function mocBienThe(phimId: number): Promise<Record<number, { tap_so: number; thu_tu: number; canh: string; so_shot: number; cac_tap: number[] }>> {
  const db = getDb();
  if (!db) return {};
  const rows = (await db.execute(sql`
    SELECT b.id,
      (array_agg(t.so ORDER BY t.so, c.thu_tu))[1] AS tap_so,
      (array_agg(c.thu_tu ORDER BY t.so, c.thu_tu))[1] AS thu_tu,
      (array_agg(coalesce(c.canh, '') ORDER BY t.so, c.thu_tu))[1] AS canh,
      count(*)::int AS so_shot,
      array_agg(DISTINCT t.so) AS cac_tap
    FROM xv_bien_the b
    JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id AND v.phim_id = ${phimId}
    JOIN xv_canh c ON c.bien_the @> to_jsonb(b.id) AND coalesce(c.nhanh, '') IN ('', 'A')
    JOIN xv_tap t ON t.id = c.tap_id
    GROUP BY b.id`)) as unknown as Row[];
  const out: Record<number, { tap_so: number; thu_tu: number; canh: string; so_shot: number; cac_tap: number[] }> = {};
  for (const r of rows) out[n(r.id)] = { tap_so: n(r.tap_so), thu_tu: n(r.thu_tu), canh: s(r.canh), so_shot: n(r.so_shot), cac_tap: arr<number>(r.cac_tap).map(Number).sort((a, b) => a - b) };
  return out;
}

// ── 📋 PHÂN RÃ KỊCH BẢN (script breakdown — phan-ra.ts): tự gắn thẻ mọi yếu tố từng shot, tạo món thiếu, báo thiếu; tăng dần theo tập ─────────────
/** Phân rã MỘT tập (~200₫, 1 lượt chữ qua chuỗi rẻ). ep = chạy lại dù chữ tập không đổi. */
export async function phanRaTapAction(tapId: number, ep = false): Promise<Kq<KqPhanRa>> {
  const db = getDb(); if (!db) return loi('no db');
  const me = await admin(); if (!me) return loi('không có quyền');
  try { return await phanRaTapDb(db, tapId, { ep, nguoi: me.email }); } catch (e) { console.error('[phân rã]', e); return loi(`lỗi máy chủ: ${e instanceof Error ? e.message : String(e)}`); }
}
/** Phân rã MỌI tập CHƯA phân rã / phân rã CŨ (chữ đổi sau lần trước) — tập không đổi bỏ qua 0đ. TUẦN TỰ: tập sau thấy món tập trước vừa tạo → không đẻ trùng. */
export async function phanRaPhimAction(phimId: number): Promise<Kq<{ chay: number; boQua: number; moi: number; vnd: number; loi: string[] }>> {
  const db = getDb(); if (!db) return loi('no db');
  const me = await admin(); if (!me) return loi('không có quyền');
  const bc = await baoCaoChuanBiDb(db, phimId); if (!bc) return loi('không thấy phim');
  const out = { chay: 0, boQua: 0, moi: 0, vnd: 0, loi: [] as string[] };
  for (const t of bc.tap.filter((x) => x.trang_thai === 'chua' || x.trang_thai === 'cu')) {
    const r = await phanRaTapDb(db, t.id, { nguoi: me.email }).catch((e: unknown) => ({ ok: false as const, loi: e instanceof Error ? e.message : String(e) }));
    if (!r.ok) { out.loi.push(`tập ${t.so}: ${r.loi}`); continue; }
    if (r.data.boQua) out.boQua++; else { out.chay++; out.moi += r.data.moi; out.vnd += r.data.vnd ?? 0; }
  }
  return { ok: true, data: out };
}
/** Báo cáo chuẩn bị cả phim (0đ): tập chưa / cũ / xong, món cần, món THIẾU (chưa tả / chưa ảnh gốc / chưa ảnh mẫu), giá ước phân rã. */
export async function baoCaoChuanBiAction(phimId: number): Promise<BaoCaoPhim | null> {
  const db = getDb(); if (!db) return null;
  if (!(await admin())) return null;
  return baoCaoChuanBiDb(db, phimId);
}
/** 🖼 SINH HẾT ẢNH THIẾU (giá ghi trên nút): đợt 1 ảnh gốc cho anchor shot đang dùng mà chưa có (đã tả) · đợt 2 ảnh mẫu cho biến thể có cha ĐÃ có ảnh gốc.
 *  Biến thể có cha còn đang chờ ảnh gốc → trả lại tên, bấm lần nữa khi ảnh gốc xong. Chạy nền song song có trần. */
export async function sinhAnhThieuAction(phimId: number): Promise<Kq<{ goc: number; bienThe: number; cho: string[]; loi: string[] }>> {
  const db = getDb(); if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await baoCaoChuanBiDb(db, phimId); if (!bc) return loi('không thấy phim');
  const goc = bc.thieu.filter((m) => m.loai === 'anchor' && m.ly_do.includes('chưa có ảnh gốc') && !m.ly_do.includes('chưa tả'));
  const coAnhGoc = new Set(((await db.execute(sql`SELECT id FROM xv_nhan_vat WHERE phim_id = ${phimId} AND jsonb_array_length(coalesce(anh_ref, '[]'::jsonb)) > 0`)) as unknown as Row[]).map((r) => n(r.id)));
  const btRow = ((await db.execute(sql`SELECT b.id, b.nhan_vat_id FROM xv_bien_the b JOIN xv_nhan_vat v ON v.id = b.nhan_vat_id WHERE v.phim_id = ${phimId}`)) as unknown as Row[]);
  const chaCua = new Map(btRow.map((r) => [n(r.id), n(r.nhan_vat_id)]));
  const bt = bc.thieu.filter((m) => m.loai === 'bien_the');
  const btSan = bt.filter((m) => coAnhGoc.has(chaCua.get(m.id) ?? -1));
  const cho = bt.filter((m) => !coAnhGoc.has(chaCua.get(m.id) ?? -1)).map((m) => `${m.cua} · ${m.ten}`);
  const l: string[] = [];
  const r1 = await songSong(goc, (m) => sinhAnhGoc(db, m.id, 1));
  r1.forEach((x, i) => { if (!x.ok) l.push(`${goc[i]!.ten}: ${x.loi}`); else if (!x.data.ok) l.push(`${goc[i]!.ten}: ${x.data.loi}`); });
  const r2 = await songSong(btSan, (m) => sinhAnhBienTheDb(db, m.id));
  r2.forEach((x, i) => { if (!x.ok) l.push(`${btSan[i]!.cua} · ${btSan[i]!.ten}: ${x.loi}`); else if (!x.data.ok) l.push(`${btSan[i]!.cua} · ${btSan[i]!.ten}: ${x.data.loi}`); });
  return { ok: true, data: { goc: goc.length, bienThe: btSan.length, cho, loi: l } };
}

/** Claude đọc kịch bản các tập → đề xuất biến thể cần cho anchor này → tạo luôn (chưa có ảnh). */
export async function goiYAIBienThe(nhanVatId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy anchor');
  const nc = await nguCanhPhimDb(db, n(r[0].phim_id));
  if (!nc) return loi('không thấy phim');
  const a = nc.nhanVat.find((v) => v.id === nhanVatId)!;
  const nhom = NHOM_BIEN_THE[a.loai] ?? NHOM_BIEN_THE.nhan_vat;
  const kq = await goiYBienThe(nc, a, nhom);
  await ghiChu(n(r[0].phim_id), `AI đề xuất biến thể · ${a.ten}`, kq);
  if (!kq.ok) return loi(kq.loi);
  const daCo = new Set((a.bien_the ?? []).map((b) => `${b.nhom}/${b.ten}`.toLowerCase()));
  let them = 0;
  for (const b of kq.data.bien_the) {
    const k = nhom.some((x) => x.key === b.nhom) ? b.nhom : nhom[0]!.key;
    if (daCo.has(`${k}/${b.ten}`.toLowerCase())) continue;
    await db.execute(sql`INSERT INTO xv_bien_the (nhan_vat_id, nhom, ten, mo_ta) VALUES (${nhanVatId}, ${k}, ${b.ten.trim()}, ${b.mo_ta})`);
    them++;
  }
  return { ok: true, data: them };
}

/** Sinh ảnh một biến thể TỪ ảnh gốc của anchor (tham chiếu) → giữ danh tính, chỉ đổi phần biến thể. Lõi: sinh-anh.ts › sinhAnhBienTheDb. */
export async function sinhAnhBienThe(bienTheId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhAnhBienTheDb(db, bienTheId);
}

// ── Tập ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function taoTap(phimId: number, ten: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten) VALUES (${phimId}, (SELECT coalesce(max(so), 0) + 1 FROM xv_tap WHERE phim_id = ${phimId}), ${ten.trim()}) RETURNING id`)) as unknown as Row[];
  await db.execute(sql`UPDATE xv_phim SET updated_at = now() WHERE id = ${phimId}`);
  return { ok: true, data: n(r[0]?.id) };
}

/** 🗺 Sơ đồ: tạo tập từ BẢN ĐỒ series (kinh_thanh.series.tap) — đúng số tập, tên + brief từ logline / nhân vật / bối cảnh / gài-trả. 0đ.
 *  Tập số đó đã có thì trả tập có sẵn. */
export async function taoTapTuBanDo(phimId: number, so: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const co = (await db.execute(sql`SELECT id FROM xv_tap WHERE phim_id = ${phimId} AND so = ${so} LIMIT 1`)) as unknown as Row[];
  if (co[0]) return { ok: true, data: n(co[0].id) };
  const p = (await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  const b = docKinhThanh(p[0]?.kinh_thanh as KinhThanh).series?.tap.find((t) => t.so === so);
  if (!b) return loi(`bản đồ series không có tập ${so}`);
  const brief = [`${b.ten} — ${b.logline}`, b.nhan_vat?.length ? `Nhân vật: ${b.nhan_vat.join(', ')}` : '', b.boi_canh?.length ? `Bối cảnh / đạo cụ: ${b.boi_canh.join(', ')}` : '', b.gai_tra ? `Gài / trả: ${b.gai_tra}` : ''].filter(Boolean).join('\n');
  const r = (await db.execute(sql`INSERT INTO xv_tap (phim_id, so, ten, brief) VALUES (${phimId}, ${so}, ${b.ten}, ${brief}) RETURNING id`)) as unknown as Row[];
  await db.execute(sql`UPDATE xv_phim SET updated_at = now() WHERE id = ${phimId}`);
  return { ok: true, data: n(r[0]?.id) };
}
export async function suaTap(id: number, d: { ten?: string; brief?: string; kich_ban?: string; tom_tat?: string; so?: number; noi_khung?: boolean; nhac_mo_ta?: string; thoi_luong_s?: number }): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_tap', id, cot: Object.keys(d), moTa: `sửa tập: ${Object.keys(d).join(', ')}`, nguoi: await ai() });
  await db.execute(sql`UPDATE xv_tap SET ten = coalesce(${d.ten ?? null}, ten), brief = coalesce(${d.brief ?? null}, brief), kich_ban = coalesce(${d.kich_ban ?? null}, kich_ban),
    tom_tat = coalesce(${d.tom_tat ?? null}, tom_tat), so = coalesce(${d.so ?? null}, so), thoi_luong_s = coalesce(${d.thoi_luong_s ?? null}, thoi_luong_s), noi_khung = coalesce(${d.noi_khung ?? null}, noi_khung), nhac_mo_ta = coalesce(${d.nhac_mo_ta ?? null}, nhac_mo_ta), updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

export async function xoaTap(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boVaoThungRac(db, 'tap', [id], me.email);   // vào thùng rác, khôi phục được — không xoá thật (#1192)
  return { ok: true, data: undefined };
}


/** Claude viết kịch bản từ brief → lưu vào tập (người sửa tiếp trong ô kịch bản). */
export async function vietKichBanTap(tapId: number, brief: string, thoiLuongS: number): Promise<Kq<string>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const thieu = thieuQc(bc.loai, bc.kt);   // quảng cáo chưa khai sản phẩm → Claude bịa tính năng (phim bra 09/10/2026) — chặn ở máy chủ, không chỉ mờ nút
  if (thieu) return loi(thieu);
  if (!brief.trim()) return loi('thiếu brief');
  const kq = await vietKichBan({ loai: bc.loai, kinhThanh: bc.kt, nhanVat: bc.nhanVat, brief, tapSo: bc.loai === 'phim' ? bc.tap.so : undefined, tapTruoc: bc.tapTruoc, thoiLuongS });
  if (!kq.ok) return loi(kq.loi);
  await ghiChu(bc.tap.phim_id, `Viết kịch bản · tập ${bc.tap.so}`, kq);
  await db.execute(sql`UPDATE xv_tap SET brief = ${brief}, kich_ban = ${kq.kichBan}, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: kq.kichBan };
}

/** Tách kịch bản thành cảnh. Thay toàn bộ cảnh đang là NHÁP của tập; cảnh đã có keyframe/video giữ nguyên (không mất tiền đã tốn). */
export async function tachCanhTap(tapId: number, soCanh: number, thoiLuongS?: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return tachCanhTapDb(db, tapId, soCanh, (await admin())!.email, thoiLuongS);
}

// ── QC mẫu (anh 09/10/2026): bài đăng kèm theo mẫu + phân tích video mẫu thành xương sống shot ─────────────────
/** Claude viết văn bản chính · tiêu đề · mô tả · nút cho bài đăng của tập (bám bài mẫu nếu có) → lưu xv_tap.bai_dang. */
/** 🧑 Thử người xem lần đầu (nguoi-xem.ts): Claude chỉ thấy bảng shot người xem thấy/nghe → kể lại + chấm hiểu + chỗ vấp; rồi đối chiếu
 *  logline/brief. Lưu kèm mã phiên bản kịch bản; cổng keyframe + xuất đọc kết quả này. TỐN TIỀN (2 lượt Claude, ~2–4 cent) — nút có giá. */
/** 🔍 Kiểm khung cả tập (kiem-khung.ts) — TỐN TIỀN: 1 lượt Claude nhìn ảnh / khối cảnh có keyframe chưa kiểm. */
export async function kiemKhungTapAction(tapId: number): Promise<Kq<{ khoi: number; shot: number; lech: number; cents: number }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  try { const r = await kiemKhungTap(db, tapId); return r.ok ? { ok: true, data: { ...r.data, lech: r.data.lech.length } } : r; } catch (e) { console.error('[kiểm khung]', e); return loi(`lỗi máy chủ: ${e instanceof Error ? e.message : String(e)}`); }
}
/** 🙂 Soi mặt cả tập (soi-mat.ts) — 0đ: OpenCV trên máy chủ so mặt trong keyframe với ảnh mẫu nhân vật. */
export async function soiMatTapAction(tapId: number, tatCa = false): Promise<Kq<{ soi: number; lech: { thu_tu: number; chu: string }[]; theo_doi: string[] }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  try { return await soiMatTap(db, tapId, { tatCa }); } catch (e) { console.error('[soi mặt]', e); return loi(`lỗi máy chủ: ${e instanceof Error ? e.message : String(e)}`); }
}
/** 🩹 Sửa mặt các shot lệch (soi-mat.ts › suaMatCanh) — TỐN TIỀN ~110₫ / lần thử / shot, tối đa 3 lần thử (giá ghi trên nút). */
export async function suaMatAction(canhIds: number[]): Promise<Kq<{ gui: number; loi: string[] }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  let gui = 0; const l: string[] = [];
  for (const id of canhIds) { const r = await suaMatCanh(db, id).catch((e: unknown) => ({ ok: false as const, loi: String(e) })); if (r.ok) gui++; else l.push(r.loi); }
  return { ok: true, data: { gui, loi: l } };
}
/** Người nhận một khung máy báo lệch MẶT (máy báo nhầm: góc nghiêng gắt, ánh sáng lạ) — 0đ. */
export async function duyetMatTayAction(canhId: number): Promise<Kq<true>> {
  const db = getDb(); const me = await admin();
  if (!db || !me) return loi('không có quyền');
  await duyetMatTay(db, canhId, me.email);
  return { ok: true, data: true };
}
/** Người nhận một khung máy báo lệch (máy báo sai) — 0đ. */
export async function duyetKhungTayAction(canhId: number): Promise<Kq<true>> {
  const db = getDb(); const me = await admin();
  if (!db || !me) return loi('không có quyền');
  const r = await duyetKhungTay(db, canhId, me.email);
  return r.ok ? { ok: true, data: true } : r;
}
/** Người duyệt nhận clip máy soi báo lỗi (máy báo nhầm) — 0đ; bản xuất nhận lại clip này. Clip mới sinh thì soi lại từ đầu. */
export async function boQuaSoiClipAction(canhId: number): Promise<Kq<true>> {
  const db = getDb(); const me = await admin();
  if (!db || !me) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_canh SET soi_clip = soi_clip || ${JSON.stringify({ bo_qua: true, bo_qua_boi: me.email })}::jsonb WHERE id = ${canhId} AND soi_clip IS NOT NULL`);
  return { ok: true, data: true };
}
/** LUỒNG CẢNH (script supervisor, 16/10/2026): khai NGÀY TRUYỆN (N1, D2…) và cảnh có tiếp LIỀN thời gian cảnh trước không, cho một cảnh của
 *  phân cảnh tập — cổng liền mạch theo nhân vật (bo-set-3d.ts › lienMachTap) reset sổ theo hai trường này. null = xoá khai (về mặc định liền mạch). */
export async function luuLuongCanh(tapId: number, ten: string, v: { ngay?: string | null; lien_truoc?: boolean | null }): Promise<Kq<true>> {
  const db = getDb(); const me = await admin();
  if (!db || !me) return loi('không có quyền');
  const dat: Record<string, unknown> = {}; const xoa: string[] = [];
  if (v.ngay !== undefined) { if (v.ngay && v.ngay.trim()) dat.ngay = v.ngay.trim().toUpperCase(); else xoa.push('ngay'); }
  if (v.lien_truoc !== undefined) { if (v.lien_truoc === null) xoa.push('lien_truoc'); else dat.lien_truoc = v.lien_truoc; }
  await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['phan_canh'], moTa: `luồng cảnh "${ten}"`, nguoi: me.email });
  await db.execute(sql`UPDATE xv_tap SET phan_canh = (SELECT coalesce(jsonb_agg(CASE WHEN x->>'ten' = ${ten} THEN (x - ${`{${xoa.join(',')}}`}::text[]) || ${JSON.stringify(dat)}::jsonb ELSE x END ORDER BY o), '[]'::jsonb)
    FROM jsonb_array_elements(phan_canh) WITH ORDINALITY AS t(x, o)), updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: true };
}
/** 🇻🇳 trên lưới (#1397): dịch mô tả các shot của tập CHƯA có bản tiếng Việt bằng model chữ rẻ nhất (claude.ts › dichMoTaVi), lưu hanh_dong_vi.
 *  Shot đã có bản dịch / hành động đã là tiếng Việt thì bỏ qua — bấm lại không tốn thêm. Trả số shot vừa dịch + tiền. */
export async function dichMoTaTap(tapId: number): Promise<Kq<{ so: number; cents: number }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const ds = ((await db.execute(sql`SELECT c.id, c.hanh_dong, t.phim_id, t.so FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.tap_id = ${tapId} AND c.hanh_dong_vi = '' AND coalesce(c.hanh_dong, '') <> '' ORDER BY c.thu_tu`)) as unknown as Row[])
    .filter((r) => !laTiengViet(s(r.hanh_dong)));
  if (!ds.length) return { ok: true, data: { so: 0, cents: 0 } };
  const kq = await dichMoTaVi(ds.map((r) => s(r.hanh_dong)));
  if (!kq.ok) return loi(kq.loi);
  const cents = await ghiTienChu(db, n(ds[0]!.phim_id), `Dịch mô tả shot sang tiếng Việt · tập ${n(ds[0]!.so)}`, kq.model, kq.tokens);
  let so = 0;
  for (const [i, r] of ds.entries()) { const v = kq.data[i]; if (!v) continue; await db.execute(sql`UPDATE xv_canh SET hanh_dong_vi = ${v} WHERE id = ${n(r.id)} AND hanh_dong_vi = ''`); so++; }
  return { ok: true, data: { so, cents } };
}
// ── SỔ NGUỒN AI (nguon-ai.ts, migration 0263) ─────────────────────────────────────────────────────────────────────────
/** Mọi nguồn + model; ổn định tính trực tiếp từ xv_job trong `ngay` ngày (ma_job = 'provider|model'). Khoá chỉ báo có / chưa có. */
export async function dsNguonAi(ngay = 14): Promise<Kq<{ nguon: Nguon[]; model: NguonModel[] }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const ng = (await db.execute(sql`SELECT * FROM xv_nguon ORDER BY CASE trang_thai WHEN 'dang' THEN 0 WHEN 'co_tk' THEN 1 WHEN 'tham_khao' THEN 2 ELSE 3 END, ten`)) as unknown as Row[];
  const md = (await db.execute(sql`SELECT m.*, od.goi AS od_goi, od.dat AS od_dat, od.giay AS od_giay, od.cents AS od_cents, od.dat_gan AS od_dat_gan, od.loi_gan AS od_loi_gan FROM xv_nguon_model m
    LEFT JOIN LATERAL (SELECT count(*) AS goi, count(*) FILTER (WHERE j.trang_thai = 'xong') AS dat,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM j.updated_at - j.created_at)) FILTER (WHERE j.trang_thai = 'xong') AS giay,
        coalesce(sum(j.chi_phi_cents), 0) AS cents, max(j.updated_at) FILTER (WHERE j.trang_thai = 'xong') AS dat_gan,
        (array_agg(left(j.loi, 160) ORDER BY j.created_at DESC) FILTER (WHERE j.trang_thai <> 'xong' AND coalesce(j.loi, '') <> ''))[1] AS loi_gan
      FROM xv_job j WHERE cardinality(m.ma_job) > 0 AND (j.provider || '|' || j.model) = ANY(m.ma_job) AND j.created_at > now() - make_interval(days => ${ngay})) od ON true
    ORDER BY m.loai, m.gia_vnd NULLS LAST, m.model`)) as unknown as Row[];
  // số dư: ảnh chụp Phòng Tài nguyên trên cùng box (apps/cty/worker/tai-nguyen-api.mjs) — chưa có tệp thì cột số dư để trống
  let anh: { du?: Record<string, number | null>; luc?: string } = {};
  try { anh = JSON.parse(await (await import('node:fs/promises')).readFile(`${process.env.CTY_DATA_DIR || '/var/lib/cty'}/tai-nguyen-api.json`, 'utf8')); } catch { /* chưa có ảnh chụp */ }
  const soDu = (k: string): SoDu | null => { const v = anh.du?.[k]; return typeof v === 'number' && DON_SO_DU[k] ? { gia_tri: v, don_vi: DON_SO_DU[k]!, luc: anh.luc ?? '' } : null; };
  return { ok: true, data: {
    nguon: ng.map((r) => ({ so_du: soDu(s(r.key)), key: s(r.key), ten: s(r.ten), kieu: s(r.kieu), trang_thai: s(r.trang_thai) as TrangThaiNguon, loai: s(r.loai), tra_tien: s(r.tra_tien), vault: s(r.vault), nap_tien: s(r.nap_tien), rui_ro: s(r.rui_ro), co_khoa: coKhoa(s(r.khoa_env), process.env) })),
    model: md.map((r) => ({ id: n(r.id), nguon_key: s(r.nguon_key), loai: s(r.loai) as LoaiNguon, model: s(r.model), goi: s(r.goi), gia_vnd: r.gia_vnd == null ? null : Number(r.gia_vnd), gia_goc: s(r.gia_goc), link: s(r.link), link_phu: s(r.link_phu),
      ngay_doc: r.ngay_doc == null ? null : String(r.ngay_doc).slice(0, 10), kha_nang: s(r.kha_nang), khop: (Array.isArray(r.khop) ? r.khop : []) as O[], tat: s(r.tat),
      // cột ổn định đặt bí danh od_*: xv_nguon_model đã có cột `goi` (tên gói) — trùng tên thì số lượt ghi đè tên gói
      on_dinh: n(r.od_goi) ? { goi: n(r.od_goi), dat: n(r.od_dat), giay: r.od_giay == null ? null : Math.round(Number(r.od_giay)), cents: Number(r.od_cents), dat_gan: r.od_dat_gan == null ? null : String(r.od_dat_gan), loi_gan: r.od_loi_gan == null ? null : s(r.od_loi_gan) } : null })),
  } };
}
/** Đổi trạng thái một nguồn (Đưa vào dùng / ngừng). Chỉ đổi sổ — tạo tài khoản, nạp tiền, đặt khoá vẫn là việc của anh. */
export async function doiTrangThaiNguon(key: string, tt: TrangThaiNguon): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!(tt in TEN_TRANG_THAI)) return loi('trạng thái lạ');
  await db.execute(sql`UPDATE xv_nguon SET trang_thai = ${tt}, updated_at = now() WHERE key = ${key}`);
  return { ok: true, data: undefined };
}
/** Thêm một bên (chưa có thì tạo, trạng thái Tham khảo) + một model của bên đó. Giá nhập theo đơn vị chuẩn của loại. */
export async function themNguonModel(d: { ten: string; loai: LoaiNguon; model: string; gia_vnd: number | null; gia_goc: string; link: string }): Promise<Kq<string>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const ten = d.ten.trim(), model = d.model.trim();
  if (!ten || !model) return loi('cần tên bên và tên model');
  if (!LOAI_NGUON.some((l) => l.key === d.loai)) return loi('loại lạ');
  // Giá phải kèm trang chứa giá đó (CHECK trong 0263 chặn ở tầng DB; đây báo lỗi dễ hiểu trước).
  if (d.gia_vnd != null && !/^https?:\/\//.test(d.link.trim())) return loi('giá phải kèm link trang chứa giá (https://…)');
  const key = ten.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `nguon-${Date.now()}`;
  await db.execute(sql`INSERT INTO xv_nguon (key, ten, nap_tien) VALUES (${key}, ${ten}, ${d.link.trim()}) ON CONFLICT (key) DO NOTHING`);
  await db.execute(sql`INSERT INTO xv_nguon_model (nguon_key, loai, model, gia_vnd, gia_goc, link, ngay_doc) VALUES (${key}, ${d.loai}, ${model}, ${d.gia_vnd}, ${d.gia_goc.trim() || 'nhập tay'}, ${d.link.trim()}, now()::date)
    ON CONFLICT (nguon_key, loai, model, goi) DO UPDATE SET gia_vnd = EXCLUDED.gia_vnd, gia_goc = EXCLUDED.gia_goc, link = EXCLUDED.link, ngay_doc = EXCLUDED.ngay_doc, updated_at = now()`);
  return { ok: true, data: key };
}
export async function thuNguoiXemTap(tapId: number): Promise<Kq<ThuNguoiXem>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  try { return await kiemNguoiXemTap(db, tapId); } catch (e) { console.error('[kiểm người xem]', e); return loi(`lỗi máy chủ: ${e instanceof Error ? e.message : String(e)}`); }
}
/** 🧑 Kiểm người xem RIÊNG một cảnh (kiem-nguoi-xem.ts › kiemNguoiXemCanh) — TỐN TIỀN, rẻ hơn kiểm cả tập. */
export async function thuNguoiXemCanh(tapId: number, phanDoan: string): Promise<Kq<ThuNguoiXem>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  try { return await kiemNguoiXemCanh(db, tapId, phanDoan); } catch (e) { console.error('[kiểm người xem cảnh]', e); return loi(`lỗi máy chủ: ${e instanceof Error ? e.message : String(e)}`); }
}
/** ✍ Sửa kịch bản theo kết quả kiểm người xem (kiem-nguoi-xem.ts) — TỐN TIỀN (1 lượt Claude), ↶ hoàn tác được. */
export async function suaTheoNguoiXem(tapId: number): Promise<Kq<{ sua: number; them: number; canGiong: number; canHinh: number[]; ghi_chu: string }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  try { return await suaTheoNguoiXemTap(db, tapId, await ai()); } catch (e) { console.error('[sửa theo người xem]', e); return loi(`lỗi máy chủ: ${e instanceof Error ? e.message : String(e)}`); }
}
export async function vietBaiDangTap(tapId: number): Promise<Kq<BaiDang>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const thieu = thieuQc(bc.loai, bc.kt);
  if (thieu) return loi(thieu);
  const canh = (await db.execute(sql`SELECT chu_man FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu`)) as unknown as Row[];
  const kq = await vietBaiDang({ kinhThanh: bc.kt, kichBan: bc.tap.kich_ban || bc.tap.brief, chuMan: canh.map((c) => s(c.chu_man)) });
  if (!kq.ok) return loi(kq.loi);
  await ghiChu(bc.tap.phim_id, `Bài đăng kèm · tập ${bc.tap.so}`, kq);
  const bd: BaiDang = { ...kq.data, luc: new Date().toISOString() };
  await db.execute(sql`UPDATE xv_tap SET bai_dang = ${JSON.stringify(bd)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: bd };
}
/** Ước tiền dịch CẢ PHIM (0đ): số chuỗi tiếng Việt còn lại (anchor, kinh thánh, tập, shot, thoại) × giá model chữ của phim. */
export async function uocDichPhim(phimId: number): Promise<Kq<{ cents: number; chars: number; soChuoi: number; soLo: number; soCoGiong: number; ngonNgu: string }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const nd = await docPhimDich(db, phimId);
  if (!nd) return loi('không thấy phim');
  const kt = docKinhThanh(nd.kt);
  return { ok: true, data: { cents: uocDichCents(kt.mo_hinh_chu, nd.chars, nd.soLo), chars: nd.chars, soChuoi: nd.chuoi.length, soLo: nd.soLo, soCoGiong: nd.soCoGiong, ngonNgu: kt.ngon_ngu } };
}
/** Dịch CẢ PHIM sang ngôn ngữ khác (Claude, TỐN TIỀN): mọi chữ tiếng Việt của phim; giữ keyframe/video; đổi ngon_ngu; hoàn tác được. */
export async function dichPhimSang(phimId: number, sang: string): Promise<Kq<{ soBanGhi: number; boGiong: number; cents: number; conViet: number }>> {
  const db = getDb();
  if (!db) return loi('no db');
  const ad = await admin();
  if (!ad) return loi('không có quyền');
  if (!NGON_NGU.some((x) => x.value === sang)) return loi(`ngôn ngữ lạ: ${sang}`);
  return chayDichPhim(db, phimId, sang, ad.email);
}
/** Thao tác mới nhất có thể hoàn tác của phim (nút ↶ trên đầu drawer phim, #1252). */
export async function docHoanTac(phimId: number): Promise<Kq<MucHoanTac | null>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return { ok: true, data: await ganNhat(db, phimId) };
}
/** ↶ Hoàn tác thao tác mới nhất (cả nhóm) — ghi lại giá trị cũ đã chụp trước khi sửa. */
export async function hoanTac(phimId: number): Promise<Kq<string>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const m = await hoanTacGanNhat(db, phimId);
  return m == null ? loi('không còn gì để hoàn tác') : { ok: true, data: m };
}
/** Sửa tay bài đăng (sau khi Claude viết). */
export async function suaBaiDang(tapId: number, d: Omit<BaiDang, 'luc'>): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['bai_dang'], moTa: 'sửa bài đăng', nguoi: await ai() });
  const bd: BaiDang = { chu_bai: d.chu_bai, tieu_de: d.tieu_de, mo_ta: d.mo_ta, cta: d.cta, luc: new Date().toISOString() };
  await db.execute(sql`UPDATE xv_tap SET bai_dang = ${JSON.stringify(bd)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: undefined };
}
/** Tải video mẫu (qc.mau.video_url) về máy chủ, lấy khung hình mỗi ~2s (tối đa 40 khung), Claude nhìn → shots + ghi chú vào qc.mau. */
export async function phanTichVideoMau(phimId: number): Promise<Kq<MauQc>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy phim');
  const kt = docKinhThanh(r[0].kinh_thanh as KinhThanh);
  const mau: MauQc = { nguon: '', video_url: '', chu_bai: '', tieu_de: '', cta: '', ghi_chu: '', shots: [], ...(kt.qc?.mau ?? {}) };
  if (!/^https?:\/\//.test(mau.video_url.trim())) return loi('dán link video mẫu (mp4) vào ô Video mẫu trước');
  const { khungHinhVideo } = await import('@/lib/xuong-video/xuat-chay');
  const kh = await khungHinhVideo(mau.video_url.trim(), 40);
  if (!kh.ok) return loi(kh.loi);
  const kq = await phanTichMau(kh.khung, kh.giay, kt);
  if (!kq.ok) return loi(kq.loi);
  await ghiChu(phimId, 'Phân tích video mẫu', kq);
  const moi: MauQc = { ...mau, shots: kq.data.shots, ghi_chu: mau.ghi_chu.trim() ? mau.ghi_chu : kq.data.ghi_chu };
  const nvK = (await db.execute(sql`SELECT ten, loai FROM xv_nhan_vat WHERE phim_id = ${phimId}`)) as unknown as Row[];
  await ghiKhuonTuMau(db, moi.shots, nvK.map((v) => ({ ten: s(v.ten), loai: s(v.loai) as NhanVat['loai'] })), kt.qc?.ten ?? '', `QC mẫu${moi.nguon ? ` · ${moi.nguon.slice(0, 60)}` : ''}`, phimId);
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(jsonb_set(coalesce(kinh_thanh, '{}'::jsonb), '{qc}', coalesce(kinh_thanh->'qc', '{}'::jsonb)), '{qc,mau}', ${JSON.stringify(moi)}::jsonb), updated_at = now() WHERE id = ${phimId}`);
  return { ok: true, data: moi };
}

// ── Bản xuất (review 09/10/2026): MP4 hoàn chỉnh của tập theo nhánh hook — thứ gửi Meta/TikTok ──────────────────
/** Dựng bản xuất ở nền (ffmpeg trên máy chủ). Trả job id; UI hỏi trangThaiXuat tới khi xong rồi tải lại tập. Không tốn tiền model. */
/** DUYỆT ANIMATIC (quy-trinh.ts › chanAnimatic): lấy bản xuất mới nhất của tập (dựng từ keyframe khi chưa có clip) làm animatic, ghi mã keyframe
 *  + giây hiện tại vào hồ sơ tập. Có bản ghi này cổng sinh video mới mở; keyframe/giây đổi sau đó là phải duyệt lại. 0đ. */
export async function duyetAnimatic(tapId: number): Promise<Kq<string>> {
  const db = getDb(); const me = await admin();
  if (!db || !me) return { ok: false, loi: 'không có quyền' };
  const t = (await db.execute(sql`SELECT xuat, ho_so FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return { ok: false, loi: 'không thấy tập' };
  const xuat = ((t[0].xuat ?? []) as BanXuat[]).filter((x) => !x.long_tieng);
  const moi = xuat[xuat.length - 1];
  if (!moi) return { ok: false, loi: 'tập chưa có bản xuất — bấm ⬇ Xuất (shot chưa có clip sẽ dựng bằng keyframe) rồi xem và duyệt' };
  const ds = ((await db.execute(sql`SELECT thu_tu, nhanh, keyframe_url, phat_s, thoi_luong_s, kiem_khung FROM xv_canh WHERE tap_id = ${tapId}`)) as unknown as Row[]).map((r) => ({ thu_tu: Number(r.thu_tu), nhanh: String(r.nhanh ?? ''), keyframe_url: (r.keyframe_url as string | null) ?? null, phat_s: r.phat_s == null ? null : Number(r.phat_s), thoi_luong_s: Number(r.thoi_luong_s), kiem_khung: (r.kiem_khung ?? null) as KiemKhung | null }));
  if (ds.some((c) => (!c.nhanh || c.nhanh === 'A') && !c.keyframe_url)) return { ok: false, loi: 'còn shot chưa có keyframe — animatic phải đủ hình' };
  const khungSai = ds.filter((c) => (!c.nhanh || c.nhanh === 'A') && chanKhung(c));
  if (khungSai.length) return { ok: false, loi: `${khungSai.length} keyframe chưa qua ${TEN_NUT_KHUNG} hoặc lệch (shot ${khungSai.map((c) => `#${c.thu_tu}`).join(', ')}) — kiểm khung ở tab Lưới, sinh lại khung lệch` };
  await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['ho_so'], moTa: 'duyệt animatic', nguoi: me.email });
  const animatic = { url: moi.url, ma: maAnimatic(ds), luc: new Date().toISOString() };
  await db.execute(sql`UPDATE xv_tap SET ho_so = coalesce(ho_so, '{}'::jsonb) || ${JSON.stringify({ animatic })}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: moi.url };
}
export async function xuatTap(tapId: number, nhanh?: string | null): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = await batDauXuatTap(db, tapId, await dsCanh(tapId), nhanh);
  if (!r.ok) return loi(r.loi);
  chayNen(async () => { await r.chay(); });
  return { ok: true, data: r.job };
}
/** Trạng thái một job xuất: đang chạy / xong (url) / lỗi. */
/** 🇻🇳 Bản lồng tiếng Việt (long-tieng.ts) — chạy nền như ⬇ Xuất, trả job để nút hỏi tiến độ. Vừa để người chỉ biết tiếng Việt xem hộ,
 *  vừa là track tiếng Việt gắn vào video gốc trên YouTube. TỐN TIỀN: 1 lượt Claude dịch (~1–3 cent, nhớ theo nội dung) + ký tự ElevenLabs
 *  trong gói (câu đã đọc thì dùng lại); dựng MP4 0đ. Không qua cổng xuất: bản này cũng là để kiểm. */
export async function xuatLongTiengVi(tapId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhTap(db, tapId);
  if (!bc) return loi('không thấy tập');
  const job = await taoJob(db, { phim_id: bc.tap.phim_id, nhan: `Lồng tiếng Việt · tập ${bc.tap.so}`, loai: 'xuat', provider: 'ffmpeg', model: 'ffmpeg', request: { tap_id: tapId, long_tieng: 'vi' } });
  chayNen(async () => {
    const r = await xuatLongTiengTap(db, tapId, job, 'vi').catch((e: unknown) => ({ ok: false as const, loi: e instanceof Error ? e.message : String(e) }));
    if (!r.ok) await xongJobDb(db, job, { loi: r.loi });
  });
  return { ok: true, data: job };
}
export async function trangThaiXuat(jobId: number): Promise<{ trang_thai: string; url: string | null; loi: string }> {
  const db = getDb();
  if (!db || !(await admin())) return { trang_thai: 'loi', url: null, loi: 'không có quyền' };
  const r = (await db.execute(sql`SELECT trang_thai, output_url, loi FROM xv_job WHERE id = ${jobId}`)) as unknown as Row[];
  return r[0] ? { trang_thai: s(r[0].trang_thai), url: r[0].output_url == null ? null : s(r[0].output_url), loi: s(r[0].loi) } : { trang_thai: 'loi', url: null, loi: 'không thấy job' };
}

// ── Cảnh ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Sắp lại thứ tự cảnh của một tập theo danh sách id (kéo thả trên timeline). Một câu UPDATE, cảnh ngoài tập không bị đụng. */
export async function xepCanh(tapId: number, ids: number[]): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  { const nhom = await chupTruoc(db, { bang: 'xv_canh', id: ids[0] ?? 0, cot: ['thu_tu'], moTa: `xếp lại thứ tự ${ids.length} shot`, nguoi: await ai() }); for (const id of ids.slice(1)) await chupTruoc(db, { bang: 'xv_canh', id, cot: ['thu_tu'], moTa: 'xếp lại thứ tự', nguoi: '', nhom }); }
  await db.execute(sql`UPDATE xv_canh c SET thu_tu = x.i, updated_at = now()
    FROM unnest(${mangInt(ids)}::int[]) WITH ORDINALITY AS x(id, i) WHERE c.id = x.id AND c.tap_id = ${tapId}`);
  return { ok: true, data: undefined };
}

/** Tắt / bật KHUNG DỰNG LẠI theo điểm nhìn ở một shot (diem-nhin-tap.ts): tắt = giữ khung gốc ngay (gỡ khung_lai), bật lại = lần xuất / đo sau tính lại. */
export async function datKhungLaiTat(id: number, tat: boolean): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id, cot: ['ky_thuat'], moTa: tat ? '👁 tắt khung dựng lại' : '👁 bật khung dựng lại', nguoi: await ai() });
  await db.execute(tat ? sql`UPDATE xv_canh SET ky_thuat = (coalesce(ky_thuat, '{}'::jsonb) - 'khung_lai') || '{"khung_lai_tat": true}'::jsonb, updated_at = now() WHERE id = ${id}`
    : sql`UPDATE xv_canh SET ky_thuat = coalesce(ky_thuat, '{}'::jsonb) - 'khung_lai_tat', updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

export async function suaCanh(id: number, d: Partial<Pick<Canh, 'canh' | 'goc_may' | 'hanh_dong' | 'hanh_dong_vi' | 'loi_thoai' | 'am_thanh' | 'thoi_luong_s' | 'nhan_vat' | 'bien_the' | 'prompt_anh' | 'prompt_video' | 'thu_tu' | 'phan_doan' | 'cam_xuc' | 'ky_thuat' | 'thoai' | 'trang_phuc' | 'phat_s' | 'chu_man' | 'nhanh' | 'kieu_chu' | 'dan_dung'>>): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id, cot: [...Object.keys(d), ...(d.thoai ? ['loi_thoai', 'thoai_url'] : [])], moTa: `sửa shot: ${Object.keys(d).join(', ')}`, nguoi: await ai() });
  // Thoại theo dòng: lưu dòng + ghép lại loi_thoai; dòng nào đổi lời thì bỏ file giọng cũ của dòng đó (đọc sai lời).
  if (d.thoai) {
    const cu = ((await db.execute(sql`SELECT thoai FROM xv_canh WHERE id = ${id}`)) as unknown as Row[])[0];
    const cuDs = arr<Canh['thoai'][number]>(cu?.thoai);
    const moi = d.thoai.filter((x) => x.loi.trim() || x.nhan_vat.trim()).map((x) => { const c0 = cuDs.find((y) => y.loi === x.loi && y.nhan_vat === x.nhan_vat); return { nhan_vat: x.nhan_vat, dien_xuat: x.dien_xuat, loi: x.loi, url: c0?.url ?? null, ...(typeof x.tre === 'number' ? { tre: x.tre } : {}) }; });
    d = { ...d, loi_thoai: ghepThoai(moi) };
    await db.execute(sql`UPDATE xv_canh SET thoai = ${JSON.stringify(moi)}::jsonb, thoai_url = ${moi[0]?.url ?? null} WHERE id = ${id}`);
  }
  await db.execute(sql`UPDATE xv_canh SET
    canh = coalesce(${d.canh ?? null}, canh), goc_may = coalesce(${d.goc_may ?? null}, goc_may), hanh_dong = coalesce(${d.hanh_dong ?? null}, hanh_dong), hanh_dong_vi = coalesce(${d.hanh_dong_vi ?? null}, hanh_dong_vi),
    loi_thoai = coalesce(${d.loi_thoai ?? null}, loi_thoai), am_thanh = coalesce(${d.am_thanh ?? null}, am_thanh), thoi_luong_s = coalesce(${d.thoi_luong_s ?? null}, thoi_luong_s),
    nhan_vat = coalesce(${d.nhan_vat ? JSON.stringify(d.nhan_vat) : null}::jsonb, nhan_vat), bien_the = coalesce(${d.bien_the ? JSON.stringify(d.bien_the) : null}::jsonb, bien_the), prompt_anh = coalesce(${d.prompt_anh ?? null}, prompt_anh),
    prompt_video = coalesce(${d.prompt_video ?? null}, prompt_video), thu_tu = coalesce(${d.thu_tu ?? null}, thu_tu),
    phan_doan = coalesce(${d.phan_doan ?? null}, phan_doan), cam_xuc = coalesce(${d.cam_xuc ?? null}, cam_xuc), trang_phuc = coalesce(${d.trang_phuc ?? null}, trang_phuc),
    phat_s = CASE WHEN ${d.phat_s === undefined} THEN phat_s ELSE ${d.phat_s ?? null} END, chu_man = coalesce(${d.chu_man ?? null}, chu_man), nhanh = coalesce(${d.nhanh ?? null}, nhanh), kieu_chu = coalesce(${d.kieu_chu ? JSON.stringify(d.kieu_chu) : null}::jsonb, kieu_chu),
    ky_thuat = CASE WHEN ${d.ky_thuat ? 1 : 0} = 1 THEN (coalesce(ky_thuat, '{}'::jsonb) - ${`{${khoaKyThuatForm().join(',')}}`}::text[]) || ${d.ky_thuat ? JSON.stringify(lamSachKyThuat(d.ky_thuat as unknown as Record<string, unknown>)) : '{}'}::jsonb ELSE ky_thuat END, dan_dung = coalesce(${d.dan_dung ? JSON.stringify(d.dan_dung) : null}::jsonb, dan_dung), updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}

export async function themCanh(tapId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`INSERT INTO xv_canh (tap_id, thu_tu, canh) VALUES (${tapId}, (SELECT coalesce(max(thu_tu), 0) + 1 FROM xv_canh WHERE tap_id = ${tapId}), 'Cảnh mới') RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]?.id) };
}

export async function xoaCanh(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  const me = await admin();
  if (!me) return loi('không có quyền');
  await boVaoThungRac(db, 'canh', [id], me.email);   // vào thùng rác, khôi phục được — không xoá thật (#1192)
  return { ok: true, data: undefined };
}




/** Ảnh gốc cho anchor (lõi ở sinh-anh.ts — script dùng chung). */
export async function sinhAnhMau(nhanVatId: number, so = 1): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhAnhGoc(db, nhanVatId, so);
}
/** Keyframe cho một shot (lõi ở sinh-anh.ts — script dùng chung). */
export async function sinhKeyframe(canhId: number, so = 1, moHinh?: string): Promise<Kq<number[]>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhKeyframeCanh(db, canhId, so, moHinh);
}

/** Sinh một poster cho phim (lõi sinh-anh.ts › sinhPosterPhim). */
export async function sinhPoster(phimId: number, yTuong = '', mau: MauPoster | '' = ''): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhPosterPhim(db, phimId, yTuong, mau);
}
/** Chọn poster đang dùng trong các bản đã sinh (↶ hoàn tác được). */
export async function chonPoster(phimId: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_phim', id: phimId, cot: ['poster_url'], moTa: 'chọn poster', nguoi: await ai() });
  await db.execute(sql`UPDATE xv_phim SET poster_url = ${url}, updated_at = now() WHERE id = ${phimId} AND poster_uv @> ${JSON.stringify([url])}::jsonb`);
  return { ok: true, data: undefined };
}
// ── Góc bán từ spy.on.tc (goc-spy.ts): spy chạy cùng box, đọc thẳng API nội bộ của nó ─────────────────────────────────
const SPY_API = process.env.SPY_API_URL || 'http://127.0.0.1:3850';
async function docSpy<T>(duong: string): Promise<Kq<T>> {
  try {
    const r = await fetch(`${SPY_API}${duong}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return loi(`spy trả ${r.status}`);
    return { ok: true, data: (await r.json()) as T };
  } catch (e) { return loi(`không gọi được spy (${e instanceof Error ? e.message.slice(0, 60) : 'lỗi'})`); }
}
export type SpSpy = { id: number; ten: string };
/** Nhóm sản phẩm trên spy (để chọn nơi lấy góc). */
export async function dsSpSpy(): Promise<Kq<SpSpy[]>> {
  if (!(await admin())) return loi('không có quyền');
  const r = await docSpy<{ id: number; ten: string }[]>('/api/goc/sp');
  return r.ok ? { ok: true, data: r.data.map((x) => ({ id: Number(x.id), ten: String(x.ten ?? '') })) } : r;
}
/** Góc AI của một nhóm sản phẩm spy (chân dung · nỗi đau · mong muốn · tình huống · phản đối), nhiều người nhắc trước. */
export async function dsGocSpy(sp: number): Promise<Kq<(GocSpy & { so_nhac: number })[]>> {
  if (!(await admin())) return loi('không có quyền');
  const r = await docSpy<{ id: number; loai: string; ten: string; mo_ta?: string; so_nhac?: number }[]>(`/api/goc?sp=${sp}`);
  if (!r.ok) return r;
  return { ok: true, data: r.data.filter((g) => String(g.loai).startsWith('ai_')).map((g) => ({ id: Number(g.id), sp, loai: g.loai, ten: g.ten, mo_ta: g.mo_ta ?? '', so_nhac: Number(g.so_nhac ?? 0) }))
    .sort((a, b) => b.so_nhac - a.so_nhac) };
}
/** Nhóm spy nên dùng cho phim: nhóm đang gắn ở phim, không có thì nhóm đã gắn cho phim QC khác CÙNG sản phẩm (nhom-phim.ts › sanPhamPhim). */
export async function spGoiYSpy(phimId: number): Promise<Kq<number | null>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const ds = ((await db.execute(sql`SELECT id, loai, kinh_thanh, goc_spy FROM xv_phim WHERE loai = 'quang_cao' AND jsonb_array_length(goc_spy) > 0 OR id = ${phimId}`)) as unknown as Row[])
    .map((r) => ({ id: n(r.id), sp: sanPhamPhim({ loai: s(r.loai) as LoaiPhim, kinh_thanh: (r.kinh_thanh ?? {}) as KinhThanh })?.key ?? null, nhom: nhomCuaGoc(docGocSpy(r.goc_spy)) }));
  const ban = ds.find((x) => x.id === phimId);
  if (ban?.nhom.length) return { ok: true, data: ban.nhom[0]! };
  const cung = ban?.sp ? ds.find((x) => x.id !== phimId && x.sp === ban.sp && x.nhom.length) : null;
  return { ok: true, data: cung?.nhom[0] ?? null };
}
/** Ghi danh sách góc spy của phim (↶ hoàn tác được). */
export async function luuGocSpy(phimId: number, ds: GocSpy[]): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const sach = xepGocSpy(docGocSpy(ds)).map((g) => ({ id: g.id, sp: g.sp, loai: g.loai, ten: g.ten, ...(g.mo_ta ? { mo_ta: g.mo_ta.slice(0, 400) } : {}) }));
  if (nhomCuaGoc(sach).length > 1) return loi('góc của một video phải cùng MỘT nhóm sản phẩm spy (đúng sản phẩm đang bán) — bỏ các góc của nhóm khác');
  await chupTruoc(db, { bang: 'xv_phim', id: phimId, cot: ['goc_spy'], moTa: 'sửa góc spy', nguoi: await ai() });
  await db.execute(sql`UPDATE xv_phim SET goc_spy = ${JSON.stringify(sach)}::jsonb, updated_at = now() WHERE id = ${phimId}`);
  return { ok: true, data: undefined };
}

// ── Ảnh QC (anh-qc.ts): ảnh creative tĩnh chép bố cục ảnh QC đang thắng ─────────────────────────────────────────────
const mapAnhQc = (r: Row): AnhQc => ({ id: n(r.id), phim_id: n(r.phim_id), khuon: s(r.khuon), ten: s(r.ten), mau_url: s(r.mau_url), chu: s(r.chu), y_tuong: s(r.y_tuong),
  ti_le: (s(r.ti_le) || '4:5') as AnhQc['ti_le'], mo_hinh: s(r.mo_hinh) || MO_HINH_ANH_QC, url: r.url ? s(r.url) : null, uv: arr<string>(r.uv), an: r.an === true });
export type DsAnhQc = { ds: AnhQc[]; dang: number[]; loi: Record<number, string> };
/** Ảnh QC của phim (kể cả ảnh đã ẩn — giao diện tự lọc) + ảnh nào đang sinh + lỗi lượt gần nhất của từng ảnh. */
export async function dsAnhQc(phimId: number): Promise<Kq<DsAnhQc>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const [r, j] = await Promise.all([
    db.execute(sql`SELECT * FROM xv_anh_qc WHERE phim_id = ${phimId} ORDER BY id`),
    db.execute(sql`SELECT DISTINCT ON ((request->>'anh_qc_id')::int) (request->>'anh_qc_id')::int AS a, trang_thai, loi, (${jobDangCho()}) AS dang
      FROM xv_job WHERE phim_id = ${phimId} AND request->>'dich' = 'anh_qc' ORDER BY (request->>'anh_qc_id')::int, id DESC`),
  ]);
  const jr = j as unknown as Row[];
  return { ok: true, data: { ds: (r as unknown as Row[]).map(mapAnhQc), dang: jr.filter((x) => x.dang === true).map((x) => n(x.a)),
    loi: Object.fromEntries(jr.filter((x) => s(x.trang_thai) === 'loi').map((x) => [n(x.a), s(x.loi)])) } };
}
/** Thêm một ảnh QC: từ khuôn có sẵn (ảnh mẫu + chữ) hoặc từ một ảnh QC mẫu tự dán (chữ trống = giữ nguyên văn chữ của mẫu). 0đ. */
export async function themAnhQc(phimId: number, nguon: { khuon: string } | { mau_url: string }): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const k = 'khuon' in nguon ? khuonAnhQc(nguon.khuon) : null;
  if ('khuon' in nguon && !k) return loi('không có khuôn này');
  const d = k ? { khuon: k.key, ten: k.ten, mau_url: k.mau_url, chu: k.chu.join('\n') } : { khuon: '', ten: 'Ảnh mẫu riêng', mau_url: 'mau_url' in nguon ? nguon.mau_url : '', chu: '' };
  if (!d.mau_url) return loi('thiếu ảnh mẫu');
  const r = (await db.execute(sql`INSERT INTO xv_anh_qc (phim_id, khuon, ten, mau_url, chu) VALUES (${phimId}, ${d.khuon}, ${d.ten}, ${d.mau_url}, ${d.chu}) RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]?.id) };
}
/** Sửa chữ / ý thêm / khổ / model / tên / ẩn của một ảnh QC (↶ hoàn tác được). */
export async function suaAnhQc(id: number, p: Partial<Pick<AnhQc, 'chu' | 'y_tuong' | 'ti_le' | 'mo_hinh' | 'ten' | 'an'>>): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (p.ti_le && !TI_LE_ANH_QC.some((t) => t.value === p.ti_le)) return loi('khổ không hợp lệ');
  if (p.mo_hinh && !MO_HINH_ANH.some((m) => m.key === p.mo_hinh)) return loi('model không có trong danh mục');
  await chupTruoc(db, { bang: 'xv_anh_qc', id, cot: ['chu', 'y_tuong', 'ti_le', 'mo_hinh', 'ten', 'an'], moTa: p.an != null ? (p.an ? 'ẩn ảnh QC' : 'hiện ảnh QC') : 'sửa ảnh QC', nguoi: await ai() });
  await db.execute(sql`UPDATE xv_anh_qc SET chu = coalesce(${p.chu ?? null}, chu), y_tuong = coalesce(${p.y_tuong ?? null}, y_tuong), ti_le = coalesce(${p.ti_le ?? null}, ti_le),
    mo_hinh = coalesce(${p.mo_hinh ?? null}, mo_hinh), ten = coalesce(${p.ten ?? null}, ten), an = coalesce(${p.an ?? null}::boolean, an), updated_at = now() WHERE id = ${id}`);
  return { ok: true, data: undefined };
}
/** Sinh một bản cho ảnh QC — TỐN TIỀN (giá trên nút, chỉ chạy khi anh bấm). */
export async function sinhAnhQc(id: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhAnhQcDb(db, id);
}
/** Chọn bản đang dùng trong các bản đã sinh của ảnh QC (↶ hoàn tác được). */
export async function chonAnhQc(id: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_anh_qc', id, cot: ['url'], moTa: 'chọn bản ảnh QC', nguoi: await ai() });
  await db.execute(sql`UPDATE xv_anh_qc SET url = ${url}, updated_at = now() WHERE id = ${id} AND uv @> ${JSON.stringify([url])}::jsonb`);
  return { ok: true, data: undefined };
}
export async function chonKeyframe(canhId: number, url: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['keyframe_url', 'keyframe_uv', 'trang_thai'], moTa: 'chọn keyframe', nguoi: await ai() });
  await db.execute(sql`UPDATE xv_canh SET keyframe_url = ${url}, keyframe_uv = CASE WHEN keyframe_uv @> ${JSON.stringify([url])}::jsonb THEN keyframe_uv ELSE keyframe_uv || ${JSON.stringify([url])}::jsonb END,
    trang_thai = CASE WHEN trang_thai IN ('nhap', 'loi') THEN 'co_keyframe' ELSE trang_thai END, updated_at = now() WHERE id = ${canhId}`);
  // 🧩 Tự bóc tách + đối chiếu NGAY sau khi chọn keyframe (Bước 3 — khỏi bấm tay); hỏng thì bỏ qua, không chặn việc chọn keyframe.
  try { await bocTachCanh(canhId); } catch { /* bóc tách lỗi (cổng ảnh…) không làm hỏng việc chọn keyframe — vẫn bấm nút 🧩 chạy lại được */ }
  return { ok: true, data: undefined };
}

/** Duyệt keyframe (gate trước khi tốn tiền video). `duyet=false` trả về co_keyframe. */
/** Làm lại shot từ bước keyframe (#1218): bỏ chọn video nháp/bản cuối đang dùng, shot về "có keyframe". Mọi bản video vẫn nằm trong
 *  video_phien_ban — chọn lại được, không mất gì. */
export async function lamLaiTuKeyframe(canhId: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['video_url', 'video_cuoi_url', 'trang_thai', 'loi'], moTa: 'làm lại từ keyframe', nguoi: await ai() });
  await db.execute(sql`UPDATE xv_canh SET video_url = NULL, video_cuoi_url = NULL, trang_thai = CASE WHEN keyframe_url IS NULL THEN 'nhap' ELSE 'co_keyframe' END, loi = '', updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: undefined };
}

export async function duyetCanh(canhId: number, duyet: boolean): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['trang_thai', 'loi'], moTa: duyet ? 'duyệt keyframe' : 'bỏ duyệt keyframe', nguoi: await ai() });
  if (duyet) {
    const r = (await db.execute(sql`UPDATE xv_canh SET trang_thai = 'duyet', loi = '', updated_at = now() WHERE id = ${canhId} AND keyframe_url IS NOT NULL RETURNING id`)) as unknown as Row[];
    if (!r[0]) return loi('cảnh chưa có keyframe để duyệt');
  } else {
    await db.execute(sql`UPDATE xv_canh SET trang_thai = 'co_keyframe', updated_at = now() WHERE id = ${canhId} AND trang_thai = 'duyet'`);
  }
  return { ok: true, data: undefined };
}

/** Ước tiền trước khi bấm: ảnh × số cảnh, video × tổng giây. */
export async function uocTien(tapId: number): Promise<{ anh1: number; videoTong: number; soCanhDuyet: number; giayDuyet: number }> {
  const db = getDb();
  if (!db || !(await admin())) return { anh1: 0, videoTong: 0, soCanhDuyet: 0, giayDuyet: 0 };
  const r = (await db.execute(sql`SELECT p.kinh_thanh AS kt, (SELECT count(*) FROM xv_canh c WHERE c.tap_id = t.id AND c.trang_thai = 'duyet') AS so_duyet,
    (SELECT coalesce(sum(thoi_luong_s), 0) FROM xv_canh c WHERE c.tap_id = t.id AND c.trang_thai = 'duyet') AS giay
    FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[];
  if (!r[0]) return { anh1: 0, videoTong: 0, soCanhDuyet: 0, giayDuyet: 0 };
  const kt = docKinhThanh(r[0].kt as KinhThanh);
  const giay = n(r[0].giay);
  return { anh1: giaAnhCents(kt.mo_hinh_anh), videoTong: giaVideoCents(kt.mo_hinh_video, kt.do_phan_giai, giay), soCanhDuyet: n(r[0].so_duyet), giayDuyet: giay };
}

/** Bắt đầu sinh video Veo cho một cảnh ĐÃ DUYỆT (keyframe làm khung đầu). Async: trả job id, UI gọi kiemVideo để poll. */

/** Sinh video cho một shot (lõi ở sinh-video.ts — script dùng chung). */
export async function sinhVideoCanh(canhId: number, moHinh?: string, ban: 'nhap' | 'cuoi' = 'nhap', tuDong = false): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return batDauVideoCanh(db, canhId, moHinh, ban, tuDong);
}
/** 🧪 Sinh THỬ video ngoài quy trình (bỏ cổng duyệt / kiểm khung / animatic) — admin bấm, job ghi là bản thử. */
export async function sinhVideoThu(canhId: number, moHinh?: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return batDauVideoCanh(db, canhId, moHinh, 'nhap', false, true);
}
/** Sơ đồ nguồn của một shot (lõi ở nguon-shot.ts): đã gửi gì lúc sinh keyframe / clip, so với giờ sẽ gửi — 0đ, chỉ đọc. */
export async function nguonCuaShot(canhId: number): Promise<NguonShot | null> {
  const db = getDb();
  if (!db || !(await admin())) return null;
  return nguonShot(db, canhId);
}
/** Nguồn của MỌI shot trong tập (sơ đồ nối khung cả tập) — cùng lõi nguonShot, theo thứ tự shot. 0đ, chỉ đọc. */
export async function nguonCuaTap(tapId: number): Promise<NguonShot[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  const ids = ((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map((r) => n(r.id));
  return (await Promise.all(ids.map((id) => nguonShot(db, id)))).filter((x): x is NguonShot => !!x);
}
/** Nhận kết quả video của tập (lõi ở sinh-video.ts). */
export async function kiemVideo(tapId: number): Promise<{ conChay: number; vuaXong: number }> {
  const db = getDb();
  if (!db || !(await admin())) return { conChay: 0, vuaXong: 0 };
  return kiemVideoTap(db, tapId);
}
/** Sinh giọng đọc thoại cho các shot (lõi ở sinh-giong.ts — script dùng chung). */
export async function sinhGiong(tapId: number, canhIds?: number[], tuy: TuyGiong = {}): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhGiongShots(db, tapId, canhIds, tuy);
}

/** Chọn một phiên bản đã sinh làm nháp hoặc bản cuối đang dùng (không tốn tiền). */
export async function chonPhienBan(canhId: number, url: string, ban: 'nhap' | 'cuoi'): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_canh', id: canhId, cot: ['video_url', 'video_cuoi_url', 'trang_thai', 'loi'], moTa: ban === 'cuoi' ? 'chọn bản cuối' : 'chọn bản nháp', nguoi: await ai() });
  if (ban === 'cuoi') await db.execute(sql`UPDATE xv_canh SET video_cuoi_url = ${url}, updated_at = now() WHERE id = ${canhId} AND video_phien_ban @> ${JSON.stringify([{ url }])}::jsonb`);
  else await db.execute(sql`UPDATE xv_canh SET video_url = ${url}, trang_thai = 'xong', loi = '', updated_at = now() WHERE id = ${canhId} AND video_phien_ban @> ${JSON.stringify([{ url }])}::jsonb`);
  return { ok: true, data: undefined };
}

/** Bản cuối = NÂNG CẤP chính clip nháp (Topaz qua fal) → chuyển động, bố cục, nhân vật giống bản nháp 100%. */
export async function nangCapCanh(canhId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const c = (await db.execute(sql`SELECT thu_tu, canh, video_url, thoi_luong_s FROM xv_canh WHERE id = ${canhId}`)) as unknown as Row[];
  if (!c[0]?.video_url) return loi('cảnh chưa có video nháp để nâng cấp');
  const giay = n(c[0].thoi_luong_s) || 8;
  const job = await taoJob(db, { nhan: `Nâng cấp bản cuối · cảnh #${n(c[0].thu_tu)} ${s(c[0].canh)}`, canh_id: canhId, loai: 'video', provider: 'fal', model: NANG_CAP.model, request: { nangCap: true, ban: 'cuoi', giay, tu: s(c[0].video_url) } });
  const kq = await batDauNangCap(NANG_CAP.model, s(c[0].video_url), 2);
  if (!kq.ok) { await xongJob(job, { loi: kq.loi }); await db.execute(sql`UPDATE xv_canh SET loi = ${kq.loi} WHERE id = ${canhId}`); return loi(kq.loi); }
  await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${kq.taskId}, updated_at = now() WHERE id = ${job}`);
  await db.execute(sql`UPDATE xv_canh SET trang_thai = 'dang_sinh', loi = '', updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: job };
}

/** Khớp miệng clip nháp với file giọng đã sinh của shot (fal sync-lipsync): nhiều dòng thoại thì nối giọng thành một file trước.
 *  Kết quả thành bản nháp mới (bản cũ còn trong phiên bản). Giá ${KHOP_MIENG.giaGiayCents}¢/giây clip. */
export async function khopMiengCanh(canhId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const bc = await boiCanhCanh(db, canhId);
  if (!bc) return loi('không thấy cảnh');
  const video = bc.canh.video_cuoi_url || bc.canh.video_url;
  if (!video) return loi('cảnh chưa có video để khớp miệng');
  const giong = dongThoai(bc.canh, bc.nhanVat).map((d) => d.url).filter((u): u is string => !!u);
  if (!giong.length) return loi('shot chưa có file giọng — sinh giọng trước (🗣)');
  let audio = giong[0]!;
  if (giong.length > 1) {
    const buf = await gopAm(giong);
    const url = buf ? await uploadToR2(`xuong-video/am/thoai/${canhId}-gop-${randomUUID()}.mp3`, buf, 'audio/mpeg') : null;
    if (!url) return loi('không nối được các dòng giọng thành một file');
    audio = url;
  }
  const giay = bc.canh.thoi_luong_s || 8;
  const job = await taoJob(db, { nhan: `Khớp miệng · cảnh #${bc.canh.thu_tu} ${bc.canh.canh}`, canh_id: canhId, loai: 'video', provider: 'fal', model: KHOP_MIENG.model, request: { khopMieng: true, ban: 'nhap', giay, tu: video, audio } });
  const kq = await guiFal(KHOP_MIENG.model, { video_url: video, audio_url: audio, sync_mode: 'cut_off' });
  if (!kq.ok) { await xongJob(job, { loi: kq.loi }); await db.execute(sql`UPDATE xv_canh SET loi = ${kq.loi} WHERE id = ${canhId}`); return loi(kq.loi); }
  await db.execute(sql`UPDATE xv_job SET trang_thai = 'chay', task_id = ${kq.taskId}, updated_at = now() WHERE id = ${job}`);
  await db.execute(sql`UPDATE xv_canh SET trang_thai = 'dang_sinh', loi = '', updated_at = now() WHERE id = ${canhId}`);
  return { ok: true, data: job };
}

/** Poll mọi job video đang chạy của tập: xong → tải về R2, ghi tiền, cảnh = xong. Gọi từ UI mỗi 10s khi có cảnh dang_sinh. */

/** Tải ảnh tham chiếu (data URL từ trình duyệt) lên R2 — thay cho ImageAttach của mos2. */
export async function taiAnhLen(dataUrl: string): Promise<Kq<string>> {
  if (!(await admin())) return loi('không có quyền');
  const m = (dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/s);
  if (!m) return loi('không phải ảnh');
  const buf = Buffer.from(m[2]!, 'base64');
  if (buf.length > 8_000_000) return loi('ảnh quá lớn (>8MB)');
  const url = await uploadToR2(`xuong-video/ref/${randomUUID()}.${duoi(m[1]!)}`, buf, m[1]!);
  void lamSanNho(url);   // ảnh nhỏ cho thẻ / timeline (anh-nho-may.ts)
  return url ? { ok: true, data: url } : loi('R2 không nhận ảnh (thiếu cấu hình storage?)');
}


/** Ghi một lần gọi Claude vào sổ chi phí (token → cents). */
async function ghiChu(phimId: number | null, nhan: string, r: { ok: boolean } & Partial<DungChu>): Promise<void> {
  if (!r.ok || !r.model || !r.tokens) return;
  await ghiTienChu(getDb()!, phimId, nhan, r.model, r.tokens);
}

// ── Gợi ý AI cho mọi form (đọc ngữ cảnh cả phim) ──────────────────────────────────────────────────────────────


export async function goiYAIKinhThanh(phimId: number): Promise<Kq<{ phong_cach: string; mo_ta: string; the_loai?: string; logline?: string; chu_de?: string }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const nc = await nguCanhPhimDb(db, phimId);
  if (!nc) return loi('không thấy phim');
  const r = await goiYKinhThanh(nc);
  await ghiChu(phimId, 'AI gợi ý kinh thánh', r);
  return r.ok ? { ok: true, data: r.data } : loi(r.loi);
}

/** ✨ Rút tuyến truyện + sổ gài / trả từ bản đồ series (0 → vài trăm ₫ qua ckey). Trả đề xuất; ngăn Sơ đồ trộn vào sổ (tronAi, chỉ điền chỗ trống). */
export async function aiTuyenTruyen(phimId: number): Promise<Kq<AiTuyenTruyen>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const nc = await nguCanhPhimDb(db, phimId);
  if (!nc) return loi('không thấy phim');
  if (!docKinhThanh(nc.kinhThanh).series?.tap?.length) return loi('phim chưa có bản đồ tập');
  const r = await goiYTuyenTruyen(nc.kinhThanh, nc.ten);
  await ghiChu(phimId, 'AI rút tuyến truyện + gài/trả', r);
  return r.ok ? { ok: true, data: r.data } : loi(r.loi);
}

/** ＋ Viết tiếp N tập trên bản đồ series (AI, vài trăm ₫ qua ckey): nối tập, sự kiện tuyến, gài mới, trả chi tiết treo → ghi thẳng (chụp hoàn tác). */
export async function aiThemTap(phimId: number, n: number): Promise<Kq<number[]>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const nc = await nguCanhPhimDb(db, phimId);
  if (!nc) return loi('không thấy phim');
  if (!docKinhThanh(nc.kinhThanh).series?.tap?.length) return loi('phim chưa có bản đồ tập');
  const r = await vietThemTap(nc.kinhThanh, nc.ten, Math.max(1, Math.min(10, n)), nc.nhanVat.map((v) => v.ten));
  await ghiChu(phimId, `AI viết tiếp ${n} tập trên bản đồ`, r);
  if (!r.ok) return loi(r.loi);
  // đọc lại ngay trước khi ghi — người có thể vừa sửa sổ trong lúc AI chạy
  const kt = ((await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as { kinh_thanh: KinhThanh }[])[0]!.kinh_thanh;
  const { s, them } = themTapAi(kt.series!, r.data, () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  await chupTruoc(db, { bang: 'xv_phim', id: phimId, cot: ['kinh_thanh'], moTa: `AI viết tiếp tập ${them.join(', ')}`, nguoi: await ai() });
  await db.execute(sql`UPDATE xv_phim SET kinh_thanh = jsonb_set(kinh_thanh, '{series}', ${JSON.stringify(s)}::jsonb), updated_at = now() WHERE id = ${phimId}`);
  return { ok: true, data: them };
}

export async function goiYAIAnchor(phimId: number, a: { loai: LoaiNhanVat; ten: string; mo_ta: string }): Promise<Kq<{ mo_ta: string; giong: string }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!a.ten.trim()) return loi('đặt tên anchor trước');
  const nc = await nguCanhPhimDb(db, phimId);
  if (!nc) return loi('không thấy phim');
  const r = await goiYAnchor(nc, a);
  await ghiChu(phimId, `AI tả anchor · ${a.ten}`, r);
  return r.ok ? { ok: true, data: r.data } : loi(r.loi);
}

/** AI đề xuất tuyến nhân vật còn thiếu từ tiền đề + kịch bản → TẠO luôn các anchor (người sửa lại sau). */
/** Claude nhìn ảnh gốc của anchor so với mô tả → lưu kết quả (khớp / lệch chỗ nào / mô tả đề xuất) để thẻ anchor hiện cảnh báo. */
export async function doiChieuAnchor(nhanVatId: number): Promise<Kq<NonNullable<NhanVat['doi_chieu']>>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy anchor');
  const nv = mapNhanVat(r[0]);
  const kq = await doiChieuAnchorClaude(nv, docKinhThanh(r[0].kt as KinhThanh));
  await ghiChu(nv.phim_id, `Đối chiếu ảnh ↔ mô tả · ${nv.ten}`, kq);
  if (!kq.ok) return loi(kq.loi);
  const dc = { ...kq.data, luc: new Date().toISOString() };
  await db.execute(sql`UPDATE xv_nhan_vat SET doi_chieu = ${JSON.stringify(dc)}::jsonb, updated_at = now() WHERE id = ${nhanVatId}`);
  return { ok: true, data: dc };
}

export async function goiYAIBoAnchor(phimId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const nc = await nguCanhPhimDb(db, phimId);
  if (!nc) return loi('không thấy phim');
  if (!nc.mo_ta.trim() && !nc.tap.some((t) => t.kich_ban.trim())) return loi('viết tiền đề (kinh thánh) hoặc kịch bản trước để AI có gì mà đề xuất');
  const r = await goiYBoAnchor(nc);
  await ghiChu(phimId, 'AI đề xuất tuyến nhân vật', r);
  if (!r.ok) return loi(r.loi);
  const daCo = new Set(nc.nhanVat.map((v) => v.ten.trim().toLowerCase()));
  let them = 0;
  for (const a of r.data.anchors) {
    if (daCo.has(a.ten.trim().toLowerCase())) continue;
    await db.execute(sql`INSERT INTO xv_nhan_vat (phim_id, loai, ten, mo_ta, giong) VALUES (${phimId}, ${a.loai}, ${a.ten.trim()}, ${a.mo_ta}, ${a.giong})`);
    them++;
  }
  return { ok: true, data: them };
}

export async function goiYAIBrief(tapId: number, thoiLuongS: number): Promise<Kq<string>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const t = (await db.execute(sql`SELECT phim_id, so FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return loi('không thấy tập');
  const nc = await nguCanhPhimDb(db, n(t[0].phim_id));
  if (!nc) return loi('không thấy phim');
  const thieu = thieuQc(nc.loai, nc.kinhThanh);
  if (thieu) return loi(thieu);
  const r = await goiYBrief(nc, n(t[0].so), thoiLuongS);
  await ghiChu(n(t[0].phim_id), `AI gợi ý brief · tập ${n(t[0].so)}`, r);
  if (r.ok) await db.execute(sql`UPDATE xv_tap SET brief = ${r.data.brief}, updated_at = now() WHERE id = ${tapId}`);
  return r.ok ? { ok: true, data: r.data.brief } : loi(r.loi);
}

/** AI viết lại một cảnh (điền form, chưa lưu) — đọc cảnh trước/sau + anchor để khớp mạch. */
export async function goiYAICanh(canhId: number, nhap: { canh: string; goc_may: string; hanh_dong: string; loi_thoai: string; nhan_vat: number[] }): Promise<Kq<Partial<Canh>>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const c = (await db.execute(sql`SELECT c.thu_tu, c.tap_id, t.phim_id FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${canhId}`)) as unknown as Row[];
  if (!c[0]) return loi('không thấy cảnh');
  const nc = await nguCanhPhimDb(db, n(c[0].phim_id));
  if (!nc) return loi('không thấy phim');
  const thuTu = n(c[0].thu_tu);
  const lanCan = (await db.execute(sql`SELECT thu_tu, canh, hanh_dong FROM xv_canh WHERE tap_id = ${n(c[0].tap_id)} AND thu_tu IN (${thuTu - 1}, ${thuTu + 1})`)) as unknown as Row[];
  const ta = (r?: Row) => (r ? `${s(r.canh)} — ${s(r.hanh_dong)}` : undefined);
  const tenNv = nhap.nhan_vat.map((id) => nc.nhanVat.find((v) => v.id === id)?.ten).filter((x): x is string => !!x);
  const r = await goiYCanh(nc, { thu_tu: thuTu, ...nhap, nhan_vat: tenNv }, ta(lanCan.find((x) => n(x.thu_tu) === thuTu - 1)), ta(lanCan.find((x) => n(x.thu_tu) === thuTu + 1)));
  await ghiChu(n(c[0].phim_id), `AI viết lại cảnh #${thuTu}`, r);
  if (!r.ok) return loi(r.loi);
  const tenToId = new Map(nc.nhanVat.map((v) => [v.ten.trim().toLowerCase(), v.id]));
  const ids = r.data.nhan_vat.map((t) => tenToId.get(t.trim().toLowerCase())).filter((x): x is number => typeof x === 'number');
  return { ok: true, data: { canh: r.data.canh, goc_may: r.data.goc_may, hanh_dong: r.data.hanh_dong, loi_thoai: r.data.loi_thoai, am_thanh: r.data.am_thanh, thoi_luong_s: r.data.thoi_luong_s, nhan_vat: ids.length ? ids : nhap.nhan_vat, prompt_anh: r.data.prompt_anh, prompt_video: r.data.prompt_video, cam_xuc: Math.max(-5, Math.min(5, Math.round(r.data.cam_xuc))), ky_thuat: lamSachKyThuat(r.data.ky_thuat as unknown as Record<string, unknown>), thoai: (r.data.thoai ?? []).filter((d) => d.loi.trim()), trang_phuc: r.data.trang_phuc ?? '' } };
}

// ── Job ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const xongJob = (id: number, d: Parameters<typeof xongJobDb>[2]) => xongJobDb(getDb()!, id, d);
const duoi = (mime: string) => (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');

// ── Giọng · hiệu ứng âm thanh · nhạc nền (08/10/2026) ──────────────────────────────────────────────────────────
// Mỗi lượt sinh = một job 'am' (tiền tính trước theo ký tự/giây, ghi vào request.gia) → hàng đợi Cloudflare → file R2 → gắn vào shot/tập.
// Chỉ chạy khi anh bấm (mỗi bấm một lượt, giá hiện trên nút).

/** Model giọng (ElevenLabs tài khoản anh nếu có khoá + mọi TTS của fal) — cho ô chọn. */
export async function dsGiongModel(): Promise<MoHinhGiong[]> {
  if (!(await admin())) return [];
  return dsMoHinhGiong();
}
/** Giọng có sẵn của một model (đọc từ OpenAPI fal / tài khoản ElevenLabs). */
export async function dsGiongCua(model: string): Promise<{ id: string; ten: string }[]> {
  if (!(await admin())) return [];
  return giongCua(model);
}

/** Chọn giọng cố định cho nhân vật (model + voice) — mọi shot nhân vật này nói dùng giọng này, cả bộ phim. */
export async function chonGiong(nhanVatId: number, model: string, voice: string): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await chupTruoc(db, { bang: 'xv_nhan_vat', id: nhanVatId, cot: ['giong_model', 'giong_id', 'giong_mau_url'], moTa: 'đổi giọng cố định của nhân vật', nguoi: await ai() });
  if (!model) return loi('chọn model giọng');
  const ds = await giongCua(model);
  if (ds.length && !ds.some((g) => g.id === voice)) return loi('giọng không có trong danh sách của model');
  // Giọng đã thử (giong_thu) → bản nghe của nó thành giọng mẫu luôn, không phải bấm nghe thử lại.
  const thu = (await db.execute(sql`SELECT x->>'url' AS url FROM xv_nhan_vat, jsonb_array_elements(giong_thu) x WHERE id = ${nhanVatId} AND x->>'model' = ${model} AND x->>'voice' = ${voice} LIMIT 1`)) as unknown as Row[];
  await db.execute(sql`UPDATE xv_nhan_vat SET giong_model = ${model}, giong_id = ${voice}, giong_mau_url = ${thu[0]?.url ? String(thu[0].url) : null}, updated_at = now() WHERE id = ${nhanVatId}`);
  return { ok: true, data: undefined };
}


/** Sinh giọng đọc lời thoại cho các shot (một shot hoặc mọi shot có thoại của tập). */
/** tuy: chọn từ bảng ＋ trên timeline (#1202) — model/giọng cho lượt này (không đổi giọng cố định của nhân vật), cảm xúc, chỉ dòng chưa có giọng. */

/** Nghe thử giọng của một nhân vật (một câu ngắn). */
export async function ngheThuGiong(nhanVatId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT v.*, p.kinh_thanh AS kt FROM xv_nhan_vat v JOIN xv_phim p ON p.id = v.phim_id WHERE v.id = ${nhanVatId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy nhân vật');
  const v = mapNhanVat(r[0]); const kt = docKinhThanh(r[0].kt as KinhThanh);
  if (!v.giong_model) return loi('chọn giọng trước');
  const text = kt.ngon_ngu === 'vi' ? `Xin chào, mình là ${v.ten}. Đây là giọng của mình trong cả bộ phim.` : `Hi, I'm ${v.ten}. This is how I sound in the whole series.`;
  const g = giaGiongTheo(await dsMoHinhGiong(), v.giong_model, text.length);
  const gia = g ?? 0;
  const job = await taoJob(db, { nhan: `Nghe thử giọng · ${v.ten} (${v.giong_id})${g == null ? ' · giá chưa rõ' : ''}`, nhan_vat_id: v.id, loai: 'am', provider: v.giong_model.startsWith('elevenlabs:') ? 'elevenlabs' : 'fal', model: v.giong_model.startsWith('elevenlabs:') ? v.giong_model : `fal:${v.giong_model}`, request: { dich: 'giong_mau', gia, text, giong_model: v.giong_model, voice: v.giong_id } });
  await dayViecAm({ kieu: 'am', job, model: v.giong_model, input: await dauVaoGiongTheoModel(v.giong_model, { text, voice: v.giong_id, ngonNgu: kt.ngon_ngu, camXuc: 0, theLoai: kt.the_loai }), thuMuc: `giong/${v.id}` });
  return { ok: true, data: job };
}

/** Sinh hiệu ứng âm thanh cho shot: có clip → từ clip (khớp hành động); chưa có → từ mô tả âm thanh + kỹ thuật âm thanh của shot. */
/** tuy (#1202): nguồn (từ clip / từ mô tả), model, mô tả sửa tay, số giây. */
export type TuyAm = { nguon?: 'clip' | 'mo_ta'; model?: string; moTa?: string; giay?: number };
export async function sinhAmThanh(tapId: number, canhIds?: number[], moHinhChu = 'sonilo/v1.1/text-to-sound-effects', tuy: TuyAm = {}): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const ds = (await dsCanh(tapId)).filter((c) => !canhIds || canhIds.includes(c.id));
  let so = 0, dang = 0;
  for (const c of ds) {
    const clip = tuy.nguon === 'mo_ta' ? null : c.video_cuoi_url || c.video_url;
    const moTa = tuy.moTa?.trim() || [c.am_thanh, promptKyThuatVideo({ am_thanh: c.ky_thuat.am_thanh }).replace(/^Sound:\s*/, '')].filter(Boolean).join('. ');
    if (!clip && !moTa.trim()) continue;
    if (c.dang_sinh_sfx) { dang++; continue; }   // đang sinh → không gửi lượt thứ hai (canhDangSinhAm cùng điều kiện)
    const giay = tuy.giay || c.thoi_luong_s || 5;
    const model = clip ? (tuy.model && moHinhAm(tuy.model)?.loai === 'sfx_video' ? tuy.model : 'mirelo-ai/sfx-v1/video-to-audio') : (tuy.model && moHinhAm(tuy.model)?.loai === 'sfx_chu' ? tuy.model : moHinhChu);
    const gia = giaAm(model, giay);
    const input: Record<string, unknown> = clip ? { video_url: clip, duration: giay, num_samples: 1, text_prompt: moTa }
      : model.includes('elevenlabs') ? { text: moTa, duration_seconds: giay } : { prompt: moTa, duration: giay };
    const job = await taoJob(db, { nhan: `Âm thanh · shot #${c.thu_tu} ${clip ? '(từ clip)' : '(từ mô tả)'}`, canh_id: c.id, loai: 'am', provider: 'fal', model: `fal:${model}`, request: { dich: 'sfx', gia, moTa } });
    await dayViecAm({ kieu: 'am', job, model, input, thuMuc: `sfx/${c.id}` });
    so++;
  }
  return so ? { ok: true, data: so } : loi(dang ? 'shot đang sinh hiệu ứng âm thanh — đợi xong, không sinh thêm lượt nữa' : 'không shot nào có clip hoặc mô tả âm thanh');
}

/** Sinh nhạc nền (lõi ở sinh-nhac.ts). */
export async function sinhNhac(tapId: number, model = 'cassetteai/music-generator', phanDoan?: string, moTaThem = ''): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return sinhNhacTap(db, tapId, model, phanDoan, moTaThem);
}

// ── Lớp phủ tự do của tập (11/10/2026) — chữ · ảnh · hình khối, xem lop.ts ────────────────────────────────────────
/** Lưu toàn bộ lớp phủ của tập (thay cả mảng) — có ↶ Hoàn tác. Số liệu kẹp về khoảng hợp lệ, tối đa 80 lớp. */
/** Độ to (LUFS) của các tệp âm thanh — timeline phát thử ở đúng mức bản xuất (sfx.ts › amLuongXem). Nhớ trong tiến trình; 0đ. */
const lufsDaDo = new Map<string, number | null>();
export async function doLufsAm(urls: string[]): Promise<Record<string, number | null>> {
  if (!(await admin())) return {};
  const ds = [...new Set(urls)].filter((u) => /^https?:\/\//.test(u)).slice(0, 80);
  const { doLufs } = await import('@/lib/xuong-video/xuat-chay');
  await Promise.all(ds.filter((u) => !lufsDaDo.has(u)).map(async (u) => { lufsDaDo.set(u, await doLufs(u)); }));
  return Object.fromEntries(ds.map((u) => [u, lufsDaDo.get(u) ?? null]));
}
/** Khớp điểm cắt vào phách nhạc nền (khop-nhip.ts) — 0đ; chụp trước để ↶ Hoàn tác. */
export async function khopNhipNhac(tapId: number): Promise<Kq<KqKhopNhip>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return khopNhipTap(db, tapId, await ai());
}
/** Giây phát mỗi shot ≥ đủ đọc hết giọng; chữ màn + lớp phủ theo (hau-ky.ts) — 0đ, ↶ Hoàn tác được. */
/** 🎥 Đa dạng chuyển động máy (nhip-hinh.ts) — 0đ: đổi chuyển động máy đúng các shot phạm luật nhịp hình, mỗi nhánh hook xét riêng
 *  (thân chung + nhánh). Chụp trước để ↶ Hoàn tác. */
export async function daDangMayTap(tapId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return { ok: true, data: await daDangMayTapDb(db, tapId, await ai()) };
}
export async function khopGiongTapAction(tapId: number): Promise<Kq<{ doi: number; tong: number; thieu: number }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return khopGiongTap(db, tapId, await ai());
}
/** ✂ Tách một shot dồn nhiều nhịp thành nhiều shot (tach-shot.ts) — 0đ, shot mới chưa có hình. */
export async function tachShot(id: number, phan: string[]): Promise<Kq<number[]>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = await tachShotDb(db, id, (Array.isArray(phan) ? phan : []).map(String).slice(0, 8), await ai());
  return r.ok ? { ok: true, data: r.ids } : loi(r.loi);
}
/** ＋ Chèn shot cho bước khuôn đang THIẾU, đúng chỗ khuôn chỉ (tach-shot.ts) — 0đ, shot mới chưa có hình. */
export async function chenShotKhuon(tapId: number, apIdx: number, buoc: number, moTa: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = await chenShotKhuonDb(db, tapId, apIdx, buoc, String(moTa ?? '').slice(0, 600), await ai());
  return r.ok ? { ok: true, data: r.id } : loi(r.loi);
}
/** THỬ nhiều shot trong một clip cho một phân cảnh (ref2v-chay.ts, học Movie Maker của Digen). Xem trước: 0đ, chỉ dựng yêu cầu + giá. */
export async function xemRef2vCanh(tapId: number, phanDoan: string, tieng = false) {
  const db = getDb();
  if (!db || !(await admin())) return null;
  return napRef2v(db, tapId, phanDoan, tieng);
}
/** Gửi MỘT lượt thử (TỐN TIỀN — nút trong studio, anh bấm; giá hiện trên nút). Kết quả chỉ ở sổ job, không thay clip shot nào. */
export async function thuRef2vCanh(tapId: number, phanDoan: string, tieng = false): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return guiRef2v(db, tapId, phanDoan, tieng);
}
/** Các lượt thử nhiều-shot của tập (mới nhất trước) — hỏi provider trước cho lượt đang chạy. */
export async function dsThuRef2v(tapId: number): Promise<KetRef2v[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  await kiemVideoTap(db, tapId).catch(() => null);
  return dsRef2v(db, tapId);
}
/** Lưu Ý ĐỒ KHÁN GIẢ của tập (khan-gia.ts) — sửa trên timeline (ngăn 🎭). Lọc: hiệu ứng có thật, shot thuộc tập. Có ảnh chụp để ↶ hoàn tác. 0đ. */
export async function luuKhanGia(tapId: number, ds: YDoKhanGia[]): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const ids = new Set(((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId}`)) as unknown as Row[]).map((r) => Number(r.id)));
  const sach = lamSachKhanGia(ds).filter((x) => ids.has(x.tu) && ids.has(x.den) && (x.lat == null || ids.has(x.lat))).slice(0, 80);
  await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['khan_gia'], moTa: `sửa ý đồ khán giả (${sach.length} đoạn)`, nguoi: await ai() });
  await db.execute(sql`UPDATE xv_tap SET khan_gia = ${JSON.stringify(sach)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: undefined };
}
/** Lưu các lần áp KHUÔN CHUỖI của tập (khuon-chuoi.ts) — sửa trên timeline (ngăn 🧭 Khuôn). Lọc: khuôn có thật, shot thuộc tập, bước trong khuôn. 0đ. */
export async function luuKhuonChuoi(tapId: number, ds: ApKhuon[]): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const ids = new Set(((await db.execute(sql`SELECT id FROM xv_canh WHERE tap_id = ${tapId}`)) as unknown as Row[]).map((r) => String(r.id)));
  const sach: ApKhuon[] = [];
  for (const a of (Array.isArray(ds) ? ds : []).slice(0, 60)) {
    const kh = khuonTheoKey(String(a?.khuon ?? '')); if (!kh) continue;
    const shots: ApKhuon['shots'] = {};
    for (const [id, b] of Object.entries(a.shots ?? {})) {
      const bs = [...new Set((Array.isArray(b) ? b : [b]).map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < kh.buoc.length).sort((x, y) => x - y);
      if (ids.has(String(id)) && bs.length) shots[String(id)] = bs.length === 1 ? bs[0]! : bs;
    }
    sach.push({ khuon: kh.key, shots, ...(a.ghi ? { ghi: String(a.ghi).slice(0, 300) } : {}) });
  }
  await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['khuon_chuoi'], moTa: `sửa khuôn chuỗi (${sach.length} lần áp)`, nguoi: await ai() });
  await db.execute(sql`UPDATE xv_tap SET khuon_chuoi = ${JSON.stringify(sach)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: undefined };
}

export async function luuLop(tapId: number, lop: Lop[]): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const k = (v: unknown, a: number, b: number, mac: number) => { const x = Number(v); return Number.isFinite(x) ? Math.max(a, Math.min(b, x)) : mac; };
  const sach = (Array.isArray(lop) ? lop : []).slice(0, 80).map((l) => ({ ...l, tu: k(l.tu, 0, 3600, 0), den: k(l.den, 0, 3600, 2), x: k(l.x, -0.5, 1.5, 0.5), y: k(l.y, -0.5, 1.5, 0.5),
    w: k(l.w, 0.01, 2, 0.5), h: k(l.h, 0.005, 2, 0.1), xoay: k(l.xoay, -180, 180, 0), mo: k(l.mo, 0, 1, 1), co: l.co == null ? undefined : k(l.co, 0.01, 0.4, 0.07),
    vien_day: l.vien_day == null ? undefined : k(l.vien_day, 0, 0.3, 0.08), chu: l.chu == null ? undefined : String(l.chu).slice(0, 300), url: l.url && /^https?:\/\//.test(l.url) ? l.url : undefined, nhom: l.nhom ? String(l.nhom).slice(0, 20) : undefined, nhom_cu: l.nhom_cu && !l.nhom ? String(l.nhom_cu).slice(0, 20) : undefined }));
  await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['lop'], moTa: `sửa lớp phủ (${sach.length} lớp)`, nguoi: await ai() });
  await db.execute(sql`UPDATE xv_tap SET lop = ${JSON.stringify(sach)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  return { ok: true, data: undefined };
}

// ── Kho tài sản dùng lại (10/10/2026) — lõi ở kho.ts ─────────────────────────────────────────────────────────────
export async function dsTaiSan(o: { loai?: LoaiTaiSan[]; thuongHieu?: string; q?: string } = {}): Promise<TaiSan[]> {
  const db = getDb();
  if (!db || !(await admin())) return [];
  return dsKho(db, o);
}
/** Lưu keyframe + clip đang dùng của shot vào kho. */
export async function luuShotKho(canhId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return luuShotVaoKho(db, canhId);
}
/** Dùng một tài sản cho shot (clip/keyframe) hoặc tập (nhạc) — có ↶ Hoàn tác. */
export async function dungTaiSanCho(id: number, dich: { canhId?: number; tapId?: number }): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return dungTaiSan(db, id, dich, await ai());
}
/** ✨ Điểm nhấn tự động (diem-nhan.ts): mỗi loại shot một hiệu ứng hình + tiếng ở điểm cắt (nhánh A). 0đ, có ↶ hoàn tác.
 *  Chạy lại = thay đúng phần điểm nhấn; lớp và tiếng người đặt tay giữ nguyên. */
export async function apDiemNhan(tapId: number): Promise<Kq<{ lop: number; tieng: number }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const nguoi = await ai();
  const t = (await db.execute(sql`SELECT lop FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return loi('không thấy tập');
  const ds = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  if (!ds.length) return loi('tập chưa có shot');
  const kq = diemNhan(ds.map((c) => ({ loai: c.phan_doan, phat: giayPhat(c), am: c.ky_thuat?.am_thanh ?? [] })), (t[0].lop ?? []) as Lop[]);
  const nhom = await chupTruoc(db, { bang: 'xv_tap', id: tapId, cot: ['lop'], moTa: '✨ điểm nhấn tự động', nguoi });
  await db.execute(sql`UPDATE xv_tap SET lop = ${JSON.stringify(kq.lop)}::jsonb, updated_at = now() WHERE id = ${tapId}`);
  for (const [i, c] of ds.entries()) {
    await chupTruoc(db, { bang: 'xv_canh', id: c.id, cot: ['ky_thuat'], moTa: '✨ điểm nhấn tự động', nguoi: '', nhom });
    await db.execute(sql`UPDATE xv_canh SET ky_thuat = ${JSON.stringify({ ...(c.ky_thuat ?? {}), am_thanh: kq.am[i] })}::jsonb, updated_at = now() WHERE id = ${c.id}`);
  }
  return { ok: true, data: { lop: kq.lop.filter((l) => l.loai === 'hieu_ung').length, tieng: kq.am.flat().length } };
}
/** 🎯 Đổi kiểu CTA của phim (thư viện CTA, mau/cta.json): mọi shot ưu đãi / CTA / end card nhận kiểu chữ mới. 0đ, có ↶ hoàn tác. */
export async function doiCta(phimId: number, key: string): Promise<Kq<{ shot: number }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = await apCtaPhim(db, phimId, key, await ai());
  return r ? { ok: true, data: { shot: r.shot } } : loi('không có kiểu CTA này');
}
/** Lưu cả tập làm khuôn QC trong kho. */
export async function luuKhuonTap(tapId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return luuKhuonQc(db, tapId);
}
/** Tạo tập mới trong phim từ một khuôn QC (chưa có hình/giọng — sinh lại từng bước). */
export async function taoTapTuKhuonQc(khuonId: number, phimId: number): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return taoTapTuKhuon(db, khuonId, phimId, await ai());
}
export async function boTaiSan(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await boKhoiKho(db, id);
  return { ok: true, data: undefined };
}

/** Ước giá trước khi bấm (hiện trên nút). */
export async function uocAm(tapId: number): Promise<{ giong: number; soThoai: number; sfx: number; soSfx: number; nhac: Record<string, number>; giay: number; soPhanCanh: number; dangNhac: number; dangPhanDoan: string[]; dangCaTap: boolean }> {
  const db = getDb();
  const bc = db ? await boiCanhTap(db, tapId) : null;
  const ds = await dsCanh(tapId);
  const dm = await dsMoHinhGiong();
  let giong = 0, soThoai = 0, sfx = 0, soSfx = 0;
  for (const c of ds) {
    const dsT = bc ? dongThoai(c, bc.nhanVat) : c.thoai;
    if (dsT.length) {
      for (const d of dsT) { const v = timNv(bc?.nhanVat ?? [], d.nhan_vat); giong += giaGiongTheo(dm, v?.giong_model || MODEL_GIONG_MAC_DINH(), d.loi.length) ?? 0; }
      soThoai++;
    }
    const clip = c.video_cuoi_url || c.video_url;
    if (clip || c.am_thanh.trim() || c.ky_thuat.am_thanh?.length) { sfx += giaAm(clip ? 'mirelo-ai/sfx-v1/video-to-audio' : 'sonilo/v1.1/text-to-sound-effects', c.thoi_luong_s || 5); soSfx++; }
  }
  const giay = giayNhac(ds);
  const nhac = Object.fromEntries(MO_HINH_AM.filter((m) => m.loai === 'nhac').map((m) => [m.key, giaAm(m.key, giay)]));
  // Nhạc đang sinh: theo phân cảnh nào / cả tập — timeline phủ sọc đúng khối đó (#1205).
  const dn = db ? ((await db.execute(sql`SELECT request->>'phan_doan' AS pd FROM xv_job WHERE loai = 'am' AND ${jobDangCho()} AND request->>'dich' = 'nhac' AND request->>'tap_id' = ${String(tapId)}`)) as unknown as Row[]) : [];
  return { giong, soThoai, sfx, soSfx, nhac, giay, soPhanCanh: new Set(ds.map((c) => c.phan_doan).filter(Boolean)).size, dangNhac: dn.length,
    dangPhanDoan: dn.map((r) => s(r.pd)).filter(Boolean), dangCaTap: dn.some((r) => !r.pd) };
}

/** Đọc trang sản phẩm (link anh dán) → điền sẵn thông tin quảng cáo + ảnh sản phẩm thật (#1201). Claude chỉ đọc chữ của trang, ~$0.01. */
export async function layTuLinkSanPham(phimId: number, link: string): Promise<Kq<import('@/lib/xuong-video/kieu').ThongTinQc>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  if (!/^https?:\/\//.test(link.trim())) return loi('link phải bắt đầu bằng http(s)://');
  let html = '';
  try {
    const r = await fetch(link.trim(), { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36', accept: 'text/html' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return loi(`trang trả ${r.status}`);
    html = await r.text();
  } catch (e) { return loi(`không mở được trang: ${e instanceof Error ? e.message : String(e)}`); }
  const meta = (k: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']+)`, 'i'))?.[1] ?? '';
  const tuyet = (u: string) => { try { return new URL(u.replace(/&amp;/g, '&'), link).toString(); } catch { return ''; } };
  // Ảnh: og:image + ảnh trong JSON-LD Product + mọi <img> lớn trên trang (bỏ icon/logo/svg).
  const anh = new Set<string>();
  const og = meta('og:image'); if (og) anh.add(tuyet(og));
  for (const m of html.matchAll(/"image"\s*:\s*(\[[^\]]*\]|"[^"]+")/g)) { for (const u of m[1]!.matchAll(/"(https?:[^"]+)"/g)) anh.add(tuyet(u[1]!)); }
  for (const m of html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi)) { const u = tuyet(m[1]!); if (u && !/\.svg|logo|icon|sprite|badge|payment|flag/i.test(u)) anh.add(u); }
  const chu = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;|&#\d+;/g, ' ').replace(/\s+/g, ' ');
  const r0 = (await db.execute(sql`SELECT kinh_thanh FROM xv_phim WHERE id = ${phimId}`)) as unknown as Row[];
  const kt = docKinhThanh(r0[0]?.kinh_thanh as KinhThanh);
  const kq = await docTrangSanPham(link.trim(), { tieuDe: meta('og:title') || (html.match(/<title>([^<]*)/i)?.[1] ?? ''), moTa: meta('og:description') || meta('description'), chu, anh: [...anh].filter(Boolean) }, kt);
  await ghiChu(phimId, 'AI đọc trang sản phẩm', kq);
  if (!kq.ok) return loi(kq.loi);
  // Ảnh trên trang → kéo về R2 (link shop có thể chặn/đổi; model ảnh cần URL ổn định).
  const anhR2: string[] = [];
  for (const u of kq.data.anh.slice(0, 6)) {
    try {
      const f = await fetch(u, { signal: AbortSignal.timeout(15000) });
      const mime = f.headers.get('content-type')?.split(';')[0] || '';
      if (!f.ok || !mime.startsWith('image/')) continue;
      const url = await uploadToR2(`xuong-video/ref/${randomUUID()}.${duoi(mime)}`, Buffer.from(await f.arrayBuffer()), mime);
      void lamSanNho(url);   // ảnh nhỏ cho thẻ / timeline (anh-nho-may.ts)
      if (url) anhR2.push(url);
    } catch { /* bỏ ảnh lỗi */ }
  }
  return { ok: true, data: { ten: kq.data.ten, link: link.trim(), diem_noi_bat: kq.data.diem_noi_bat, doi_tuong: kq.data.doi_tuong, uu_dai: kq.data.uu_dai, thi_truong: kq.data.thi_truong, anh: anhR2 } };
}


/** Bộ set các shot của tập đứng trên (chỉ vật) — lưới kịch bản cần chỗ vật cố định để đo chuỗi chú ý (bo-set-3d.ts › loiMachTap). */
export async function boSetCuaTap(tapId: number): Promise<Kq<Pick<BoSet, 'id' | 'du_lieu'>[]>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT DISTINCT b.id, b.du_lieu FROM xv_bo_set b JOIN xv_nhan_vat v ON v.bo_set_id = b.id JOIN xv_tap t ON t.phim_id = v.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[];
  return { ok: true, data: r.map((x) => ({ id: Number(x.id), du_lieu: x.du_lieu as BoSet['du_lieu'] })) };
}
/** 🧊 Dữ liệu trình xem 3D của một tập (bo-set-xem.tsx): mọi bộ set mà shot của tập đứng trên + khối nhân vật / đạo cụ + máy và chỗ đứng
 *  từng shot. CÙNG dữ liệu Blender dựng khung xám (bo-set-3d.ts › bangDung) — xoay xem ở trình duyệt khớp đúng ảnh khung xám. */
/** SỔ LIỀN MẠCH (so-lien-mach.ts) cho drawer: theo TẬP (drawer cảnh — mọi nhân vật) hoặc theo NHÂN VẬT qua mọi tập của phim (drawer nhân vật).
 *  Nhánh dựng A, thứ tự phát. Lỗi lấy từ cùng cổng lienMachTap với cổng keyframe. */
export async function soLienMachAction(q: { tapId: number } | { phimId: number; ten: string }): Promise<Kq<{ tap: { id: number; so: number; ten: string }; so: SoLienMachT }[]>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const taps = (await db.execute('tapId' in q ? sql`SELECT * FROM xv_tap WHERE id = ${q.tapId}` : sql`SELECT * FROM xv_tap WHERE phim_id = ${q.phimId} ORDER BY so, id`)) as unknown as Row[];
  if (!taps[0]) return loi('không thấy tập');
  const nv = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(taps[0].phim_id)} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat);
  const out: { tap: { id: number; so: number; ten: string }; so: SoLienMachT }[] = [];
  for (const r of taps) {
    const t = mapTap(r);
    const ds = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${t.id} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
    const so = soLienMach(ds, t.phan_canh, nv, t.khong_gian);
    if ('ten' in q && !so.nhanVat[q.ten]?.length) continue;   // drawer nhân vật: chỉ tập có nhân vật này
    out.push({ tap: { id: t.id, so: t.so, ten: t.ten }, so });
  }
  return { ok: true, data: out };
}
export async function boSet3dTap(tapId: number): Promise<Kq<{ sets: BoSet[]; khoi: Record<string, NhanVat['khoi_3d']>; loai: Record<string, string>; shots: { id: number; thu_tu: number; ma: string; canh: string; set_id: number | null; may_3d: May3d | null; xam: string | null }[]; ti_le: string }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const t = (await db.execute(sql`SELECT t.phim_id, p.kinh_thanh FROM xv_tap t JOIN xv_phim p ON p.id = t.phim_id WHERE t.id = ${tapId}`)) as unknown as Row[];
  if (!t[0]) return loi('không thấy tập');
  const nv = ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(t[0].phim_id)} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat);
  const ds = locNhanh(((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${tapId} ORDER BY thu_tu, id`)) as unknown as Row[]).map(mapCanh), 'A');
  const shots = ds.map((c) => ({ id: c.id, thu_tu: c.thu_tu, ma: c.dan_dung?.ma ?? '', canh: c.canh, set_id: boSetCuaShot(c, nv), may_3d: c.may_3d ?? null, xam: c.khung_xam?.xam ?? null }));
  // + bộ set gắn với BỐI CẢNH của phim (chưa có shot nào đứng trên vẫn tham quan được — dựng set trước, đặt shot sau).
  const ids = [...new Set([...shots.map((s) => s.set_id), ...nv.filter((v) => v.loai === 'boi_canh').map((v) => v.bo_set_id ?? null)].filter((x): x is number => !!x))];
  const sets = ids.length ? ((await db.execute(sql`SELECT * FROM xv_bo_set WHERE id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)) as unknown as Row[]).map(mapBoSet) : [];
  const khoi: Record<string, NhanVat['khoi_3d']> = {}; const loaiNv: Record<string, string> = {};
  for (const v of nv) if (v.khoi_3d) { khoi[v.ten] = v.khoi_3d; loaiNv[v.ten] = v.loai; }
  return { ok: true, data: { sets, khoi, loai: loaiNv, shots, ti_le: docKinhThanh(t[0].kinh_thanh as KinhThanh).ti_le } };
}

/** 🧊 Dữ liệu trình xem theo MỘT BỘ SET (thẻ bối cảnh › 🧊 Xem 3D, anh 17/10/2026 "sao không thấy ở đây"): bộ set + khối nhân vật của phim +
 *  mọi shot (mọi tập, nhánh A) đứng trên bộ set đó — xem được ngay cả khi phim chưa có shot. Cùng khuôn dữ liệu boSet3dTap. */
export async function boSet3dSet(setId: number): Promise<Kq<{ sets: BoSet[]; khoi: Record<string, NhanVat['khoi_3d']>; loai: Record<string, string>; shots: { id: number; thu_tu: number; ma: string; canh: string; set_id: number | null; may_3d: May3d | null; xam: string | null }[]; ti_le: string }>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT b.*, p.kinh_thanh AS kt_phim FROM xv_bo_set b LEFT JOIN xv_phim p ON p.id = b.phim_id WHERE b.id = ${setId}`)) as unknown as Row[];
  if (!r[0]) return loi('không thấy bộ set');
  const set = mapBoSet(r[0]); const phimId = r[0].phim_id == null ? null : Number(r[0].phim_id);
  const nv = phimId ? ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat) : [];
  const ds = phimId ? locNhanh(((await db.execute(sql`SELECT c.* FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ${phimId} ORDER BY t.so, c.thu_tu, c.id`)) as unknown as Row[]).map(mapCanh), 'A') : [];
  const shots = ds.filter((c) => boSetCuaShot(c, nv) === setId).map((c) => ({ id: c.id, thu_tu: c.thu_tu, ma: c.dan_dung?.ma ?? '', canh: c.canh, set_id: setId, may_3d: c.may_3d ?? null, xam: c.khung_xam?.xam ?? null }));
  const khoi: Record<string, NhanVat['khoi_3d']> = {}; const loaiNv: Record<string, string> = {};
  for (const v of nv) if (v.khoi_3d) { khoi[v.ten] = v.khoi_3d; loaiNv[v.ten] = v.loai; }
  return { ok: true, data: { sets: [set], khoi, loai: loaiNv, shots, ti_le: docKinhThanh(r[0].kt_phim as KinhThanh).ti_le } };
}

// ── KHO CREATIVE THEO SẢN PHẨM (kho-creative.ts) ─────────────────────────────────────────────────────────────────────────────────
export type KhoSanPham = { sp: { key: string; ten: string; link: string; spy: number | null }; creative: DongCreative[]; thanh_phan: ThanhPhan[] };
/** Mọi creative QC của MỘT sản phẩm (khoá = nhom-phim.ts › sanPhamPhim) + thành phần gom từ shot / anchor. Chỉ đọc, 0đ. */
/** Phần Ethopex của creative QC (kinh_thanh.ethopex — scripts/ethopex/*): null nếu creative chưa lên Ethopex. */
function etpCua(kt: KinhThanh): EtpCr | null {
  const e = (kt as unknown as { ethopex?: { creative_id?: number; camp_id?: number | null; camp_nhan_ban?: number[]; nguon_qc?: string | null; tu?: number; den?: number; so_lieu?: SoLieuQc } }).ethopex;
  if (!e?.creative_id) return null;
  return { creative_id: e.creative_id, camp: [e.camp_id, ...(e.camp_nhan_ban ?? [])].filter((x): x is number => typeof x === 'number'), nguon_qc: e.nguon_qc ?? null,
    doan: e.tu != null && e.den != null ? `${e.tu}–${e.den}s` : '', the_loai: kt.the_loai ?? '', so_lieu: e.so_lieu ?? null };
}
export async function docKhoSanPham(key: string): Promise<Kq<KhoSanPham>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const phim = ((await db.execute(sql`SELECT p.id, p.ten, p.loai, p.kinh_thanh, p.goc_spy, p.poster_url, p.updated_at,
      (SELECT c.keyframe_url FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = p.id AND c.keyframe_url IS NOT NULL ORDER BY c.updated_at DESC LIMIT 1) AS anh_kf
    FROM xv_phim p WHERE p.loai = 'quang_cao' ORDER BY p.updated_at DESC`)) as unknown as Row[])
    .filter((r) => { const kt = (r.kinh_thanh ?? {}) as KinhThanh; return !kt.luu_tru && sanPhamPhim({ loai: 'quang_cao', kinh_thanh: kt })?.key === key; });
  if (!phim.length) return loi('không có creative nào của sản phẩm này');
  const ids = phim.map((r) => n(r.id));
  const tplIds = [...new Set(phim.map((r) => Number(((r.kinh_thanh ?? {}) as KinhThanh).tu_template?.id)).filter(Number.isFinite))];
  const [tpl, shot, nv, tap] = await Promise.all([
    tplIds.length ? db.execute(sql`SELECT id, ten, kinh_thanh->'template' AS cfg FROM xv_phim WHERE id = ANY(${mangInt(tplIds)}::int[])`) : Promise.resolve([]),
    db.execute(sql`SELECT t.phim_id, c.thu_tu, c.phan_doan, c.chu_man, c.thoai, c.loi_thoai, c.hanh_dong, c.updated_at,
        (c.keyframe_url IS NOT NULL) AS co_hinh, (c.video_url IS NOT NULL OR c.video_cuoi_url IS NOT NULL) AS co_clip
      FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE t.phim_id = ANY(${mangInt(ids)}::int[]) AND coalesce(c.nhanh, '') IN ('', 'A') ORDER BY t.phim_id, t.so, c.thu_tu`),
    db.execute(sql`SELECT phim_id, loai, ten, mo_ta, jsonb_array_length(coalesce(anh_ref, '[]'::jsonb)) AS so_anh, coalesce(giong, '') AS giong FROM xv_nhan_vat WHERE phim_id = ANY(${mangInt(ids)}::int[]) ORDER BY id`),
    db.execute(sql`SELECT phim_id, xuat FROM xv_tap WHERE phim_id = ANY(${mangInt(ids)}::int[])`),
  ]);
  const khuon = new Map((tpl as unknown as Row[]).map((r) => { const c = (r.cfg ?? {}) as { dong?: string; khuon?: string }; return [n(r.id), { id: n(r.id), dong: c.dong ?? '', khuon: c.khuon ?? '', ten: s(r.ten) }]; }));
  const xuat = new Map<number, { url: string; luc: string }>();
  for (const r of tap as unknown as Row[]) for (const x of arr<BanXuat>(r.xuat)) { const cu = xuat.get(n(r.phim_id)); if (x.url && (!cu || x.luc > cu.luc)) xuat.set(n(r.phim_id), { url: x.url, luc: x.luc }); }
  const shots: ShotKho[] = (shot as unknown as Row[]).map((r) => {
    const th = arr<{ loi?: string; url?: string | null }>(r.thoai).filter((d) => (d.loi ?? '').trim());
    return { phim_id: n(r.phim_id), thu_tu: n(r.thu_tu), phan_doan: s(r.phan_doan), chu_man: s(r.chu_man), loi: th.map((d) => d.loi).join(' ') || s(r.loi_thoai), hanh_dong: s(r.hanh_dong),
      co_hinh: r.co_hinh === true, co_clip: r.co_clip === true, can_giong: th.length > 0, co_giong: th.length > 0 && th.every((d) => !!d.url), sua_luc: new Date(s(r.updated_at)).toISOString() };
  });
  const anchors: AnchorKho[] = (nv as unknown as Row[]).map((r) => ({ phim_id: n(r.phim_id), loai: s(r.loai), ten: s(r.ten), mo_ta: s(r.mo_ta), so_anh: n(r.so_anh), giong: s(r.giong) }));
  const cr: CreativeKho[] = phim.map((r) => {
    const kt = (r.kinh_thanh ?? {}) as KinhThanh;
    return { id: n(r.id), ten: s(r.ten), sua_luc: new Date(s(r.updated_at)).toISOString(), anh: (r.poster_url ? s(r.poster_url) : null) || (r.anh_kf ? s(r.anh_kf) : null),
      goc: docGocSpy(r.goc_spy), ngon_ngu: kt.ngon_ngu ?? 'vi', phong_cach: kt.phong_cach ?? '', tpl: khuon.get(Number(kt.tu_template?.id)) ?? null, xuat: xuat.get(n(r.id)) ?? null,
      etp: etpCua(kt) };
  });
  const kt0 = (phim[0]!.kinh_thanh ?? {}) as KinhThanh;
  const spy = cr.flatMap((c) => nhomCuaGoc(c.goc))[0] ?? null;
  return { ok: true, data: { sp: { key, ten: kt0.qc?.ten?.trim() || key, link: kt0.qc?.link?.trim() ?? '', spy }, creative: cr.map((c) => dongCreative(c, shots)), thanh_phan: gomThanhPhan(shots, anchors, cr) } };
}

/** Cụm người mua của nhóm spy (xv_cum_goc) — null = chưa gom. */
export async function docCumGoc(sp: number): Promise<Kq<{ cum: CumGoc[]; nguon: string } | null>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = ((await db.execute(sql`SELECT cum, nguon FROM xv_cum_goc WHERE sp = ${sp}`)) as unknown as Row[])[0];
  return { ok: true, data: r ? { cum: arr<CumGoc>(r.cum), nguon: s(r.nguon) } : null };
}

// ── LÔ SINH (xv_lo): kế hoạch creative một ô góc × khuôn → tạo phim từ template (0đ) ──────────────────────────────────────────
export type LoSinh = { id: number; goc: GocSpy[]; dong: string; khuon: string; template_id: number | null; template_ten: string; phim_id: number | null; trang_thai: 'cho' | 'da_tao' | 'bo'; luc: string };
export async function dsLo(spKey: string): Promise<Kq<LoSinh[]>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const r = (await db.execute(sql`SELECT l.*, p.ten AS tpl_ten FROM xv_lo l LEFT JOIN xv_phim p ON p.id = l.template_id WHERE l.sp_key = ${spKey} ORDER BY l.id DESC`)) as unknown as Row[];
  return { ok: true, data: r.map((x) => ({ id: n(x.id), goc: docGocSpy(x.goc), dong: s(x.dong), khuon: s(x.khuon), template_id: x.template_id == null ? null : n(x.template_id), template_ten: s(x.tpl_ten),
    phim_id: x.phim_id == null ? null : n(x.phim_id), trang_thai: (s(x.trang_thai) || 'cho') as LoSinh['trang_thai'], luc: new Date(s(x.created_at)).toISOString() })) };
}
/** Thêm một ô (góc × khuôn) vào lô. Khuôn phải có template (lấy template đầu tiên của khuôn); ô đang chờ trùng thì không thêm lần hai. */
export async function themLo(spKey: string, goc: GocSpy, dong: string, khuon: string): Promise<Kq<number>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const g = docGocSpy([goc])[0];
  if (!g) return loi('góc không hợp lệ');
  const tpl = ((await db.execute(sql`SELECT id FROM xv_phim WHERE kinh_thanh->'template'->>'dong' = ${dong} AND kinh_thanh->'template'->>'khuon' = ${khuon}
    AND coalesce((kinh_thanh->>'luu_tru')::boolean, false) = false ORDER BY id LIMIT 1`)) as unknown as Row[])[0];
  if (!tpl) return loi('khuôn này chưa có template — dựng template trước (tab 🧩 Template)');
  const trung = ((await db.execute(sql`SELECT id FROM xv_lo WHERE sp_key = ${spKey} AND dong = ${dong} AND khuon = ${khuon} AND trang_thai = 'cho' AND goc @> ${JSON.stringify([{ id: g.id }])}::jsonb`)) as unknown as Row[])[0];
  if (trung) return { ok: true, data: n(trung.id) };
  const r = (await db.execute(sql`INSERT INTO xv_lo (sp_key, goc, dong, khuon, template_id) VALUES (${spKey}, ${JSON.stringify([g])}::jsonb, ${dong}, ${khuon}, ${n(tpl.id)}) RETURNING id`)) as unknown as Row[];
  return { ok: true, data: n(r[0]!.id) };
}
/** Bỏ một dòng lô (đổi trạng thái, KHÔNG xoá dòng). */
export async function boLo(id: number): Promise<Kq> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  await db.execute(sql`UPDATE xv_lo SET trang_thai = 'bo' WHERE id = ${id} AND trang_thai = 'cho'`);
  return { ok: true, data: undefined };
}
/** Giá trị ô SẢN PHẨM đã điền ở các creative cùng sản phẩm (tu_template.gia_tri, nhóm ô san_pham) — điền sẵn form tạo phim từ lô. */
export async function giaTriSanPham(spKey: string): Promise<Kq<Record<string, string>>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  return { ok: true, data: await giaTriSanPhamDb(db, spKey) };
}
/** Tạo phim từ một dòng lô: chép template + điền ô (như nút 🧩) rồi gắn góc của ô và nối dòng lô với phim. */
export async function taoPhimTuLo(loId: number, ten: string, gt: Record<string, string>): Promise<Kq<KetQuaChep>> {
  const db = getDb();
  if (!db) return loi('no db');
  if (!(await admin())) return loi('không có quyền');
  const l = ((await db.execute(sql`SELECT * FROM xv_lo WHERE id = ${loId}`)) as unknown as Row[])[0];
  if (!l || s(l.trang_thai) !== 'cho' || l.template_id == null) return loi('dòng lô không còn chờ tạo');
  const r = await taoPhimTuTemplate(n(l.template_id), ten, gt);
  if (!r.ok) return r;
  const g = docGocSpy(l.goc);
  await db.execute(sql`UPDATE xv_phim SET goc_spy = ${JSON.stringify(g)}::jsonb, updated_at = now() WHERE id = ${r.data.phimId}`);
  await db.execute(sql`UPDATE xv_lo SET phim_id = ${r.data.phimId}, trang_thai = 'da_tao' WHERE id = ${loId}`);
  return r;
}

// 👗 SỔ TRANG PHỤC CARRY của shot canhId: nạp mọi shot nhánh chính của tập + phân cảnh (ngày/lien_truoc) → lookMang → look đã carry cho từng nhân vật
// của riêng shot này. Dùng cho đối chiếu (Áo + Vết áo lấy từ biến thể, vết carry từ mốc đổ). tap_id + phan_canh từ xv_tap.
async function lookTap(db: NonNullable<ReturnType<typeof getDb>>, tapId: number, nhanVat: NhanVat[]): Promise<Map<number, Map<string, LookMang>>> {
  const t = ((await db.execute(sql`SELECT so, phan_canh FROM xv_tap WHERE id = ${tapId}`)) as unknown as Row[])[0];
  const ds = ((await db.execute(sql`SELECT id, canh, nhan_vat, bien_the FROM xv_canh WHERE tap_id = ${tapId} AND coalesce(nhanh, '') IN ('', 'A') ORDER BY thu_tu, id`)) as unknown as Row[])
    .map((r) => ({ id: n(r.id), canh: s(r.canh), nhan_vat: arr<number>(r.nhan_vat).map(Number), bien_the: arr<number>(r.bien_the).map(Number) }));
  return lookMang(ds, nhanVat, (t?.phan_canh ?? []) as PhanCanh[], t?.so == null ? undefined : n(t.so));
}

// 🧩 BÓC TÁCH một shot từ UI (bấm nút trong ngăn chi tiết) — chạy y boc-tach.mts --ghi cho khung đầu + cuối: bóc thành phần thật từ keyframe rồi đối chiếu dự kiến, ghi xv_canh.boc_tach.
export async function bocTachCanh(canhId: number): Promise<{ ok: boolean; boc_tach?: BocTachCanh; loi?: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, loi: 'chưa đăng nhập' };
  const db = getDb();
  if (!db) return { ok: false, loi: 'không có DB' };
  const row = ((await db.execute(sql`SELECT c.*, t.phim_id, t.khong_gian FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${canhId}`)) as unknown as Row[])[0];
  if (!row) return { ok: false, loi: 'không thấy cảnh' };
  const c = mapCanh(row); const phimId = Number(row.phim_id);
  if (!c.keyframe_url && !c.keyframe_ket) return { ok: false, loi: 'chưa có keyframe để bóc tách' };
  const nhanVat = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${phimId} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const kg = kgCua(row.khong_gian as never, c);
  const look = (await lookTap(db, c.tap_id, nhanVat)).get(canhId);
  const out: { dau?: BocTachKhung; cuoi?: BocTachKhung } = {}; const dc: { dau?: DongDoiChieu[]; cuoi?: DongDoiChieu[] } = {};
  for (const [luc, url] of [['dau', c.keyframe_url], ['cuoi', c.keyframe_ket]] as const) {
    if (!url) continue;
    const r = await bocTachKhung(db, phimId, url, nhanVat.filter((v) => v.loai === 'nhan_vat').map((v) => v.ten));
    if (!r) continue;
    out[luc] = r;
    const chieu = await doiChieuKhung(db, phimId, thanhPhanDuKien(c, nhanVat, kg, luc, look), r);
    if (chieu) dc[luc] = apDungSoBang(chieu, c, nhanVat, kg, luc, r);
  }
  if (!out.dau && !out.cuoi) return { ok: false, loi: 'bóc tách hỏng (cổng ảnh không trả kết quả)' };
  const boc_tach: BocTachCanh = { ...out, doi_chieu: dc, luc_boc: new Date().toISOString(), tren: { dau: c.keyframe_url, cuoi: c.keyframe_ket ?? null } };
  await db.execute(sql`UPDATE xv_canh SET boc_tach = ${JSON.stringify(boc_tach)}::jsonb WHERE id = ${canhId}`);
  return { ok: true, boc_tach };
}

// ⚖️ Lấy DANH MỤC THÀNH PHẦN của một shot cho NGĂN RỘNG (DoiChieuNgan). Chỉ đọc, không tốn tiền:
//   - duKien: thành phần dự kiến đầu/cuối dựng thẳng từ dữ liệu (MỌI shot thấy, kể cả chưa bóc AI).
//   - boSung: dự kiến BỔ SUNG nối từ shot TRƯỚC đã sinh keyframe (trạng thái cuối của nó cần tiếp sang shot này) — tách bạch khỏi dự kiến gốc.
//   - boc_tach: đối chiếu với ảnh (nếu đã bóc). keyframe đầu/cuối + nhân vật (BangBocTach so tóc).
export async function layThanhPhanCanh(canhId: number): Promise<{ ok: boolean; ten?: string; keyframe_url?: string | null; keyframe_ket?: string | null; boc_tach?: BocTachCanh | null; nhanVat?: NhanVat[]; duKien?: { dau: MucDuKien[]; cuoi: MucDuKien[] }; boSung?: { tuShot: string; tuThat: boolean; muc: MucDuKien[] } | null; loi?: string }> {
  const db = getDb();
  if (!db) return { ok: false, loi: 'không có DB' };
  const row = ((await db.execute(sql`SELECT c.*, t.phim_id, t.khong_gian FROM xv_canh c JOIN xv_tap t ON t.id = c.tap_id WHERE c.id = ${canhId}`)) as unknown as Row[])[0];
  if (!row) return { ok: false, loi: 'không thấy cảnh' };
  const c = mapCanh(row);
  const nhanVat = await kemBienThe(db, ((await db.execute(sql`SELECT * FROM xv_nhan_vat WHERE phim_id = ${Number(row.phim_id)} ORDER BY id`)) as unknown as Row[]).map(mapNhanVat));
  const kg = kgCua(row.khong_gian as never, c);
  const looks = await lookTap(db, c.tap_id, nhanVat); const look = looks.get(canhId);
  const duKien = { dau: thanhPhanDuKien(c, nhanVat, kg, 'dau', look), cuoi: thanhPhanDuKien(c, nhanVat, kg, 'cuoi', look) };
  // BỔ SUNG nối từ shot TRƯỚC cùng phân đoạn đã sinh keyframe: ưu tiên TRẠNG THÁI THỰC TẾ đã xác lập ở CUỐI shot đó (đã bóc) — đó mới là mốc shot này phải khớp (anh 30/10);
  // chưa bóc thì tạm dùng dự kiến cuối. tuThat=true khi lấy từ thực tế.
  let boSung: { tuShot: string; tuThat: boolean; muc: MucDuKien[] } | null = null;
  const tr = ((await db.execute(sql`SELECT * FROM xv_canh WHERE tap_id = ${c.tap_id} AND phan_doan = ${c.phan_doan} AND coalesce(nhanh, '') IN ('', 'A') AND thu_tu < ${c.thu_tu} AND keyframe_url IS NOT NULL ORDER BY thu_tu DESC LIMIT 1`)) as unknown as Row[])[0];
  if (tr) {
    const ct = mapCanh(tr);
    const dcCuoi = ct.boc_tach?.doi_chieu?.cuoi ?? ct.boc_tach?.doi_chieu?.dau;
    const tuThat = !!dcCuoi?.length;
    const muc = tuThat
      ? dcCuoi!.filter((x) => x.thuc_te && x.thuc_te !== '—').map((x) => ({ thanh_phan: x.thanh_phan, du_kien: x.thuc_te }))
      : thanhPhanDuKien(ct, nhanVat, kg, 'cuoi', looks.get(ct.id));
    boSung = { tuShot: `#${ct.thu_tu} ${ct.canh ?? ''}`.trim(), tuThat, muc };
  }
  return { ok: true, ten: `#${c.thu_tu} ${c.canh ?? ''}`.trim(), keyframe_url: c.keyframe_url, keyframe_ket: c.keyframe_ket ?? null, boc_tach: c.boc_tach ?? null, nhanVat, duKien, boSung };
}
