#!/usr/bin/env node
// PHÒNG SÁCH — DÂY CHUYỀN THẬT (12/10/2026, anh: "hoàn thiện phòng bán sách KDP, Etsy…"). Phòng KHÔNG giữ bản sao trạng thái nào:
// đọc SỔ SẢN PHẨM (Directus products — cùng sổ tab Tài sản của MOS2; puzzle-books/scripts/quy-trinh.mjs ghi sau từng trạm, may-chay.mjs
// đọc để dựng / bật bán theo lịch), gom theo tựa, suy ra việc kế của từng dòng và AI làm (Giám đốc · máy · vai trong phòng). Chỉ ĐỌC, 0 đồng.
// Sổ của phòng khai ở cong-ty/phong/<phòng>.md → so_san_pham: [nền:shop, …]; phòng không khai thì không có tab Dây chuyền.
//   node worker/sach.mjs --thu [phòng]   in báo cáo sáng + việc chờ Giám đốc từ sổ thật (cần DIRECTUS_URL/TOKEN → chạy trên box3)
//   node worker/sach.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';
import { GOC } from './goc.mjs';
import { parseFm } from '../scripts/fm.mjs';
import { vaiCuaPhong } from './quy-trinh.mjs';

const CONG_TY = path.join(GOC, 'cong-ty');
export const SAP_TOI = 21;   // = SAP_TOI của puzzle-books/scripts/may-chay.mjs: máy đêm chỉ dựng cuốn có ngày đăng trong 21 ngày tới
export const homNay = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const cach = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);   // a − b, tính bằng ngày
// Dòng đầu ghi chú do quy-trinh.mjs ghi: "▶ quy trình 5/6 · xong: … · kế: …". MOS2 apps/web/src/lib/tai-san/doc.ts đọc cùng dòng này.
const QT = /^▶ quy trình (\d+)\/(\d+)(?: · xong: [^·\n]*?)?(?: · (?:kế: )?([^\n]*))?(?:\n|$)/;   // neo cuối dòng: không neo thì nhóm "kế" bị bỏ qua mà vẫn khớp
const TRAM_NOI_DUNG = /^(nội dung|mô tả)/;   // hai trạm quy-trinh.mjs không có lệnh máy (lam: null) → người viết
export const linkMos2 = (id) => `https://mos2.on.tc/?tab=taisan&sp=sp&spId=d:${id}`;   // drawer sản phẩm (tai-san-view.tsx useModalParam('sp'))

/** Một dòng sổ → dạng phòng dùng. */
export function dong(r) {
  const lc = r.listing_config ?? {}; const q = String(r.notes ?? '').match(QT);
  return { id: r.id, nen: r.platform, shop: r.store, dinhDang: r.category ?? null, status: r.status, tua: String(r.title ?? '').trim(),
    ngay: lc.dangDuKien ?? null, loai: lc.loai ?? null, duyet: lc.duyetLuc ?? lc.duyet ?? null, url: r.url ?? null, sku: r.sku ?? null,
    tram: q ? { dat: Number(q[1]), tong: Number(q[2]), ke: q[3]?.trim() || null } : null };
}

/** Việc kế của MỘT dòng: { ai, muc?, chu, qua? }. ai: 'giam-doc' | VAI ở phòng ('truong-phong', 'nguoi-lam' — ai giữ vai đọc từ hồ sơ phòng,
 *  vaiCuaPhong) | 'may' | 'san' | null (không ai phải làm gì).
 *  qua = số ngày đã quá ngày đăng dự kiến (âm = còn bấy nhiêu ngày). tre = máy lẽ ra đã làm mà chưa (sau 2 ngày). */
export function viecKe(d, hom) {
  const qua = d.ngay ? cach(hom, d.ngay) : null; const toi = qua != null && qua >= 0;
  const dangDung = () => {   // dòng đã vào dây chuyền mà chưa dựng xong
    const { dat, tong, ke } = d.tram;
    if (TRAM_NOI_DUNG.test(ke ?? '')) return { ai: 'nguoi-lam', muc: 1, chu: `viết ${ke} (${dat}/${tong})`, qua };
    return { ai: 'may', chu: `dựng ${dat}/${tong} · kế: ${ke ?? '?'}${qua != null && -qua > SAP_TOI ? ' (dựng đêm khi còn ≤ 21 ngày)' : ''}`, qua };
  };
  const dangDungLai = d.tram && d.tram.dat < d.tram.tong - 1;
  // Anh đã bấm Duyệt mà sổ còn owner_review: sách ngoài dây chuyền (bộ coin — không máy nào đẩy status) hoặc máy chưa chạy lại.
  // Như MOS2 Tài sản (daDuyetBanNay): đã duyệt = sẵn sàng, trừ khi máy đang dựng lại (ảnh đổi thì phải duyệt lại).
  const st = d.status === 'owner_review' && d.duyet && !dangDungLai ? 'ready' : d.status;
  switch (st) {
    case 'published': return { ai: null, chu: 'đang bán' };
    case 'in_review': return { ai: 'san', chu: 'sàn đang duyệt' };
    case 'unlisted': case 'archived': return { ai: null, chu: 'ngừng' };
    case 'ready':
      if (!d.ngay) return { ai: 'truong-phong', muc: 2, chu: 'đã duyệt nhưng chưa có ngày đăng' };
      if (!toi) return { ai: null, chu: `đã duyệt, chờ tới ngày đăng`, qua };
      if (d.nen === 'kdp') {   // puzzle-books dang-kdp.mjs (MacBook, 2 giờ/lần) tạo nháp rồi ghi sku = mã tựa; nút Publish là chữ ký của Giám đốc
        const dd = d.dinhDang && d.dinhDang !== 'paperback' ? ` (${d.dinhDang})` : '';
        if (d.sku) return { ai: 'giam-doc', muc: 3, chu: `bấm Publish KDP${dd} — nháp đã sẵn`, qua };
        if (!d.tram) return { ai: 'truong-phong', muc: 2, chu: `soạn nháp KDP${dd} — sách ngoài dây chuyền, máy không tự làm`, qua };
        return { ai: 'may', chu: `tạo nháp KDP${dd} (MacBook, 2 giờ/lần) → Giám đốc bấm Publish`, qua, tre: qua >= 1 };
      }
      return { ai: 'may', chu: d.nen === 'etsy' ? 'bật bán Etsy 08:30 (≤3 cuốn/ngày)' : d.nen === 'gumroad' ? 'đăng Gumroad 09:00 (MacBook)' : `chờ đăng ${d.nen}`, qua, tre: qua >= 2 };
    case 'owner_review':
      if (!dangDungLai) return { ai: 'giam-doc', muc: 3, chu: 'duyệt bản xem trong MOS2', qua: toi ? qua : null };
      return { ...dangDung(), chu: `dựng lại ${d.tram.dat}/${d.tram.tong} · kế: ${d.tram.ke ?? '?'} (${d.duyet ? 'đã duyệt — ảnh đổi thì duyệt lại' : 'giữ chờ duyệt'})` };
    case 'draft': case 'planned':
      if (d.tram) return dangDung();
      if (d.status === 'draft') return { ai: 'truong-phong', muc: 2, chu: 'đang làm ngoài dây chuyền (sổ không có dòng ▶ quy trình)', qua };
      if (!d.ngay) return { ai: null, chu: 'chưa xếp lịch' };
      if (-qua > SAP_TOI) return { ai: null, chu: `trong lịch · còn ${-qua} ngày`, qua };
      return { ai: 'truong-phong', muc: 2, chu: 'chưa vào dây chuyền: chưa có hồ sơ dựng (themes/<tên>.json) → máy đêm bỏ qua', qua };
    default: return { ai: 'truong-phong', muc: 2, chu: `trạng thái lạ "${d.status}"` };
  }
}

const UU_TIEN = ['giam-doc', 'truong-phong', 'nguoi-lam', 'may', 'san'];
/** Gom dòng theo tựa (một tựa = nhiều nền / nhiều định dạng). Xếp theo ngày đăng gần nhất còn mở; nhóm: dang (có việc) · ban (chỉ còn bán/sàn duyệt) · lich (còn xa). */
export function gomTua(ds, hom) {
  const m = new Map();
  for (const d of ds) { const k = d.tua.toLowerCase(); const g = m.get(k) ?? { tua: d.tua, dong: [] }; g.dong.push({ ...d, viec: viecKe(d, hom) }); m.set(k, g); }
  return [...m.values()].map((g) => {
    const mo = g.dong.filter((d) => !['published', 'unlisted', 'archived'].includes(d.status));
    const ngay = mo.map((d) => d.ngay).filter(Boolean).sort()[0] ?? null;
    const ai = UU_TIEN.find((a) => g.dong.some((d) => d.viec.ai === a)) ?? null;
    const nhom = !mo.length || mo.every((d) => d.status === 'in_review') ? 'ban' : ['giam-doc', 'truong-phong', 'nguoi-lam', 'may'].includes(ai) || mo.some((d) => d.status !== 'planned') ? 'dang' : 'lich';
    return { ...g, ngay, ai, nhom, loai: g.dong.find((d) => d.loai)?.loai ?? null, tram: g.dong.find((d) => d.tram)?.tram ?? null };
  }).sort((a, b) => (a.ngay ?? '9999').localeCompare(b.ngay ?? '9999') || a.tua.localeCompare(b.tua));
}

const THAO = { 'soạn nháp KDP': 'soạn nháp KDP ngoài máy', 'chưa vào dây chuyền': 'tới hạn chưa vào dây chuyền', 'đã duyệt nhưng chưa có ngày': 'đã duyệt chưa có ngày đăng' };   // đầu câu viecKe → nhãn báo cáo
const ddmm = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
/** Báo cáo sáng của trưởng phòng theo mẫu AGENTS.md §7 — máy dựng từ sổ (0 đồng), không gọi mô hình. */
export function baoCao(nhom, hom, nguoi, tenPhong) {
  const dongs = nhom.flatMap((g) => g.dong.map((d) => ({ g, d })));
  const ban = (n) => dongs.filter(({ d }) => d.nen === n && d.status === 'published').length;
  const tuaBan = nhom.filter((g) => g.dong.some((d) => d.status === 'published')).length;
  const sanDuyet = dongs.filter(({ d }) => d.status === 'in_review').length;
  const tuaCo = (f) => new Set(dongs.filter(f).map(({ g }) => g.tua)).size;
  const dung = tuaCo(({ d }) => d.viec.ai === 'may' && d.status !== 'ready');
  const choNgay = tuaCo(({ d }) => d.status === 'ready' && d.viec.ai === null);
  const lich = nhom.filter((g) => g.nhom === 'lich'); const xa = lich.map((g) => g.ngay).filter(Boolean).sort().pop();
  const gd = dongs.filter(({ d }) => d.viec.ai === 'giam-doc');
  const kdp = gd.filter(({ d }) => d.viec.chu.startsWith('bấm Publish')), xem = gd.filter(({ d }) => d.viec.chu.startsWith('duyệt'));
  const quaMax = Math.max(0, ...gd.map(({ d }) => d.viec.qua ?? 0));
  const tp = tuaCo(({ d }) => d.viec.ai === 'truong-phong'), nd = tuaCo(({ d }) => d.viec.ai === 'nguoi-lam');
  const tre = dongs.filter(({ d }) => d.viec.tre);
  const can = [
    gd.length && `mức 3 cho Giám đốc — ${[kdp.length && `${kdp.length} lần bấm Publish KDP`, xem.length && `${xem.length} bản xem chờ duyệt`].filter(Boolean).join(', ')}${quaMax ? ` (quá ngày đăng nhiều nhất ${quaMax} ngày)` : ''}`,
    (tp || nd) && `mức 2 cho trưởng phòng — ${[...Object.entries(THAO).map(([dau, nhan]) => [tuaCo(({ d }) => d.viec.ai === 'truong-phong' && d.viec.chu.startsWith(dau)), nhan]),
      [tp - Object.keys(THAO).reduce((t, dau) => t + tuaCo(({ d }) => d.viec.ai === 'truong-phong' && d.viec.chu.startsWith(dau)), 0), 'việc khác'], [nd, 'chờ viết nội dung']]
      .filter(([n]) => n > 0).map(([n, nhan]) => `${n} tựa ${nhan}`).join(', ')}`,
    tre.length && `máy trễ — ${tre.length} dòng đã duyệt, quá ngày mà máy chưa làm xong (${[...new Set(tre.map(({ d }) => d.nen))].join(', ')})`,
  ].filter(Boolean);
  return [`${nguoi} · ${tenPhong} · ${ddmm(hom)}`,
    `Xong: đang bán ${tuaBan} tựa — Etsy ${ban('etsy')} · KDP ${ban('kdp')} · Gumroad ${ban('gumroad')} dòng${sanDuyet ? `; ${sanDuyet} dòng sàn đang duyệt` : ''}`,
    `Đang: ${dung} tựa máy đang dựng, ${choNgay} tựa đã duyệt chờ tới ngày — lịch còn ${lich.length} tựa${xa ? ` tới ${ddmm(xa)}` : ''}`,
    `Cần: ${can.length ? can.join('; ') : 'không'}`].join('\n');
}

let NHO = null;   // { phong, luc, rows } — nhớ 60 giây: mở lại trang / làm mới không gọi Directus mỗi lần
/** Đọc các dòng sổ của phòng. CTY_SACH_TEP = bản chụp sổ (máy dev / tự kiểm), không cần token. */
export async function docSo(nguon) {
  if (process.env.CTY_SACH_TEP) return JSON.parse(fs.readFileSync(process.env.CTY_SACH_TEP, 'utf8')).data.filter((x) => nguon.includes(`${x.platform}:${x.store}`));
  const tok = process.env.DIRECTUS_TOKEN; if (!tok) throw new Error('môi trường của mos2-cty thiếu DIRECTUS_TOKEN → không đọc được sổ sản phẩm');
  const ds = (i) => [...new Set(nguon.map((x) => x.split(':')[i]))].map(encodeURIComponent).join(',');
  const r = await fetch(`${process.env.DIRECTUS_URL || 'https://as.on.tc'}/items/products?limit=-1&fields=id,platform,store,status,category,title,listing_config,notes,url,sku&filter[platform][_in]=${ds(0)}&filter[store][_in]=${ds(1)}`,
    { headers: { authorization: `Bearer ${tok}` }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !Array.isArray(d.data)) throw new Error(`sổ sản phẩm (Directus) trả ${r.status}: ${d.errors?.[0]?.message ?? 'không có data'}`);
  return d.data.filter((x) => nguon.includes(`${x.platform}:${x.store}`));
}
/** Dây chuyền của một phòng: null = phòng không khai so_san_pham; { loi } = đọc sổ hỏng (trang báo đỏ, không hiện bảng cũ). */
export async function dayChuyen(phong, hom = homNay()) {
  const fm = parseFm(fs.readFileSync(path.join(CONG_TY, 'phong', `${phong}.md`), 'utf8')).fm;
  const nguon = Array.isArray(fm.so_san_pham) ? fm.so_san_pham : [];
  if (!nguon.length) return null;
  try { if (!NHO || NHO.phong !== phong || Date.now() - NHO.luc > 60_000) NHO = { phong, luc: Date.now(), rows: await docSo(nguon) }; }
  catch (e) { return { nguon, loi: e.message }; }
  const nhom = gomTua(NHO.rows.map(dong), hom);
  const tp = vaiCuaPhong(phong)['truong-phong'];   // người đang giữ vai trưởng phòng (đổi người = đổi hồ sơ phòng / sổ bổ nhiệm)
  const tenTp = tp ? String(parseFm(fs.readFileSync(path.join(CONG_TY, 'nhan-su', tp, 'SOUL.md'), 'utf8')).fm.ten ?? tp) : String(fm.truong ?? 'Trưởng phòng');
  return { nguon, hom, luc: new Date(NHO.luc).toISOString(), nhom, bao_cao: baoCao(nhom, hom, tenTp, String(fm.ten ?? phong).replace(/\s*\(.*\)\s*$/, '')) };
}

if (process.argv[1]?.endsWith('sach.mjs') && process.argv.includes('--thu')) {
  const dc = await dayChuyen(process.argv[process.argv.indexOf('--thu') + 1] || 'sach');
  if (!dc) { console.log('phòng không khai so_san_pham'); process.exit(0); }
  if (dc.loi) { console.error('✗', dc.loi); process.exit(1); }
  console.log(dc.bao_cao, '\n');
  for (const g of dc.nhom) for (const d of g.dong) if (d.viec.ai === 'giam-doc' || d.viec.ai === 'truong-phong' || d.viec.tre) console.log(`${d.viec.ai.padEnd(12)} ${d.nen.padEnd(7)} ${(d.ngay ?? '—').padEnd(10)} ${g.tua.slice(0, 50).padEnd(50)} ${d.viec.chu}${d.viec.qua > 0 ? ` · quá ${d.viec.qua} ngày` : ''}`);
}

if (process.argv[1]?.endsWith('sach.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert');
  const H = '2026-10-12';
  const R = (o) => dong({ id: o.id ?? 'x', platform: o.nen ?? 'kdp', store: 's', status: o.st, title: o.tua ?? 'T', category: o.dd ?? null, sku: o.sku ?? null,
    listing_config: { dangDuKien: o.ngay, duyet: o.duyet }, notes: o.ghi ?? null });
  const v = (o) => viecKe(R(o), H);
  a.deepEqual(R({ st: 'draft', ghi: '▶ quy trình 3/6 · xong: bìa · kế: ảnh bán hàng + ảnh ghim\nghi chú cũ' }).tram, { dat: 3, tong: 6, ke: 'ảnh bán hàng + ảnh ghim' });
  a.deepEqual(R({ st: 'ready', ghi: '▶ quy trình 6/6 · xong: anh duyệt bản xem trong MOS2 · dựng xong' }).tram, { dat: 6, tong: 6, ke: 'dựng xong' });
  a.equal(R({ st: 'planned', ghi: 'Tập 1. Đủ hồ sơ' }).tram, null, 'ghi chú tay không phải dòng quy trình');
  // KDP đã duyệt quá ngày → Giám đốc bấm Publish; Etsy/Gumroad → máy, trễ sau 2 ngày
  const MAY = '▶ quy trình 6/6 · xong: anh duyệt bản xem trong MOS2 · dựng xong';
  a.deepEqual(v({ st: 'ready', ngay: '2026-10-07', sku: 'ABC', ghi: MAY }), { ai: 'giam-doc', muc: 3, chu: 'bấm Publish KDP — nháp đã sẵn', qua: 5 });
  a.equal(v({ st: 'ready', ngay: '2026-10-07', sku: 'ABC', dd: 'hardcover' }).chu, 'bấm Publish KDP (hardcover) — nháp đã sẵn');
  a.deepEqual([v({ st: 'ready', ngay: '2026-10-07', ghi: MAY }).ai, v({ st: 'ready', ngay: '2026-10-07', ghi: MAY }).tre], ['may', true], 'chưa có nháp mà quá ngày = máy KDP trễ, chưa tới lượt anh');
  a.equal(v({ st: 'ready', ngay: '2026-10-12', ghi: MAY }).tre, false, 'tới ngày hôm nay: máy còn trong hạn');
  a.equal(v({ st: 'ready', ngay: '2026-10-11', ghi: MAY }).tre, true, 'KDP chạy 2 giờ/lần: qua một ngày chưa có nháp là hỏng');
  a.equal(v({ st: 'ready', nen: 'etsy', ngay: '2026-10-11' }).tre, false, 'Etsy ≤3 cuốn/ngày: lùi một ngày còn là xếp hàng');
  a.equal(v({ st: 'ready', ngay: '2026-10-07' }).ai, 'truong-phong', 'sách ngoài dây chuyền: máy KDP không tự soạn nháp');
  a.equal(v({ st: 'ready', ngay: '2026-10-19' }).ai, null, 'chưa tới ngày thì không ai phải làm');
  a.deepEqual([v({ st: 'ready', nen: 'etsy', ngay: '2026-10-12' }).ai, v({ st: 'ready', nen: 'etsy', ngay: '2026-10-12' }).tre], ['may', false]);
  a.equal(v({ st: 'ready', nen: 'gumroad', ngay: '2026-10-09' }).tre, true, 'máy quá 3 ngày chưa đăng = trễ');
  a.equal(v({ st: 'ready' }).ai, 'truong-phong', 'đã duyệt mà không có ngày đăng = việc trưởng phòng');
  // chờ duyệt: chỉ là việc Giám đốc khi máy đã dựng tới trạm duyệt (hoặc sách ngoài dây chuyền); đã duyệt thì là việc máy
  a.equal(v({ st: 'owner_review', ghi: '▶ quy trình 5/6 · xong: mô tả · kế: anh duyệt bản xem trong MOS2' }).ai, 'giam-doc');
  a.equal(v({ st: 'owner_review', ngay: '2026-10-12' }).ai, 'giam-doc', 'sách ngoài dây chuyền (bộ coin) chờ duyệt');
  a.equal(v({ st: 'owner_review', ghi: '▶ quy trình 1/6 · xong: nội dung (lint) · kế: ruột PDF (Letter + A4)' }).ai, 'may', 'máy chưa dựng lại thì chưa tới lượt anh');
  a.equal(v({ st: 'owner_review', duyet: '2026-10-09', ngay: '2026-10-12' }).chu, 'soạn nháp KDP — sách ngoài dây chuyền, máy không tự làm', 'bộ coin: anh đã duyệt, không máy nào đẩy status → như sẵn sàng');
  a.equal(v({ st: 'owner_review', duyet: '2026-10-09', ngay: '2026-11-05', nen: 'etsy', ghi: '▶ quy trình 1/6 · xong: nội dung (lint) · kế: ruột PDF (Letter + A4)' }).ai, 'may', 'đã duyệt nhưng máy dựng lại → chưa sẵn sàng');
  // chưa vào dây chuyền: tới cửa sổ 21 ngày → Thảo; xa hơn → lịch; trạm nội dung → Nhi
  a.equal(v({ st: 'planned', ngay: '2026-11-02' }).ai, 'truong-phong');
  a.equal(v({ st: 'planned', ngay: '2026-11-03' }).ai, null, 'còn 22 ngày: ngoài cửa sổ máy đêm');
  a.equal(v({ st: 'draft', ghi: '▶ quy trình 0/6 · kế: nội dung (lint)', ngay: '2026-10-30' }).ai, 'nguoi-lam');
  a.equal(v({ st: 'draft', ghi: '▶ quy trình 4/6 · xong: ảnh · kế: mô tả bán hàng (KDP/Gumroad/Etsy)' }).ai, 'nguoi-lam');
  a.equal(v({ st: 'draft', ghi: '▶ quy trình 2/6 · xong: ruột · kế: bìa' }).ai, 'may');
  a.equal(v({ st: 'published' }).ai, null); a.equal(v({ st: 'in_review' }).ai, 'san');
  // gom + báo cáo
  const ds = [R({ id: 1, tua: 'Sudoku', nen: 'etsy', st: 'published', ngay: '2026-10-08' }), R({ id: 2, tua: 'Sudoku', st: 'ready', ngay: '2026-10-07', sku: 'D1' }),
    R({ id: 3, tua: 'Bingo', nen: 'etsy', st: 'ready', ngay: '2026-10-22' }), R({ id: 4, tua: 'Kakuro', st: 'planned', ngay: '2026-11-16' }),
    R({ id: 5, tua: 'Xa', st: 'planned', ngay: '2027-06-14' }), R({ id: 8, tua: 'Moi', st: 'planned', ngay: '2026-10-20' }), R({ id: 6, tua: 'Coin', st: 'owner_review', ngay: '2026-10-12' }), R({ id: 7, tua: 'Cu', nen: 'etsy', st: 'published' })];
  const n = gomTua(ds, H);
  a.deepEqual(n.map((g) => [g.tua, g.nhom, g.ai]), [['Sudoku', 'dang', 'giam-doc'], ['Coin', 'dang', 'giam-doc'], ['Moi', 'dang', 'truong-phong'], ['Bingo', 'dang', null], ['Kakuro', 'lich', null], ['Xa', 'lich', null], ['Cu', 'ban', null]]);
  a.equal(n[0].ngay, '2026-10-07', 'ngày của tựa = ngày sớm nhất còn mở (dòng đã bán không tính)');
  const bc = baoCao(n, H, 'Thảo', 'Phòng Sách').split('\n');
  a.equal(bc.length, 4, 'đúng 4 dòng AGENTS.md §7');
  a.equal(bc[0], 'Thảo · Phòng Sách · 12/10/2026');
  a.equal(bc[1], 'Xong: đang bán 2 tựa — Etsy 2 · KDP 0 · Gumroad 0 dòng');
  a.equal(bc[2], 'Đang: 0 tựa máy đang dựng, 1 tựa đã duyệt chờ tới ngày — lịch còn 2 tựa tới 14/06/2027');
  a.equal(bc[3], 'Cần: mức 3 cho Giám đốc — 1 lần bấm Publish KDP, 1 bản xem chờ duyệt (quá ngày đăng nhiều nhất 5 ngày); mức 2 cho trưởng phòng — 1 tựa tới hạn chưa vào dây chuyền');
  a.equal(baoCao([], H, 'Thảo', 'P').split('\n')[3], 'Cần: không');
  // đọc sổ: bản chụp lọc đúng nền:shop của phòng; thiếu token thì báo lỗi rõ
  const tam = path.join(process.env.TMPDIR || '/tmp', `sach-tu-kiem-${process.pid}.json`);
  fs.writeFileSync(tam, JSON.stringify({ data: [{ platform: 'kdp', store: 'a' }, { platform: 'kdp', store: 'b' }, { platform: 'etsy', store: 'a' }] }));
  process.env.CTY_SACH_TEP = tam; a.equal((await docSo(['kdp:a', 'etsy:a'])).length, 2); delete process.env.CTY_SACH_TEP; fs.unlinkSync(tam);
  const tok = process.env.DIRECTUS_TOKEN; delete process.env.DIRECTUS_TOKEN;
  await a.rejects(docSo(['kdp:a']), /thiếu DIRECTUS_TOKEN/); if (tok) process.env.DIRECTUS_TOKEN = tok;
  a.equal(await dayChuyen('thu-nghiem'), null, 'phòng không khai sổ → không có dây chuyền');
  console.log('✓ sach.mjs: tự kiểm đạt');
}
