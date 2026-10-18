// KHUÔN CHUỖI SHOT (anh 18/10/2026: "trong cùng một film áp dụng nhiều kiểu khuôn để phục vụ mục đích của đạo diễn và kịch bản · mỗi dòng film
// có quy chuẩn / kiến thức ngành riêng — tổng hợp lại và áp dụng · trên timeline phải show rõ từng khuôn đang áp thế nào ở từng cảnh quay").
// Tầng GIỮA giữa luật một shot (luat-dung.ts, dien-anh.ts › vai) và khuôn cả phim (mau/templates.json): một đoạn 2–6 shot làm MỘT nhiệm vụ kể
// (lộ âm mưu, làm nhục, vả mặt, kết treo…). Mỗi bước nói shot đó phải đóng VAI nào (ky_thuat.vai) và thực hiện luật nào (ky_thuat.luat).
// Một tập áp nhiều khuôn (xv_tap.khuon_chuoi): mỗi lần áp gán từng shot vào một bước; kiemKhuon so vai thật của shot với bước → timeline tô
// xanh / vàng / đỏ. Thuần dữ liệu + hàm thuần — client lẫn server import được; có test (khuon-chuoi.test.mts).
import type { TheLoai, KyThuatShot } from './dien-anh';

/** vai = các vai kể (dien-anh.ts › nhóm 'vai') chấp nhận cho bước · luat = luật dựng nên có · lap = được nhiều shot liền · tuy = bước tuỳ chọn ·
 *  nen = không bắt buộc nhưng thiếu thì cảnh báo (cái "sướng" của khuôn nằm ở đó). */
/** may = chuyển động máy gợi ý cho bước (dien-anh.ts › nhóm chuyen_dong) — vd "Lộ kẻ đứng sau" = chuyển chủ thể (cú máy HBO A → B). */
export type BuocKhuon = { ten: string; vai: string[]; luat?: string[]; may?: string[]; lap?: boolean; tuy?: boolean; nen?: boolean; ghi: string };
export type NguonKhuon = { phim: string; ghi: string };
export type KhuonChuoi = { key: string; ten: string; muc_dich: string; the_loai: TheLoai[] | 'tat_ca'; buoc: BuocKhuon[]; ket?: string; nguon: NguonKhuon[] };
/** Một lần áp khuôn trong tập: shot (id xv_canh) → chỉ số bước, hoặc MẢNG bước khi một shot gánh nhiều nhịp (timeline chia ô, gợi ý tách shot).
 *  ghi = vì sao áp (đạo diễn / kịch bản muốn gì ở đoạn này). */
export type ApKhuon = { khuon: string; shots: Record<string, number | number[]>; ghi?: string };
export const buocCua = (v: number | number[] | undefined): number[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

const DRAMA: TheLoai[] = ['phim_doc', 'chinh_kich', 'tinh_cam', 'kinh_di', 'hanh_dong', 'vien_tuong'];
const QC: TheLoai[] = ['qc_ugc', 'qc_cao_cap'];

export const KHUON_CHUOI: KhuonChuoi[] = [
  {
    key: 'thiet_lap_khong_gian', ten: 'Thiết lập không gian', muc_dich: 'Cho khán giả biết đang ở đâu, lúc nào, ai đứng chỗ nào — trước khi chuyện xảy ra.', the_loai: 'tat_ca',
    buoc: [
      { ten: 'Toàn cảnh nơi chốn', vai: ['thiet_lap', 'thoi_gian'], luat: ['dan_khong_gian', 'dan_thoi_gian'], may: ['drone_len', 'cau_xuong', 'lia'], ghi: 'rộng nhất: nơi + giờ trong ngày qua ánh sáng' },
      { ten: 'Master', vai: ['tong_the'], luat: ['du_diem_nhin'], tuy: true, ghi: 'mọi nhân vật trong một khung, thấy khoảng cách giữa họ' },
      { ten: 'Vào người', vai: ['hanh_dong', 'phan_ung'], lap: true, ghi: 'hẹp dần vào người làm việc chính' },
    ],
    nguon: [{ phim: 'Ngữ pháp dựng cổ điển (establishing → master → coverage)', ghi: 'luat-dung.ts › dan_khong_gian' }],
  },
  {
    key: 'lo_am_muu', ten: 'Lộ âm mưu (chênh lệch thông tin)', muc_dich: 'Cho khán giả biết điều nhân vật chính chưa biết — hồi hộp đến từ khoảng chênh, không từ hành động.', the_loai: DRAMA,
    buoc: [
      { ten: 'Nhân chứng nhìn', vai: ['phan_ung', 'chu_quan'], luat: ['nhan_qua_huong_nhin'], ghi: 'ai đó nhìn ra xa — mọi thứ sau được xem qua mắt một nhân chứng' },
      { ten: 'Sự kiện', vai: ['hanh_dong', 'tong_the', 'chu_quan', 'thiet_lap'], ghi: 'thứ nhân chứng thấy (khớp hướng nhìn)' },
      { ten: 'Lộ kẻ đứng sau', vai: ['nguoi_thu_ba', 'hanh_dong'], luat: ['may_co_dong_co', 'chenh_thong_tin'], may: ['chuyen_chu_the', 'vuot_tien_canh', 'doi_net'], ghi: 'máy theo sự kiện rồi trượt sang kẻ chờ sẵn — lộ ra như tình cờ, không giới thiệu' },
      { ten: 'Kẻ đó hành động', vai: ['hanh_dong', 'nguoi_thu_ba'], ghi: 'nhân quả đặt sát nhau → khán giả tự suy ra động cơ' },
      { ten: 'Chấm câu', vai: ['tam_trang', 'chi_tiet', 'phan_ung'], luat: ['khoang_lang'], nen: true, ghi: 'khoảng lặng / màn đen để nỗi lo ngấm trước cảnh mới' },
    ],
    ket: 'mờ ra đen (fade to black)',
    nguon: [{ phim: 'Phim HBO anh kể 18/10/2026', ghi: 'người bị thương nhìn → xe cấp cứu rời trung tâm → máy trượt sang người của trung tâm chờ sẵn → hắn bám theo → màn đen' },
      { phim: 'Hitchcock / Truffaut (1966)', ghi: 'quả bom dưới gầm bàn: khán giả biết, nhân vật không — đó là hồi hộp' }],
  },
  {
    key: 'lam_nhuc', ten: 'Làm nhục (đè nén)', muc_dich: 'Dồn nhân vật chính xuống đáy trước công chúng — nạp cảm xúc để cú vả mặt sau đó "sướng".', the_loai: ['phim_doc', 'chinh_kich', 'tinh_cam'],
    buoc: [
      { ten: 'Kẻ ác gây sự', vai: ['thiet_lap', 'tong_the', 'hanh_dong'], ghi: 'hành động xúc phạm rõ ràng, thấy cả không gian công cộng' },
      { ten: 'Chi tiết nỗi nhục', vai: ['chi_tiet'], luat: ['thay_tung_buoc'], tuy: true, ghi: 'cận dấu vết: vết cà phê, tấm thẻ bị giật, tay siết lại' },
      { ten: 'Người khác chứng kiến', vai: ['nguoi_thu_ba', 'hanh_dong', 'tong_the'], lap: true, ghi: 'đám đông xì xào / người có quyền thờ ơ — nhục vì có người xem' },
      { ten: 'Phản ứng nén', vai: ['phan_ung'], luat: ['giu_phan_ung', 'thay_mat_phan_ung'], ghi: 'nhân vật chính KHÔNG bùng nổ — nén lại (khán giả nén theo)' },
      { ten: 'Chấm đáy', vai: ['tong_the', 'tam_trang', 'hanh_dong'], tuy: true, ghi: 'khung rộng / khung lặng chốt điểm thấp nhất' },
    ],
    nguon: [{ phim: 'Micro-drama tổng tài (ReelShort, DramaBox…)', ghi: 'mô-típ 打脸 "vả mặt": đè nén trước, lật thế sau; càng nhục trước công chúng thì lật càng sướng' }],
  },
  {
    key: 'ra_mat_quyen_luc', ten: 'Ra mắt người quyền lực', muc_dich: 'Một nhân vật bước vào là cả phòng đổi thái độ — quyền lực đo bằng phản ứng của người khác.', the_loai: DRAMA,
    buoc: [
      { ten: 'Bước vào', vai: ['thiet_lap', 'hanh_dong', 'tong_the'], luat: ['gioi_thieu'], may: ['dan_truoc', 'nghieng_len', 'nang_ha'], ghi: 'góc thấp, cả phòng im — người đó chiếm khung' },
      { ten: 'Người khác đổi thái độ', vai: ['chu_quan', 'nguoi_thu_ba', 'phan_ung', 'hanh_dong'], lap: true, ghi: 'kẻ ác đổi giọng ngọt, đám đông cúi đầu' },
      { ten: 'Ánh mắt phán xét', vai: ['phan_ung'], luat: ['giu_phan_ung'], ghi: 'cận mặt người quyền lực: một cái nhìn là đủ quyết định' },
    ],
    nguon: [{ phim: 'The Devil Wears Prada (2006)', ghi: 'Miranda bước ra thang máy: cả toà soạn chạy tán loạn trước khi bà nói một chữ' }],
  },
  {
    key: 'gai_bi_mat', ten: 'Gài bí mật cho khán giả', muc_dich: 'Lộ cho khán giả một chi tiết nhân vật khác không thấy — để trả ở cảnh sau.', the_loai: 'tat_ca',
    buoc: [
      { ten: 'Chi tiết gài', vai: ['chi_tiet'], luat: ['motif', 'tu_ke_du'], ghi: 'vật nhỏ, lộ một nhịp rồi khuất (chuỗi hạt dưới tay áo)' },
      { ten: 'Dấu hiệu ngầm', vai: ['chi_tiet', 'phan_ung'], luat: ['chenh_thong_tin'], lap: true, ghi: 'nhân vật chính có lá bài tẩy — khán giả biết, kẻ ác không' },
    ],
    nguon: [{ phim: 'Gài – trả (Chekhov\'s gun)', ghi: 'luat-dung.ts › tu_ke_du, motif' }],
  },
  {
    key: 'va_mat', ten: 'Vả mặt (lật thế)', muc_dich: 'Nhân vật bị coi thường lộ thân phận thật trước đúng những người đã chà đạp mình.', the_loai: ['phim_doc', 'chinh_kich', 'hanh_dong'],
    buoc: [
      { ten: 'Kẻ ác đắc ý', vai: ['thiet_lap', 'tong_the', 'hanh_dong'], ghi: 'đỉnh tự mãn ngay trước cú lật' },
      { ten: 'Chính diện xuất hiện', vai: ['hanh_dong', 'thiet_lap'], luat: ['gioi_thieu'], may: ['dan_truoc', 'vuot_tien_canh', 'nghieng_len'], ghi: 'góc thấp, trang phục khác hẳn — đổi vị thế bằng hình' },
      { ten: 'Lộ thân phận', vai: ['nguoi_thu_ba', 'hanh_dong', 'tong_the'], luat: ['gia_tri_doi'], ghi: 'người thứ ba xác nhận (luật sư, chủ tịch) — khán giả được thấy trước kẻ ác' },
      { ten: 'Chi tiết sụp đổ', vai: ['chi_tiet'], tuy: true, ghi: 'vật rơi / vỡ thay cho câu nói' },
      { ten: 'Đòn quyết định', vai: ['hanh_dong'], ghi: 'câu tuyên bố / hành động chốt hạ, từng chữ' },
      { ten: 'Mặt kẻ thua', vai: ['phan_ung'], luat: ['giu_phan_ung', 'thay_mat_phan_ung'], nen: true, ghi: 'GIỮ trên mặt kẻ ác — đây là phần khán giả chờ cả tập' },
    ],
    nguon: [{ phim: 'Micro-drama tổng tài (ReelShort, DramaBox…)', ghi: 'mô-típ 打脸: lật thế phải kết bằng phản ứng của kẻ thua, không kết bằng lời của người thắng' }],
  },
  {
    key: 'doi_thoai_cang', ten: 'Đối thoại căng (shot / ngược shot)', muc_dich: 'Hai người đấu khẩu — khung siết dần theo độ căng.', the_loai: 'tat_ca',
    buoc: [
      { ten: 'Hai người một khung', vai: ['tong_the'], luat: ['truc_180'], ghi: 'đặt trục, ai đứng bên nào' },
      { ten: 'Qua vai qua lại', vai: ['nguoi_thu_ba', 'phan_ung', 'hanh_dong', 'chu_quan'], luat: ['doi_mat'], lap: true, ghi: 'cùng trục, khớp hướng nhìn' },
      { ten: 'Cận khi đỉnh căng', vai: ['phan_ung'], luat: ['luat_30'], ghi: 'nhảy ≥ 2 cỡ cảnh vào mặt khi câu then chốt' },
    ],
    nguon: [{ phim: 'Shot / reverse shot', ghi: 'luat-dung.ts › doi_mat, truc_180' }],
  },
  {
    key: 'phat_hien', ten: 'Phát hiện', muc_dich: 'Nhân vật nhận ra điều gì — khán giả nhận ra cùng lúc.', the_loai: 'tat_ca',
    buoc: [
      { ten: 'Mặt bình thường', vai: ['phan_ung', 'hanh_dong'], ghi: 'chưa biết gì' },
      { ten: 'Vật / điều lạ', vai: ['chu_quan', 'chi_tiet'], luat: ['nhan_qua_huong_nhin'], ghi: 'đúng thứ nó thấy' },
      { ten: 'Mặt đổi sắc', vai: ['phan_ung'], luat: ['giu_phan_ung'], ghi: 'phản ứng giữ đủ lâu để đọc' },
    ],
    nguon: [{ phim: 'Hiệu ứng Kuleshov', ghi: 'mặt + vật nó nhìn = cảm xúc không shot nào có riêng' }],
  },
  {
    key: 'ket_treo', ten: 'Kết treo (cliffhanger)', muc_dich: 'Đóng tập bằng một câu hỏi mới — người xem phải bấm tập sau.', the_loai: ['phim_doc', 'chinh_kich', 'kinh_di', 'hanh_dong', 'vien_tuong', 'tinh_cam'],
    buoc: [
      { ten: 'Cú lật', vai: ['hanh_dong', 'tong_the', 'phan_ung'], luat: ['gia_tri_doi'], lap: true, ghi: 'thế cờ vừa đổi' },
      { ten: 'Giữ phản ứng', vai: ['phan_ung'], luat: ['giu_phan_ung', 'khoang_lang'], ghi: 'im lặng, giữ mặt — để cú lật ngấm' },
      { ten: 'Câu hỏi mới', vai: ['chi_tiet', 'nguoi_thu_ba'], luat: ['chenh_thong_tin', 'motif'], ghi: 'một chi tiết mở bí ẩn mới (trả motif đã gài)' },
    ],
    ket: 'cắt đen',
    nguon: [{ phim: 'Micro-drama tổng tài', ghi: 'mỗi tập 1–2 phút kết bằng hook cho tập sau (THE_LOAI phim_doc)' }],
  },
  {
    key: 'truoc_sau', ten: 'Trước / Sau (QC)', muc_dich: 'Vấn đề → sản phẩm → kết quả, đọc được khi tắt tiếng.', the_loai: QC,
    buoc: [
      { ten: 'Vấn đề', vai: ['hanh_dong', 'chi_tiet', 'thiet_lap'], ghi: 'nỗi đau nhìn thấy được trong 3 giây đầu' },
      { ten: 'Khó chịu', vai: ['phan_ung'], tuy: true, ghi: 'mặt người chịu vấn đề' },
      { ten: 'Sản phẩm', vai: ['chi_tiet', 'hanh_dong'], ghi: 'sản phẩm vào khung rõ, đúng màu' },
      { ten: 'Giải quyết', vai: ['hanh_dong'], ghi: 'dùng sản phẩm' },
      { ten: 'Kết quả', vai: ['tong_the', 'phan_ung', 'hanh_dong'], ghi: 'sau — cùng góc với trước để so' },
    ],
    nguon: [{ phim: 'mau/templates.json', ghi: 'khuôn QC "Trước / Sau"' }],
  },
  {
    key: 'loi_chung', ten: 'Lời chứng (UGC)', muc_dich: 'Người thật nói thẳng camera, xen hình minh hoạ.', the_loai: QC,
    buoc: [
      { ten: 'Nói vào máy', vai: ['hanh_dong', 'chu_quan'], ghi: 'móc câu bằng câu nói đầu' },
      { ten: 'Hình minh hoạ', vai: ['chi_tiet', 'hanh_dong'], lap: true, ghi: 'b-roll đúng điều đang nói' },
      { ten: 'Quay lại người nói', vai: ['hanh_dong', 'phan_ung'], ghi: 'chốt + CTA' },
    ],
    nguon: [{ phim: 'mau/templates.json', ghi: 'khuôn QC người thật' }],
  },
];

/** Quy chuẩn NGÀNH theo dòng phim — kinh nghiệm gom lại để áp. Khuôn hay dùng + luật nhịp riêng của dòng. */
export const QUY_CHUAN_DONG: Partial<Record<TheLoai, { khuon: string[]; luat: string[] }>> = {
  phim_doc: { khuon: ['lam_nhuc', 'ra_mat_quyen_luc', 'gai_bi_mat', 'va_mat', 'doi_thoai_cang', 'ket_treo'],
    luat: ['3 giây đầu là móc câu (xung đột thấy ngay)', 'mỗi 15–30 giây một nút thắt', 'đè nén trước, vả mặt sau — vả mặt kết bằng mặt kẻ thua', 'cắt theo câu thoại, cận mặt nhiều', 'cuối tập là kết treo + cắt đen'] },
  chinh_kich: { khuon: ['thiet_lap_khong_gian', 'doi_thoai_cang', 'phat_hien', 'lo_am_muu', 'ket_treo'], luat: ['máy chậm, khoảng lặng dài', 'chênh lệch thông tin thay cho lời giải thích', 'chuyển cảnh lớn bằng màn đen'] },
  kinh_di: { khuon: ['thiet_lap_khong_gian', 'lo_am_muu', 'phat_hien', 'ket_treo'], luat: ['im lặng trước cú doạ', 'khán giả thấy mối nguy trước nhân vật', 'không lộ toàn bộ con quái trước hồi 3'] },
  hoat_hinh: { khuon: ['thiet_lap_khong_gian', 'phat_hien'], luat: ['ít cắt, nhịp chậm, cảm xúc rõ trên mặt', 'mỗi gag đọc được khi tắt tiếng', 'ít mỉa mai kịch tính'] },
  qc_ugc: { khuon: ['loi_chung', 'truoc_sau'], luat: ['móc câu trong 3 giây', 'shot 1–3 giây', 'không màn đen (mất người lướt)', 'sản phẩm lộ trước giây 5'] },
  qc_cao_cap: { khuon: ['truoc_sau', 'thiet_lap_khong_gian'], luat: ['sản phẩm hoàn hảo, macro', 'chuyển động mượt, ít cắt thô', 'logo / CTA cuối'] },
};

export const khuonTheoKey = (k: string) => KHUON_CHUOI.find((x) => x.key === k);
export const hopTheLoai = (kh: KhuonChuoi, tl?: TheLoai | '') => !tl || kh.the_loai === 'tat_ca' || kh.the_loai.includes(tl);

export type ShotKhuon = { id: number; thu_tu: number; ky_thuat?: KyThuatShot | null };
export type MucKiem = 'tot' | 'vang' | 'do';
/** goiY = luật dựng bước này nên có mà shot chưa gắn mã — chỉ GỢI Ý (không đổi màu): nhiều shot cũ chưa ghi ky_thuat.luat, tô vàng vì thế thì che mất lỗ thật. */
export type KetShot = { id: number; buoc: number; tenBuoc: string; muc: MucKiem; loi: string[]; goiY: string[]; /** mọi bước shot này gánh (≥ 2 = nên tách shot) */ buocs: number[] };
/** Bước THIẾU và chỗ nó nên đứng: ngay sau shot `sau` (null = trước shot đầu của khuôn). */
export type BuocThieu = { buoc: number; ten: string; ghi: string; muc: MucKiem; sau: number | null };
export type KetAp = { ap: ApKhuon; kh: KhuonChuoi; shots: KetShot[]; loi: string[]; muc: MucKiem; thieu: BuocThieu[] };

const nang = (a: MucKiem, b: MucKiem): MucKiem => (a === 'do' || b === 'do' ? 'do' : a === 'vang' || b === 'vang' ? 'vang' : 'tot');

/** So MỘT lần áp khuôn với shot thật: vai của shot có đúng bước không, bước bắt buộc có đủ không, thứ tự bước có lùi không, khuôn có hợp dòng phim. */
export function kiemKhuon(ap: ApKhuon, canh: ShotKhuon[], theLoai?: TheLoai | ''): KetAp | null {
  const kh = khuonTheoKey(ap.khuon);
  if (!kh) return null;
  const ds = canh.filter((c) => buocCua(ap.shots[String(c.id)]).length).sort((a, b) => a.thu_tu - b.thu_tu);
  const shots: KetShot[] = [];
  let truoc = -1;
  const dem = new Map<number, number>();
  for (const c of ds) {
    const bs = buocCua(ap.shots[String(c.id)]);
    const loi: string[] = []; const goiY: string[] = []; let muc: MucKiem = 'tot';
    for (const i of bs) {
      const b = kh.buoc[i];
      if (!b) { loi.push(`bước ${i + 1} không có trong khuôn`); muc = 'do'; continue; }
      const vai = c.ky_thuat?.vai;
      // Shot gánh nhiều bước: vai chỉ khớp được MỘT bước — các bước còn lại là dấu hiệu phải tách, không phải sai vai.
      if (bs.length === 1) {
        if (!vai) { loi.push(`shot chưa ghi vai kể — bước cần ${b.vai.join(' / ')}`); muc = nang(muc, 'vang'); }
        else if (!b.vai.includes(vai)) { loi.push(`shot đang đóng vai "${vai}", bước "${b.ten}" cần ${b.vai.join(' / ')}`); muc = 'do'; }
        const thieuLuat = (b.luat ?? []).filter((l) => !(c.ky_thuat?.luat ?? []).includes(l));
        if (b.luat?.length && thieuLuat.length === b.luat.length) goiY.push(`luật dựng nên có: ${b.luat.join(' / ')}`);
      }
      if (i < truoc) { loi.push(`lùi về bước "${b.ten}" sau bước "${kh.buoc[truoc]!.ten}"`); muc = 'do'; }
      dem.set(i, (dem.get(i) ?? 0) + 1);
      if (!b.lap && (dem.get(i) ?? 0) > 1) { loi.push(`bước "${b.ten}" chỉ nên một shot`); muc = nang(muc, 'vang'); }
      truoc = Math.max(truoc, i);
    }
    if (bs.length > 1) { loi.push(`một shot gánh ${bs.length} bước (${bs.map((i) => kh.buoc[i]?.ten ?? i + 1).join(' → ')}) — nên tách thành ${bs.length} shot để mỗi nhịp có khung riêng`); muc = nang(muc, 'vang'); }
    shots.push({ id: c.id, buoc: bs[0]!, tenBuoc: bs.map((i) => kh.buoc[i]?.ten ?? `bước ${i + 1}?`).join(' + '), muc, loi, goiY, buocs: bs });
  }
  const loi: string[] = []; let muc: MucKiem = shots.reduce<MucKiem>((a, s) => nang(a, s.muc), 'tot');
  const thieu: BuocThieu[] = [];
  kh.buoc.forEach((b, i) => {
    if (dem.has(i) || b.tuy) return;
    const m: MucKiem = b.nen ? 'vang' : 'do';
    loi.push(b.nen ? `thiếu "${b.ten}" — ${b.ghi}` : `thiếu bước bắt buộc "${b.ten}"`); muc = nang(muc, m);
    // Chỗ đứng: sau shot cuối cùng còn ở bước NHỎ hơn bước thiếu (thứ tự khuôn); không có thì đứng trước shot đầu.
    const sau = [...shots].reverse().find((x) => Math.max(...x.buocs) < i);
    thieu.push({ buoc: i, ten: b.ten, ghi: b.ghi, muc: m, sau: sau ? sau.id : null });
  });
  if (!hopTheLoai(kh, theLoai)) { loi.push(`khuôn này không thuộc dòng phim hiện tại`); muc = nang(muc, 'vang'); }
  return { ap, kh, shots, loi, muc, thieu };
}

/** Xếp các lần áp vào hàng (lane) không chồng nhau theo khoảng shot — khuôn trải rộng (gài motif ở cảnh 2, trả ở cảnh 5) sang hàng riêng. */
export function xepHang(ket: KetAp[], thuTu: Map<number, number>): KetAp[][] {
  const hang: { ds: KetAp[]; khoang: [number, number][] }[] = [];
  const khoang = (k: KetAp): [number, number] => { const t = k.shots.map((s) => thuTu.get(s.id) ?? 0); return [Math.min(...t), Math.max(...t)]; };
  for (const k of [...ket].sort((a, b) => khoang(a)[0] - khoang(b)[0])) {
    const [a, b] = khoang(k);
    const h = hang.find((x) => x.khoang.every(([u, v]) => b < u || a > v));
    if (h) { h.ds.push(k); h.khoang.push([a, b]); } else hang.push({ ds: [k], khoang: [[a, b]] });
  }
  return hang.map((h) => h.ds);
}

/** Khối lời dặn cho bước TÁCH SHOT (claude.ts › heThong): khuôn hợp dòng phim + từng bước cần vai nào, quy chuẩn ngành — Claude ghi mỗi shot
 *  `khuon` + `buoc_khuon`, máy chủ gom lại thành xv_tap.khuon_chuoi (khuonTuShot). */
export function vanKhuonChuoi(theLoai?: TheLoai | ''): string {
  const ds = KHUON_CHUOI.filter((k) => hopTheLoai(k, theLoai));
  const qc = theLoai ? QUY_CHUAN_DONG[theLoai] : undefined;
  return `KHUÔN CHUỖI SHOT (dẫn dắt kiểu phim HBO: mỗi đoạn 2–6 shot làm MỘT nhiệm vụ kể, khán giả luôn biết đang ở đâu, vì sao cắt, ai biết gì). Mỗi phân cảnh chọn 1–2 khuôn hợp mục đích của nó; mỗi shot ghi \`khuon\` = mã khuôn đoạn đó thực hiện và \`buoc_khuon\` = số bước (1, 2, …) — VAI KỂ của shot (ky_thuat.vai) phải đúng vai bước cần, đi đúng thứ tự bước, không bỏ bước bắt buộc. Một shot chỉ một bước: nhịp nào cần khung riêng thì tách shot. Shot nối không thuộc khuôn nào thì để khuon rỗng.
${ds.map((k) => `- ${k.key} — ${k.ten}: ${k.muc_dich} Bước: ${k.buoc.map((b, i) => `${i + 1}. ${b.ten} (${b.vai.join('/')}${b.may?.length ? `; máy: ${b.may.join('/')}` : ''}${b.tuy ? ', tuỳ chọn' : b.nen ? ', nên có' : ''})`).join(' → ')}${k.ket ? `. Kết: ${k.ket}` : ''}`).join('\n')}${qc ? `\nQUY CHUẨN DÒNG PHIM: ${qc.luat.join(' · ')}` : ''}`;
}

/** Gom khuôn Claude ghi trên từng shot (đã lưu, có id) thành các lần áp: shot liền nhau cùng phân cảnh + cùng mã khuôn = một lần áp. */
export function khuonTuShot(shots: { id: number; phan_doan: string; khuon?: string; buoc_khuon?: number }[]): ApKhuon[] {
  const out: ApKhuon[] = [];
  let cur: (ApKhuon & { pd: string; cuoi: number }) | null = null;
  for (const s of shots) {
    const kh = s.khuon ? khuonTheoKey(s.khuon) : undefined;
    const b = Math.round(Number(s.buoc_khuon ?? 0)) - 1;
    if (!kh || b < 0 || b >= kh.buoc.length) { cur = null; continue; }
    // Cùng khuôn + cùng cảnh nhưng bước quay về đầu (bước mới < bước cuối, bước không lặp được) = lần áp MỚI (đè nén lần 2…).
    const moi = !cur || cur.khuon !== kh.key || cur.pd !== s.phan_doan || (b < cur.cuoi) || (b === cur.cuoi && !kh.buoc[b]!.lap);
    if (moi) { cur = { khuon: kh.key, shots: {}, pd: s.phan_doan, cuoi: b }; out.push(cur); }
    cur!.shots[String(s.id)] = b; cur!.cuoi = b;
  }
  return out.map(({ khuon, shots: sh }) => ({ khuon, shots: sh }));
}
