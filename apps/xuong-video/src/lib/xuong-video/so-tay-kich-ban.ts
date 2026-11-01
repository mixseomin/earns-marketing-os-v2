// SỔ TAY KỊCH BẢN — thư viện kinh nghiệm + bộ phép thử mà MỌI lần bấm "Viết kịch bản" tự đọc (anh 01/11/2026: "các kinh nghiệm, thông tin đề xuất có lưu
// thành thư viện để khi bấm sinh kịch bản sau này nó tự refer đến không? Các bước chấm chéo, chấm ngược, thử kịch bản cũng vậy. Bước viết kịch bản = AI
// không đơn thuần là gọi AI mà còn tự chấm chính kịch bản đó và cho ra kết luận"). Gốc: kịch bản phim #1156 do AI viết một lượt gom 2–3 gag vào một cảnh,
// nhạt, không ai chấm. Một nguồn cho: lời dặn viết + tách cảnh (claude.ts › heThong qua vanSoTay), bộ chấm (claude.ts › chamKichBanAi), máy kiểm thẻ gag,
// kết luận lưu ở xv_tap.cham_kich_ban, trang Thư viện › 📓 Sổ tay kịch bản. Thêm bài học = thêm một dòng ở đây. Thuần — tự kiểm: so-tay-kich-ban.test.mts.

export type KinhNghiem = { ma: string; ten: string; bai_hoc: string; ap_dung: string; /** 'chung' = mọi phim; còn lại = khoá cách viết (CACH_VIET) */ pham_vi: 'chung' | 'gag'; nguon: string; link?: string };
export const KINH_NGHIEM_KB: KinhNghiem[] = [
  { ma: 'sinh_du_cham', ten: 'Sinh dư rồi chấm, không viết một lượt', pham_vi: 'chung',
    bai_hoc: 'Bản AI viết một lần ra rập khuôn: trong nghiên cứu Dramatron, 15 biên kịch nhận xét kết quả "formulaic", chỉ dùng được để brainstorm.',
    ap_dung: 'Máy viết luôn kèm một lượt chấm của model KHÁC; phim gag sinh ~30 ứng viên rồi giữ phần tốt nhất.', nguon: 'DeepMind Dramatron (NeurIPS 2022)', link: 'https://github.com/google-deepmind/dramatron' },
  { ma: 'dan_truoc_viet_sau', ten: 'Lập dàn trước, viết sau', pham_vi: 'chung',
    bai_hoc: 'Sinh truyện theo tầng (logline → nhân vật → điểm truyện → cảnh) giữ mạch tốt hơn viết thẳng; nhiều agent phê bình lẫn nhau lọc được chỗ nhạt.',
    ap_dung: 'Viết bám khung beat của gói; bộ chấm là agent thứ hai, thử mù là agent thứ ba.', nguon: 'Awesome-Story-Generation (danh sách nghiên cứu)', link: 'https://github.com/yingpengma/Awesome-Story-Generation' },
  { ma: 'luat_hep', ten: 'Luật hẹp sinh ra gag', pham_vi: 'gag',
    bai_hoc: 'Bộ luật Road Runner (Chuck Jones): luật cứng cho nhân vật và thế giới — trọng lực là kẻ thù, bị bẽ mặt nhiều hơn bị đau. Gốc gác còn tranh cãi, cách đặt luật hẹp vẫn đáng học.',
    ap_dung: 'Mỗi phim gag khai MỘT vật đặc trưng; mọi lời giải phải đi qua vật đó (phép thử "thay vai").', nguon: 'Chuck Jones, Chuck Amuck (1999)', link: 'https://www.mentalfloss.com/entertainment/tv/chuck-jones-rules-writing-road-runner-cartoons' },
  { ma: 'mot_shot_mot_gag', ten: 'Một shot = một gag trọn', pham_vi: 'gag',
    bai_hoc: '"Englishman in New York" (antrofrog): 46 giây, 13 gag, cắt mỗi 3–4 giây theo phách; mỗi shot là một cú máy liền chứa đủ vấn đề → vật ra tay → phản ứng.',
    ap_dung: 'Kịch bản gag viết theo khối [GAG n], tách cảnh mỗi khối đúng một shot; máy chặn khối gom hai gag.', nguon: 'antrofrog — Englishman in New York (Midjourney + ảnh→video)' },
  { ma: 'cu_day_them', ten: 'Gag phải có cú đẩy thêm (topper)', pham_vi: 'gag',
    bai_hoc: 'Gỡ rối xong mà dừng là gag nhạt; phim mẫu luôn có thêm một cú sau lời giải (gỡ dây xong người dắt chó xoay như con quay).',
    ap_dung: 'Thẻ gag bắt buộc ô "đẩy thêm"; bộ chấm trừ điểm gag thiếu nó.', nguon: 'Thuật ngữ gag hoạt hình "topper"; phân tích phim mẫu 01/11/2026' },
  { ma: 'cham_tong', ten: 'Chấm từng mảnh rồi chấm cả tập', pham_vi: 'chung',
    bai_hoc: 'Chấm từng gag / cảnh riêng không thấy hai mảnh cùng một trò khác tên (lượt đầu phim #1156: "xâu vật bằng đòn" và "xâu chuỗi qua lỗ" cùng lọt).',
    ap_dung: 'Vòng chấm sau được xem các mảnh đã giữ; cuối cùng một lượt chấm tổng cả tập loại cặp trùng trò.', nguon: 'Bài học lượt chạy 01/11/2026' },
  { ma: 'khong_phen', ten: 'Tránh phèn', pham_vi: 'chung',
    bai_hoc: 'Phèn = lời giải tiện quá, cảm ơn lố, nhồi biểu tượng (nón lá, áo dài, phở) không vì lý do trong truyện, biểu cảm khoa trương.',
    ap_dung: 'Chấm ngược hỏi thẳng "chỗ nào phèn" trước khi cho điểm.', nguon: 'Anh 01/11/2026' },
];

export type PhepThu = { ma: string; ten: string; hoi: string; truot: string };
/** 6 phép thử một gag — trượt một là loại (anh duyệt 01/11/2026). */
export const PHEP_THU_GAG: PhepThu[] = [
  { ma: 'thay_vai', ten: 'Thay vai', hoi: 'Thay nhân vật chính bằng một người qua đường bất kỳ, gag còn chạy không?', truot: 'còn chạy → tầm thường; lời giải phải cần đúng vật đặc trưng, dùng theo cách bất ngờ' },
  { ma: 'doi_pho', ten: 'Đổi nơi', hoi: 'Chuyển gag sang nơi khác có còn đúng không?', truot: 'còn đúng → chưa thuộc về nơi này' },
  { ma: 'day_them', ten: 'Cú đẩy thêm', hoi: 'Sau khi gỡ rối còn một cú bất ngờ nữa không?', truot: 'không có → nhạt' },
  { ma: 'doc_nua_giay', ten: 'Đọc trong nửa giây', hoi: 'Vấn đề có hiện ra ngay khung đầu, không cần chữ / lời?', truot: 'phải giải thích → hỏng' },
  { ma: 'khong_lap', ten: 'Không lặp cơ chế', hoi: 'Cơ chế gag có trùng gag khác trong tập không?', truot: 'trùng (vd hai lần "móc vật đang bay") → loại một' },
  { ma: 'leo_thang', ten: 'Leo thang', hoi: 'Gag có to hơn gag trước (số người, mức nguy, độ khéo)?', truot: 'phẳng → đổi thứ tự hoặc thay gag' },
];
/** Phép thử kịch bản thường (mọi gói không phải gag) — bám khung 5 nhịp của vietKichBan + luật ngành. */
export const PHEP_THU_CHUNG: PhepThu[] = [
  { ma: 'hook', ten: 'Hook 3 giây', hoi: 'Ba giây đầu có hình / câu khiến người xem phải xem tiếp?', truot: 'mở bằng giới thiệu chậm' },
  { ma: 'muc_tieu', ten: 'Mục tiêu + xung đột', hoi: 'Nhân vật muốn gì, cái gì cản — thấy rõ trong cảnh đầu?', truot: 'không rõ ai muốn gì' },
  { ma: 'leo_thang', ten: 'Leo thang', hoi: 'Các lần thử tệ dần, sức ép tăng?', truot: 'phẳng, lặp' },
  { ma: 'lat', ten: 'Lật ngược', hoi: 'Có cú lật ở 55–90% thời lượng mà người xem không đoán trước?', truot: 'đoán được / không có' },
  { ma: 'khong_sao', ten: 'Không sáo, không phèn', hoi: 'Tình huống, thoại có lối mòn hay biểu tượng nhồi nhét?', truot: 'cliché, thoại giải thích, cảm ơn lố' },
  { ma: 'dung_brief', ten: 'Đúng brief / logline', hoi: 'Kịch bản kể đúng điều brief + logline hứa?', truot: 'lệch đề' },
];

/** Cách viết theo gói: 'gag' = sinh dư thẻ gag → chấm → xếp; còn lại = viết một bản → chấm → sửa một vòng. */
export type CachViet = 'gag' | 'thuong';
export const GOI_GAG = new Set(['mv_gag_hoat_hinh']);
export const cachViet = (goi: string | null | undefined): CachViet => (goi && GOI_GAG.has(goi) ? 'gag' : 'thuong');
export const phepThuCua = (goi: string | null | undefined): PhepThu[] => (cachViet(goi) === 'gag' ? PHEP_THU_GAG : PHEP_THU_CHUNG);
export const kinhNghiemCua = (goi: string | null | undefined): KinhNghiem[] => KINH_NGHIEM_KB.filter((k) => k.pham_vi === 'chung' || k.pham_vi === cachViet(goi));

/** Khối dặn đưa vào heThong (viết + tách cảnh đọc chung). */
export function vanSoTay(goi: string | null | undefined): string {
  const cv = cachViet(goi);
  return `SỔ TAY KỊCH BẢN (bài học ngành — áp dụng, không nhắc lại):\n${kinhNghiemCua(goi).map((k) => `- ${k.ten}: ${k.bai_hoc} → ${k.ap_dung}`).join('\n')}\n`
    + `Kịch bản sẽ bị chấm bằng các phép thử sau (trượt là bị loại):\n${phepThuCua(goi).map((p) => `- ${p.ten}: ${p.hoi} (trượt khi ${p.truot})`).join('\n')}`
    + (cv === 'gag' ? `\nĐỊNH DẠNG GAG: kịch bản gồm các khối "[GAG n] <tên>" — mỗi khối là MỘT shot liền, một gag trọn: vấn đề → vật đặc trưng ra tay → cú đẩy thêm → phản ứng. Khi tách cảnh: mỗi khối [GAG n] đúng MỘT shot, không chia nhỏ, không gộp.` : '');
}

// ── Thẻ gag + máy kiểm (0đ) ─────────────────────────────────────────────────────────────────────────────────────────────
export type TheGag = { ten: string; van_de: string; ra_tay: string; day_them: string; phan_ung: string; /** tên cơ chế ngắn (vd "móc vật đang bay") — để bắt lặp */ co_che: string;
  /** vì sao gag chỉ xảy ra ở nơi này */ vi_sao_noi: string; /** 1–10: quy mô / mức nguy / độ khéo — để xếp leo thang */ muc: number };
export type DiemGag = { ten: string; diem: Record<string, number>; ly_do_loai: string; phen: string; tong: number };
export type ThuMu = { ten: string; ke_lai: string; hieu: boolean; buon_cuoi: number };

export const chuanCoChe = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
/** Máy kiểm một bộ gag: ô trống, trùng cơ chế, khối gom hai gag (ra_tay chứa "rồi … rồi"/"; " nhiều lời giải). */
export function kiemTheGag(ds: TheGag[]): string[] {
  const loi: string[] = [];
  const o: (keyof TheGag)[] = ['van_de', 'ra_tay', 'day_them', 'phan_ung', 'co_che', 'vi_sao_noi'];
  ds.forEach((g, i) => { const thieu = o.filter((k) => !String(g[k] ?? '').trim()); if (thieu.length) loi.push(`gag ${i + 1} "${g.ten}" thiếu ô ${thieu.join(', ')}`); });
  const thay = new Map<string, number>();
  ds.forEach((g, i) => { const k = chuanCoChe(g.co_che); if (!k) return; if (thay.has(k)) loi.push(`gag ${i + 1} "${g.ten}" trùng cơ chế "${g.co_che}" với gag ${thay.get(k)! + 1}`); else thay.set(k, i); });
  ds.forEach((g, i) => { if ((g.van_de.match(/;/g) ?? []).length >= 2) loi.push(`gag ${i + 1} "${g.ten}" có vẻ gom nhiều vấn đề trong một shot`); });
  return loi;
}

/** Chọn K gag: bỏ gag trượt bất kỳ phép thử (điểm 0) hoặc thử mù không hiểu, bỏ trùng cơ chế (giữ bản điểm cao), xếp leo thang theo muc
 *  (gag điểm cao nhất để cuối nếu cùng mức). Trả về cả danh sách loại kèm lý do — kết luận cần nói rõ vì sao. */
export function chonGag(ds: TheGag[], diem: DiemGag[], mu: ThuMu[], k: number): { chon: TheGag[]; loai: { ten: string; vi: string }[] } {
  const d = new Map(diem.map((x) => [x.ten, x])); const m = new Map(mu.map((x) => [x.ten, x]));
  const loai: { ten: string; vi: string }[] = [];
  const qua = ds.filter((g) => {
    const s = d.get(g.ten); if (!s) { loai.push({ ten: g.ten, vi: 'không được chấm' }); return false; }
    const truot = Object.entries(s.diem).filter(([, v]) => v <= 0).map(([kk]) => PHEP_THU_GAG.find((p) => p.ma === kk)?.ten ?? kk);
    if (truot.length) { loai.push({ ten: g.ten, vi: `trượt ${truot.join(', ')}${s.ly_do_loai ? ` — ${s.ly_do_loai}` : ''}` }); return false; }
    const t = m.get(g.ten); if (t && !t.hieu) { loai.push({ ten: g.ten, vi: `thử mù không hiểu: "${t.ke_lai}"` }); return false; }
    return true;
  }).sort((a, b) => tong(d, m, b) - tong(d, m, a));
  const coChe = new Set<string>(); const chon: TheGag[] = [];
  for (const g of qua) {
    const kc = chuanCoChe(g.co_che);
    if (coChe.has(kc)) { loai.push({ ten: g.ten, vi: `trùng cơ chế "${g.co_che}"` }); continue; }
    if (chon.length >= k) { loai.push({ ten: g.ten, vi: 'đạt nhưng thừa (điểm thấp hơn)' }); continue; }
    coChe.add(kc); chon.push(g);
  }
  chon.sort((a, b) => a.muc - b.muc || tong(d, m, a) - tong(d, m, b));
  return { chon, loai };
}
const tong = (d: Map<string, DiemGag>, m: Map<string, ThuMu>, g: TheGag) => (d.get(g.ten)?.tong ?? 0) + (m.get(g.ten)?.buon_cuoi ?? 0);

/** Thẻ gag → kịch bản dạng khối [GAG n] (tách cảnh mỗi khối đúng một shot). */
export const kichBanTuGag = (ds: TheGag[], mo: string): string =>
  `${mo.trim() ? `${mo.trim()}\n\n` : ''}${ds.map((g, i) => `[GAG ${i + 1}] ${g.ten}\nVấn đề: ${g.van_de}\nRa tay: ${g.ra_tay}\nĐẩy thêm: ${g.day_them}\nPhản ứng: ${g.phan_ung}\n(cơ chế: ${g.co_che} · vì sao ở đây: ${g.vi_sao_noi})`).join('\n\n')}`;

// ── Kết luận chấm — lưu xv_tap.cham_kich_ban, hiện dưới ô kịch bản ──────────────────────────────────────────────────────
export type ChamKb = {
  luc: string; cach: CachViet; dat: boolean; diem: number; /** 0–10 */ ket_luan: string;
  nguoi_viet: string; nguoi_cham: string; nguoi_thu?: string;
  muc: { ma: string; ten: string; diem: number; ly_do: string }[];
  /** chấm ngược: lý do loại / chỗ phèn tìm được TRƯỚC khi cho điểm */ nguoc: string[];
  may: string[]; /** máy kiểm (0đ) */
  gag?: { ung_vien: number; chon: string[]; loai: { ten: string; vi: string }[] };
  vong: number; /** số vòng viết (sửa theo lời chấm) */ vnd?: number;
};
export const NGUONG_DAT = 7;
/** Điểm 0–10 từ các mục 0–2 + kết luận một câu. */
export function ketLuan(muc: ChamKb['muc'], may: string[], nguoc: string[]): { diem: number; dat: boolean; ket_luan: string } {
  const diem = muc.length ? Math.round((muc.reduce((a, x) => a + x.diem, 0) / (muc.length * 2)) * 100) / 10 : 0;
  const truot = muc.filter((x) => x.diem <= 0);
  const dat = diem >= NGUONG_DAT && !truot.length && !may.length;
  const ket_luan = dat ? `ĐẠT ${diem}/10${nguoc.length ? ` — còn lưu ý: ${nguoc[0]}` : ''}`
    : `CHƯA ĐẠT ${diem}/10 — ${[truot.length ? `trượt ${truot.map((x) => x.ten).join(', ')}` : '', may.length ? `máy: ${may[0]}` : '', diem < NGUONG_DAT ? `dưới ngưỡng ${NGUONG_DAT}` : ''].filter(Boolean).join(' · ')}`;
  return { diem, dat, ket_luan };
}
