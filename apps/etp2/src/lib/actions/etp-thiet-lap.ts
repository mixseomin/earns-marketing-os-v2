'use server';
// TAB CAMP › ⚙ THIẾT LẬP (anh 24/11/2026: "chi tiết mọi config của từng camp. Show mọi cột, chi tiết, ko cắt cụt… group cột";
// "chia nhóm thì giống như các bước lên camp của hệ thống Etho để còn biết sai đúng ở đâu").
// Nguồn THẬT, chỉ đọc: etp.bai_camp.du = GET /api/v1/campaigns/<id> trọn (apps/etp/bai-qc.py — camp ACTIVE đọc lại sau 6 giờ)
// + etp.bai_cr = chữ creative (asset_spec) đọc lúc lên + etp.camp. Form chữ chuẩn = apps/etp/form-chu.json (một nguồn với chu-qc.py / ap-form-chu.py).
// Chữ AD đang mang trên Meta: camp tạo TRƯỚC lúc creative được đưa về form (bai_cr.form_luc) giữ chữ cũ (Meta giữ bản creative riêng) → dòng đó lấy chữ cũ ở bai_cr,
// trừ khi ad đã được gắn lại creative form (ap-form-chu.py --ad ghi bai_camp.chu_form_luc).
// Gói gọn: danh sách dài lặp lại giữa các camp (nước, vị trí…) gom vào bảng chữ chung `chung`, dòng chỉ giữ số thứ tự.
import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';

export type FormChu = { creative_type: string; call_to_action: string; link_url: string; primaryTexts: string[]; headlines: string[]; descriptions: string[] };
/** một ô: chữ ngắn, hoặc số thứ tự vào `chung` (chữ dài lặp) */
export type OTl = string | number | null;
export type DongTl = Record<string, OTl> & { camp_id: number };
export type ThietLap = { form: FormChu; dong: DongTl[]; chung: string[]; thieu: number };
/** camp DỰ KIẾN của một phim trong khối (anh 25/11/2026 "plan phải có cụ thể loại camp, creative… tao cần nhìn thấy ở Thiết lập"):
 *  id = camp_id âm của dòng khối · khuon = camp khuôn máy sẽ nhân bản (nhan-ban.py) · so = số camp · cid = phim · de = ô bị khối đè (ROAS, ngân sách, giờ, miền, tên…) */
export type KeTl = { id: number; khuon: number; so: number; cid: number; bo: string | null; de: Record<string, string | null> };

const J = (v: unknown): Record<string, unknown> => {
  if (typeof v === 'string' && /^[{[]/.test(v.trim())) { try { return J(JSON.parse(v)); } catch { return {}; } }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
};
const L = (v: unknown): unknown[] => (Array.isArray(v) ? v : typeof v === 'string' && v.trim().startsWith('[') ? (() => { try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; } })() : []);
const S = (v: unknown): string | null => (v == null || v === '' ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
const ds = (v: unknown, noi = ', ') => { const a = L(v).map((x) => S(x)).filter(Boolean); return a.length ? a.join(noi) : null; };

/** form chữ chuẩn — đọc thẳng apps/etp/form-chu.json (etp2 chạy ở apps/etp2) */
function docForm(): FormChu {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), '..', 'etp', 'form-chu.json'), 'utf8')) as FormChu;
}

export async function docThietLap(ids: number[], ke: KeTl[] = []): Promise<ThietLap | { loi: string }> {
  if (!(await quyenEtp(await getCurrentUser()))) return { loi: 'không có quyền' };
  const ma = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter((x) => Number.isInteger(x) && x > 0))];
  const db = getDb(); if (!db) return { loi: 'không nối được kho' };
  let form: FormChu;
  try { form = docForm(); } catch (e) { return { loi: `không đọc được form chữ apps/etp/form-chu.json: ${String((e as Error)?.message ?? e).slice(0, 160)}` }; }
  const ke_ = (Array.isArray(ke) ? ke : []).filter((k) => Number.isInteger(k?.khuon) && k.khuon > 0 && Number.isInteger(k?.id) && k.id < 0 && Number.isInteger(k?.cid)).slice(0, 200);
  const lay = [...new Set([...ma, ...ke_.map((k) => k.khuon)])];
  if (!lay.length) return { form, dong: [], chung: [], thieu: 0 };
  const rows = (await db.execute(sql`select c.camp_id, c.ten, c.bo, c.ad_account_id, c.trang_thai, c.giao, c.dong_bo, c.ngan_sach, c.creative_id, c.content_id, c.roas, c.chien_luoc, c.lich, c.loi camp_loi,
      to_char(c.tao at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') tao, b.page_id, b.ten_mien, b.final_url, b.du,
      to_char(b.du_luc at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') du_luc, p.ten pten, p.them->>'picture_url' panh,
      r.kieu, r.cta, r.link, r.chinh, r.tieu_de, r.mo_ta, to_char(r.form_luc at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') form_luc, (r.form_luc is not null and c.tao < r.form_luc and b.chu_form_luc is null) chu_cu
    from (select camp_id, ten, bo, ad_account_id, trang_thai, giao, dong_bo, ngan_sach, creative_id, content_id, roas, chien_luoc, lich, loi, tao from etp.camp
        -- camp CẢ ĐỘI (#1859): etp.camp_ngoai không có bo / giao / roas / lịch / lỗi nhà → null; cấu hình trọn đọc từ bai_camp.du như camp nhà
        union all select n.camp_id, n.ten, null, n.ad_account_id, n.trang_thai, null, null, n.ngan_sach, n.creative_id, n.content_id, null, n.chien_luoc, null, null, n.tao
          from etp.camp_ngoai n where not exists (select 1 from etp.camp x where x.camp_id = n.camp_id)) c
      left join etp.bai_camp b using (camp_id) left join etp.bai_cr r on r.creative_id = c.creative_id
      left join etp.tai_nguyen p on p.loai = 'page' and (p.id = b.page_id or p.external_id = b.page_id::text)
    where c.camp_id = any(${sql.raw(`array[${lay.join(',')}]::int[]`)})`)) as unknown as Record<string, unknown>[];
  const chung: string[] = [], soChung = new Map<string, number>();
  const gon = (v: string | null): OTl => { if (v == null || v.length < 40) return v; let i = soChung.get(v); if (i == null) { i = chung.length; chung.push(v); soChung.set(v, i); } return i; };
  let thieu = 0;
  const coMa = new Set(ma);
  const tatCa = rows.map((r): DongTl => {
    const du = J(r.du), c = J(du.camp), g = J(du.nhom), a = J(du.ad), cp = J(c.source_payload), gp = J(g.source_payload), t = J(gp.targeting), po = J(gp.promoted_object), bc = J(gp.bid_constraints);
    if (r.du == null && coMa.has(Number(r.camp_id))) thieu++;
    // ad đang mang chữ nào: creative đưa về form SAU khi camp lên → chữ cũ (bai_cr giữ bản đọc lúc lên); còn lại = chữ creative hiện tại
    const cu = r.chu_cu === true;
    const chinh = cu || !r.form_luc ? L(r.chinh) : form.primaryTexts, tieu = cu || !r.form_luc ? L(r.tieu_de) : form.headlines, moTa = cu || !r.form_luc ? L(r.mo_ta) : form.descriptions;
    const cta = cu || !r.form_luc ? S(r.cta) : form.call_to_action, link = cu || !r.form_luc ? S(r.link) : form.link_url, kieu = cu || !r.form_luc ? S(r.kieu) : form.creative_type;
    const attr = L(gp.attribution_spec).map((x) => { const o = J(x); return `${S(o.event_type)} ${S(o.window_days)} ngày`; }).join(' · ') || null;
    const geo = J(t.geo_locations), ex = J(t.excluded_geo_locations), ta = J(t.targeting_automation);
    const ns = (k: unknown) => (k == null ? null : `${k}`);
    const vt = [['Facebook', t.facebook_positions], ['Instagram', t.instagram_positions], ['Messenger', t.messenger_positions], ['Threads', t.threads_positions], ['WhatsApp', t.whatsapp_positions], ['Audience Network', t.audience_network_positions]]
      .map(([n, v]) => { const x = ds(v); return x ? `${n}: ${x}` : null; }).filter(Boolean).join('\n') || null;
    const loi = [['camp', c.error], ['camp ⚠', c.warning], ['ad set', g.error], ['ad set ⚠', g.warning], ['ad', a.error], ['ad ⚠', a.warning], ['kho', r.camp_loi]]
      .filter(([, v]) => S(v)).map(([n, v]) => `${n}: ${S(v)}`).join('\n') || null;
    return {
      camp_id: Number(r.camp_id), du_luc: S(r.du_luc), tao: S(r.tao),
      // 1. CAMPAIGN
      c_ten: S(c.name) ?? S(r.ten), c_bo: S(r.bo), c_tk: S(c.external_account_id) ?? S(r.ad_account_id), c_ext: S(c.external_campaign_id), c_muc_tieu: S(cp.objective) ?? S(c.objective),
      c_mua: S(cp.buying_type), c_gia: S(c.source_bidding_strategy) ?? S(cp.bid_strategy) ?? S(r.chien_luoc), c_ns: ns(c.budget_daily ?? r.ngan_sach), c_ns_tron: ns(c.budget_lifetime || null),
      c_ns_chia: cp.is_adset_budget_sharing_enabled == null ? null : cp.is_adset_budget_sharing_enabled ? 'bật' : 'tắt', c_dac_biet: ds(cp.special_ad_categories) ?? 'không',
      c_dsa: [S(cp.dsa_beneficiary), S(cp.dsa_payor)].filter(Boolean).join(' / ') || null, c_tt: S(c.state) ?? S(r.trang_thai), c_meta: S(c.source_status), c_giao: S(c.delivery_status) ?? S(r.giao),
      // thêm cho ngăn camp kiểu trang cấu hình Ethopex (anh 24/11/2026 "drawer hiện ra giống config page bên etho với các page y hệt")
      c_build: S(c.build_name), c_epc: ns(Number(c.min_epc) || null), c_che_do: cp.daily_budget || cp.lifetime_budget ? 'Campaign budget' : 'Ad set budget',
      c_loi: gon([S(c.error), S(c.warning) && `⚠ ${S(c.warning)}`].filter(Boolean).join('\n') || null),
      // 2. AD SET
      g_ten: gon(S(g.name)), g_toi_uu: S(g.optimization_goal) ?? S(gp.optimization_goal), g_tinh_phi: S(gp.billing_event) ?? S(g.billing_event), g_dich: S(gp.destination_type),
      g_su_kien: S(po.custom_event_type), g_pixel: S(po.pixel_id) ?? ds(L(du.pixel).map((x) => J(x).pixel_id)), g_roas: ns(bc.roas_average_floor ?? (Number(g.target_roas) || null) ?? r.roas),
      g_ns: ns(g.daily_budget || null), g_attr: gon(attr), g_bat_dau: S(gp.start_time), g_ket_thuc: S(gp.end_time), g_lich: S(r.lich),
      g_nuoc: gon(ds(geo.countries)), g_so_nuoc: ns(L(geo.countries).length || null), g_kieu_vt: ds(geo.location_types), g_loai_nuoc: gon(ds(ex.countries)), g_so_loai: ns(L(ex.countries).length || null),
      g_ngon_ngu: ds(t.locales), g_tuoi: `${S(t.age_min) ?? '18'}–${t.age_max == null || Number(t.age_max) >= 65 ? '65+' : S(t.age_max)}`, g_gioi: ds(t.genders),
      g_adv: ta.advantage_audience == null ? null : ta.advantage_audience ? 'bật' : 'tắt', g_nen: gon(ds(t.publisher_platforms)), g_vi_tri: gon(vt), g_thiet_bi: ds(t.device_platforms),
      g_an_toan: gon(ds(t.brand_safety_content_filter_levels)), g_vung_qd: gon(ds(gp.regional_regulated_categories)), g_ext: S(g.external_group_id), g_meta: S(g.source_status), g_giao: S(g.delivery_status),
      g_tt: S(g.status), g_epc: ns(Number(g.min_epc) || null), g_cpa: ns(Number(g.target_cpa) || null), g_dsa_b: S(gp.dsa_beneficiary) ?? S(cp.dsa_beneficiary), g_dsa_p: S(gp.dsa_payor) ?? S(cp.dsa_payor),
      g_kich: g.pending_activation ? 'chờ kích hoạt' : null, g_loi: gon([S(g.error), S(g.warning) && `⚠ ${S(g.warning)}`].filter(Boolean).join('\n') || null),
      // 3. AD
      a_page: S(a.facebook_page_id) ?? S(r.page_id), a_page_ten: S(r.pten), a_page_anh: S(r.panh), a_mien: S(a.domain) ?? S(r.ten_mien), a_lp: S(a.landing_page_id), a_phim: S(a.content_id) ?? S(r.content_id),
      a_url: S(a.final_url) ?? S(r.final_url), a_tags: S(a.url_tags), a_bai_co: S(a.is_existing_post), a_bai: S(a.effective_object_story_id), a_ext: S(a.external_ad_id), a_ext_cr: S(a.external_creative_id),
      a_video: S(a.video_id), a_meta: S(a.source_status), a_giao: S(a.delivery_status),
      a_ten: gon(S(a.name)), a_kich: a.pending_activation ? 'chờ kích hoạt' : null, a_loi: gon([S(a.error), S(a.warning) && `⚠ ${S(a.warning)}`].filter(Boolean).join('\n') || null),
      // 4. CREATIVE — form chữ
      f_cr: S(r.creative_id), f_kieu: kieu, f_cta: cta, f_tt: S(a.status) ?? S(r.trang_thai), f_link: link, f_chinh: gon(L(chinh).map((x) => S(x)).filter(Boolean).join('\n') || null),
      f_tieu: gon(L(tieu).map((x) => S(x)).filter(Boolean).join('\n') || null), f_mo_ta: gon(L(moTa).map((x) => S(x)).filter(Boolean).join('\n') || null),
      f_nguon: cu ? `chữ cũ — camp lên trước lúc creative về form (${S(r.form_luc)})` : r.form_luc ? 'chữ form (creative đã về form trước khi camp lên)' : r.chinh == null ? 'chưa đọc chữ creative' : 'chữ creative lúc lên',
      // 5. ĐỒNG BỘ
      s_camp: S(c.sync_status) ?? S(r.dong_bo), s_nhom: S(g.sync_status), s_ad: S(a.sync_status), s_media: S(a.media_status), s_cho: g.pending_activation || a.pending_activation ? 'chờ kích hoạt' : null,
      s_loi: gon(loi), s_dong_bo_luc: S(c.last_synced_at),
    };
  });
  const dong = tatCa.filter((d) => coMa.has(d.camp_id));
  if (ke_.length) {
    // bộ của phim: cùng luật máy dùng khi lên (apps/etp/cong.py SQL_BO_PHIM) — phim đang vòng đổi bộ → bộ đó, còn lại bo_phim_moi
    const cids = [...new Set(ke_.map((k) => k.cid))];
    const boR = (await db.execute(sql`select p.cid, coalesce((select thu_bo from etp.phim where content_id = p.cid and thu_vong = 'doi_bo' and coalesce(thu_bo, '') <> ''),
        (select gia_tri#>>'{}' from etp.cau_hinh where khoa = 'bo_phim_moi')) bo from unnest(${sql.raw(`array[${cids.join(',')}]::int[]`)}) p(cid)`)) as unknown as Record<string, unknown>[];
    const boPhim = new Map(boR.map((r) => [Number(r.cid), S(r.bo)]));
    // tài khoản + Page theo BỘ: nhan-ban.py dựng trên khuôn của bộ khác thì đổi đúng tk / ext / page sang bộ đó (bo_tk — xv_khoa_ngoai.ethopex_bo_tk), nên camp dự kiến cũng đổi
    const boTkR = (await db.execute(sql`select k.key bo, k.value->>'ext' ext, k.value->>'page' page, p.ten pten, p.them->>'picture_url' panh from xv_khoa_ngoai x, jsonb_each(x.gia_tri) k
        left join etp.tai_nguyen p on p.loai = 'page' and p.id::text = k.value->>'page' where x.ten = 'ethopex_bo_tk'`)) as unknown as Record<string, unknown>[];
    const boTk = new Map(boTkR.map((r) => [String(r.bo), { ext: S(r.ext), page: S(r.page), pten: S(r.pten), panh: S(r.panh) }]));
    const khuon = new Map(tatCa.map((d) => [d.camp_id, d]));
    // ô CHƯA CÓ khi camp chưa tạo: mã Meta, trạng thái, đồng bộ, lỗi, giờ tạo — để trống, không mượn của camp khuôn
    const CHUA = ['du_luc', 'tao', 'c_ext', 'c_tt', 'c_meta', 'c_giao', 'c_loi', 'c_build', 'g_ten', 'g_ext', 'g_meta', 'g_giao', 'g_tt', 'g_kich', 'g_loi', 'g_bat_dau', 'g_ket_thuc',
      'a_ext', 'a_ext_cr', 'a_bai', 'a_video', 'a_meta', 'a_giao', 'a_ten', 'a_kich', 'a_loi', 'a_url', 'f_tt', 's_camp', 's_nhom', 's_ad', 's_media', 's_cho', 's_loi', 's_dong_bo_luc'];
    // chữ THẬT của creative sắp lên (bai_cr, ap-form-chu ghi sau mỗi PATCH) — creative có thể mang kiểu khác Dol (apps/etp/chu-kieu.json, anh 26/11/2026);
    // chưa có dòng / form_luc (đã về form Dol) → chữ form
    const crKe = ke_.map((k) => -k.id);
    const chuKe = new Map(crKe.length ? ((await db.execute(sql`select creative_id, chinh, tieu_de, mo_ta from etp.bai_cr
        where creative_id in (${sql.join(crKe.map((c) => sql`${c}`), sql`, `)}) and form_luc is null and jsonb_array_length(coalesce(chinh, '[]')) > 0`)) as unknown as { creative_id: number; chinh: unknown; tieu_de: unknown; mo_ta: unknown }[])
      .map((r) => [Number(r.creative_id), r]) : []);
    for (const k of ke_) {
      const g = khuon.get(k.khuon);
      const ct = chuKe.get(-k.id);
      for (let i = 1; i <= Math.max(1, Math.min(k.so, 20)); i++) {
        const d: DongTl = { ...(g ?? {}), camp_id: k.id - i };
        for (const x of CHUA) d[x] = null;
        Object.assign(d, {
          ke_cha: k.id, ke_thu: `${i}/${k.so}`, ke_khuon: k.khuon, ke_thieu: g ? null : `kho không đọc được camp khuôn #${k.khuon}`,
          c_tt: 'kế hoạch', c_bo: k.bo || boPhim.get(k.cid) || null, a_phim: String(k.cid), a_url: `Ethopex sinh theo phim #${k.cid} lúc tạo camp`,
          f_kieu: form.creative_type, f_cta: form.call_to_action, f_link: form.link_url, f_chinh: gon((ct ? L(ct.chinh).map(String) : form.primaryTexts).join('\n')), f_tieu: gon((ct ? L(ct.tieu_de).map(String) : form.headlines).join('\n')),
          f_mo_ta: gon((ct ? L(ct.mo_ta).map(String) : form.descriptions).join('\n')),
          f_nguon: ct ? 'chữ creative (bai_cr) — kiểu lên camp trong apps/etp/chu-kieu.json hoặc form, cửa CamLechForm soát lúc lên' : 'chữ form chuẩn — creative mới, máy chỉ lên khi creative đúng form (CamLechForm)',
        });
        const bt = boTk.get(String(d.c_bo ?? ''));
        if (bt && String(g?.c_bo ?? '') !== String(d.c_bo)) Object.assign(d, { c_tk: bt.ext, a_page: bt.page, a_page_ten: bt.pten, a_page_anh: bt.panh });
        // ngân sách ad set chỉ đè khi khuôn dùng ngân sách ad set
        const de = { ...k.de }; if (g?.g_ns == null) delete de.g_ns;
        for (const [x, v] of Object.entries(de)) d[x] = gon(v ?? null);
        dong.push(d);
      }
    }
  }
  return { form, dong, chung, thieu };
}
