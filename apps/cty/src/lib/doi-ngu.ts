// ĐỘI NGŨ (11/10/2026, anh: "danh sách toàn bộ nhân sự + bảng chỉ số so sánh + đề xuất — các thứ vừa nãy mất tiền để test"):
// đọc kết quả DÒ MODEL đã trả tiền trên box (worker/do-model.mjs, do-van.mjs) rồi gắn vào từng người theo BỘ NÃO (model) của họ.
// Chỉ số gốc = điểm đo của model trên bộ đo chuẩn với hồ sơ trung tính → hai người cùng model có cùng chỉ số gốc (khác nhau ở thực chiến).
// Đề xuất do máy tính từ số đo; đổi bộ não / đổi người = mức 3, Giám đốc ký.
import fs from 'node:fs';
import path from 'node:path';
import { dsNhanSu, dsPhong } from './cong-ty';
import { vaiCuaPhong } from '../../worker/quy-trinh.mjs';

const DIR = () => path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'do-model');
export type Vai = 'giao' | 'lam' | 'kiem';
export const VAI: Vai[] = ['giao', 'lam', 'kiem'];
export const TEN_VAI: Record<Vai, string> = { giao: 'Trưởng phòng', lam: 'Người làm', kiem: 'Người kiểm' };
export const COT_VAI: Record<Vai, string> = { giao: 'Giao việc', lam: 'Làm', kiem: 'Kiểm' };   // nhãn cột ngắn (bảng vừa màn điện thoại)
export type TK = { n: number; dung: number; ti_le: number; kt95: [number, number]; usd_goi: number; ms_giua: number | null; hong_dinh_dang: number; vuot_500: number;
  bac_sai?: number; duyet_sai?: number; hoi_thua?: number; giao_bua?: number; mat_rang_buoc?: number };
type Chon = { model: string; ti_le: number; usd_goi: number; gioi_nhat: number; nhom_dan_dau: string[] };
export type KetDo = { dot: string; ts: string; so_goi: number; tong_chi: number; theo_vai: Record<Vai, Record<string, TK>>;
  theo_loai: Record<Vai, Record<string, Record<string, TK | Chon | null>>>; duong_bien: Record<Vai, string[]>; de_xuat: Record<Vai, Chon | null> };
const doc = <T,>(f: string): T | null => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) as T; } catch { return null; } };   // chưa có tệp = chưa đo
const dsDot = () => { try { return fs.readdirSync(DIR()); } catch { return []; } };

export const tenModel = (m: string) => m.replace(/^[a-z]+:/, '').replace(/^[a-z-]+\//, '');
export const pc = (x: number) => `${Math.round(x * 100)}%`;
const lan = (x: number) => (x >= 10 ? Math.round(x).toString() : x.toFixed(1).replace('.', ','));

/** Đợt đo gốc: đợt nhiều lời gọi nhất KHÔNG đổi tính cách (bỏ chạy thử `thu-*`, đợt tính cách `tc-*`, văn dài `van`). */
export function ketDoModel(): KetDo | null {
  return dsDot().filter((d) => !/^(thu|tc-|van)/.test(d)).map((d) => doc<KetDo>(path.join(DIR(), d, 'ket.json'))).filter((k): k is KetDo => !!k)
    .sort((a, b) => b.so_goi - a.so_goi)[0] ?? null;
}

/** Tổng tiền mọi đợt đo đã chạy (kể cả chạy thử, tính cách, văn dài) — đọc từ nhật ký lời gọi, không ước. */
export function tongChiDo(): { usd: number; goi: number } {
  let usd = 0, goi = 0;
  for (const d of dsDot()) for (const t of ['goi.jsonl', 'bai.jsonl', 'cham.jsonl']) {
    let s = ''; try { s = fs.readFileSync(path.join(DIR(), d, t), 'utf8'); } catch { continue; }
    for (const l of s.split('\n')) if (l) { try { usd += JSON.parse(l).usd || 0; goi++; } catch { /* dòng hỏng: bỏ */ } }
  }
  return { usd, goi };
}

export type TacDung = { chi_so: string; muc: number; model: string; vai: Vai; truoc: number; sau: number; chenh: number; p: number; n: number };
/** Thí nghiệm tính cách: mỗi đợt `tc-<chỉ số>-<mức>` so theo cặp với đợt gốc (so-voi-*.json do `do-model.mjs --so` ghi). */
export function tacDungTinhCach(): TacDung[] {
  return dsDot().flatMap((d) => {
    const m = d.match(/^tc-([a-z_]+)-(\d+)$/); if (!m) return [];
    const f = dsDotTep(d).find((t) => /^so-voi-(?!tc-)/.test(t)); const s = f ? doc<{ kq: { model: string; vai: Vai; a: number; b: number; chenh: number; p: number; n: number }[] }>(path.join(DIR(), d, f)) : null;
    return (s?.kq ?? []).map((x) => ({ chi_so: m[1]!, muc: Number(m[2]), model: x.model, vai: x.vai, truoc: x.b, sau: x.a, chenh: x.chenh, p: x.p, n: x.n }));
  });
}
const dsDotTep = (d: string) => { try { return fs.readdirSync(path.join(DIR(), d)); } catch { return []; } };

/** Văn dài: giám khảo máy chấm mù Sáng tạo 2 ↔ 9 (do-van.mjs). */
export function ketVanDai(): Record<string, { s9: number; s2: number; ngang: number }> | null {
  const k = doc<{ giam_khao: Record<string, Record<string, { s9: number; s2: number; ngang: number }>> }>(path.join(DIR(), 'van', 'ket.json'));
  if (!k) return null;
  const tong: Record<string, { s9: number; s2: number; ngang: number }> = {};
  for (const theoModel of Object.values(k.giam_khao)) for (const [m, v] of Object.entries(theoModel)) { const o = (tong[m] ??= { s9: 0, s2: 0, ngang: 0 }); o.s9 += v.s9; o.s2 += v.s2; o.ngang += v.ngang; }
  return tong;
}

const MA_VAI: Record<string, Vai> = { 'truong-phong': 'giao', 'nguoi-lam': 'lam', 'nguoi-kiem': 'kiem' };
const vaiTuChucDanh = (cd: string): Vai => (/kiểm/i.test(cd) ? 'kiem' : /trưởng|chánh/i.test(cd) ? 'giao' : 'lam');

export type DeXuat = { muc: 'giu' | 'doi' | 'chua-do'; chu: string; re?: string; them: string[] };
export type Nguoi = { id: string; ten: string; phong: string; phongTen: string; chucDanh: string; model: string; vai: Vai; giuVai: string[];
  chiSo: Record<Vai, TK | null>; deXuat: DeXuat; tc: Record<string, number> };

/** Đề xuất cho MỘT người ở vai chính của họ: (1) lựa chọn đáng tiền nhất của vai (nhóm kém người giỏi nhất ≤ 5 điểm, lấy rẻ nhất);
 *  (2) phương án rẻ: model rẻ nhất mà vẫn hơn bộ não hiện tại ≥ 5 điểm (5 điểm ≈ biên sai số của bộ đo). */
export function deXuatCho(model: string, vai: Vai, k: KetDo | null, tc: Record<string, number> = {}): DeXuat {
  const cur = k?.theo_vai[vai]?.[model];
  if (!k || !cur) return { muc: 'chua-do', them: [], chu: model === 'claude-code' ? 'Chưa đo: chạy bằng Claude Code (gói thuê bao), không gọi qua proxy nên chưa có trong bộ đo' : `Chưa đo bộ não ${tenModel(model)}` };
  const them: string[] = [];
  if (vai === 'kiem' && (cur.bac_sai ?? 0) >= 10) them.push(`khắt khe: bác nhầm ${cur.bac_sai}/60 lượt chấm bài sạch`);
  if (vai === 'giao' && (cur.giao_bua ?? 0) >= 10) them.push(`giao bừa ${cur.giao_bua}/32 việc lẽ ra phải hỏi lại`);
  if (vai === 'giao' && (cur.mat_rang_buoc ?? 0) >= 10) them.push(`làm rơi ràng buộc/đoạn nguồn ở ${cur.mat_rang_buoc}/96 brief`);
  if (model === 'openai:gpt-4o-mini' && vai === 'giao' && (tc.mem_mong ?? 0) < 8) them.push('nếu giữ 4o-mini: Mềm mỏng 9 đo được +8 điểm ở vai này (hỏi lại việc mâu thuẫn nhiều hơn)');
  const ds = Object.entries(k.theo_vai[vai]).filter(([, s]) => s.n);
  const re = ds.filter(([m, s]) => m !== model && s.ti_le >= cur.ti_le + 0.05).sort((a, b) => a[1].usd_goi - b[1].usd_goi)[0];
  const reChu = re && re[0] !== k.de_xuat[vai]?.model ? `Rẻ nhất mà vẫn hơn: ${tenModel(re[0])} ${pc(re[1].ti_le)}, ${re[1].usd_goi <= cur.usd_goi ? `rẻ hơn ${lan(cur.usd_goi / re[1].usd_goi)} lần` : `đắt hơn ${lan(re[1].usd_goi / cur.usd_goi)} lần`}` : undefined;
  const c = k.de_xuat[vai];
  if (!c || c.model === model) return { muc: 'giu', them, chu: 'Giữ: đang là lựa chọn đáng tiền nhất cho vai này', re: reChu };
  const chenh = Math.round((c.ti_le - cur.ti_le) * 100); const r = cur.usd_goi / c.usd_goi;
  const gia = r >= 1 ? `rẻ hơn ${lan(r)} lần` : `đắt hơn ${lan(1 / r)} lần`;
  if (chenh >= 5) return { muc: 'doi', them, re: reChu, chu: `Đổi bộ não sang ${tenModel(c.model)}: đúng ${pc(cur.ti_le)} → ${pc(c.ti_le)} (+${chenh} điểm), ${gia}` };
  if (r >= 2 && (cur.usd_goi - c.usd_goi) * 1000 >= 0.1) return { muc: 'doi', them, re: reChu, chu: `Ngang điểm (${pc(cur.ti_le)} so với ${pc(c.ti_le)}) mà ${tenModel(c.model)} ${gia}` };   // rẻ hơn nhưng tiết kiệm < $0,10/1.000 lời gọi: không đáng đổi
  return { muc: 'giu', them, re: reChu, chu: `Giữ: ngang lựa chọn đáng tiền nhất (${tenModel(c.model)} ${pc(c.ti_le)}), đổi chỉ tiết kiệm không đáng kể (dưới $0,10/1.000 lời gọi)` };
}

export function doiNgu(): { k: KetDo | null; ds: Nguoi[] } {
  const k = ketDoModel(); const phong = dsPhong(); const tenPhong = Object.fromEntries(phong.map((p) => [p.id, String(p.fm.ten ?? p.id)]));
  const giu: Record<string, { phong: string; vai: Vai }[]> = {};
  for (const p of phong) for (const [v, ai] of Object.entries((vaiCuaPhong(p.id) ?? {}) as Record<string, string>)) if (MA_VAI[v] && ai) (giu[ai] ??= []).push({ phong: p.id, vai: MA_VAI[v]! });
  const ds = dsNhanSu().map((d) => {
    const fm = d.fm as Record<string, unknown>; const model = String(fm.model ?? ''); const cd = String(fm.chuc_danh ?? '');
    const vai = giu[d.id]?.[0]?.vai ?? vaiTuChucDanh(cd);
    const tc = Object.fromEntries(Object.entries(fm).filter(([x]) => x.startsWith('tc_')).map(([x, v]) => [x.slice(3), Number(v)]));
    return { id: d.id, ten: String(fm.ten ?? d.id), phong: String(fm.phong ?? ''), phongTen: tenPhong[String(fm.phong ?? '')] ?? String(fm.phong ?? ''), chucDanh: cd, model, vai,
      giuVai: (giu[d.id] ?? []).map((g) => `${TEN_VAI[g.vai]} · ${tenPhong[g.phong] ?? g.phong}`),
      chiSo: Object.fromEntries(VAI.map((v) => [v, k?.theo_vai[v]?.[model] ?? null])) as Record<Vai, TK | null>, deXuat: deXuatCho(model, vai, k, tc), tc };
  });
  return { k, ds };
}
