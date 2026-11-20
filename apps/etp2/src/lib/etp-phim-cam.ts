// NGUỒN CẤM PHIM (góp ý etp2 #1725, anh 20/11/2026: "Nếu bị cấm thì bấm vào phải show lý do chi tiết do cái gì: nguồn cấm, do điểm số hay do bên team Etho lọc cấm").
// Sổ xv_khoa_ngoai['ethopex_phim_cam'] chỉ có {luc, ly_do}: mỗi nơi ghi sổ (kiem-phim-18.py NudeNet / AI soát poster, Claude soát tờ, anh cấm, Ethopex báo vi phạm)
// để lại dấu riêng ở đầu câu lý do → đọc dấu đó ra NGUỒN + điểm số (nếu có). Một hàm duy nhất cho mọi chỗ hiện phim cấm (tab Phim, ngăn phim, ngăn dựng theo mẫu).
export type LoaiCam = 'etho' | 'anh' | 'diem' | 'ai' | 'claude' | 'poster' | 'khac';
export type NguonCam = {
  loai: LoaiCam;
  /** tên nguồn đọc cho anh */
  nguon: string;
  /** cách nguồn đó quyết định cấm */
  cach: string;
  /** điểm số máy soát (nhãn → điểm 0–1) — chỉ máy soát 18+ NudeNet có; AI / Claude / anh / Ethopex cấm theo nhận xét, không có điểm */
  diem: { nhan: string; diem: number }[];
  /** mô hình AI đã soát (AI soát poster) */
  mo_hinh: string | null;
  /** lý do đã bỏ dấu nguồn ở đầu câu */
  vi_sao: string;
};

const NHAN_NUDENET: Record<string, string> = {
  female_breast_exposed: 'ngực nữ hở', male_breast_exposed: 'ngực nam hở', female_genitalia_exposed: 'vùng kín nữ hở', male_genitalia_exposed: 'vùng kín nam hở',
  buttocks_exposed: 'mông hở', anus_exposed: 'hậu môn hở', armpits_exposed: 'nách hở', belly_exposed: 'bụng hở', feet_exposed: 'chân trần',
  female_breast_covered: 'ngực nữ che', buttocks_covered: 'mông che', female_genitalia_covered: 'vùng kín nữ che',
};

export function nguonCam(lyDo: string | null | undefined): NguonCam {
  const s = (lyDo ?? '').trim();
  const ra = (loai: LoaiCam, nguon: string, cach: string, vi_sao = s, diem: NguonCam['diem'] = [], mo_hinh: string | null = null): NguonCam => ({ loai, nguon, cach, diem, mo_hinh, vi_sao: vi_sao || 'sổ không ghi lý do' });
  if (/Ethopex báo/i.test(s)) return ra('etho', 'Ethopex / đội Etho báo vi phạm', 'Ethopex báo phim dính vi phạm chính sách, anh ra lệnh cấm theo báo đó');
  const nn = s.match(/^máy soát 18\+ \(NudeNet\):\s*(.*)$/i);
  if (nn) {
    const than = nn[1] ?? '';
    const diem = [...than.matchAll(/([a-z_]+)\s+(0?\.\d+|1(?:\.0+)?)/g)].map((m) => { const k = m[1] ?? ''; return { nhan: NHAN_NUDENET[k] ?? k.replace(/_/g, ' '), diem: Number(m[2]) }; });
    return ra('diem', 'Máy soát 18+ chấm điểm (NudeNet)', 'máy quét từng khung phim, khung nào vượt ngưỡng điểm khoả thân / gợi dục thì cấm cả phim', than, diem);
  }
  const ai = s.match(/^AI soát poster \(([^)]+)\):\s*(.*)$/i);
  if (ai) return ra('ai', 'AI soát poster tự động', 'máy gửi poster phim cho AI xem, AI kết luận có hình cấm (máu, vũ khí, gợi dục…) thì cấm phim — không có điểm số, cấm theo nhận xét của AI', ai[2] ?? '', [], (ai[1] ?? '').replace(/^[a-z]+:/i, ''));
  if (/Claude soát/i.test(s)) return ra('claude', 'Claude soát tay', 'Claude xem tờ khung / poster trong phiên làm việc rồi ghi cấm — không có điểm số, cấm theo nhận xét');
  if (/poster bị loại/i.test(s)) return ra('poster', 'Soát poster thủ công (đợt 23/10)', 'poster phim bị loại ở đợt soát tay 23/10 — sổ không ghi chi tiết hình nào');
  if (/\banh\b/i.test(s)) return ra('anh', 'Anh cấm trực tiếp', 'anh ra lệnh cấm phim này');
  return ra('khac', 'Ghi tay vào sổ', 'sổ chỉ ghi lý do, không có dấu nguồn');
}

/** máy chặn gì khi phim nằm trong sổ cấm (cùng cổng apps/etp/cong.py phim_cam) */
export const CAM_CHAN = 'Máy không mở camp mới, không nhân bản, không bật lại, không tăng, không lên creative cho phim này — kể cả ROAS và vé tay';
