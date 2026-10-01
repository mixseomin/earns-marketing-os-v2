#!/usr/bin/env node
// Nạp kết quả tìm đối thủ (JSON) vào sổ shop_doi_thu / _sp / _qc (migration 0206). In ra SQL — chạy lại được (ON CONFLICT DO NOTHING / chỉ điền chỗ trống).
//   node scripts/shop/doi-thu-nhap.mjs scripts/shop/doi-thu-tim.json > /tmp/doi-thu.sql
//   scp /tmp/doi-thu.sql box3:/tmp/ && ssh box3 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f /tmp/doi-thu.sql'
// JSON: {doi_thu:[{ten, website, kenh_ban, fb_page_url, fb_page_id, tiktok, nguon_tim, ghi_chu,
//         san_pham:[{our_product, ten, url, gia, gia_goc, khop, ghi_chu}],
//         quang_cao:[{nen_tang, link, hook, tieu_de, cta, dinh_dang, goc, uu_dai, media, so_phien_ban, landing, bat_dau, dang_chay, ghi_chu, sp_url?}]}]}
// our_product → sản phẩm của mình theo (cửa hàng, ma_ngoai hoặc slug) ở bảng SAN_PHAM dưới.
import { readFileSync } from 'node:fs';

const SAN_PHAM = {
  1: ['mellowstep', 'slug', 'mellowstep-wide-toe-barefoot-walker'],
  2: ['mellowstep', 'slug', 'mellowstep-cloud-wide-fit-sneaker'],
  3: ['mellowstep', 'slug', 'mellowstep-easy-slip-on-walking-shoe'],
  4: ['demo-bra', 'ma_ngoai', 'lb-1'],
};
const KENH = new Set(['dtc', 'amazon', 'walmart', 'aliexpress', 'temu', 'tiktok_shop', 'khac']);
const KHOP = new Set(['dung_mau', 'gan', 'khac', 'chua_xac_nhan']);
const NT = new Set(['meta', 'tiktok', 'google', 'khac']);
const DD = new Set(['video', 'ugc_video', 'anh', 'carousel', 'slideshow']);

const t = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 'NULL' : String(Math.round(Number(v) * 100) / 100));
const url = (v) => (typeof v === 'string' && /^https?:\/\/\S+$/.test(v.trim()) ? t(v.trim()) : 'NULL');
const ngay = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? `'${v.slice(0, 10)}'::date` : 'NULL');
const bool = (v) => (v === true ? 'true' : v === false ? 'false' : 'NULL');
const spMinh = (k) => { const x = SAN_PHAM[k]; return x ? `(SELECT p.id FROM shop_san_pham p JOIN shop_cua_hang c ON c.id = p.cua_hang_id WHERE c.khoa = ${t(x[0])} AND p.${x[1]} = ${t(x[2])})` : 'NULL'; };

const f = process.argv[2];
if (!f) { console.error('cần đường dẫn JSON'); process.exit(1); }
const j = JSON.parse(readFileSync(f, 'utf8'));
const out = ['BEGIN;'];
for (const d of j.doi_thu ?? []) {
  if (!d.ten) continue;
  const kenh = KENH.has(d.kenh_ban) ? d.kenh_ban : 'dtc';
  const dt = `(SELECT id FROM shop_doi_thu WHERE lower(ten) = lower(${t(d.ten)}) AND kenh_ban = ${t(kenh)})`;
  const pid = String(d.fb_page_id ?? '').replace(/\D/g, '');
  out.push(`INSERT INTO shop_doi_thu (ten, website, kenh_ban, fb_page_url, fb_page_id, tiktok, nguon_tim, ghi_chu) VALUES (${t(d.ten)}, ${url(d.website)}, ${t(kenh)}, ${url(d.fb_page_url)}, ${t(pid)}, ${url(d.tiktok)}, ${t(d.nguon_tim)}, ${t(d.ghi_chu)}) ON CONFLICT DO NOTHING;`);
  // đã có (vd. tìm lại lần hai): chỉ điền chỗ còn trống, không đè số anh đã sửa tay
  out.push(`UPDATE shop_doi_thu SET website = COALESCE(website, ${url(d.website)}), fb_page_url = COALESCE(fb_page_url, ${url(d.fb_page_url)}), fb_page_id = COALESCE(fb_page_id, ${t(pid)}), tiktok = COALESCE(tiktok, ${url(d.tiktok)}), cap_nhat = now() WHERE id = ${dt};`);
  for (const s of d.san_pham ?? []) {
    if (url(s.url) === 'NULL') continue;
    out.push(`INSERT INTO shop_doi_thu_sp (doi_thu_id, san_pham_id, ten, url, gia, gia_goc, khop, ghi_chu, luc) VALUES (${dt}, ${spMinh(s.our_product)}, ${t(s.ten)}, ${url(s.url)}, ${n(s.gia)}, ${n(s.gia_goc)}, ${t(KHOP.has(s.khop) ? s.khop : 'chua_xac_nhan')}, ${t(s.ghi_chu)}, now()) ON CONFLICT (doi_thu_id, url) DO NOTHING;`);
  }
  for (const q of d.quang_cao ?? []) {
    if (url(q.link) === 'NULL') continue;
    // QC trỏ tới trang đích nào trong sản phẩm của họ (khớp theo url / landing)
    const sp = q.sp_url || q.landing;
    const spId = sp ? `(SELECT id FROM shop_doi_thu_sp WHERE doi_thu_id = ${dt} AND url = ${url(sp)})` : 'NULL';
    out.push(`INSERT INTO shop_doi_thu_qc (doi_thu_id, doi_thu_sp_id, nen_tang, link, hook, noi_dung, mo_ta, landing, bat_dau, dang_chay, ghi_chu, tieu_de, cta, dinh_dang, goc, uu_dai, media, so_phien_ban, luc) VALUES (${dt}, ${spId}, ${t(NT.has(q.nen_tang) ? q.nen_tang : 'khac')}, ${url(q.link)}, ${t(q.hook)}, ${t(q.than_bai)}, ${t(q.mo_ta)}, ${url(q.landing)}, ${ngay(q.bat_dau)}, ${bool(q.dang_chay)}, ${t(q.ghi_chu)}, ${t(q.tieu_de)}, ${t(q.cta)}, ${t(DD.has(q.dinh_dang) ? q.dinh_dang : null)}, ${t(q.goc)}, ${t(q.uu_dai)}, ${url(q.media)}, ${Number.isInteger(q.so_phien_ban) ? q.so_phien_ban : 'NULL'}, now()) ON CONFLICT (doi_thu_id, link) DO NOTHING;`);
  }
}
out.push('COMMIT;');
console.log(out.join('\n'));
