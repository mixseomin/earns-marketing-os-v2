// SOCIAL TRAFFIC — LIVE: đọc góc thật từ spy.on.tc (cùng box3, cổng 3850, gọi thẳng 127.0.0.1 — nginx SSO chỉ chặn ngoài).
// Mỗi nhóm có góc AI lấy N góc mạnh nhất (spy đã xếp theo Sức mạnh). Kênh / lô / trang đích chưa có nguồn thật
// (mô hình chưa chạy) → rỗng; view hiện ô trống nói rõ số sẽ đến từ đâu. Kết quả nhớ 5 phút: /api/goc/sp nặng ~1,5MB.
import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { docKenh, docKenhSo, docVideoSo } from './tai-san/kenh';
import { tinhVideo, tinhPin } from './tai-san/video-tinh';
import type { StBan, StGoc, StKenh, StTrang, StTrangThaiKenh } from './social-traffic-demo';

const SPY = process.env.SPY_URL || 'http://127.0.0.1:3850';
const GOC_MOI_NHOM = 8;
const LOAI: Record<string, string> = { ai_chan_dung: 'Chân dung', ai_tinh_huong: 'Tình huống', ai_noi_dau: 'Nỗi đau', ai_vi_sao: 'Vì sao', ai_phan_doi: 'Phản đối' };

export interface SocialLive { luc: string; goc: StGoc[]; nhom: number; loi: string[]; kenh: StKenh[]; trang: StTrang[]; ban: StBan[] }

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
  catch (e) { return { luc, goc: [], nhom: 0, loi: [`không đọc được danh sách nhóm của spy: ${(e as Error).message}`], ...(await docKenhThat(loi)) }; }
  const ra: StGoc[][] = new Array(nhom.length);
  let tiep = 0;
  await Promise.all(Array.from({ length: Math.min(SONG_SONG, nhom.length) }, async () => {
    while (tiep < nhom.length) {
      const i = tiep++, s = nhom[i]!;
      try { ra[i] = await docNhom(s.id, s.ten); } catch (e) { loi.push(`nhóm #${s.id} ${s.ten}: ${(e as Error).message}`); ra[i] = []; }
    }
  }));
  // xếp chung mọi nhóm theo Sức mạnh (spy chấm trong từng nhóm, 0–100 cùng thang) — góc mạnh nhất toàn kho lên đầu
  return { luc, goc: ra.flat().sort((a, b) => (b.suc ?? -1) - (a.suc ?? -1)), nhom: nhom.length, loi, ...(await docKenhThat(loi)) };
}

/* KÊNH THẬT (anh 16/10/2026 "gom các kênh từ dự án KDP, Gum, Etsy về"): dự án nào có cửa bán Gumroad / Etsy / KDP đang mở (vault) thì
   lấy kênh mạng xã hội CHÍNH của dự án đó (platform_accounts.project_id). Số đo dùng LẠI máy của tab Tài sản — kenh_so_ngay qua
   tai-san/kenh.ts + video-tinh.ts (tinhVideo / tinhPin) — nên hai tab luôn cùng số. Kênh có trong vault mà chưa có máy đo → daDo=false.
   Bán: Gumroad theo store (product_daily 30 ngày); Etsy / KDP chưa có nguồn số bán → null + ghi chú. */
const NEN: Record<string, { pk: string; ten: string }> = {
  youtube: { pk: 'youtube', ten: 'YouTube Shorts' }, tiktok: { pk: 'tiktok', ten: 'TikTok' }, 'fb-reels': { pk: 'facebook', ten: 'Facebook Reels' },
  'ig-reels': { pk: 'instagram', ten: 'Instagram Reels' }, pinterest: { pk: 'pinterest', ten: 'Pinterest' },
};
const MXH = ['youtube', 'tiktok', 'facebook', 'instagram', 'pinterest', 'twitter', 'threads'];
const TT_TK = (s: string | null): StTrangThaiKenh => (s === 'banned' || s === 'suspended' || s === 'locked' ? 'khoa' : s === 'closed' ? 'dung' : s === 'flagged' || s === 'limited' ? 'co' : 'song');
const giua = (a: number[]) => { if (!a.length) return 0; const x = [...a].sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m]! : (x[m - 1]! + x[m]!) / 2; };

async function docKenhThat(loi: string[]): Promise<{ kenh: StKenh[]; trang: StTrang[]; ban: StBan[] }> {
  const d = getDb(); if (!d) return { kenh: [], trang: [], ban: [] };
  try {
    const cua = (await d.execute(sql`SELECT a.platform_key, a.handle, a.status, a.project_id, p.name AS du_an FROM platform_accounts a LEFT JOIN projects p ON p.id = a.project_id
      WHERE a.platform_key IN ('gumroad','etsy','kdp') AND coalesce(a.status,'') NOT IN ('closed','banned') AND a.project_id IS NOT NULL ORDER BY a.platform_key`)) as unknown as
      { platform_key: string; handle: string; status: string | null; project_id: string; du_an: string | null }[];
    const duAn = [...new Set(cua.map((c) => c.project_id))];
    const tenDuAn = Object.fromEntries(cua.map((c) => [c.project_id, c.du_an ?? c.project_id]));
    const [tk, so, video, kenhSp, dau, gum] = await Promise.all([
      d.execute(sql`SELECT id, platform_key, handle, status, project_id, proxy_id, created_at::date::text AS tao FROM platform_accounts
        WHERE project_id = ANY(${duAn}) AND platform_key = ANY(${MXH}) ORDER BY project_id, platform_key`) as unknown as Promise<{ id: number; platform_key: string; handle: string; status: string | null; project_id: string; proxy_id: number | null; tao: string }[]>,
      docKenhSo(), docVideoSo(), docKenh(),
      d.execute(sql`SELECT split_part(san_pham, ':', 1) AS du_an, kenh, min(ngay)::text AS dau FROM kenh_so_ngay GROUP BY 1, 2`) as unknown as Promise<{ du_an: string; kenh: string; dau: string }[]>,
      d.execute(sql`SELECT store, sum(views)::int AS xem, sum(sales)::int AS ban, round(sum(usd_cents) / 100.0, 2)::float AS usd FROM product_daily
        WHERE date >= to_char(current_date - 30, 'YYYY-MM-DD') GROUP BY store`) as unknown as Promise<{ store: string; xem: number; ban: number; usd: number }[]>,
    ]);
    const hom = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);   // ngày theo giờ Việt Nam như tab Tài sản
    const homMs = Date.parse(hom);
    const kenh: StKenh[] = [];
    for (const da of duAn) {
      const dongs = video.dongs.filter((x) => x.sanPham.split(':')[0] === da);
      const tv = tinhVideo(dongs, hom);
      const soCua = Object.fromEntries(Object.entries(so).filter(([k]) => k.split('|')[1]?.split(':')[0] === da));
      const pin = tinhPin(soCua);
      const daDung = new Set<number>();
      for (const [key, nen] of Object.entries(NEN)) {
        const n = tv.nen.find((x) => x.kenh === key);
        const coSo = key === 'pinterest' ? !!pin : !!n && n.soVideo > 0;
        const t = tk.find((x) => x.project_id === da && x.platform_key === nen.pk && !daDung.has(x.id));
        if (!coSo && !t) continue;
        if (t) daDung.add(t.id);
        const ngayDau = dau.find((x) => x.du_an === da && x.kenh === key)?.dau ?? t?.tao ?? hom;
        const daDang = key === 'pinterest' ? kenhSp.filter((x) => x.project === da).reduce((a, x) => a + (x.o.pinterest?.xong ?? 0), 0) : n?.soVideo ?? 0;
        kenh.push({
          id: t?.id ?? -(kenh.length + 1), ten: t?.handle ?? nen.ten, nenTang: nen.ten, nhom: tenDuAn[da] ?? da, ngonNgu: 'EN',
          proxy: t?.proxy_id ? `proxy #${t.proxy_id}` : t ? 'chưa gắn proxy' : 'chưa có trong vault', tt: TT_TK(t?.status ?? null),
          ngay: Math.max(0, Math.round((homMs - Date.parse(ngayDau)) / 864e5)), video: daDang,
          trungViXem: key === 'pinterest' ? 0 : giua(tv.video.map((v) => v.nen[key]?.tong).filter((x): x is number => x != null)),
          xem: key === 'pinterest' ? pin?.hien30 ?? 0 : n?.tong ?? 0, xem7: key === 'pinterest' ? null : n?.xem7 ?? null,
          click: key === 'pinterest' ? pin?.click30 ?? 0 : n?.vaoShop7 ?? 0, hh: 0, daDo: coSo,
        });
      }
      // kênh MXH khác của dự án (twitter, threads…) có trong vault nhưng chưa có máy đo
      for (const t of tk.filter((x) => x.project_id === da && !daDung.has(x.id)))
        kenh.push({ id: t.id, ten: t.handle, nenTang: t.platform_key, nhom: tenDuAn[da] ?? da, ngonNgu: 'EN', proxy: t.proxy_id ? `proxy #${t.proxy_id}` : 'chưa gắn proxy',
          tt: TT_TK(t.status), ngay: Math.max(0, Math.round((homMs - Date.parse(t.tao)) / 864e5)), video: 0, trungViXem: 0, xem: 0, click: 0, hh: 0, daDo: false });
    }
    // trang đích = các đích link mà kênh trỏ tới (kenh_sp.dich) — chưa có máy đo click từng trang → null
    const theoDich = new Map<string, StTrang>();
    for (const sp of kenhSp.filter((x) => x.project && duAn.includes(x.project))) for (const o of Object.values(sp.o)) {
      if (!o.dich) continue;
      const c = theoDich.get(o.dich) ?? { slug: o.dich.replace(/^https?:\/\//, ''), goc: 0, kenh: 0, click: null, raShop: null, chuongTrinh: new URL(o.dich).hostname.replace(/^www\./, ''), song: true, tieuDe: sp.ten, kenhTen: '' };
      c.kenhTen = [...new Set([...(c.kenhTen ? c.kenhTen.split(', ') : []), o.kenh])].join(', ');
      if (!c.tieuDe!.includes(sp.ten)) c.tieuDe = `${c.tieuDe} · ${sp.ten}`;
      theoDich.set(o.dich, c);
    }
    const ban: StBan[] = cua.map((c) => {
      if (c.platform_key === 'gumroad') { const g = gum.find((x) => x.store === c.handle);
        return { cua: 'Gumroad', ten: c.handle, duAn: tenDuAn[c.project_id] ?? c.project_id, xem30: g?.xem ?? 0, ban30: g?.ban ?? 0, usd30: g?.usd ?? 0, ghiChu: g ? undefined : 'store chưa có số trong product_daily' }; }
      return { cua: c.platform_key === 'kdp' ? 'Amazon KDP' : 'Etsy', ten: c.handle, duAn: tenDuAn[c.project_id] ?? c.project_id, xem30: null, ban30: null, usd30: null, ghiChu: 'chưa có máy đọc số bán' };
    });
    // store Gumroad có số mà tài khoản vault không gắn dự án (vd frontporchpuzzles #504) — vẫn đếm, không bỏ sót tiền
    for (const g of gum) if (!ban.some((b) => b.cua === 'Gumroad' && b.ten === g.store))
      ban.push({ cua: 'Gumroad', ten: g.store, duAn: '—', xem30: g.xem, ban30: g.ban, usd30: g.usd, ghiChu: 'tài khoản vault chưa gắn dự án' });
    return { kenh, trang: [...theoDich.values()], ban };
  } catch (e) { loi.push(`kênh / cửa bán: ${(e as Error).message}`); return { kenh: [], trang: [], ban: [] }; }
}
