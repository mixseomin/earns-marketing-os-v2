// NHẬN CAMP ROAS TỪ TÊN — một luật cho mọi màn etp, CÙNG luật với máy luật apps/etp/cong.py (la_roas / _GOC_ID); đổi thì đổi cả hai.
//   nhà:  "★ … roas 1.1 duplicate by 69342"
//   team: "Dup by 68596 ROAS 1.1" (Kiên) · "…_D69655_ROAS1" · "…_V1_D2 (ROAS)" (Sơn)
// Anh 31/10/2026 "các camp roas của kiên ko thấy đánh dấu vàng": bản cũ chỉ nhận kiểu nhà.
const ROAS_TEAM = /(?:^|[\s_(])ROAS\d*(?=$|[\s_)])/;
export const laRoas = (ten: string | null | undefined) => {
  const t = ten ?? '';
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
