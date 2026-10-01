// SHOP — đọc sổ HẠ TẦNG QUẢNG CÁO (migration 0210) cho /shop › Hạ tầng QC: mọi shop MOS, mỗi shop một bộ (người · BM · TK QC ·
// thẻ · Trang · pixel), người nối kho tài khoản (platform_accounts → proxy + browser profile). Kèm ĐƯỜNG NỐI RA NGOÀI của từng bộ
// (`DungChung`) đếm trên toàn kho — luật đỏ/vàng ở qc-ha-tang.ts (thuần).
import 'server-only';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checklist, khoaThe, kiemHaTang, type BuocChuan, type DungChung, type HaTang, type PhatHien } from './qc-ha-tang';

type Row = Record<string, unknown>;
const q = async (s: ReturnType<typeof sql>) => { const d = getDb(); if (!d) return [] as Row[]; return (await d.execute(s)) as unknown as Row[]; };
const so = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const chu = (v: unknown) => (v === null || v === undefined ? null : String(v));
const ngay = (v: unknown) => (v === null || v === undefined ? null : String(v).slice(0, 10));
const chung = (r: Row) => ({ id: Number(r.id), cuaHangId: Number(r.cua_hang_id), ghiChu: chu(r.ghi_chu), trangThai: String(r.trang_thai) });

export type BoHaTang = { h: HaTang; kq: PhatHien[]; ck: BuocChuan[] };

export async function docHaTang(homNay = new Date().toISOString().slice(0, 10)): Promise<BoHaTang[]> {
  const [ch, bm, the, tk, nguoi, trang, pixel, prx] = await Promise.all([
    q(sql`SELECT id, khoa, domain, NULLIF(mat_tien->'do'->>'meta_pixel', '') AS px FROM shop_cua_hang ORDER BY id`),
    q(sql`SELECT id, cua_hang_id, ext_id, ten, nguon, noi_mua, ma_don, gia_mua, ngay_mua::text AS ngay_mua, bao_hanh_den::text AS bao_hanh_den, xac_minh,
             da_go_nguoi_ban, trang_thai, token_enc IS NOT NULL AS co_token, token_quyen, token_luc::text AS token_luc, ghi_chu FROM shop_qc_bm ORDER BY id`),
    q(sql`SELECT id, cua_hang_id, nhan, so_cuoi, nha_phat_hanh, loai, chu_the, het_han, dich_vu, phi_thang, han_muc, ngay_cap::text AS ngay_cap, trang_thai, ghi_chu
            FROM shop_qc_the ORDER BY id`),
    q(sql`SELECT id, cua_hang_id, bm_id, ext_id, ten, tien_te, mui_gio, han_muc, the_id, nguon, noi_mua, ma_don, gia_mua, bao_hanh_den::text AS bao_hanh_den,
             trang_thai, ghi_chu FROM shop_qc_tk ORDER BY id`),
    q(sql`SELECT n.id, n.cua_hang_id, n.account_id, n.ten, n.bm_id, n.vai_tro, n.nguon, n.trang_thai, n.ghi_chu,
             a.handle, a.email, a.platform_key, a.proxy_id, a.browser_profile_id, p.label AS proxy, p.location AS proxy_noi, b.label AS profile
        FROM shop_qc_nguoi n
        LEFT JOIN platform_accounts a ON a.id = n.account_id
        LEFT JOIN proxies p ON p.id = a.proxy_id
        LEFT JOIN browser_profiles b ON b.id = a.browser_profile_id
       ORDER BY n.id`),
    q(sql`SELECT id, cua_hang_id, account_id, bm_id, ext_id, ten, nguon, trang_thai, ghi_chu FROM shop_qc_trang ORDER BY id`),
    q(sql`SELECT id, cua_hang_id, bm_id, ext_id, ten, ten_mien, xac_minh_mien, capi, trang_thai, ghi_chu FROM shop_qc_pixel ORDER BY id`),
    /* endpoint mang user:pass — chỉ lấy HOST ra màn, không bao giờ cả chuỗi */
    q(sql`SELECT s.id, s.cua_hang_id, s.proxy_id, s.nha_cung_cap, s.gia_thang, s.gia_han_den::text AS gia_han_den, s.trang_thai, s.ghi_chu,
             p.label, p.type, p.location, p.health, substring(p.endpoint from '([^@/:]+)(:[0-9]+)?/?$') AS host
        FROM shop_qc_proxy s JOIN proxies p ON p.id = s.proxy_id ORDER BY s.id`),
  ]);

  /* Người trong kho dùng chung proxy / browser profile với tài khoản KHÁC (mọi nền tảng, mọi dự án) — chỉ hỏi cho đúng các proxy /
     profile mà người của các bộ đang dùng. */
  const proxyIds = [...new Set(nguoi.map((r) => so(r.proxy_id)).filter((x): x is number => x != null))];
  const profileIds = [...new Set(nguoi.map((r) => so(r.browser_profile_id)).filter((x): x is number => x != null))];
  const [banProxy, banProfile] = await Promise.all([
    proxyIds.length ? q(sql`SELECT id, proxy_id, COALESCE(handle, email, '#' || id) AS ten, platform_key FROM platform_accounts
                             WHERE proxy_id = ANY(${proxyIds}::bigint[]) AND COALESCE(status, '') <> 'closed'`) : Promise.resolve([] as Row[]),
    profileIds.length ? q(sql`SELECT id, browser_profile_id, COALESCE(handle, email, '#' || id) AS ten, platform_key FROM platform_accounts
                               WHERE browser_profile_id = ANY(${profileIds}::bigint[]) AND COALESCE(status, '') <> 'closed'`) : Promise.resolve([] as Row[]),
  ]);

  const khoaCua = new Map(ch.map((r) => [Number(r.id), String(r.khoa)]));
  const dangDung = (r: Row) => String(r.trang_thai) !== 'bo';
  const bo: HaTang[] = ch.map((c) => {
    const id = Number(c.id);
    const cua = (rs: Row[]) => rs.filter((r) => Number(r.cua_hang_id) === id);
    return {
      cuaHangId: id, khoa: String(c.khoa), domain: String(c.domain ?? ''), pixelSite: chu(c.px),
      bm: cua(bm).map((r) => ({ ...chung(r), extId: chu(r.ext_id), ten: String(r.ten), nguon: String(r.nguon), noiMua: chu(r.noi_mua), maDon: chu(r.ma_don),
        giaMua: so(r.gia_mua), ngayMua: ngay(r.ngay_mua), baoHanhDen: ngay(r.bao_hanh_den), xacMinh: !!r.xac_minh, daGoNguoiBan: !!r.da_go_nguoi_ban,
        coToken: !!r.co_token, tokenQuyen: chu(r.token_quyen), tokenLuc: chu(r.token_luc) })),
      the: cua(the).map((r) => ({ ...chung(r), nhan: String(r.nhan), soCuoi: String(r.so_cuoi), nhaPhatHanh: chu(r.nha_phat_hanh), loai: String(r.loai),
        chuThe: chu(r.chu_the), hetHan: chu(r.het_han), dichVu: chu(r.dich_vu), phiThang: so(r.phi_thang), hanMuc: so(r.han_muc), ngayCap: ngay(r.ngay_cap) })),
      tk: cua(tk).map((r) => ({ ...chung(r), bmId: so(r.bm_id), extId: chu(r.ext_id), ten: String(r.ten), tienTe: String(r.tien_te), muiGio: chu(r.mui_gio),
        hanMuc: so(r.han_muc), theId: so(r.the_id), nguon: String(r.nguon), noiMua: chu(r.noi_mua), maDon: chu(r.ma_don), giaMua: so(r.gia_mua), baoHanhDen: ngay(r.bao_hanh_den) })),
      nguoi: cua(nguoi).map((r) => ({ ...chung(r), accountId: so(r.account_id), ten: String(r.ten), bmId: so(r.bm_id), vaiTro: String(r.vai_tro), nguon: String(r.nguon),
        acc: r.account_id == null ? null : { handle: chu(r.handle), email: chu(r.email), platform: String(r.platform_key ?? ''), proxyId: so(r.proxy_id), proxy: chu(r.proxy),
          proxyNoi: chu(r.proxy_noi), profileId: so(r.browser_profile_id), profile: chu(r.profile) } })),
      trang: cua(trang).map((r) => ({ ...chung(r), accountId: so(r.account_id), bmId: so(r.bm_id), extId: chu(r.ext_id), ten: String(r.ten), nguon: String(r.nguon) })),
      pixel: cua(pixel).map((r) => ({ ...chung(r), bmId: so(r.bm_id), extId: chu(r.ext_id), ten: String(r.ten), tenMien: chu(r.ten_mien), xacMinhMien: !!r.xac_minh_mien, capi: !!r.capi })),
      proxy: cua(prx).map((r) => ({ ...chung(r), proxyId: Number(r.proxy_id), label: String(r.label ?? `#${r.proxy_id}`), loai: String(r.type ?? ''), noi: chu(r.location),
        host: chu(r.host), suckhoe: chu(r.health), nhaCungCap: chu(r.nha_cung_cap), giaThang: so(r.gia_thang), giaHanDen: ngay(r.gia_han_den) })),
    };
  });

  return bo.map((h) => {
    const khac = (rs: Row[]) => rs.filter((r) => Number(r.cua_hang_id) !== h.cuaHangId && dangDung(r));
    const gom = (rs: Row[], khoa: (r: Row) => string | null) => {
      const m: Record<string, string[]> = {};
      for (const r of rs) { const k = khoa(r); if (!k) continue; const t = khoaCua.get(Number(r.cua_hang_id)) ?? '?'; if (!(m[k] ??= []).includes(t)) m[k].push(t); }
      return m;
    };
    const minh = new Set(h.nguoi.map((n) => n.accountId).filter((x): x is number => x != null));
    const ngoaiBo = (rs: Row[], cot: string) => {
      const m: Record<number, string[]> = {};
      for (const r of rs) if (!minh.has(Number(r.id))) (m[Number(r[cot])] ??= []).push(`${r.ten} (${r.platform_key})`);
      return m;
    };
    const ngoai: DungChung = {
      nguoi: gom(khac(nguoi), (r) => chu(r.account_id)) as unknown as Record<number, string[]>,
      proxy: ngoaiBo(banProxy, 'proxy_id'), profile: ngoaiBo(banProfile, 'browser_profile_id'),
      the: gom(khac(the), (r) => khoaThe({ nhaPhatHanh: chu(r.nha_phat_hanh), soCuoi: String(r.so_cuoi) })),
      ma: { ...gom(khac(bm), (r) => chu(r.ext_id)), ...gom(khac(tk), (r) => chu(r.ext_id)), ...gom(khac(trang), (r) => chu(r.ext_id)), ...gom(khac(pixel), (r) => chu(r.ext_id)) },
      proxyBo: gom(khac(prx), (r) => chu(r.proxy_id)) as unknown as Record<number, string[]>,
    };
    return { h, kq: kiemHaTang(h, ngoai, homNay), ck: checklist(h) };
  });
}

/** Tài khoản cá nhân / Trang Facebook trong kho để chọn làm người / Trang của bộ (ô chọn trong drawer). */
export async function docTaiKhoanFb(): Promise<{ id: number; ten: string; loai: string; proxy: string | null; profile: string | null }[]> {
  const r = await q(sql`SELECT a.id, COALESCE(a.handle, a.email, '#' || a.id) AS ten, a.account_kind, p.label AS proxy, b.label AS profile
                          FROM platform_accounts a LEFT JOIN proxies p ON p.id = a.proxy_id LEFT JOIN browser_profiles b ON b.id = a.browser_profile_id
                         WHERE a.platform_key = 'facebook' AND COALESCE(a.status, '') <> 'closed'
                         ORDER BY a.id DESC LIMIT 2000`);
  return r.map((x) => ({ id: Number(x.id), ten: String(x.ten), loai: String(x.account_kind ?? 'user'), proxy: chu(x.proxy), profile: chu(x.profile) }));
}

/** Proxy trong kho để gắn vào bộ (ô chọn) — chỉ nhãn / loại / nơi, không endpoint. */
export async function docProxyKho(): Promise<{ id: number; ten: string; loai: string; noi: string | null }[]> {
  const r = await q(sql`SELECT id, label, type, location FROM proxies WHERE archived_at IS NULL ORDER BY id DESC LIMIT 1000`);
  return r.map((x) => ({ id: Number(x.id), ten: String(x.label), loai: String(x.type ?? ''), noi: chu(x.location) }));
}
/** Browser profile trong kho để gắn cho người. */
export async function docProfileKho(): Promise<{ id: number; ten: string }[]> {
  const r = await q(sql`SELECT id, COALESCE(label, external_id, '#' || id) AS ten FROM browser_profiles WHERE archived_at IS NULL ORDER BY id DESC LIMIT 1000`);
  return r.map((x) => ({ id: Number(x.id), ten: String(x.ten) }));
}
