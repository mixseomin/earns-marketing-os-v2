// SOCIAL TRAFFIC — LIVE: đọc góc thật từ spy.on.tc (cùng box3, cổng 3850, gọi thẳng 127.0.0.1 — nginx SSO chỉ chặn ngoài).
// Mỗi nhóm có góc AI lấy N góc mạnh nhất (spy đã xếp theo Sức mạnh). Kênh / lô / trang đích chưa có nguồn thật
// (mô hình chưa chạy) → rỗng; view hiện ô trống nói rõ số sẽ đến từ đâu. Kết quả nhớ 5 phút: /api/goc/sp nặng ~1,5MB.
import 'server-only';
import { unstable_cache } from 'next/cache';
import type { StGoc } from './social-traffic-demo';

const SPY = process.env.SPY_URL || 'http://127.0.0.1:3850';
const GOC_MOI_NHOM = 8;
const LOAI: Record<string, string> = { ai_chan_dung: 'Chân dung', ai_tinh_huong: 'Tình huống', ai_noi_dau: 'Nỗi đau', ai_vi_sao: 'Vì sao', ai_phan_doi: 'Phản đối' };

export interface SocialLive { luc: string; goc: StGoc[]; nhom: number; loi: string[] }

type SpNhom = { id: number; ten: string; ai: number };
type SpGoc = { id: number; ten: string; loai: string; cach_tim: string; so_qc: number | null; suc?: { diem: number }; bc?: { nguoi: number } | null; bat_ngo?: boolean; dang_len?: boolean };

// Nhớ RIÊNG từng nhóm (unstable_cache theo mã nhóm): nhóm lỗi thì ném → không bị nhớ, lần sau gọi lại; nhóm tốt giữ 5 phút.
// Trước đó nhớ cả lô → một nhóm quá hạn (#1, 16/10/2026) là thiếu góc của nhóm đó suốt 5 phút.
const docNhom = (id: number, ten: string) => unstable_cache(async (): Promise<StGoc[]> => {
  const r = await fetch(`${SPY}/api/goc?sp=${id}`, { cache: 'no-store', signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`spy /api/goc ${r.status}`);
  return ((await r.json()) as SpGoc[]).filter((g) => g.cach_tim === 'ai').slice(0, GOC_MOI_NHOM).map((g): StGoc => ({
    id: g.id, nhom: ten, ten: g.ten, loai: LOAI[g.loai] ?? g.loai, suc: g.suc?.diem ?? null, nguoi: g.bc?.nguoi ?? 0, qc: g.so_qc,
    batNgo: !!g.bat_ngo, dangLen: !!g.dang_len, tt: 'chua', video: 0, click: 0, hh: 0,
  }));
}, ['social-goc-v1', String(id)], { revalidate: 300 })();

const docDanhSach = unstable_cache(async (): Promise<SpNhom[]> => {
  const r = await fetch(`${SPY}/api/goc/sp`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`spy /api/goc/sp ${r.status}`);
  return ((await r.json()) as SpNhom[]).filter((x) => x.ai > 0).map((x) => ({ id: x.id, ten: x.ten, ai: x.ai }));
}, ['social-nhom-v1'], { revalidate: 300 });

const SONG_SONG = 4;   // 27 lượt cùng lúc làm spy nghẽn (đo 16/10/2026: 32 giây, #1 quá hạn 30s) — gọi từng đợt 4 nhóm

export async function getSocialLive(): Promise<SocialLive> {
  const luc = new Date().toISOString(), loi: string[] = [];
  let nhom: SpNhom[];
  try { nhom = await docDanhSach(); }
  catch (e) { return { luc, goc: [], nhom: 0, loi: [`không đọc được danh sách nhóm của spy: ${(e as Error).message}`] }; }
  const ra: StGoc[][] = new Array(nhom.length);
  let tiep = 0;
  await Promise.all(Array.from({ length: Math.min(SONG_SONG, nhom.length) }, async () => {
    while (tiep < nhom.length) {
      const i = tiep++, s = nhom[i]!;
      try { ra[i] = await docNhom(s.id, s.ten); } catch (e) { loi.push(`nhóm #${s.id} ${s.ten}: ${(e as Error).message}`); ra[i] = []; }
    }
  }));
  return { luc, goc: ra.flat(), nhom: nhom.length, loi };
}
