// BẢN LỒNG TIẾNG (13/10/2026 — "làm track tiếng Việt là mặc định, rồi dùng nó làm review luôn"): hình + nhịp shot giữ nguyên, chữ màn dịch,
// mọi câu nói đọc lại bằng tiếng đích với ĐÚNG giọng người nói của bản gốc. Một bản dùng cho hai việc: người chỉ biết tiếng Việt xem hộ
// (chấm câu chuyện có rõ không), và track tiếng phụ gắn vào cùng video trên YouTube (đa ngôn ngữ, lượt xem dồn về một video).
// Thuần: chuỗi cần dịch + giọng của từng dòng + gắn bản dịch vào shot + đọc shot theo ngôn ngữ. Phần máy chủ (dịch, đọc, xuất, ghi) ở long-tieng.ts. Tự kiểm: ban-dich.test.mts
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

/** Chữ màn dịch theo từng dòng, giữ mốc giây. Dòng chưa dịch được giữ nguyên. */
export const dichChuMan = (chu: string, dich: Map<string, string>): string =>
  tachDong(chu ?? '').map((d) => (d.chu.trim() ? `${d.moc}${dich.get(d.chu.trim()) ?? d.chu}` : `${d.moc}${d.chu}`)).join('\n');

type ShotLuu = ShotDich & Pick<Canh, 'chu_man_dich'>;
/** Gắn bản dịch vào shot (chữ màn → chu_man_dich, từng dòng → thoai[i].dich) kèm câu gốc lúc dịch. giongDich: "<shot id>:<dòng>" → url.
 *  Máy chủ ghi đúng các trường này vào DB (long-tieng.ts); timeline + bản xuất đọc lại bằng theoNgonNgu. */
export function ganDich<T extends ShotLuu>(canh: T[], lang: string, dich: Map<string, string>, giongDich: Map<string, string>): T[] {
  return canh.map((c) => ({
    ...c,
    chu_man_dich: { ...(c.chu_man_dich ?? {}), ...((c.chu_man ?? '').trim() ? { [lang]: { goc: c.chu_man, chu: dichChuMan(c.chu_man, dich) } } : {}) },
    thoai: (c.thoai ?? []).map((d, i) => (d.loi.trim()
      ? { ...d, dich: { ...(d.dich ?? {}), [lang]: { goc: d.loi, loi: dich.get(d.loi.trim()) ?? d.loi, url: giongDich.get(`${c.id}:${i}`) ?? null } } }
      : d)),
  }));
}

/** Shot như bản ngôn ngữ `lang` (timeline, xem toàn màn hình, bản xuất lồng tiếng — một hàm): chữ màn dịch, mỗi dòng mang câu dịch + file giọng
 *  dịch. Bản dịch cũ (câu gốc đã sửa sau khi dịch) hoặc chưa có giọng → dòng im, KHÔNG phát giọng gốc lẫn vào; đếm vào `thieu`. */
export function theoNgonNgu<T extends ShotLuu>(canh: T[], lang: string): { canh: T[]; thieu: number; coDich: boolean } {
  let thieu = 0; let coDich = false;
  const ra = canh.map((c) => {
    const cm = c.chu_man_dich?.[lang];
    if (cm) coDich = true;
    const chu = cm && cm.goc === c.chu_man ? cm.chu : c.chu_man;
    const thoai = (c.thoai ?? []).map((d) => {
      if (!d.loi.trim()) return d;
      const x = d.dich?.[lang]; if (x) coDich = true;
      const moi = x && x.goc === d.loi;
      if (!moi || !x.url) thieu++;
      const { dai: _d, ...con } = d;
      return { ...con, loi: moi ? x.loi : d.loi, url: moi ? x.url ?? null : null, gon: true };
    });
    return { ...c, chu_man: chu, thoai, thoai_url: thoai.find((d) => d.url)?.url ?? null };
  });
  return { canh: ra, thieu, coDich };
}
