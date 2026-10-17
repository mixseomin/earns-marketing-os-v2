// CÂU HỎI KIỂM KHUNG kiểu DSG (Davidsonian Scene Graph, Google 2023 — arxiv 2310.18235; TIFA 2303.11897): thay vì hỏi chung "ảnh có ổn không", sinh
// từ DỮ LIỆU shot một danh sách câu có / không, mỗi câu một sự thật nguyên tử (ai có mặt, mặc gì, quay mặt đâu, đồ nhận dạng đúng không…), câu phụ
// thuộc chỉ tính khi câu gốc đúng ("mặc vest trắng" chỉ hỏi khi "có Hạ"). Người chấm (Claude trong phiên — kiem-khung.mts --in, hoặc lượt API) trả lời
// từng câu; câu "không" = một lỗi đúng loại (khung.ts › LOAI_LOI_KHUNG). Anh 17/10/2026: "xem shot nào phải sinh lại keyframe" — câu hỏi lấy từ dữ
// liệu hiện tại (sổ người, 3D, ảnh chuẩn), nên keyframe cũ sinh từ prompt / 3D cũ lộ ra ngay câu nào sai. Thuần — tự kiểm: cau-hoi-khung.test.mts
import type { Canh, May3d, NhanVat } from './kieu';
import type { LoaiLoiKhung } from './khung';
import { bienTheTheoSo, huongVoiMay, PT_THAY } from './bo-set-3d';
import { LA_NHAN_DANG } from './kiem-ai-3d';
import { dauBoiCanh } from './prompt-khoi';

export type CauHoi = { ma: string; hoi: string; loai: LoaiLoiKhung; phu_thuoc?: string };
/** DÁNG ở khung mở (mã động tác dung-set.py › DONG_TAC) → câu hỏi nhìn được. Chỉ dáng rõ trên hình; mocap 'mc_*' (đi, chạy) không hỏi. */
const DANG: Record<string, string> = { chong_ban: 'chống hai tay lên mặt bàn, người đổ về trước', cui_nguoi: 'cúi người về phía trước', om_thung: 'ôm thùng trước bụng', cam_truoc: 'cầm món đồ trước ngực',
  khoanh_tay: 'khoanh tay', thuyet_trinh: 'một tay mở về phía màn chiếu', gioi_thieu: 'đưa tay giới thiệu người bên cạnh', gio_cao: 'giơ cao món đồ', hat: 'hất mạnh món đồ ra trước', dua_truoc_mat: 'đưa món đồ lên trước mặt người đối diện' };
const ngan = (t: string, n = 90) => { const x = t.trim().replace(/\s+/g, ' '); return x.length > n ? `${x.slice(0, n).replace(/[\s,;]+\S*$/, '')}…` : x; };

export function cauHoiKhung(x: { canh: Pick<Canh, 'khung_xam' | 'ky_thuat' | 'dan_dung' | 'may_3d'>; nhanVat: NhanVat[]; may?: May3d | null }): CauHoi[] {
  const { canh, nhanVat } = x; const m = x.may ?? canh.may_3d; const kx = canh.khung_xam;
  const out: CauHoi[] = []; const chen = canh.ky_thuat?.co_canh === 'insert';
  // CẬN TAY: cận chèn mà chủ thể là món đang cầm / đeo ở tay → mặt người ngoài khung. Cận vết trên áo (#2) thì khung 3D vẫn có đầu — không hỏi "không thấy mặt".
  const canTay = chen && (kx?.kiem ?? []).some((k) => k.bat_buoc && k.trong_khung && m?.vi_tri.some((v) => v.ten === k.nhan_vat && v.cam && (!v.deo || v.deo.startsWith('cotay'))));
  const bc = nhanVat.find((v) => v.loai === 'boi_canh');
  if (bc?.mo_ta.trim()) out.push({ ma: 'boi_canh', loai: 'bo_tri', hoi: `Bối cảnh đúng: "${dauBoiCanh(bc.mo_ta)}"?` });
  if (canh.dan_dung?.mo?.trim()) out.push({ ma: 'mo', loai: 'trang_thai', hoi: `Đúng khoảnh khắc MỞ shot: "${ngan(canh.dan_dung.mo, 120)}"?` });
  const chuThe = (kx?.kiem ?? []).filter((k) => k.bat_buoc && k.trong_khung);
  const nguoi: string[] = [];
  for (const k of chuThe) {
    const a = nhanVat.find((v) => v.ten === k.nhan_vat); const vt = m?.vi_tri.find((v) => v.ten === k.nhan_vat); const co = `co:${k.nhan_vat}`;
    if (a?.loai === 'nhan_vat') {
      nguoi.push(a.ten);
      out.push({ ma: co, loai: 'thieu', hoi: canTay ? `Có tay / cổ tay của ${a.ten} trong khung?` : `Có ${a.ten} trong khung (${ngan(a.mo_ta, 70)})?` });
      const ao = vt ? bienTheTheoSo(vt, a).map((b) => b.mo_ta).filter(Boolean) : [];
      const dang = (vt?.dien ?? []).map((d) => String(d)).filter((d) => !d.includes('@') || Number(d.split('@')[1]!.split('-')[0]) <= 0.01).map((d) => DANG[d.split('@')[0]!]).filter(Boolean);
      if (dang.length) out.push({ ma: `dang:${a.ten}`, phu_thuoc: co, loai: 'trang_thai', hoi: `${a.ten} đang ${dang.join(', ')}?` });
      if (ao.length) out.push({ ma: `ao:${a.ten}`, phu_thuoc: co, loai: 'nhan_dang', hoi: `${a.ten} mặc đúng: ${ngan(ao.join('; '), 120)}?` });
      if (canTay) out.push({ ma: `chen:${a.ten}`, phu_thuoc: co, loai: 'thua', hoi: `Cận chèn: KHÔNG thấy mặt ${a.ten} (chỉ tay / cổ tay)?` });
      else if (!chen && m && vt) { const h = huongVoiMay(m, vt); if (h && h.lech <= 80) out.push({ ma: `mat:${a.ten}`, phu_thuoc: co, loai: 'vi_tri', hoi: `${a.ten} quay mặt về phía máy, thấy mặt (3D lệch ${h.lech}°)?` }); }
    } else {
      out.push({ ma: co, loai: 'thieu', hoi: `Có ${k.nhan_vat}${a?.mo_ta ? ` (${ngan(a.mo_ta, 70)})` : ''} rõ trong khung?` });
      if (vt?.cam) out.push({ ma: `cam:${k.nhan_vat}`, phu_thuoc: co, loai: 'vi_tri', hoi: `${k.nhan_vat} nằm trên ${vt.deo ? `${vt.deo.startsWith('cotay_t') ? 'cổ tay trái' : vt.deo.startsWith('cotay_p') ? 'cổ tay phải' : vt.deo} của` : 'tay / người'} ${vt.cam}?` });
    }
  }
  if (nguoi.length && !chen) out.push({ ma: 'so_nguoi', loai: 'thua', hoi: `Đúng ${nguoi.length} nhân vật chính (${nguoi.join(', ')}) — không nhân đôi, không người lạ chen tiền cảnh?` });
  for (const t of (kx?.thay ?? []).filter((t) => t.pt >= PT_THAY && LA_NHAN_DANG.test(t.en ?? ''))) out.push({ ma: `nd:${t.ten}`, loai: 'nhan_dang', hoi: `${ngan(t.en ?? t.ten, 90)} — đúng nội dung ảnh chuẩn trên khung 3D (chữ, hình)?` });
  if (m) {
    const g = Math.round((Math.atan2((m.nhin[2] ?? 0) - (m.dat[2] ?? 0), Math.hypot(m.nhin[0]! - m.dat[0]!, m.nhin[1]! - m.dat[1]!)) * 180) / Math.PI);
    out.push({ ma: 'goc', loai: 'vi_tri', hoi: `Góc máy ${g >= 8 ? `THẤP, ngước lên ~${g}°` : g <= -8 ? `CAO, chúc xuống ~${-g}°` : 'ngang tầm'} như khung 3D?` });
  }
  const chinh = chuThe.filter((k) => nhanVat.some((v) => v.ten === k.nhan_vat && v.loai === 'nhan_vat')).sort((a, b) => b.cao_khung_pt - a.cao_khung_pt)[0];
  if (chinh && !chen) out.push({ ma: 'co_canh', loai: 'vi_tri', hoi: `Cỡ khung đúng 3D: ${chinh.nhan_vat} cao khoảng ${Math.round(Math.min(100, chinh.cao_khung_pt))}% chiều cao khung (±15)?` });
  out.push({ ma: 'chu', loai: 'thua', hoi: 'Không có chữ / logo / phụ đề lạ (ngoài nội dung đồ nhận dạng)?' });
  return out;
}

/** In danh sách câu hỏi cho người chấm (thẻ shot của kiem-khung). */
export const inCauHoi = (ds: CauHoi[]) => ds.length ? `CÂU HỎI KIỂM (trả lời từng câu có / không; câu có "← sau" chỉ tính khi câu gốc "có"; mỗi câu "không" = một lỗi đúng loại trong ngoặc):\n${ds.map((c) => `  [${c.ma}] (${c.loai}) ${c.hoi}${c.phu_thuoc ? ` ← sau [${c.phu_thuoc}]` : ''}`).join('\n')}` : '';
/** Đáp án → lỗi: câu "không" mà câu gốc (nếu có) "có". dap: ma → true (có) / false (không). */
export function loiTuDapAn(ds: CauHoi[], dap: Record<string, boolean>): { loai: LoaiLoiKhung; mo_ta: string }[] {
  return ds.filter((c) => dap[c.ma] === false && (!c.phu_thuoc || dap[c.phu_thuoc] !== false)).map((c) => ({ loai: c.loai, mo_ta: `[${c.ma}] không: ${c.hoi}` }));
}
