// Bộ kiểm "quảng cáo đạt chưa" — chạy ngay sau tách cảnh và mỗi lần sửa shot, không tốn tiền, dùng chung cho MỌI sản phẩm
// (review phim bra 09/10/2026: hook 6s toàn lời, không chữ màn, không bằng chứng, 64s cho brief 24s — không máy nào kêu).
// Mỗi luật là một thứ ads thật đo được: 85% xem tắt tiếng → chữ màn; 3 giây đầu quyết định giữ tay; sản phẩm phải thấy sớm;
// số liệu chỉ được lấy từ mục sản phẩm; CTA phải có chữ. File thuần, tự kiểm bằng kiem-qc.test.mts.
import type { Canh, LoaiPhim, NhanVat, ThongTinQc } from './kieu';
import { giayPhat, locNhanh, coMau, giayMau } from './kieu';

export type MucKiem = { key: string; ok: boolean; chu: string; chiTiet?: string };
type ShotKiem = Pick<Canh, 'thu_tu' | 'nhan_vat' | 'phan_doan' | 'chu_man' | 'nhanh' | 'phat_s' | 'thoi_luong_s' | 'loi_thoai' | 'thoai' | 'trang_thai' | 'keyframe_url'>;

const soTu = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const loiCua = (c: ShotKiem) => (c.thoai?.length ? c.thoai.map((d) => d.loi).join(' ') : c.loi_thoai.replace(/^[^:"“]*:\s*/, ''));
const coSo = (s: string) => /\d|★|⭐|%/.test(s);
/** Tốc độ nói nghe rõ: ~2,5 từ/giây (tiếng Việt lẫn Anh); trên 3 là nuốt chữ. */
export const TU_MOI_GIAY = 2.8;

/** Kiểm một bản dựng (thân + một nhánh hook). Phim/short chỉ kiểm độ dài; quảng cáo kiểm đủ bộ. */
export function kiemQc(opts: { loai: LoaiPhim; canh: ShotKiem[]; nhanVat: Pick<NhanVat, 'id' | 'loai'>[]; qc?: ThongTinQc | null; mucTieuS?: number | null; nhanh?: string | null }): MucKiem[] {
  const ds = locNhanh(opts.canh, opts.nhanh).slice().sort((a, b) => a.thu_tu - b.thu_tu);
  const out: MucKiem[] = [];
  if (!ds.length) return out;
  const tong = ds.reduce((a, c) => a + giayPhat(c), 0);
  if (opts.mucTieuS) {
    const lech = Math.abs(tong - opts.mucTieuS) / opts.mucTieuS;
    out.push({ key: 'dai', ok: lech <= 0.12, chu: `${Math.round(tong)}s / mục tiêu ${opts.mucTieuS}s`, chiTiet: lech > 0.12 ? `Lệch ${Math.round(lech * 100)}% — cắt bớt (kéo mép clip) hoặc tách lại với đúng thời lượng` : undefined });
  }
  if (opts.loai !== 'quang_cao') return out;
  // 0. Có QC mẫu: số shot đúng bằng mẫu, tổng giây ±10% — bản clone "gần giống nhất" đo được ở đây.
  if (coMau(opts.qc)) {
    const m = opts.qc!.mau!; const gm = giayMau(m); const than = ds.filter((c) => !c.nhanh || c.nhanh === 'A');
    const lechGiay = gm ? Math.abs(tong - gm) / gm : 0;
    out.push({ key: 'mau', ok: than.length === m.shots.length && lechGiay <= 0.1, chu: `Bám QC mẫu: ${than.length}/${m.shots.length} shot · ${Math.round(tong)}/${gm}s`,
      chiTiet: than.length !== m.shots.length ? `Mẫu có ${m.shots.length} shot, bản này ${than.length} — tách lại theo mẫu hoặc thêm/bớt shot` : lechGiay > 0.1 ? `Tổng giây lệch ${Math.round(lechGiay * 100)}% so với mẫu — kéo mép clip cho khớp` : undefined });
  }
  const spIds = new Set(opts.nhanVat.filter((v) => v.loai === 'san_pham').map((v) => v.id));
  const coSp = (c: ShotKiem) => c.nhan_vat.some((id) => spIds.has(id));
  // 1. Hook: shot đầu ≤ 3 giây phát, có chữ trên màn.
  const dau = ds[0]!;
  out.push({ key: 'hook', ok: giayPhat(dau) <= 3 && !!dau.chu_man.trim(), chu: 'Hook ≤ 3s + chữ màn', chiTiet: giayPhat(dau) > 3 ? `Shot đầu phát ${giayPhat(dau)}s — cắt còn ≤ 3s` : !dau.chu_man.trim() ? 'Shot đầu chưa có chữ trên màn (85% xem tắt tiếng)' : undefined });
  // 2. Sản phẩm thấy sớm: một shot có anchor sản phẩm bắt đầu trước giây thứ 5 (hoặc 20% thời lượng).
  let t = 0; let thaySom = false;
  for (const c of ds) { if (coSp(c) && t <= Math.max(5, tong * 0.2)) { thaySom = true; break; } t += giayPhat(c); }
  out.push({ key: 'sp_som', ok: spIds.size === 0 ? false : thaySom, chu: 'Sản phẩm xuất hiện ≤ 5s', chiTiet: spIds.size === 0 ? 'Chưa có anchor sản phẩm ở mục 2' : thaySom ? undefined : 'Shot có sản phẩm bắt đầu quá muộn' });
  // 3. ≥ 2/3 shot có sản phẩm.
  const soSp = ds.filter(coSp).length;
  out.push({ key: 'sp_23', ok: soSp * 3 >= ds.length * 2, chu: `Sản phẩm trong ${soSp}/${ds.length} shot`, chiTiet: soSp * 3 < ds.length * 2 ? 'Cần ≥ 2/3 shot thấy sản phẩm — thêm sản phẩm vào shot (＋ đối tượng)' : undefined });
  // 4. Bằng chứng có số thật: chữ màn/thoại của beat Bằng chứng chứa số, và số đó phải có trong mục sản phẩm.
  const chuBc = ds.map((c) => `${c.chu_man} ${loiCua(c)}`).filter(coSo);
  const nguon = `${opts.qc?.diem_noi_bat ?? ''} ${opts.qc?.uu_dai ?? ''} ${opts.qc?.doi_tuong ?? ''}`;
  const soTrongNguon = new Set((nguon.match(/\d[\d.,]*/g) ?? []).map((x) => x.replace(/[.,]/g, '')));
  const soBia = ds.flatMap((c) => (`${c.chu_man} ${loiCua(c)}`.match(/\d[\d.,]*/g) ?? []).map((x) => x.replace(/[.,]/g, ''))).filter((x) => x.length >= 2 && !soTrongNguon.has(x));
  out.push({ key: 'bang_chung', ok: chuBc.length > 0 && soBia.length === 0, chu: chuBc.length ? (soBia.length ? `Số không có trong mục 0: ${[...new Set(soBia)].slice(0, 4).join(', ')}` : 'Bằng chứng có số thật') : 'Chưa có bằng chứng bằng số', chiTiet: soBia.length ? 'Số liệu trong chữ màn/thoại phải lấy từ mục 0 (đánh giá, số khách, giá) — máy không tìm thấy các số này ở đó' : chuBc.length ? undefined : 'Thêm một shot/chữ màn nêu số đánh giá, số khách, chính sách đổi trả… (lấy từ mục 0)' });
  // 5. CTA: shot cuối có chữ màn, và nhắc tới ưu đãi/hành động.
  const cuoi = ds[ds.length - 1]!;
  out.push({ key: 'cta', ok: !!cuoi.chu_man.trim(), chu: 'CTA có chữ màn', chiTiet: cuoi.chu_man.trim() ? undefined : 'Shot cuối phải có chữ: ưu đãi + hành động (mua ngay / xem size / bấm link)' });
  // 6. Trấn an trước CTA: một trong 3 shot cuối nhắc đổi trả / size / bảo hành / miễn phí ship (chữ màn hoặc thoại).
  const tranAn = /đổi|trả|hoàn|size|bảo hành|ship|miễn phí|return|exchange|refund|guarantee|free shipping|risk/i;
  const coTranAn = ds.slice(-3).some((c) => tranAn.test(`${c.chu_man} ${loiCua(c)}`));
  out.push({ key: 'tran_an', ok: coTranAn, chu: 'Trấn an trước CTA', chiTiet: coTranAn ? undefined : 'Trước CTA cần một câu/chữ về đổi trả, size, bảo hành hay ship (nếu mục 0 có)' });
  // 7. Tốc độ nói: từ / giây phát ≤ 2,8 ở mọi shot.
  const nhanh = ds.filter((c) => { const tu = soTu(loiCua(c)); return tu > 0 && tu / giayPhat(c) > TU_MOI_GIAY; });
  out.push({ key: 'toc_do', ok: nhanh.length === 0, chu: nhanh.length ? `${nhanh.length} shot nói quá nhanh` : 'Tốc độ nói vừa', chiTiet: nhanh.length ? `Shot ${nhanh.map((c) => `#${c.thu_tu}`).join(', ')}: quá ${TU_MOI_GIAY} từ/giây — bớt lời hoặc kéo dài phát` : undefined });
  // 8. Chữ màn ngắn: ≤ 8 từ mỗi shot (đọc được trong 1-2 giây).
  const dai = ds.filter((c) => soTu(c.chu_man) > 8);
  out.push({ key: 'chu_ngan', ok: dai.length === 0, chu: dai.length ? `${dai.length} chữ màn dài` : 'Chữ màn ≤ 8 từ', chiTiet: dai.length ? `Shot ${dai.map((c) => `#${c.thu_tu}`).join(', ')}: chữ màn quá 8 từ` : undefined });
  return out;
}
