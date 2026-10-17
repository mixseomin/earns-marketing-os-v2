// SOCIAL TRAFFIC — LIVE: đọc góc thật từ spy.on.tc (cùng box3, cổng 3850, gọi thẳng 127.0.0.1 — nginx SSO chỉ chặn ngoài).
// Mỗi nhóm có góc AI lấy N góc mạnh nhất (spy đã xếp theo Sức mạnh). Kênh / lô / trang đích chưa có nguồn thật
// (mô hình chưa chạy) → rỗng; view hiện ô trống nói rõ số sẽ đến từ đâu. Kết quả nhớ 5 phút: /api/goc/sp nặng ~1,5MB.
import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { docKenh, docKenhSo, docVideoSo } from './tai-san/kenh';
import { tinhVideo, tinhPin } from './tai-san/video-tinh';
import type { StBan, StGoc, StKenh, StLanding, StLo, StTrang, StTrangThaiKenh } from './social-traffic-demo';
import { docSoLanding, siteCoMa } from './social-truc-tiep';

const SPY = process.env.SPY_URL || 'http://127.0.0.1:3850';
const GOC_MOI_NHOM = 8;
const LOAI: Record<string, string> = { ai_chan_dung: 'Chân dung', ai_tinh_huong: 'Tình huống', ai_noi_dau: 'Nỗi đau', ai_vi_sao: 'Vì sao', ai_phan_doi: 'Phản đối' };

export interface SocialLive { luc: string; goc: StGoc[]; nhom: number; loi: string[]; kenh: StKenh[]; trang: StTrang[]; ban: StBan[]; lo: StLo[]; landing: StLanding[] }

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
  catch (e) { const l = [`không đọc được danh sách nhóm của spy: ${(e as Error).message}`]; return { luc, goc: [], nhom: 0, loi: l, ...(await docKenhThatVaLanding(l)), lo: await docLoStudio(l) }; }
  const ra: StGoc[][] = new Array(nhom.length);
  let tiep = 0;
  await Promise.all(Array.from({ length: Math.min(SONG_SONG, nhom.length) }, async () => {
    while (tiep < nhom.length) {
      const i = tiep++, s = nhom[i]!;
      try { ra[i] = await docNhom(s.id, s.ten); } catch (e) { loi.push(`nhóm #${s.id} ${s.ten}: ${(e as Error).message}`); ra[i] = []; }
    }
  }));
  // xếp chung mọi nhóm theo Sức mạnh (spy chấm trong từng nhóm, 0–100 cùng thang) — góc mạnh nhất toàn kho lên đầu
  return { luc, goc: ra.flat().sort((a, b) => (b.suc ?? -1) - (a.suc ?? -1)), nhom: nhom.length, loi, ...(await docKenhThatVaLanding(loi)), lo: await docLoStudio(loi) };
}

/* LANDING: trang đích = link mà video của các máy (xv_may_video.dang.link) và kênh (kenh_sp.dich) trỏ tới — thêm máy / kênh mới là trang tự hiện,
   không khai tay. Số phiên đọc sổ phiên khách adfond (page-events.js trên site: trang VÀO, nguồn, cuộn, bấm sang shop). */
async function docKenhThatVaLanding(loi: string[]) {
  const k = await docKenhThat(loi);
  return { ...k, landing: await docLanding(k.trang, loi) };
}
async function docLanding(trang: StTrang[], loi: string[]): Promise<StLanding[]> {
  const d = getDb(); if (!d) return [];
  try {
    const may = (await d.execute(sql`SELECT v.dang->>'link' AS link, m.ten, count(*)::int AS so FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id
      WHERE NOT v.luu_tru AND coalesce(v.dang->>'link', '') <> '' GROUP BY 1, 2`)) as unknown as { link: string; ten: string; so: number }[];
    const theo = new Map<string, { nguon: string[]; soVideo: number }>();
    const them = (url: string, nguon: string, so = 0) => { try { const u = new URL(url); const key = `${u.host.replace(/^www\./, '')}${u.pathname}`; const x = theo.get(key) ?? { nguon: [], soVideo: 0 }; if (!x.nguon.includes(nguon)) x.nguon.push(nguon); x.soVideo += so; theo.set(key, x); } catch { /* link hỏng */ } };
    for (const r of may) them(r.link, `máy ${r.ten}`, r.so);
    for (const t of trang) them(t.slug.startsWith('http') ? t.slug : `https://${t.slug}`, t.kenhTen ? `kênh ${t.kenhTen}` : 'kênh');
    const ds = [...theo].map(([key, x]) => { const i = key.indexOf('/'); return { site: key.slice(0, i), path: key.slice(i) || '/', ...x }; });
    let so = new Map(), coMa = new Set<string>(); try { [so, coMa] = await Promise.all([docSoLanding(ds), siteCoMa([...new Set(ds.map((x) => x.site))])]); } catch (e) { loi.push(`số landing (adfond): ${(e as Error).message}`); }
    return ds.map((x): StLanding => { const s = so.get(`${x.site}${x.path}`) ?? { phien7: 0, khach7: 0, doc50: 0, bamRa: 0, phien30: 0, online: 0, nguonKhach: [], cuoi: null };
      return { url: `https://${x.site}${x.path}`, site: x.site, path: x.path, nguon: x.nguon.join(' · '), soVideo: x.soVideo, ...s, coMa: coMa.has(x.site) }; })
      .sort((a, b) => b.phien7 - a.phien7 || b.soVideo - a.soVideo);
  } catch (e) { loi.push(`landing: ${(e as Error).message}`); return []; }
}

/* HÀNG ĐỢI SẢN XUẤT (LIVE): video thật của các MÁY trên studio.on.tc (xv_may / xv_may_video, cùng DB mos2_prod — từ 17/10/2026 video máy không còn
   là phim). Chưa dựng → Dựng · đã dựng mà còn nền chưa đăng → Lên lịch · đăng đủ mọi nền của máy → rời hàng đợi (sổ đăng xv_may_video.da_dang).
   Máy dựng bằng máy nên không qua Kịch bản / Kiểm. Video lưu trữ (video cũ, không dựng / không đăng nữa) không vào hàng đợi. */
const STUDIO = 'https://studio.on.tc';
async function docLoStudio(loi: string[]): Promise<StLo[]> {
  const d = getDb(); if (!d) return [];
  try {
    const r = (await d.execute(sql`SELECT v.id, v.may_id, v.chu_de, m.du_an, v.video_url,
        EXISTS (SELECT 1 FROM jsonb_array_elements(m.dang) n WHERE NOT (v.da_dang ? (n->>'nen'))) AS con_nen
      FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE NOT v.luu_tru ORDER BY v.id DESC`)) as unknown as { id: number; may_id: number; chu_de: string; du_an: string; video_url: string | null; con_nen: boolean }[];
    return r.filter((x) => !x.video_url || x.con_nen).map((x): StLo => ({ id: x.id, goc: 0, kenh: 0, buoc: x.video_url ? 3 : 1, ten: x.chu_de, duAn: x.du_an,
      studio: `${STUDIO}/?kho=tu_dong&may=${x.may_id}&video=${x.id}`, video: x.video_url }));
  } catch (e) { loi.push(`hàng đợi studio: ${(e as Error).message}`); return []; }
}

/* KÊNH THẬT (anh 16/10/2026 "gom các kênh từ dự án KDP, Gum, Etsy về"): dự án có cửa bán — Etsy / KDP đang mở trong vault,
   Gumroad theo store có số (product_daily, ghép dự án theo tên) — thì lấy kênh mạng xã hội CHÍNH của dự án (platform_accounts.project_id). Số đo dùng LẠI máy của tab Tài sản — kenh_so_ngay qua
   tai-san/kenh.ts + video-tinh.ts (tinhVideo / tinhPin) — nên hai tab luôn cùng số. Kênh có trong vault mà chưa có máy đo → daDo=false.
   Bán: Gumroad theo store (product_daily 30 ngày); Etsy / KDP chưa có nguồn số bán → null + ghi chú. */
const NEN: Record<string, { pk: string; ten: string }> = {
  youtube: { pk: 'youtube', ten: 'YouTube Shorts' }, tiktok: { pk: 'tiktok', ten: 'TikTok' }, 'fb-reels': { pk: 'facebook', ten: 'Facebook Reels' },
  'ig-reels': { pk: 'instagram', ten: 'Instagram Reels' }, pinterest: { pk: 'pinterest', ten: 'Pinterest' },
};
const MXH = ['youtube', 'tiktok', 'facebook', 'instagram', 'pinterest', 'twitter', 'threads'];
const TT_TK = (s: string | null): StTrangThaiKenh => (s === 'banned' || s === 'suspended' || s === 'locked' ? 'khoa' : s === 'closed' ? 'dung' : s === 'flagged' || s === 'limited' ? 'co' : 'song');
const giua = (a: number[]) => { if (!a.length) return 0; const x = [...a].sort((p, q) => p - q), m = x.length >> 1; return x.length % 2 ? x[m]! : (x[m - 1]! + x[m]!) / 2; };

/* KÊNH TỰ HIỆN (18/10/2026, anh: "các kênh sau này phải tự động thêm vào… không bao giờ phải nhắc"): danh sách trên chỉ đi từ dự án có CỬA BÁN
   (Etsy/KDP/Gumroad), nên kênh aff (Hotel Scam Alerts → ratesbyroom, Before You Land → esimfares — dự án adfond) không bao giờ hiện.
   Nguồn chuẩn = VAULT: mọi tài khoản mạng xã hội còn sống có dự án (platform_accounts.project_id) — lập kênh nào cũng phải `browsers link … <dự án>`,
   nên kênh tự hiện ngay lúc lưu vault, không cần thêm bước. Kênh đã khai trong máy đăng (xv_may.dang[].br.acct) lấy thêm tên máy làm nhóm và số video
   máy đã đăng lên nền đó (xv_may_video.da_dang); kênh chưa gắn máy nhóm theo dự án. Chưa có máy đo lượt xem → daDo=false. */
const NEN_TEN: Record<string, string> = { youtube: 'YouTube Shorts', facebook: 'Facebook Reels', instagram: 'Instagram Reels', x: 'X', twitter: 'X', tiktok: 'TikTok', pinterest: 'Pinterest', threads: 'Threads', quora: 'Quora' };
async function docKenhVault(d: NonNullable<ReturnType<typeof getDb>>, daCo: Set<number>, homMs: number): Promise<StKenh[]> {
  const r = (await d.execute(sql`SELECT a.id, a.platform_key, a.handle, a.status, a.proxy_id, a.created_at::date::text AS tao, coalesce(p.name, a.project_id) AS du_an,
      may.ten AS may, may.da_dang
    FROM platform_accounts a LEFT JOIN projects p ON p.id = a.project_id
    LEFT JOIN LATERAL (SELECT m.ten, (SELECT count(*)::int FROM xv_may_video v WHERE v.may_id = m.id AND v.da_dang ? (n->>'nen')) AS da_dang
      FROM xv_may m CROSS JOIN LATERAL jsonb_array_elements(m.dang) n WHERE n->'br'->>'acct' = a.id::text LIMIT 1) may ON true
    WHERE a.project_id IS NOT NULL AND a.platform_key IN (${sql.join([...MXH, 'quora'].map((x) => sql`${x}`), sql`, `)})
      AND coalesce(a.status, '') NOT IN ('closed', 'banned')
      -- Facebook: kênh là PAGE (vault ghi "(Page)"); tài khoản FB cá nhân chỉ để đăng nhập (htuan82@, mixseo@…) không phải kênh — trừ khi máy đăng khai nó
      AND (a.platform_key <> 'facebook' OR a.handle ILIKE '%(Page)%' OR may.ten IS NOT NULL)
    ORDER BY (may.ten IS NULL), may.ten, du_an, a.platform_key`)) as unknown as { id: number; platform_key: string; handle: string; status: string | null; proxy_id: number | null; tao: string; du_an: string; may: string | null; da_dang: number | null }[];
  return r.filter((x) => !daCo.has(x.id)).map((x): StKenh => ({
    id: x.id, ten: x.handle, nenTang: NEN_TEN[x.platform_key] ?? x.platform_key, nhom: x.may ?? x.du_an, ngonNgu: 'EN', proxy: x.proxy_id ? `proxy #${x.proxy_id}` : 'chưa gắn proxy',
    tt: TT_TK(x.status), ngay: Math.max(0, Math.round((homMs - Date.parse(x.tao)) / 864e5)), video: x.da_dang ?? 0, trungViXem: 0, xem: 0, click: 0, hh: 0, daDo: false,
  }));
}

async function docKenhThat(loi: string[]): Promise<{ kenh: StKenh[]; trang: StTrang[]; ban: StBan[] }> {
  const d = getDb(); if (!d) return { kenh: [], trang: [], ban: [] };
  try {
    // Etsy / KDP: tài khoản vault đang mở có dự án. Gumroad: theo STORE có số (product_daily) — tài khoản vault Gumroad là tài khoản
    // ĐĂNG NHẬP (một tài khoản vào nhiều store qua switcher, vd makalynkentymtt82 → militarycalc/codecrate/examweight), không phải store.
    const [cua, duAnAll, storeAll] = await Promise.all([
      d.execute(sql`SELECT a.platform_key, a.handle, a.project_id FROM platform_accounts a
        WHERE a.platform_key IN ('etsy','kdp') AND coalesce(a.status,'') NOT IN ('closed','banned') AND a.project_id IS NOT NULL ORDER BY a.platform_key`) as unknown as Promise<{ platform_key: string; handle: string; project_id: string }[]>,
      d.execute(sql`SELECT id, name FROM projects`) as unknown as Promise<{ id: string; name: string }[]>,
      d.execute(sql`SELECT DISTINCT store FROM product_daily`) as unknown as Promise<{ store: string }[]>,
    ]);
    // store ↔ dự án theo TÊN chuẩn hoá (frontporchpuzzles = "Front Porch Puzzles", examweight = examweight) — store không khớp dự án nào vẫn hiện, dự án '—'
    const chuan = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
    const duAnStore = (store: string) => duAnAll.find((p) => chuan(p.id) === chuan(store) || chuan(p.name) === chuan(store))?.id ?? null;
    const tenDuAn: Record<string, string> = Object.fromEntries(duAnAll.map((p) => [p.id, p.name]));
    const duAn = [...new Set([...cua.map((c) => c.project_id), ...storeAll.map((s) => duAnStore(s.store)).filter((x): x is string => !!x)])];
    if (!duAn.length) return { kenh: await docKenhVault(d, new Set(), Date.parse(new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10))), trang: [], ban: [] };
    // drizzle trải mảng JS thành ($1, $2…) chứ không thành text[] → `= ANY(${mang})` gãy ("op ANY/ALL (array) requires array"); dùng IN (…)
    const trong = (xs: string[]) => sql.join(xs.map((x) => sql`${x}`), sql`, `);
    const [tk, so, video, kenhSp, dau, gum] = await Promise.all([
      d.execute(sql`SELECT id, platform_key, handle, status, project_id, proxy_id, created_at::date::text AS tao FROM platform_accounts
        WHERE project_id IN (${trong(duAn)}) AND platform_key IN (${trong(MXH)}) ORDER BY project_id, platform_key`) as unknown as Promise<{ id: number; platform_key: string; handle: string; status: string | null; project_id: string; proxy_id: number | null; tao: string }[]>,
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
    kenh.push(...await docKenhVault(d, new Set(kenh.map((k) => k.id)), homMs));
    // trang đích = các đích link mà kênh trỏ tới (kenh_sp.dich) — chưa có máy đo click từng trang → null
    const theoDich = new Map<string, StTrang>();
    for (const sp of kenhSp.filter((x) => x.project && duAn.includes(x.project))) for (const o of Object.values(sp.o)) {
      if (!o.dich) continue;
      const c = theoDich.get(o.dich) ?? { slug: o.dich.replace(/^https?:\/\//, ''), goc: 0, kenh: 0, click: null, raShop: null, chuongTrinh: new URL(o.dich).hostname.replace(/^www\./, ''), song: true, tieuDe: sp.ten, kenhTen: '' };
      c.kenhTen = [...new Set([...(c.kenhTen ? c.kenhTen.split(', ') : []), o.kenh])].join(', ');
      if (!c.tieuDe!.includes(sp.ten)) c.tieuDe = `${c.tieuDe} · ${sp.ten}`;
      theoDich.set(o.dich, c);
    }
    const ban: StBan[] = [
      ...storeAll.map((s): StBan => { const g = gum.find((x) => x.store === s.store), da = duAnStore(s.store);
        return { cua: 'Gumroad', ten: s.store, duAn: da ? tenDuAn[da] ?? da : '—', xem30: g?.xem ?? 0, ban30: g?.ban ?? 0, usd30: g?.usd ?? 0, ghiChu: da ? undefined : 'store không khớp tên dự án nào' }; }),
      ...cua.map((c): StBan => ({ cua: c.platform_key === 'kdp' ? 'Amazon KDP' : 'Etsy', ten: c.handle, duAn: tenDuAn[c.project_id] ?? c.project_id, xem30: null, ban30: null, usd30: null, ghiChu: 'chưa có máy đọc số bán' })),
    ];
    return { kenh, trang: [...theoDich.values()], ban };
  } catch (e) { loi.push(`kênh / cửa bán: ${(e as Error).message}`); return { kenh: [], trang: [], ban: [] }; }
}
