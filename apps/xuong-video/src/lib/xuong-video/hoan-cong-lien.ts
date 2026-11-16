// HOÀN CÔNG — PHẦN THUẦN (anh 16/11/2026: "vì đây là sinh bằng AI nên shot sau khi sinh ra cũng phải có bước review lại kiểu hoàn công để so sánh với kịch bản hiện
// tại và yêu cầu đầu vào; bộ chấm hoàn công phải là dạng độc lập để xem các shot hiện tại và tương lai điều chỉnh thế nào"). Phần chạy (bóc khung clip + đối chiếu):
// hoan-cong.ts. Phần này: (1) tóm tắt hoàn công một shot; (2) NỐI TIẾP — trạng thái THẬT cuối shot i (bóc từ clip) so với đầu shot i+1 (bóc thật nếu đã có clip,
// không thì so với yêu cầu thẻ shot) → shot hiện tại / tương lai phải chỉnh gì. Đây là GIÁM KHẢO chưa đo trên bộ gắn nhãn (docs/chuan-cham-diem.md luật 4):
// chỉ để xem + báo, KHÔNG chặn / không tự sinh lại. Tự kiểm: hoan-cong-lien.test.mts.
import type { BocTachKhung, DongDoiChieu } from './kieu';

export type HoanCongLuc = { t: number; boc: BocTachKhung; chieu: DongDoiChieu[] };
/** Kết quả hoàn công gắn CLIP (url) — clip đổi thì hoàn công cũ hết hiệu lực. */
export type HoanCong = { url: string; luc_cham: string; doan: [number, number]; dau?: HoanCongLuc | null; cuoi?: HoanCongLuc | null };

const LECH = new Set(['lệch', 'thiếu', 'thừa']);
/** Dòng lệch của một lúc (đầu / cuối) so với thẻ shot. */
export const dongLech = (l?: HoanCongLuc | null): DongDoiChieu[] => (l?.chieu ?? []).filter((r) => LECH.has(r.muc));
export const hoanCongCu = (hc: HoanCong | null | undefined, videoUrl: string | null | undefined): boolean => !!hc && hc.url !== videoUrl;

const chuan = (t: string) => t.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
/** Cùng một món? (tên bóc tự do: "tiền thừa" ↔ "Tiền thừa (vài tờ tiền nhàu)") — trùng hoặc chứa nhau sau chuẩn hoá. */
const cungMon = (a: string, b: string) => { const x = chuan(a), y = chuan(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
const giu = (k?: BocTachKhung | null) => (k?.dao_cu ?? []).map((d) => ({ ten: d.ten, ai: chuan(d.nguoi_giu ?? '') || 'không ai', cach: d.cach_giu ?? '' }));
const coMat = (k: BocTachKhung | null | undefined, ai: string) => ai === 'không ai' || (k?.nguoi ?? []).some((n) => cungMon(n.ai, ai));

export type ShotHoanCong = { so: number; phan_doan?: string | null; hc?: HoanCong | null };
/** NỐI TIẾP qua cú cắt (cùng phân cảnh): món ở tay A cuối shot trước mà đầu shot sau ở tay B (cả hai người cùng có mặt) → đổi tay không có trên hình;
 *  món đang ở tay người có mặt đầu shot sau mà biến mất → mất đồ. Trả câu cho shot SAU (shot cần chỉnh: sinh lại, hoặc sửa thẻ shot sau cho khớp thật). */
export function lechNoiTiep(ds: readonly ShotHoanCong[]): { so: number; chu: string }[] {
  const out: { so: number; chu: string }[] = [];
  for (let i = 1; i < ds.length; i++) {
    const a = ds[i - 1]!, b = ds[i]!; if ((a.phan_doan ?? '') !== (b.phan_doan ?? '')) continue;
    const kA = a.hc?.cuoi?.boc, kB = b.hc?.dau?.boc; if (!kA || !kB) continue;
    for (const m of giu(kA)) {
      const n = giu(kB).find((x) => cungMon(x.ten, m.ten));
      if (n && n.ai !== m.ai && coMat(kB, m.ai) && n.ai !== 'không ai') out.push({ so: b.so, chu: `«${m.ten}»: cuối #${a.so} ở tay ${m.ai}, đầu #${b.so} đã ở tay ${n.ai} — đổi tay không có trên hình` });
      if (!n && m.ai !== 'không ai' && coMat(kB, m.ai)) out.push({ so: b.so, chu: `«${m.ten}»: cuối #${a.so} ${m.ai} đang cầm, đầu #${b.so} ${m.ai} vẫn trong khung mà món biến mất` });
    }
  }
  return out;
}
