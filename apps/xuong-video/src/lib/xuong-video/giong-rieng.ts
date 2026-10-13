// GIỌNG RIÊNG cho nhân vật chưa chọn giọng (13/10/2026 — Fox Tales: Felix đọc "Ahem" bằng George = giọng người dẫn; 23/24 nhân vật trong xưởng
// chưa chọn giọng nên tất cả rơi về cùng một giọng mặc định). Máy gán một giọng KHÔNG trùng người dẫn / nhân vật khác của phim, đoán giới
// tính theo mô tả nếu có, rồi LƯU vào nhân vật — các tập sau giữ nguyên giọng đó; anh đổi ở mục 2 › Chọn giọng. Thuần, tự kiểm giong-rieng.test.mts.

/** Giới tính giọng có sẵn của ElevenLabs (bộ premade); giọng ngoài danh sách coi là không rõ. */
const NAM = ['Roger', 'Charlie', 'Callum', 'Liam', 'Will', 'Eric', 'Chris', 'Brian', 'Daniel', 'Bill', 'George'];
const NU = ['Aria', 'Sarah', 'Laura', 'Charlotte', 'Alice', 'Matilda', 'Jessica', 'Lily'];
const RE_NU = /\b(she|her|woman|women|girl|lady|queen|mother|mom|grandma|grandmother|wife|female|princess|hen|aunt|sister|madam)\b|\b(bà|cô|chị|mẹ|nữ)\b/i;
const RE_NAM = /\b(he|his|him|man|men|boy|king|father|dad|grandpa|grandfather|husband|male|prince|sir|guy|uncle|brother)\b|\b(ông|chú|bố|nam)\b/i;

export type GioiGiong = 'nam' | 'nu' | '';
export const gioiTheoMoTa = (moTa: string): GioiGiong => (RE_NU.test(moTa) ? 'nu' : RE_NAM.test(moTa) ? 'nam' : '');

/** Chọn giọng cho một nhân vật: ưu tiên giọng đúng giới, chưa ai dùng; chọn ổn định theo id (cùng đầu vào → cùng giọng). */
export function chonGiongRieng(nv: { id: number; mo_ta: string }, dsGiong: string[], daDung: Iterable<string>): string {
  const dung = new Set(daDung);
  const con = dsGiong.filter((g) => !dung.has(g));
  const gioi = gioiTheoMoTa(nv.mo_ta);
  const hop = con.filter((g) => (gioi === 'nam' ? NAM.includes(g) : gioi === 'nu' ? NU.includes(g) : true));
  const ds = hop.length ? hop : con.length ? con : dsGiong;
  return ds.length ? ds[nv.id % ds.length]! : '';
}
