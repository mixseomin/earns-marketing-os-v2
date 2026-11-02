// NHẬN CAMP ROAS — một luật cho mọi màn etp, CÙNG luật với máy luật apps/etp/cong.py (la_roas / _GOC_ID) + cột etp.*.la_roas (0401); đổi thì đổi cả ba.
// CHIẾN LƯỢC THẦU THẬT trước (anh 02/11/2026 "camp của Kiên nhiều cái ko set tên"): chien_luoc = LOWEST_COST_WITH_MIN_ROAS; chưa có chiến lược mới đọc tên:
//   nhà:  "★ … roas 1.1 duplicate by 69342"
//   team: "Dup by 68596 ROAS 1.1" (Kiên) · "…_D69655_ROAS1" · "…_V1_D2 (ROAS)" (Sơn)
// Anh 31/10/2026 "các camp roas của kiên ko thấy đánh dấu vàng": bản cũ chỉ nhận kiểu nhà.
const ROAS_TEAM = /(?:^|[\s_(])ROAS[\d.]*(?=$|[\s_)])/;   // [\d.]: "ROAS1.2_S_…" (Sơn) — bản \d* cũ bỏ sót
export const laRoas = (x: string | null | undefined | { ten?: string | null; chien_luoc?: string | null }) => {
  if (x && typeof x === 'object') {
    if (x.chien_luoc) return x.chien_luoc === 'LOWEST_COST_WITH_MIN_ROAS';
    x = x.ten;
  }
  const t = x ?? '';
  return t.includes(' duplicate by ') || t.trimStart().startsWith('★') || ROAS_TEAM.test(t);
};
/** mức ROAS ghi trong tên ("roas 1.1" / "ROAS 1.1"); "_ROAS1" là số thứ tự bản của team, không phải mức → null */
export const mucRoas = (ten: string | null | undefined): number | null => {
  const m = (ten ?? '').match(/\broas\s+(\d+(?:\.\d+)?)\b/i);
  return m ? Number(m[1]) : null;
};
/** camp gốc ghi trong tên ("duplicate by <id>" · "Dup by <id>" · "_D<id>"); tên chỉ có "(ROAS)" thì không có → null */
export const gocRoas = (ten: string | null | undefined): number | null => {
  const m = (ten ?? '').match(/(?:duplicate by|dup by|_D)\s*(\d{5,})/i);
  return m ? Number(m[1]) : null;
};
