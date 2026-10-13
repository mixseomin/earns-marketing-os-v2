// BẢN LỒNG TIẾNG (13/10/2026 — "làm track tiếng Việt là mặc định, rồi dùng nó làm review luôn"): hình + nhịp shot giữ nguyên, chữ màn dịch,
// mọi câu nói đọc lại bằng tiếng đích với ĐÚNG giọng người nói của bản gốc. Một bản dùng cho hai việc: người chỉ biết tiếng Việt xem hộ
// (chấm câu chuyện có rõ không), và track tiếng phụ gắn vào cùng video trên YouTube (đa ngôn ngữ, lượt xem dồn về một video).
// Thuần: chuỗi cần dịch + giọng của từng dòng + áp bản dịch. Phần máy chủ (dịch, đọc, xuất, ghi) ở long-tieng.ts. Tự kiểm: ban-dich.test.mts
import type { Canh, DongThoai, KinhThanh, NhanVat } from './kieu';
import { timNv } from './am-thanh';

/** Một dòng chữ màn = mốc "@1.2 " (tuỳ) + chữ; chỉ dịch phần chữ, giữ nguyên mốc. */
const MOC = /^(\s*@\d+(?:[.,]\d+)?s?\s+)?(.*)$/;
const tachDong = (chu: string) => chu.split('\n').map((d) => { const m = MOC.exec(d)!; return { moc: m[1] ?? '', chu: m[2] ?? '' }; });

type ShotDich = Pick<Canh, 'id' | 'chu_man' | 'thoai'>;
export function chuoiCanDich(canh: ShotDich[]): string[] {
  const s = new Set<string>();
  for (const c of canh) {
    for (const d of tachDong(c.chu_man ?? '')) if (d.chu.trim()) s.add(d.chu.trim());
    for (const d of c.thoai ?? []) if (d.loi.trim()) s.add(d.loi.trim());
  }
  return [...s];
}

/** Giọng đọc bản dịch của một dòng = giọng đã đọc bản gốc (d.giong "model|voice") → giọng riêng của nhân vật → giọng lời dẫn của phim.
 *  null = chưa biết giọng nào (dòng chưa từng đọc, nhân vật chưa có giọng) — máy chủ rơi về giọng mặc định. */
export function giongDong(d: Pick<DongThoai, 'nhan_vat' | 'giong'>, nv: Pick<NhanVat, 'ten' | 'giong_model' | 'giong_id'>[], kt: Pick<KinhThanh, 'giong_dan'>): { model: string; voice: string } | null {
  const [model, voice] = (d.giong ?? '').split('|');
  if (model && voice) return { model, voice };
  const v = d.nhan_vat.trim() ? timNv(nv, d.nhan_vat) : undefined;
  if (v) return v.giong_model && v.giong_id ? { model: v.giong_model, voice: v.giong_id } : null;
  return kt.giong_dan ?? null;
}

/** Áp bản dịch: chữ màn tiếng đích (giữ mốc giây); mỗi dòng thoại mang câu dịch + file giọng dịch (giongDich: chỉ số shot → dòng → url).
 *  Dòng có chữ mà không có file dịch thì im (KHÔNG phát giọng gốc lẫn vào bản dịch). Câu chưa dịch được giữ nguyên chữ. */
export function apDich<T extends ShotDich>(canh: T[], dich: Map<string, string>, giongDich: Map<string, string> = new Map()): T[] {
  return canh.map((c) => {
    const chu = tachDong(c.chu_man ?? '').map((d) => (d.chu.trim() ? `${d.moc}${dich.get(d.chu.trim()) ?? d.chu}` : `${d.moc}${d.chu}`)).join('\n');
    const thoai = (c.thoai ?? []).map((d, i) => {
      if (!d.loi.trim()) return d;
      const { dai: _d, ...con } = d;
      return { ...con, loi: dich.get(d.loi.trim()) ?? d.loi, url: giongDich.get(`${c.id}:${i}`) ?? null, gon: true };
    });
    return { ...c, chu_man: (c.chu_man ?? '') ? chu : '', thoai, thoai_url: thoai.find((d) => d.url)?.url ?? null };
  });
}
