// SOCIAL TRAFFIC — LIVE: đọc góc thật từ spy.on.tc (cùng box3, cổng 3850, gọi thẳng 127.0.0.1 — nginx SSO chỉ chặn ngoài).
// Mỗi nhóm có góc AI lấy N góc mạnh nhất (spy đã xếp theo Sức mạnh). Kênh / lô / trang đích chưa có nguồn thật
// (mô hình chưa chạy) → rỗng; view hiện ô trống nói rõ số sẽ đến từ đâu. Kết quả nhớ 5 phút: /api/goc/sp nặng ~1,5MB.
import 'server-only';
import { unstable_cache } from 'next/cache';
import { getDb } from '@mos2/db';
import { sql, type SQL } from 'drizzle-orm';
import { siteOf } from './host';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { docKenh, docKenhSo, docVideoSo } from './tai-san/kenh';
import { tinhVideo, tinhPin } from './tai-san/video-tinh';
import type { DangNenTho, StBan, StGoc, StKenh, StLanding, StLo, StTrang, StTrangThaiKenh } from './social-traffic-demo';
import { docBamBaiDang, docNguonSite, docSoLanding, siteCoMa } from './social-truc-tiep';
import { HOST_BAN, MAY_TIM, NEN_QC, loaiCampEtp, type VaoHeSinhThai } from './social-thanh-pho';
import { getProductsView } from './products/data';
import { networkRows } from './revenue/networks';
import { docEthopex } from './ethopex-doc';
import { chamLuat, dangCamp } from './ethopex-luat';
import { tinhSucKhoe, type StSucKhoe, type VaoSuc } from './social-suc-khoe';

const SPY = process.env.SPY_URL || 'http://127.0.0.1:3850';
const GOC_MOI_NHOM = 8;
const LOAI: Record<string, string> = { ai_chan_dung: 'Chân dung', ai_tinh_huong: 'Tình huống', ai_noi_dau: 'Nỗi đau', ai_vi_sao: 'Vì sao', ai_phan_doi: 'Phản đối' };

export interface SocialLive { luc: string; goc: StGoc[]; nhom: number; loi: string[]; kenh: StKenh[]; trang: StTrang[]; ban: StBan[]; lo: StLo[]; landing: StLanding[]; lich: StLich[]; luoi: StLuoi; suc: StSucKhoe;
  /** favicon thật của từng site đích (data URI; null = site chưa có favicon riêng) — thành phố Social dán lên nóc toà, không gọi ra ngoài từ trình duyệt */
  fav: Record<string, string | null>;
  /** mọi site có mã theo dõi: phiên 30 ngày + phiên từ từng máy tìm kiếm (khoá MAY_TIM) — thành phố Social dựng cả site chưa có nguồn */
  nguonSite: { site: string; phien30: number; tim: Record<string, number>; qc?: Record<string, number>; gt?: Record<string, number>; online?: number; khach30p?: number; ngay?: Record<string, number> }[];
  /** hệ sinh thái cho thành phố: dự án (site chính, ngừng?), sổ site ↔ dự án, sản phẩm mọi cửa bán, app, tài khoản cửa bán */
  heSinhThai: VaoHeSinhThai }
/** LƯỚI LỊCH (anh 18/10/2026: "phần lịch phải show thêm kiểu lịch thật"): một ô = một bài trên một kênh vào một giờ (GMT+7).
 *  da = đã đăng (sổ xv_may_video.da_dang, có link) · du_kien = máy sẽ đăng (xv_lich_du_kien — dang-may tính bằng luật nhịp an toàn, mos2 không tính lại). */
export interface StLuoiO { ngay: string; gio: string; may: string; mayTen: string; nen: string; title: string; url: string | null; loai: 'da' | 'du_kien' }
/** THỐNG KÊ KHO (anh 18/10/2026: "cần thống kê theo kiểu nội dung, format… trên lịch nhìn thấy hết"): một dòng = máy × (format | kiểu nội dung).
 *  da = lượt đã đăng · kho = lượt DUYỆT chưa đăng (một video lên 3 nền = 3) · den = ngày lượt dự kiến cuối cùng (lịch 90 ngày của dang-may) — null = không có lượt nào. */
export interface StKho { may: string; mayTen: string; chieu: 'format' | 'kieu'; nhan: string; da: number; kho: number; den: string | null }
export interface StLuoi { hom: string; tinhLuc: string | null; o: StLuoiO[]; kho: StKho[] }
/** LỊCH ĐĂNG (anh 18/10/2026: "cần show lịch đăng trên tab social"): mỗi dòng = một nơi đăng của một máy studio (xv_may.dang[]) — giờ, máy Mac chạy,
 *  trần/ngày, hôm nay đã đăng chưa, lần gần nhất, video kế. Đọc thẳng cấu hình máy + sổ đăng (xv_may_video.da_dang) nên máy / nền mới tự hiện. */
export interface StLich {
  may: string; mayMa: string; chay: boolean; nen: string; nenTen: string; tk: string; gio: string; mayMac: string; tran: number;
  homNay: number; homNayUrl: string | null; cuoiLuc: string | null; cuoiUrl: string | null; daDang: number; conCho: number; ke: string | null;
  /** giờ chạy THẬT của máy Mac này trong sổ việc nền cty (lượt dang-may --het) — rỗng = không có lượt nào, nơi đăng này không đăng được */
  luot: string[];
}

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

/** Đo từng phần (anh 18/10/2026: "tab social chậm quá") — mỗi lần dựng in MỘT dòng nhật ký `social: góc 120ms · kênh 640ms …` để biết phần nào nặng. */
const doGio = async <T,>(ten: string, ghi: string[], f: () => Promise<T>): Promise<T> => { const t = Date.now(); try { return await f(); } finally { ghi.push(`${ten} ${Date.now() - t}ms`); } };
export async function getSocialLive(): Promise<SocialLive> {
  const luc = new Date().toISOString(), loi: string[] = [], gio: string[] = [], t0 = Date.now();
  // CHẠY SONG SONG: góc spy, kênh + landing, lò studio, lịch đăng không phụ thuộc nhau (trước 18/10 chạy nối đuôi — cộng dồn thời gian từng phần)
  const [goc, kenh, lo, lich, luoi, suc, nguonSite, heSinhThai] = await Promise.all([doGio('góc', gio, () => docGocSpy(loi)), doGio('kênh+landing', gio, () => docKenhThatVaLanding(loi)),
    doGio('lò', gio, () => docLoStudio(loi)), doGio('lịch', gio, () => docLich(loi)), doGio('lưới', gio, () => docLuoi(loi)), doGio('sức khoẻ', gio, () => docSucKhoe(loi)),
    doGio('nguồn site', gio, () => docNguonSite().catch((e: Error) => { loi.push(`nguồn site (adfond): ${e.message}`); return []; })),
    doGio('hệ sinh thái', gio, () => docHeSinhThai(loi))]);
  const site = [...new Set([...kenh.landing.map((x) => x.site), ...suc.dong.map((x) => x.site).filter((x): x is string => !!x), ...nguonSite.map((x) => x.site), ...MAY_TIM.map((m) => m.host), ...Object.values(HOST_BAN), ...Object.values(NEN_QC).map((q) => q.host), ...nguonSite.flatMap((x) => Object.keys(x.gt ?? {}))])];
  const fav = await doGio('favicon', gio, () => docFav(site));
  console.log(`social: ${gio.join(' · ')} · tổng ${Date.now() - t0}ms`);
  return { luc, ...goc, loi, ...kenh, lo, lich, luoi, suc, fav, nguonSite, heSinhThai };
}
/** HỆ SINH THÁI (thành phố): dự án (host của projects.website, ngung_luc), sổ du_an_site, sản phẩm mọi cửa bán (kho products Directus — cùng nguồn tab
 *  Tài sản, số 30 ngày), app_ung_dung, tài khoản cửa bán trong vault. Phần nào lỗi thì phần đó rỗng, ghi lỗi, không chặn trang. */
async function docHeSinhThai(loi: string[]): Promise<VaoHeSinhThai> {
  const rong: VaoHeSinhThai = { duAn: [], duAnSite: [], sanPham: [], app: [], tkCua: [] };
  const d = getDb(); if (!d) return rong;
  const tu30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  // mỗi phần đọc lỗi → phần đó rỗng + ghi lỗi lên trang (không nuốt im: số thiếu mà không ai biết vì sao)
  const doc = <T,>(ten: string, p: Promise<T>, rong: T) => p.catch((e: Error) => { loi.push(`${ten}: ${e.message}`); return rong; });
  const q = <T,>(ten: string, cau: SQL) => doc(ten, d.execute(cau) as unknown as Promise<T[]>, [] as T[]);
  const [da, ds, app, tk, sp, nguonApp, refs, lv, donShop, ads, chi, phuPf, hat, aff, etp] = await Promise.all([
    q<{ id: string; name: string; website: string | null; ngung: boolean; ria: boolean }>('dự án', sql`SELECT id, name, website, ngung_luc IS NOT NULL AS ngung, coalesce(pho_ria, false) AS ria FROM projects WHERE archived_at IS NULL AND NOT coalesce(is_demo, false)`),
    q<{ site: string; project_id: string }>('sổ site dự án', sql`SELECT site, project_id FROM du_an_site`),
    q<{ ten: string; project_id: string }>('app (app_ung_dung)', sql`SELECT ten, project_id FROM app_ung_dung WHERE project_id IS NOT NULL`),
    // mọi tài khoản cửa bán kể cả đã khoá: cửa bán mà mọi tài khoản đều bị khoá (Udemy) → sản phẩm ra khu 'tài khoản bị khoá' ở rìa; 'closed' = tự đóng, không tính
    q<{ platform_key: string; handle: string; project_id: string | null; khoa: boolean }>('tài khoản cửa bán', sql`SELECT platform_key, handle, project_id, coalesce(status, '') IN ('banned', 'suspended', 'locked') AS khoa FROM platform_accounts WHERE coalesce(status, '') <> 'closed'
      AND platform_key IN ('etsy', 'kdp', 'gumroad', 'udemy', 'app-store', 'ms-store', 'mql5-market', 'rapidapi', 'chaturbate', 'stripcash', 'stripe')`),
    doc('sản phẩm', getProductsView(30), null),
    doc('nguồn app (Apple)', docNguonApp(), []),
    q<{ product_id: string; refs: Record<string, number> | null }>('nguồn Gumroad (product_daily)', sql`SELECT product_id, refs FROM product_daily WHERE refs IS NOT NULL AND date >= to_char(current_date - 30, 'YYYY-MM-DD')`),
    q<{ khoa: string; linh_vuc: string }>('sổ lĩnh vực', sql`SELECT khoa, linh_vuc FROM linh_vuc_gan`),
    // đơn shop mặt tiền 30 ngày (trừ hoàn), theo tên miền chính của cửa hàng; cửa hàng demo, đơn huỷ / chưa trả / đơn thử không tính
    q<{ site: string; usd: number }>('đơn shop', sql`SELECT c.domain AS site, coalesce(sum(o.tong - coalesce(o.hoan, 0)), 0)::float AS usd FROM shop_don o JOIN shop_cua_hang c ON c.id = o.cua_hang_id
      WHERE NOT coalesce(c.demo, false) AND o.tao_luc > now() - interval '30 days'
        -- chỉ đơn thật đã trả: bỏ đơn huỷ / hoàn / lỗi / chưa trả và đơn thử (test-mos2@… ngày 01/10 làm Kho bạc báo nhầm $49,99 — anh hỏi 22/10/2026)
        AND coalesce(o.trang_thai_shop, '') NOT IN ('cancelled', 'refunded', 'failed', 'pending', 'trash', 'draft') AND coalesce(o.khach->>'email', '') NOT ILIKE 'test%'
      GROUP BY 1`),
    // AdSense theo site (dòng site_domain rỗng = tổng tài khoản, bỏ) · chi quảng cáo hệ PHỦ · nền aff hệ PHỦ → dự án (Chaturbate → Chat When Bored)
    q<{ site: string; usd: number }>('AdSense', sql`SELECT regexp_replace(site_domain, '^www\.', '') AS site, sum(earnings_usd)::float AS usd FROM adsense_daily WHERE date > current_date - 30 AND coalesce(site_domain, '') <> '' GROUP BY 1`),
    q<{ nguon: string; project_id: string | null; usd: number }>('chi quảng cáo (phu_chi)', sql`SELECT nguon_key AS nguon, project_id, sum(chi_usd)::float AS usd FROM phu_chi WHERE ngay > current_date - 30 GROUP BY 1, 2`),
    q<{ slug: string; project_id: string }>('nền aff PHỦ', sql`SELECT DISTINCT slug, project_id FROM phu_platforms WHERE project_id IS NOT NULL`),
    // hạ tầng: máy chủ (hosting) + tên miền (hạn, máy gốc) trong sổ tài sản
    q<{ kind: string; label: string; project_id: string | null; het: string | null; ip: string | null; origin: string | null; chi: number; currency: string }>('sổ hạ tầng', sql`SELECT kind, label, project_id, expires_at::text AS het, meta->>'ip' AS ip, meta->>'origin' AS origin, cost_monthly::float AS chi, currency FROM infra_resources WHERE kind IN ('hosting', 'domain') AND coalesce(status, 'active') <> 'cancelled'`),
    // hoa hồng mạng aff (CJ, Awin — cùng nguồn lịch Doanh thu trang chủ, nhớ 10 phút) · Ethopex (thu / chi Meta Ads)
    doc('hoa hồng aff', networkRows(tu30), null),
    doc('Ethopex', docEthopex(), null),
  ]);
  // SỐ DƯ NGUỒN TRẢ TRƯỚC (nguồn AI, máy thuê): ảnh chụp Phòng Tài nguyên (apps/cty/worker/tai-nguyen-api.mjs, 30 phút/lần, giữ lịch từng ngày) + tên ở sổ nguồn AI studio (xv_nguon)
  const DON_DU: Record<string, string> = { shopaikey: '$', kie: 'credit', runpod: '$', ckey: '₫', plenxai: 'credit' };
  const anhTn = await doc('số dư nguồn', (async () => JSON.parse(readFileSync(`${process.env.CTY_DATA_DIR || '/var/lib/cty'}/tai-nguyen-api.json`, 'utf8')) as { du?: Record<string, number | null>; lich?: { ngay: string; du: Record<string, number | null> }[]; loi?: Record<string, string>; luc?: string })(), {});
  const tenNguon = new Map((await q<{ key: string; ten: string }>('sổ nguồn AI', sql`SELECT key, ten FROM xv_nguon`)).map((x) => [x.key, x.ten]));
  const soDuTn = Object.keys({ ...(anhTn.du ?? {}), ...(anhTn.loi ?? {}) }).map((key) => ({ key, ten: tenNguon.get(key) ?? key, don: DON_DU[key] ?? '', du: anhTn.du?.[key] ?? null, loi: anhTn.loi?.[key] ?? null, luc: anhTn.luc ?? null,
    lich: (anhTn.lich ?? []).map((x) => ({ ngay: x.ngay, du: x.du?.[key] ?? null })) }));
  const [mayChu, congTy, tnTk, tnCb, tnHs, tnDs, tnPx, tnNs, tnQc] = await Promise.all([doc('máy chủ', docMayChu(), []), doc('công ty AI', docCongTy(), []),
    // tài nguyên (khu TÀI NGUYÊN): tài khoản × trạng thái, cảnh báo chưa xử, hồ sơ trình duyệt (br / máy ảo), proxy, sổ ngân sách, tài khoản QC shop
    q<{ nen: string; status: string; n: number }>('tài khoản theo nền', sql`SELECT platform_key AS nen, status, count(*)::int AS n FROM platform_accounts GROUP BY 1, 2`),
    q<{ nen: string | null; loai: string; n: number }>('cảnh báo nền tảng', sql`SELECT coalesce(platform, 'khac') AS nen, loai, count(*)::int AS n FROM platform_alerts WHERE xong_luc IS NULL GROUP BY 1, 2`),
    q<{ tool: string; n: number; gan7: number; cuoi: string | null }>('hồ sơ trình duyệt', sql`SELECT tool, count(*)::int AS n, (count(*) FILTER (WHERE last_opened_at > now() - interval '7 days'))::int AS gan7, max(last_opened_at)::text AS cuoi FROM browser_profiles WHERE archived_at IS NULL GROUP BY 1`),
    q<{ id: number; nen: string; handle: string | null; loai: string; noi_dung: string | null; url: string | null; luc: string; acct: number | null }>('danh sách cảnh báo', sql`SELECT id, coalesce(platform, 'khac') AS nen, handle, loai, left(noi_dung, 160) AS noi_dung, url, luc::text AS luc, account_id AS acct FROM platform_alerts WHERE xong_luc IS NULL ORDER BY luc DESC LIMIT 80`),
    q<{ suc: string; n: number }>('proxy', sql`SELECT coalesce(health, 'chưa đo') AS suc, count(*)::int AS n FROM proxies WHERE archived_at IS NULL GROUP BY 1`),
    q<{ ten: string; so: number; tien_te: string; chu_ky: number | null }>('sổ ngân sách', sql`SELECT label AS ten, amount_cents / 100.0 AS so, currency AS tien_te, recurring_interval_days AS chu_ky FROM budget_entries WHERE kind IN ('expense', 'recurring')`),
    q<{ ten: string; trang_thai: string; han_muc: number | null; tien_te: string }>('tài khoản QC shop', sql`SELECT ten, trang_thai, han_muc::float AS han_muc, coalesce(tien_te, 'USD') AS tien_te FROM shop_qc_tk`)]);
  // Gumroad: product_daily.product_id = mã Gumroad = products.sku → nguồn theo nơi khách tới (refs)
  const theoSku = new Map((sp?.rows ?? []).filter((p) => p.sku).map((p) => [p.sku!, p.id]));
  const nguonGum = refs.flatMap((r) => { const id = theoSku.get(r.product_id); return id && r.refs ? Object.entries(r.refs).map(([nguon, n]) => ({ sp: id, nguon, hien: 0, xem: Number(n) || 0, tai: 0 })) : []; });
  const ngayHomEtp = etp?.ngayCamp.reduce((m: string | null, x) => (m == null || x.ngay > m ? x.ngay : m), null) ?? null;   // ngày báo cáo mới nhất của Ethopex
  return {
    duAn: da.map((x) => ({ id: x.id, ten: x.name, site: siteOf(x.website), ngung: x.ngung, ria: x.ria })),
    duAnSite: ds.map((x) => ({ site: x.site, duAn: x.project_id })),
    sanPham: (sp?.rows ?? []).map((p) => ({ id: p.id, ten: p.title, nen: p.platform, trangThai: p.status, url: p.url, store: p.store, sku: p.sku, xem7: p.views7d, tai: p.downloads, net: p.net })),
    nguonSp: [...nguonApp, ...nguonGum],
    linhVuc: lv.map((x) => ({ khoa: x.khoa, linhVuc: x.linh_vuc })),
    tienSite: donShop.map((x) => ({ site: x.site.replace(/^www\./, ''), usd: Number(x.usd) || 0 })),
    app: app.map((x) => ({ ten: x.ten, duAn: x.project_id })),
    tkCua: [...tk.map((x) => ({ nen: x.platform_key, handle: x.handle, duAn: x.project_id, khoa: x.khoa })), ...phuPf.map((x) => ({ nen: x.slug, handle: x.slug, duAn: x.project_id, khoa: false }))],
    tienAds: ads.map((x) => ({ site: x.site, usd: Number(x.usd) || 0 })),
    hat: hat.map((x) => ({ kind: x.kind, label: x.label, duAn: x.project_id, het: x.het ? x.het.slice(0, 10) : null, ip: x.ip ?? (x.origin?.match(/\d+\.\d+\.\d+\.\d+/)?.[0] ?? null), chi: Number(x.chi) || 0, tien: x.currency })),
    mayChu,
    congTy,
    // camp Ethopex: thu / chi 30 ngày cộng từ báo cáo ngày × camp (cùng cửa sổ tu30 với tiền Ethopex ở Kho bạc)
    // + chấm luật Ethopex (cùng chamLuat của tab Ethopex) cho cụm phim city #1439: NB = dấu nhân bản, OFF chạm / gần = bốc khói, TC = vi phạm
    // + thu / chi NGÀY BÁO CÁO MỚI NHẤT (bảng hiệu phim city, cùng số với bảng Content của Ethopex)
    // + loại camp (loaiCampEtp): chờ public = đã dựng chưa tiêu đồng nào; dừng ad set mà hôm nay vẫn tiêu = chạy (Ethopex đồng bộ trạng thái chậm); chỉ tiêu ngày trước = tắt
    camps: etp ? etp.camps.map((c) => { const ng = etp.ngayCamp.filter((x) => x.camp === c.id && x.ngay >= tu30), hn = ng.filter((x) => x.ngay === ngayHomEtp);
      const loai = loaiCampEtp({ trangThai: c.trang_thai, giao: c.giao, batDau: c.bat_dau, daTieu: etp.ngayCamp.some((x) => x.camp === c.id && x.chi > 0), tieuHom: hn.some((x) => x.chi > 0) });
      const lu = chamLuat(c, { soCampPhim: etp.camps.filter((y) => y.content_id && y.content_id === c.content_id && y.trang_thai === 'ACTIVE').length, phimThang: !!c.content_id && etp.phimThang.includes(c.content_id) });
      const co = (ma: string, ...tt: string[]) => lu.some((x) => x.ma === ma && tt.includes(x.trang_thai));
      return { id: c.id, ten: c.ten, bo: c.bo ?? null, boTen: c.bo_ten ?? null, phim: c.phim, ngonNgu: c.ngon_ngu, trangThai: loai === 'tat' ? 'paused' : 'active', thu30: ng.reduce((a, x) => a + x.thu, 0), chi30: ng.reduce((a, x) => a + x.chi, 0), nganSachNgay: c.ngan_sach,
        phimId: c.content_id, dang: dangCamp(c), viPham: co('TC', 'cham'), cho: loai === 'cho', nhanBanDuoc: co('NB', 'cham'), sapTat: loai === 'chay' && co('OFF', 'cham', 'gan'),
        thuHom: hn.reduce((a, x) => a + x.thu, 0), chiHom: hn.reduce((a, x) => a + x.chi, 0), ngayHom: ngayHomEtp, ngay: ng.map((x) => ({ ngay: x.ngay, thu: x.thu, chi: x.chi })) }; }) : [],
    taiNguyen: { tk: tnTk, canhBao: tnCb.map((x) => ({ nen: x.nen ?? 'khac', loai: x.loai, n: x.n })), canhBaoDs: tnDs.map((x) => ({ id: x.id, nen: x.nen, handle: x.handle, loai: x.loai, noiDung: x.noi_dung, url: x.url, luc: x.luc, acct: x.acct })), hoSo: tnHs, proxy: tnPx,
      soNganSach: tnNs.map((x) => ({ ten: x.ten, kieu: x.chu_ky ? 'định kỳ' : 'một lần', so: Number(x.so) || 0, tienTe: x.tien_te, chuKy: x.chu_ky })), tkQcShop: tnQc.map((x) => ({ ten: x.ten, trangThai: x.trang_thai, hanMuc: x.han_muc, tienTe: x.tien_te })), soDu: soDuTn },
    chi: [...chi.map((x) => ({ nguon: x.nguon, duAn: x.project_id, usd: Number(x.usd) || 0 })),
      ...(etp ? [{ nguon: 'Meta Ads (Ethopex)', duAn: 'ethopex', usd: etp.theoNgay.filter((x) => x.ngay >= tu30).reduce((a, x) => a + x.chi, 0) }] : [])],
    tienAff: [...(aff?.rows ?? []).filter((r) => r.source === 'affiliate' && r.date >= tu30).map((r) => ({ site: r.site ? r.site.replace(/^www\./, '') : null, mang: r.group ?? r.channel, usd: r.amount })),
      ...(etp ? [{ site: null, mang: 'Ethopex', duAn: 'ethopex', usd: etp.theoNgay.filter((x) => x.ngay >= tu30).reduce((a, x) => a + x.thu, 0) }] : [])],
  };
}
/** CÔNG TY AI (thành phố › khu văn phòng): phòng ban đọc từ sổ cty (apps/cty/cong-ty/phong/*.md, cùng repo trên máy chủ) + việc nền 24 giờ của trưởng phòng
 *  (/var/lib/cty/nhip/<người>.jsonl: {luc, viec, ket}). Máy không có cty (máy dev) → rỗng. Nhớ 2 phút. */
const docCongTy = unstable_cache(async () => {
  const { readdirSync, readFileSync: doc, existsSync: co } = await import('node:fs');
  const goc = `${process.cwd().replace(/\/apps\/web$/, '')}/apps/cty/cong-ty/phong`, nhip = `${process.env.CTY_DATA_DIR || '/var/lib/cty'}/nhip`;
  if (!co(goc)) return [];
  const chuanTen = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z]/g, '');
  const tu = Date.now() - 864e5;
  return readdirSync(goc).filter((f) => f.endsWith('.md')).map((f) => {
    const t = doc(`${goc}/${f}`, 'utf8'), fm = (k: string) => new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(t.split('---')[1] ?? '')?.[1]?.trim() ?? '';
    const truong = fm('truong'), nguoi = chuanTen(truong.split(/[\s(·,]/)[0] ?? ''), tep = `${nhip}/${nguoi}.jsonl`;
    const viec = co(tep) ? doc(tep, 'utf8').trim().split('\n').slice(-5000).flatMap((l) => { try { return [JSON.parse(l) as { luc: string; viec: string; ket?: string }]; } catch { return []; } }) : [];
    const gan = viec.filter((v) => Date.parse(v.luc) > tu);
    return { khoa: f.replace(/\.md$/, ''), ten: fm('ten'), truong, duAn: (fm('du_an').match(/[\w-]+/g) ?? []), hoatDong: !/chưa hoạt động/.test(fm('trang_thai')) && fm('trang_thai') !== '',
      trangThai: fm('trang_thai'), viec24: gan.length, cuoi: viec.at(-1) ?? null };
  });
}, ['tp-cong-ty-v1'], { revalidate: 120 });
/** MÁY CHỦ (thành phố › nhà máy điện): mỗi máy tự kê site nó phục vụ (server_name trong nginx) + tải CPU / RAM / đĩa. Máy chạy mos2 đọc tại chỗ,
 *  máy khác qua ssh (box3 có khoá). Nhớ 15 phút. Thêm máy = thêm một dòng ở đây; máy không ssh được (box2) chỉ hiện theo sổ hạ tầng. */
const MAY_CHU: { ten: string; ip: string; ssh: string | null }[] = [
  { ten: 'box3 · mos2', ip: '167.233.241.16', ssh: null }, { ten: 'box1 · as.on.tc', ip: '5.78.65.158', ssh: 'root@5.78.65.158' }, { ten: 'VPS may-cao-vn', ip: '116.118.28.214', ssh: 'root@116.118.28.214' },
];
// tầng ngầm (anh 23/10/2026): thêm số việc chạy theo giờ (systemd timer) + dịch vụ đang lỗi (systemctl --failed) — dòng HEN: / LOI: ở cuối
const LENH_MAY = `cat /proc/loadavg | cut -d' ' -f1; nproc; free -m | awk '/Mem:/{print $7}'; df -P / | awk 'NR==2{print $5}'; grep -hs 'server_name' /etc/nginx/sites-enabled/* | sed 's/#.*//' | tr ';' '\n' | grep server_name | sed 's/server_name//'; echo "HEN:$(systemctl list-timers --all --no-legend 2>/dev/null | wc -l)"; echo "LOI:$(systemctl --failed --no-legend --plain 2>/dev/null | awk '{print $1}' | paste -sd, -)"`;
const docMayChu = unstable_cache(async () => {
  const { execFile } = await import('node:child_process'), { promisify } = await import('node:util'), chay = promisify(execFile);
  return Promise.all(MAY_CHU.map(async (m) => {
    try {
      const { stdout } = m.ssh ? await chay('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', m.ssh, LENH_MAY], { timeout: 12000 }) : await chay('bash', ['-c', LENH_MAY], { timeout: 8000 });
      const dong = stdout.split('\n'), hen = dong.find((l) => l.startsWith('HEN:')), loiDv = dong.find((l) => l.startsWith('LOI:'));
      const [tai, nhan, ram, dia, ...ten] = dong.filter((l) => !/^(HEN|LOI):/.test(l));
      const sites = [...new Set(ten.join(' ').split(/\s+/).map((h) => h.trim().replace(/^www\./, '')).filter((h) => /\.[a-z]{2,}$/.test(h) && !h.endsWith('.on.tc') && h !== '_'))];
      return { ...m, tai: Number(tai) || 0, nhan: Number(nhan) || 1, ramMB: Number(ram) || 0, diaPct: parseInt(dia ?? '', 10) || 0, sites, loi: null as string | null,
        henGio: hen ? Number(hen.slice(4)) || 0 : null, loiDv: loiDv ? loiDv.slice(4).split(',').filter(Boolean) : [] };
    } catch (e) { return { ...m, tai: null, nhan: null, ramMB: null, diaPct: null, sites: [] as string[], loi: (e as Error).message.slice(0, 80), henGio: null as number | null, loiDv: [] as string[] }; }
  }));
}, ['tp-may-chu-v2'], { revalidate: 900 });
/** NGUỒN APP (Apple Analytics, scripts/app-store-so.mjs ghi Directus product_stats.raw_data.chiTiet): 30 ngày, mỗi app × nguồn → hiển thị / xem trang / tải lần đầu. */
async function docNguonApp(): Promise<{ sp: string; nguon: string; hien: number; xem: number; tai: number }[]> {
  const url = process.env.DIRECTUS_URL || 'https://as.on.tc', token = process.env.DIRECTUS_TOKEN; if (!token) return [];
  const tu = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const r = await fetch(`${url}/items/product_stats?limit=-1&fields=product_id,raw_data&filter[platform][_eq]=app-store&filter[date][_gte]=${tu}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), next: { revalidate: 600 } });
  if (!r.ok) throw new Error(`Directus ${r.status}`);
  const ra: { sp: string; nguon: string; hien: number; xem: number; tai: number }[] = [];
  for (const x of ((await r.json()) as { data: { product_id: string | null; raw_data: { chiTiet?: { n?: number; su?: string; nguon?: string }[] } | null }[] }).data)
    for (const c of x.raw_data?.chiTiet ?? []) if (x.product_id && c.nguon) ra.push({ sp: x.product_id, nguon: c.nguon, hien: c.su === 'Impression' ? c.n ?? 0 : 0, xem: c.su === 'Page view' ? c.n ?? 0 : 0, tai: c.su === 'First-time download' ? c.n ?? 0 : 0 });
  return ra;
}
/** FAVICON SITE ĐÍCH (thành phố Social): Google s2 cỡ 128 → data URI, nhớ 1 ngày mỗi site. Site không có favicon riêng thì s2 trả quả địa cầu
 *  16×16 → null (thành phố vẽ chữ cái đầu). Lỗi mạng / quá 3 giây → null, không chặn trang. */
const favMot = (site: string) => unstable_cache(async (): Promise<string | null> => {
  const r = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=128`, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) return null;
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length < 24 || b.readUInt32BE(16) < 32) return null;   // IHDR: rộng ở byte 16
  return `data:${r.headers.get('content-type') ?? 'image/png'};base64,${b.toString('base64')}`;
}, ['social-fav-v1', site], { revalidate: 86400 })();
async function docFav(site: string[]): Promise<Record<string, string | null>> {
  return Object.fromEntries(await Promise.all(site.map(async (s) => [s, await favMot(s).catch(() => null)] as const)));
}
/** Góc thật từ spy: danh sách nhóm rồi từng nhóm (SONG_SONG lượt cùng lúc), xếp chung theo Sức mạnh. */
/** GÓC SPY KHÔNG CHẶN TRANG (anh 21/10/2026: "tab social treo rồi" — bộ nhớ đệm 5 phút hết / vừa deploy thì trang đứng chờ spy 65–150 giây).
 *  Đợi spy tối đa CHO_GOC_MS; quá thì trả bản góc gần nhất lưu trên đĩa (sống qua deploy / khởi động lại), spy nạp tiếp ở nền rồi ghi bản mới. */
const CHO_GOC_MS = 3000, TEP_GOC = `${process.env.MOS2_DATA_DIR || '/var/lib/mos2'}/social-goc.json`;
let dangNapGoc: Promise<{ goc: StGoc[]; nhom: number }> | null = null;
async function docGocSpy(loi: string[]): Promise<{ goc: StGoc[]; nhom: number }> {
  const loiNen: string[] = [];
  dangNapGoc ??= napGocSpy(loiNen).then((r) => {
    if (r.goc.length) try { mkdirSync(dirname(TEP_GOC), { recursive: true }); writeFileSync(TEP_GOC, JSON.stringify({ luc: new Date().toISOString(), ...r })); } catch { /* ghi đĩa hỏng: lần sau vẫn đọc spy */ }
    return r;
  }).finally(() => { dangNapGoc = null; });
  // có bản lưu thì chỉ chờ spy 0,8 giây (đổi lấy bản mới nhất không đáng bắt anh chờ); chưa có thì chờ CHO_GOC_MS
  const het = new Promise<null>((xong) => setTimeout(() => xong(null), existsSync(TEP_GOC) ? 800 : CHO_GOC_MS));
  const r = await Promise.race([dangNapGoc, het]);
  if (r) { loi.push(...loiNen); return r; }
  try { const c = JSON.parse(readFileSync(TEP_GOC, 'utf8')) as { luc: string; goc: StGoc[]; nhom: number }; loi.push(`spy chậm — đang hiện góc lưu lúc ${new Date(Date.parse(c.luc) + 7 * 3600e3).toISOString().slice(11, 16)} ${c.luc.slice(8, 10)}/${c.luc.slice(5, 7)}, bản mới nạp ở nền`); return { goc: c.goc, nhom: c.nhom }; }
  catch { loi.push('spy chậm, chưa có bản góc lưu — góc nạp ở nền, mở lại sau ít phút'); return { goc: [], nhom: 0 }; }
}
async function napGocSpy(loi: string[]): Promise<{ goc: StGoc[]; nhom: number }> {
  let nhom: SpNhom[];
  try { nhom = await docDanhSach(); }
  catch (e) { loi.push(`không đọc được danh sách nhóm của spy: ${(e as Error).message}`); return { goc: [], nhom: 0 }; }
  const ra: StGoc[][] = new Array(nhom.length);
  let tiep = 0;
  await Promise.all(Array.from({ length: Math.min(SONG_SONG, nhom.length) }, async () => {
    while (tiep < nhom.length) {
      const i = tiep++, s = nhom[i]!;
      try { ra[i] = await docNhom(s.id, s.ten); } catch (e) { loi.push(`nhóm #${s.id} ${s.ten}: ${(e as Error).message}`); ra[i] = []; }
    }
  }));
  // xếp chung mọi nhóm theo Sức mạnh (spy chấm trong từng nhóm, 0–100 cùng thang) — góc mạnh nhất toàn kho lên đầu
  return { goc: ra.flat().sort((a, b) => (b.suc ?? -1) - (a.suc ?? -1)), nhom: nhom.length };
}

/* LANDING: trang đích = link mà video của các máy (xv_may_video.dang.link) và kênh (kenh_sp.dich) trỏ tới — thêm máy / kênh mới là trang tự hiện,
   không khai tay. Số phiên đọc sổ phiên khách adfond (page-events.js trên site: trang VÀO, nguồn, cuộn, bấm sang shop). */
async function docKenhThatVaLanding(loi: string[]) {
  const k = await docKenhThat(loi);
  return { ...k, landing: await docLanding(k.trang, loi) };
}
/** TRANG ĐÍCH của Social = MỘT danh sách cho mọi chỗ (bảng Landing, Trực tiếp, badge online): link trong video của các MÁY studio
 *  (xv_may_video.dang.link) + link đích của kênh (kenh_sp.dich). Trước 18/10 badge Trực tiếp chỉ lấy kenh_sp → bảng Landing thấy khách
 *  trên ratesbyroom.com mà badge ghi 0 (anh: "sao ko khớp?"). Thêm nguồn trang đích thì thêm Ở ĐÂY. */
export async function dsTrangDich(kenhLink: { url: string; nguon: string }[]): Promise<{ site: string; path: string; nguon: string[]; soVideo: number }[]> {
  const d = getDb(); if (!d) return [];
  const may = (await d.execute(sql`SELECT v.dang->>'link' AS link, m.ten, count(*)::int AS so FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id
    WHERE NOT v.luu_tru AND coalesce(v.dang->>'link', '') <> '' GROUP BY 1, 2`)) as unknown as { link: string; ten: string; so: number }[];
  const theo = new Map<string, { nguon: string[]; soVideo: number }>();
  const them = (url: string, nguon: string, so = 0) => { try { const u = new URL(url); const key = `${u.host.replace(/^www\./, '')}${u.pathname}`; const x = theo.get(key) ?? { nguon: [], soVideo: 0 }; if (!x.nguon.includes(nguon)) x.nguon.push(nguon); x.soVideo += so; theo.set(key, x); } catch { /* link hỏng */ } };
  for (const r of may) them(r.link, `máy ${r.ten}`, r.so);
  for (const k of kenhLink) them(k.url.startsWith('http') ? k.url : `https://${k.url}`, k.nguon);
  return [...theo].map(([key, x]) => { const i = key.indexOf('/'); return { site: key.slice(0, i), path: key.slice(i) || '/', ...x }; });
}

async function docLanding(trang: StTrang[], loi: string[]): Promise<StLanding[]> {
  try {
    const ds = await dsTrangDich(trang.map((t) => ({ url: t.slug, nguon: t.kenhTen ? `kênh ${t.kenhTen}` : 'kênh' })));
    let so = new Map(), coMa = new Set<string>(); try { [so, coMa] = await Promise.all([docSoLanding(ds), siteCoMa([...new Set(ds.map((x) => x.site))])]); } catch (e) { loi.push(`số landing (adfond): ${(e as Error).message}`); }
    return ds.map((x): StLanding => { const s = so.get(`${x.site}${x.path}`) ?? { phien7: 0, khach7: 0, doc50: 0, bamRa: 0, phien30: 0, online: 0, nguonKhach: [], cuoi: null };
      return { url: `https://${x.site}${x.path}`, site: x.site, path: x.path, nguon: x.nguon.join(' · '), soVideo: x.soVideo, ...s, coMa: coMa.has(x.site) }; })
      .sort((a, b) => b.phien7 - a.phien7 || b.soVideo - a.soVideo);
  } catch (e) { loi.push(`landing: ${(e as Error).message}`); return []; }
}

/* HÀNG ĐỢI SẢN XUẤT (LIVE): video thật của các MÁY trên studio.on.tc (xv_may / xv_may_video, cùng DB mos2_prod — từ 17/10/2026 video máy không còn
   là phim). Chưa dựng → Dựng · đã dựng mà còn nền chưa đăng → Lên lịch · đăng đủ mọi nền của máy → rời hàng đợi (sổ đăng xv_may_video.da_dang).
   Máy dựng bằng máy nên không qua Kịch bản / Kiểm. Video lưu trữ (video cũ, không dựng / không đăng nữa) không vào hàng đợi. */
/* Video KẾ của một nền = cùng luật puzzle-books dang-may.mjs › chonVideo (id tăng, đã dựng, chưa lưu trữ, chưa đăng lên nền này; nền ảnh x_anh / fb_anh
   cần ảnh tĩnh). Hai nơi chạy hai runtime (máy Mac đăng · mos2 hiện) nên luật chép ở đây — đổi luật bên đó thì đổi cả chỗ này. */
const NEN_ANH_LICH = ['x_anh', 'fb_anh'];
const NEN_LINK_LICH = ['x_link', 'fb_link'];   // bài link (S03 bước 4): dòng studio dang.loai 'link', không video
/** Lượt dang-may --het của từng máy Mac trong sổ việc nền cty (apps/cty/cong-ty/viec-nen.json) → { iMac: ['20:00', '21:00'] }. Thiếu tệp = {} (bảng báo không có lượt). */
function luotMayDang(): Record<string, string[]> {
  for (const f of [`${process.cwd()}/apps/cty/cong-ty/viec-nen.json`, `${process.cwd()}/../cty/cong-ty/viec-nen.json`, '/opt/earns-marketing-os-v2/apps/cty/cong-ty/viec-nen.json']) {
    try {
      const so = JSON.parse(readFileSync(f, 'utf8')) as { viec?: { nhan: string; chay?: string[]; hen?: { luc?: string[] } }[] } | { nhan: string; chay?: string[]; hen?: { luc?: string[] } }[];
      const ds = Array.isArray(so) ? so : so.viec ?? [];
      const ra: Record<string, string[]> = {};
      for (const v of ds) if ((v.chay ?? []).some((c) => c.endsWith('dang-may.mjs')) && (v.chay ?? []).includes('--het')) ra[v.nhan.split(':')[0]!] = v.hen?.luc ?? [];
      return ra;
    } catch { /* thử đường kế */ }
  }
  return {};
}
/** Lưới lịch: bài đã đăng 3 ngày qua (giờ thật) + bài dự kiến từ hôm nay (lượt chưa tới giờ). */
/** Sức khoẻ đăng (đầu tab Tổng quan): nơi đăng của máy đang chạy · bài 5 ngày · lỗi đăng 7 ngày · cảnh báo rủi ro 7 ngày · lịch dự kiến. Tính ở social-suc-khoe.ts. */
async function docSucKhoe(loi: string[]): Promise<StSucKhoe> {
  const rong = tinhSucKhoe({ bay: Date.now(), noi: [], da: [], hong: [], canhBao: [], lich: [] });
  const d = getDb(); if (!d) return rong;
  type R = Record<string, string | null>;
  try {
    const [noi, da, hong, cb, lich] = await Promise.all([
      d.execute(sql`SELECT m.ma AS may, m.ten AS may_ten, n->>'nen' AS nen, coalesce(n->>'ten', n->>'nen') AS nen_ten, coalesce(n->>'tk', '') AS tk,
          coalesce(n->>'gio', '') AS gio, coalesce(n->>'may', '') AS may_mac, n->'br'->>'acct' AS acct,
          (SELECT regexp_replace(split_part(split_part(v.dang->>'link', '//', 2), '/', 1), '^www\.', '') FROM xv_may_video v WHERE v.may_id = m.id AND coalesce(v.dang->>'link', '') <> ''
            GROUP BY 1 ORDER BY count(*) DESC LIMIT 1) AS site,
          (SELECT string_agg(DISTINCT regexp_replace(split_part(split_part(v.dang->>'link', '//', 2), '/', 1), '^www\.', ''), ' ') FROM xv_may_video v WHERE v.may_id = m.id AND coalesce(v.dang->>'link', '') <> '') AS sites
        FROM xv_may m CROSS JOIN LATERAL jsonb_array_elements(m.dang) n WHERE m.chay ORDER BY m.id, n->>'nen'`) as unknown as Promise<R[]>,
      d.execute(sql`SELECT m.ma AS may, e.key AS nen, e.value->>'ngay' AS ngay, e.value->>'luc' AS luc, e.value->>'url' AS url
        FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id CROSS JOIN LATERAL jsonb_each(coalesce(v.da_dang, '{}'::jsonb)) e
        WHERE m.chay AND e.value->>'ngay' >= to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 30, 'YYYY-MM-DD')`) as unknown as Promise<R[]>,
      d.execute(sql`SELECT m.ma AS may, k.nen, k.luc::text AS luc, k.noi_dung AS chu FROM xv_may_nhat_ky k JOIN xv_may m ON m.id = k.may_id
        WHERE m.chay AND NOT k.ok AND k.buoc = 'dang' AND k.nen IS NOT NULL AND k.luc > now() - interval '7 days'`) as unknown as Promise<R[]>,
      d.execute(sql`SELECT account_id::text AS acct, loai, luc::text AS luc, noi_dung AS chu, nguon FROM platform_alerts WHERE account_id IS NOT NULL AND xong_luc IS NULL AND luc > now() - interval '7 days'`) as unknown as Promise<R[]>,
      d.execute(sql`SELECT ds FROM xv_lich_du_kien WHERE id = 1`) as unknown as Promise<{ ds: { may: string; nen: string; ngay: string; gio: string }[] }[]>,
    ]);
    const vao: VaoSuc = {
      bay: Date.now(),
      noi: noi.map((x) => ({ may: String(x.may), mayTen: String(x.may_ten), nen: String(x.nen), nenTen: String(x.nen_ten), tk: String(x.tk), gio: String(x.gio), mayMac: String(x.may_mac), acct: x.acct ?? null, site: x.site ?? null, sites: x.sites ? x.sites.split(' ') : [] })),
      da: da.map((x) => ({ may: String(x.may), nen: String(x.nen), ngay: String(x.ngay), luc: x.luc ?? null, url: x.url ?? null })),
      hong: hong.map((x) => ({ may: String(x.may), nen: String(x.nen), luc: new Date(String(x.luc)).toISOString(), chu: String(x.chu) })),
      canhBao: cb.map((x) => ({ acct: String(x.acct), loai: String(x.loai), luc: new Date(String(x.luc)).toISOString(), chu: String(x.chu), nguon: String(x.nguon ?? '') })),
      lich: (lich[0]?.ds ?? []).map((x) => ({ may: x.may, nen: x.nen, ngay: x.ngay, gio: x.gio })),
    };
    return tinhSucKhoe(vao);
  } catch (e) { loi.push(`sức khoẻ đăng: ${(e as Error).message}`); return rong; }
}
async function docLuoi(loi: string[]): Promise<StLuoi> {
  const hom = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), rong: StLuoi = { hom, tinhLuc: null, o: [], kho: [] };
  const d = getDb(); if (!d) return rong;
  try {
    const [da, dk] = await Promise.all([
      d.execute(sql`SELECT m.ma, m.ten AS may_ten, e.key AS nen, e.value->>'ngay' AS ngay, e.value->>'luc' AS luc, e.value->>'url' AS url, coalesce(v.dang->>'title', v.chu_de) AS title
        FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id CROSS JOIN LATERAL jsonb_each(v.da_dang) e
        WHERE e.value->>'ngay' >= to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 42, 'YYYY-MM-DD')`) as unknown as Promise<Record<string, string | null>[]>,   // 6 tuần: đủ cho lịch tháng / tuần (anh 22/10/2026)
      d.execute(sql`SELECT luc::text AS luc, ds FROM xv_lich_du_kien WHERE id = 1`) as unknown as Promise<{ luc: string; ds: { ngay: string; gio: string; may: string; mayTen?: string; nen: string; title: string; format?: string; nhom?: string | null }[] }[]>,
    ]);
    // kho + đã đăng theo máy × nền × kiểu nội dung (dang.nhom); cùng điều kiện "DUYỆT đúng bản" như máy đăng (may.ts › dsVideoDang) và nền ảnh cần ảnh tĩnh
    const kr = (await d.execute(sql`SELECT m.ma, m.ten, n->>'nen' AS nen, coalesce(v.dang->>'nhom', '—') AS nhom,
        count(*) FILTER (WHERE v.da_dang ? (n->>'nen'))::int AS da,
        count(*) FILTER (WHERE NOT v.da_dang ? (n->>'nen') AND NOT coalesce(v.luu_tru, false)
          AND ((n->>'nen') = ANY(${sql.raw(`ARRAY['${NEN_LINK_LICH.join("','")}']`)})) = (coalesce(v.dang->>'loai', '') = 'link')
          AND (v.video_url IS NOT NULL OR (n->>'nen') = ANY(${sql.raw(`ARRAY['${NEN_LINK_LICH.join("','")}']`)}))
          AND v.cham->>'ket' = 'DUYET' AND v.cham->>'xuat' = v.xuat_luc::text AND v.cham->>'dang' = md5(v.dang::text)
          AND (NOT (n->>'nen') = ANY(${sql.raw(`ARRAY['${NEN_ANH_LICH.join("','")}']`)}) OR jsonb_array_length(coalesce(v.anh, '[]'::jsonb)) > 0))::int AS kho
      FROM xv_may m CROSS JOIN LATERAL jsonb_array_elements(m.dang) n JOIN xv_may_video v ON v.may_id = m.id WHERE m.chay GROUP BY 1, 2, 3, 4`)) as unknown as { ma: string; ten: string; nen: string; nhom: string; da: number; kho: number }[];
    const ds = dk[0]?.ds ?? [], fmt = (nen: string) => (NEN_LINK_LICH.includes(nen) ? 'Bài link' : NEN_ANH_LICH.includes(nen) ? 'Bài 2 ảnh' : 'Video ngắn');
    const gom = new Map<string, StKho>();
    for (const x of kr) for (const [chieu, nhan] of [['format', fmt(x.nen)], ['kieu', x.nhom]] as const) {
      const k = `${x.ma}|${chieu}|${nhan}`, g = gom.get(k) ?? { may: x.ma, mayTen: x.ten, chieu, nhan, da: 0, kho: 0, den: null }; g.da += x.da; g.kho += x.kho; gom.set(k, g);
    }
    for (const x of ds) for (const [chieu, nhan] of [['format', x.format ?? fmt(x.nen)], ['kieu', x.nhom ?? '—']] as const) {
      const g = gom.get(`${x.may}|${chieu}|${nhan}`); if (g && (!g.den || x.ngay > g.den)) g.den = x.ngay;
    }
    // giờ VN của lượt đăng thật: luc (ISO, UTC) + 7 giờ; sổ cũ không có luc thì không có giờ → xếp vào '—'
    const gioVn = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(11, 16) : '—');
    const o: StLuoiO[] = da.map((x) => ({ ngay: String(x.ngay), gio: gioVn(x.luc ?? null), may: String(x.ma), mayTen: String(x.may_ten), nen: String(x.nen), title: String(x.title ?? ''), url: x.url ?? null, loai: 'da' as const }));
    const bayVn = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
    const cuoiLuoi = new Date(Date.parse(`${hom}T00:00:00Z`) + 42 * 864e5).toISOString().slice(0, 10);   // 6 tuần tới cho lịch tháng / tuần (lưới giờ tự lọc 10 ngày); lịch 90 ngày còn lại chỉ dùng cho thống kê kho
    for (const x of dk[0]?.ds ?? []) if (`${x.ngay} ${x.gio}` > bayVn && x.ngay <= cuoiLuoi) o.push({ ngay: x.ngay, gio: x.gio, may: x.may, mayTen: x.mayTen ?? x.may, nen: x.nen, title: x.title, url: null, loai: 'du_kien' });
    return { hom, tinhLuc: dk[0]?.luc ?? null, o, kho: [...gom.values()].filter((g) => g.da || g.kho).sort((a, b) => a.mayTen.localeCompare(b.mayTen) || a.chieu.localeCompare(b.chieu) || b.kho - a.kho) };
  } catch (e) { loi.push(`lưới lịch: ${(e as Error).message}`); return rong; }
}
async function docLich(loi: string[]): Promise<StLich[]> {
  const d = getDb(); if (!d) return [];
  try {
    const hom = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);   // ngày theo giờ Việt Nam — sổ đăng ghi 'ngay' theo giờ VN
    const r = (await d.execute(sql`SELECT m.ma, m.ten AS may, m.chay, n->>'nen' AS nen, coalesce(n->>'ten', n->>'nen') AS nen_ten, coalesce(n->>'tk', '') AS tk,
        coalesce(n->>'gio', '') AS gio, coalesce(n->>'may', '') AS may_mac, coalesce((n->>'tran')::int, 1) AS tran,
        (SELECT count(*)::int FROM xv_may_video v WHERE v.may_id = m.id AND v.da_dang->(n->>'nen')->>'ngay' = ${hom}) AS hom_nay,
        (SELECT v.da_dang->(n->>'nen')->>'url' FROM xv_may_video v WHERE v.may_id = m.id AND v.da_dang->(n->>'nen')->>'ngay' = ${hom} ORDER BY v.da_dang->(n->>'nen')->>'luc' DESC NULLS LAST LIMIT 1) AS hom_nay_url,
        (SELECT v.da_dang->(n->>'nen')->>'luc' FROM xv_may_video v WHERE v.may_id = m.id AND v.da_dang ? (n->>'nen') ORDER BY v.da_dang->(n->>'nen')->>'luc' DESC NULLS LAST LIMIT 1) AS cuoi_luc,
        (SELECT v.da_dang->(n->>'nen')->>'url' FROM xv_may_video v WHERE v.may_id = m.id AND v.da_dang ? (n->>'nen') ORDER BY v.da_dang->(n->>'nen')->>'luc' DESC NULLS LAST LIMIT 1) AS cuoi_url,
        (SELECT count(*)::int FROM xv_may_video v WHERE v.may_id = m.id AND v.da_dang ? (n->>'nen')) AS da_dang,
        (SELECT count(*)::int FROM xv_may_video v WHERE v.may_id = m.id AND v.video_url IS NOT NULL AND NOT v.luu_tru AND NOT v.da_dang ? (n->>'nen')
           AND (NOT (n->>'nen') = ANY(${sql.raw(`ARRAY['${NEN_ANH_LICH.join("','")}']`)}) OR jsonb_array_length(v.anh) > 0)) AS con_cho,
        (SELECT coalesce(v.dang->>'title', v.chu_de) FROM xv_may_video v WHERE v.may_id = m.id AND v.video_url IS NOT NULL AND NOT v.luu_tru AND NOT v.da_dang ? (n->>'nen')
           AND (NOT (n->>'nen') = ANY(${sql.raw(`ARRAY['${NEN_ANH_LICH.join("','")}']`)}) OR jsonb_array_length(v.anh) > 0) ORDER BY v.id LIMIT 1) AS ke
      FROM xv_may m CROSS JOIN LATERAL jsonb_array_elements(m.dang) n
      ORDER BY m.chay DESC, n->>'gio', m.id, n->>'nen'`)) as unknown as Record<string, unknown>[];
    const luot = luotMayDang();
    return r.map((x): StLich => ({
      may: String(x.may), mayMa: String(x.ma), chay: !!x.chay, nen: String(x.nen), nenTen: String(x.nen_ten), tk: String(x.tk), gio: String(x.gio), mayMac: String(x.may_mac),
      tran: Number(x.tran), homNay: Number(x.hom_nay), homNayUrl: (x.hom_nay_url as string | null) ?? null, cuoiLuc: (x.cuoi_luc as string | null) ?? null,
      cuoiUrl: (x.cuoi_url as string | null) ?? null, daDang: Number(x.da_dang), conCho: Number(x.con_cho), ke: (x.ke as string | null) ?? null,
      luot: String(x.ma) === 'front-porch-only-one' ? [String(x.gio)] : luot[String(x.may_mac)] ?? [],   // Front Porch đăng bằng lượt riêng (dang-short), không qua dang-may
    }));
  } catch (e) { loi.push(`lịch đăng: ${(e as Error).message}`); return []; }
}

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
const NEN_TEN: Record<string, string> = { youtube: 'YouTube Shorts', facebook: 'Facebook Reels', instagram: 'Instagram Reels', x: 'X', twitter: 'X', tiktok: 'TikTok', pinterest: 'Pinterest', threads: 'Threads', quora: 'Quora', dailymotion: 'Dailymotion' };
async function docKenhVault(d: NonNullable<ReturnType<typeof getDb>>, daCo: Set<number>, homMs: number): Promise<StKenh[]> {
  const r = (await d.execute(sql`SELECT a.id, a.platform_key, a.handle, a.status, coalesce(a.proxy_id, bp.default_proxy_id) AS proxy_id, a.created_at::date::text AS tao, coalesce(p.name, a.project_id) AS du_an,
      may.ten AS may, may.da_dang
    FROM platform_accounts a LEFT JOIN projects p ON p.id = a.project_id
    -- proxy: của tài khoản, không có thì của profile trình duyệt chứa nó (profile đi trọn qua proxy, vd beforeyouland → #4)
    LEFT JOIN browser_profiles bp ON bp.id = a.browser_profile_id
    -- MỌI nền máy dùng tài khoản này cộng lại (một tài khoản X có cả nền x — video — và x_anh — bài ảnh; LIMIT 1 trước đây đếm thiếu bài ảnh)
    LEFT JOIN LATERAL (SELECT string_agg(DISTINCT m.ten, ' · ') AS ten, sum((SELECT count(*) FROM xv_may_video v WHERE v.may_id = m.id AND v.da_dang ? (n->>'nen')))::int AS da_dang
      FROM xv_may m CROSS JOIN LATERAL jsonb_array_elements(m.dang) n WHERE n->'br'->>'acct' = a.id::text) may ON true
    WHERE a.project_id IS NOT NULL AND a.platform_key IN (${sql.join([...MXH, 'quora', 'dailymotion'].map((x) => sql`${x}`), sql`, `)})
      AND coalesce(a.status, '') NOT IN ('closed', 'banned')
      -- Facebook: kênh là PAGE (vault ghi "(Page)"); tài khoản FB cá nhân chỉ để đăng nhập (htuan82@, mixseo@…) không phải kênh — trừ khi máy đăng khai nó
      AND (a.platform_key <> 'facebook' OR a.handle ILIKE '%(Page)%' OR may.ten IS NOT NULL)
    ORDER BY (may.ten IS NULL), may.ten, du_an, a.platform_key`)) as unknown as { id: number; platform_key: string; handle: string; status: string | null; proxy_id: number | null; tao: string; du_an: string; may: string | null; da_dang: number | null }[];
  // lượt sang site của từng tài khoản = cộng phiên (sổ phiên adfond, utm_source của máy đăng) qua mọi cặp nền × site của các máy dùng tài khoản đó
  const [cap, bam] = await Promise.all([
    // site của máy = host trong link video của máy (ratesbyroom.com, esimfares.com, pickjot.com…) — một tài khoản × nền × site là một kênh
    d.execute(sql`SELECT DISTINCT n->'br'->>'acct' AS acct, n->>'nen' AS nen, regexp_replace(split_part(split_part(v.dang->>'link', '//', 2), '/', 1), '^www\.', '') AS site
      FROM xv_may m CROSS JOIN LATERAL jsonb_array_elements(m.dang) n JOIN xv_may_video v ON v.may_id = m.id
      WHERE n->'br'->>'acct' IS NOT NULL AND v.dang->>'link' IS NOT NULL`) as unknown as Promise<{ acct: string; nen: string; site: string }[]>,
    docBamBaiDang().catch(() => null),
  ]);
  const bamTk = new Map<number, number>();
  if (bam) for (const c of cap) { const n = bam.get(`${c.nen}|${c.site}`); if (n) bamTk.set(Number(c.acct), (bamTk.get(Number(c.acct)) ?? 0) + n); }
  return r.filter((x) => !daCo.has(x.id)).map((x): StKenh => ({
    id: x.id, ten: x.handle, nenTang: NEN_TEN[x.platform_key] ?? x.platform_key, nenKey: x.platform_key, nhom: x.may ?? x.du_an, ngonNgu: 'EN', proxy: x.proxy_id ? `proxy #${x.proxy_id}` : 'chưa gắn proxy',
    duAn: x.du_an, tt: TT_TK(x.status), ngay: Math.max(0, Math.round((homMs - Date.parse(x.tao)) / 864e5)), video: x.da_dang ?? 0, trungViXem: 0, xem: 0, click: bamTk.get(x.id) ?? 0, hh: 0, daDo: false, demBai: x.may != null,
    demBam: x.may != null && bam != null,
  }));
}

async function docDangMay(d: NonNullable<ReturnType<typeof getDb>>, homMs: number): Promise<Map<number, DangNenTho[]>> {
  // MÁY ĐĂNG TRÊN CITY (anh 25/10/2026 "các việc chờ đăng, lúc đăng, hỏng, sửa đã thể hiện realtime trên city chưa"): mỗi tài khoản × nền của máy đang bật —
  // nhật ký mới nhất 24 giờ (dang-may / dang-short ghi 'bat-dau' lúc bắt đầu, 'dang' lúc xong / hỏng), bài lên hôm nay (sổ da_dang), lịch dự kiến hôm nay
  // (xv_lich_du_kien — máy tự tính bằng nhịp an toàn, mos2 không tính lại), việc của Mạnh ở hàng thợ máy (/var/lib/cty/tho-may.json, khoá dang:lo|máy|nền).
  // city tự làm mới mỗi phút → trễ tối đa ~1 phút. Mô hình quyết trạng thái (social-thanh-pho.ts › trangThaiNen).
  const homVN = new Date(homMs + 7 * 3600e3).toISOString().slice(0, 10);
  const [nenMay, lichRow] = await Promise.all([
    d.execute(sql`SELECT n->'br'->>'acct' AS acct, n->>'nen' AS nen, m.ma, m.ten,
        (SELECT json_build_object('buoc', k.buoc, 'ok', k.ok, 'luc', k.luc, 'chu', left(k.noi_dung, 200)) FROM xv_may_nhat_ky k
           WHERE k.may_id = m.id AND k.nen = n->>'nen' AND k.luc > now() - interval '24 hours' ORDER BY k.luc DESC, k.id DESC LIMIT 1) AS nk,
        (SELECT json_build_object('url', v.da_dang->(n->>'nen')->>'url', 'luc', v.da_dang->(n->>'nen')->>'luc') FROM xv_may_video v
           WHERE v.may_id = m.id AND v.da_dang->(n->>'nen')->>'ngay' = ${homVN} ORDER BY v.da_dang->(n->>'nen')->>'luc' DESC NULLS LAST LIMIT 1) AS da
      FROM xv_may m CROSS JOIN LATERAL jsonb_array_elements(m.dang) n WHERE m.chay AND n->'br'->>'acct' IS NOT NULL`).catch(() => []) as unknown as Promise<{ acct: string; nen: string; ma: string; ten: string; nk: DangNenTho['nk']; da: DangNenTho['daHom'] }[]>,
    d.execute(sql`SELECT ds FROM xv_lich_du_kien WHERE id = 1`).catch(() => []) as unknown as Promise<{ ds: { acct?: string; nen: string; ngay: string; gio: string; title?: string }[] }[]>,
  ]);
  const lichHom = new Map<string, { gio: string; title: string }>();
  for (const e of lichRow[0]?.ds ?? []) if (e.ngay === homVN && e.acct && !lichHom.has(`${e.acct}|${e.nen}`)) lichHom.set(`${e.acct}|${e.nen}`, { gio: e.gio, title: e.title ?? '' });
  const suaMay = new Map<string, 'cho' | 'dang'>();
  try { const { readFileSync } = await import('node:fs'); const st = JSON.parse(readFileSync(`${process.env.CTY_DATA_DIR || '/var/lib/cty'}/tho-may.json`, 'utf8')) as { hang?: { khoa: string; tt: string }[] };
    for (const v of st.hang ?? []) if (v.khoa.startsWith('dang:lo|') && (v.tt === 'cho' || v.tt === 'dang')) suaMay.set(v.khoa.slice(8), v.tt); } catch { /* máy không có cty (máy dev) */ }
  const dangTk = new Map<number, DangNenTho[]>();
  for (const x of nenMay) { const a = Number(x.acct); if (!a) continue;
    dangTk.set(a, [...(dangTk.get(a) ?? []), { nen: x.nen, may: x.ten, nk: x.nk, daHom: x.da && (x.da.url || x.da.luc) ? x.da : null, lichHom: lichHom.get(`${x.acct}|${x.nen}`) ?? null, sua: suaMay.get(`${x.ma}|${x.nen}`) ?? null }]); }
  return dangTk;
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
    if (!duAn.length) { const hm = Date.parse(new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)), kv = await docKenhVault(d, new Set(), hm), dm = await docDangMay(d, hm);
      for (const k of kv) k.dangMay = dm.get(k.id); return { kenh: kv, trang: [], ban: [] }; }
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
        // lần đăng cuối = video mới nhất CỦA NỀN NÀY (sổ số video ghi ngayDang từng video) · landing chính = đích nhiều sản phẩm trỏ nhất
        const dangCuoi = dongs.filter((x) => x.kenh === key).flatMap((x) => x.videos.map((v) => v.ngayDang ?? '')).reduce((a, x) => (x > a ? x : a), '') || null;
        const dem = new Map<string, number>(); for (const sp of kenhSp.filter((x) => x.project === da)) { const u = sp.o[key === 'pinterest' ? 'pinterest' : 'shorts']?.dich;   /* kenh_sp gộp mọi nền video ngắn dưới khoá 'shorts' */ if (u) dem.set(u, (dem.get(u) ?? 0) + 1); }
        const landing = [...dem].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        const daDang = key === 'pinterest' ? kenhSp.filter((x) => x.project === da).reduce((a, x) => a + (x.o.pinterest?.xong ?? 0), 0) : n?.soVideo ?? 0;
        kenh.push({
          id: t?.id ?? -(kenh.length + 1), ten: t?.handle ?? nen.ten, nenTang: nen.ten, nenKey: nen.pk, nhom: tenDuAn[da] ?? da, duAn: tenDuAn[da] ?? da, ngonNgu: 'EN',
          proxy: t?.proxy_id ? `proxy #${t.proxy_id}` : t ? 'chưa gắn proxy' : 'chưa có trong vault', tt: TT_TK(t?.status ?? null),
          ngay: Math.max(0, Math.round((homMs - Date.parse(ngayDau)) / 864e5)), video: daDang,
          trungViXem: key === 'pinterest' ? 0 : giua(tv.video.map((v) => v.nen[key]?.tong).filter((x): x is number => x != null)),
          xem: key === 'pinterest' ? pin?.hien30 ?? 0 : n?.tong ?? 0, xem7: key === 'pinterest' ? null : n?.xem7 ?? null,
          click: key === 'pinterest' ? pin?.click30 ?? 0 : n?.vaoShop7 ?? 0, hh: 0, daDo: coSo, dangCuoi, landing,
        });
      }
      // kênh MXH khác của dự án (twitter, threads…) có trong vault nhưng chưa có máy đo
      for (const t of tk.filter((x) => x.project_id === da && !daDung.has(x.id)))
        kenh.push({ id: t.id, ten: t.handle, nenTang: NEN_TEN[t.platform_key] ?? t.platform_key, nenKey: t.platform_key, nhom: tenDuAn[da] ?? da, duAn: tenDuAn[da] ?? da, ngonNgu: 'EN', proxy: t.proxy_id ? `proxy #${t.proxy_id}` : 'chưa gắn proxy',
          tt: TT_TK(t.status), ngay: Math.max(0, Math.round((homMs - Date.parse(t.tao)) / 864e5)), video: 0, trungViXem: 0, xem: 0, click: 0, hh: 0, daDo: false });
    }
    kenh.push(...await docKenhVault(d, new Set(kenh.map((k) => k.id)), homMs));
    { const dm = await docDangMay(d, homMs); for (const k of kenh) k.dangMay = dm.get(k.id); }   // mọi kênh (cả kênh của dự án có cửa bán — Front Porch) mang trạng thái máy đăng
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
