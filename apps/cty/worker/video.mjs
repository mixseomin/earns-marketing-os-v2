// DÂY CHUYỀN VIDEO của Phòng Sách (anh 12/10/2026: "tổ chức việc video trong phòng"; nguồn 'video' trong quy-trinh/sach/danh-sach.json `day_chuyen`).
// Đơn vị việc = 1 video (1 chủ đề ô chữ tặng → 1 clip → 4 nền). Hai nguồn, đều do máy ghi, phòng chỉ ĐỌC:
//   · số đo: MOS2 kenh_so_ngay (puzzle-books scripts/so-short.mjs, MacBook sau lượt 20:05) — video đã đăng + lượt xem cộng dồn + vào shop 7 ngày;
//   · lượt đăng: ${CTY_DATA_DIR}/may/video-<nền>.json (puzzle-books scripts/dang-short.mjs ghi sau MỖI lượt) — đăng được / lỗi gì, kho, video kế.
// Từ đó: trạng thái hôm nay của từng nền, kho, thẻ video, và việc trễ (máy lỗi / quá giờ không có tin / số đo cũ / kho sắp cạn) → giao theo
// quy trình như việc của dây chuyền sách (máy làm thay → người chủ trì quy trình đó).   node worker/video.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';

// nền: mã của máy đăng (tệp may/) · tên · kenh trong kenh_so_ngay · giờ đăng VN (phút trong ngày) — theo LaunchAgent của puzzle-books
export const NEN_VIDEO = [
  { nen: 'tiktok', ten: 'TikTok', kenh: 'tiktok', gio: 20 * 60 },
  { nen: 'youtube', ten: 'YouTube', kenh: 'youtube', gio: 20 * 60 + 5 },
  { nen: 'facebook', ten: 'Facebook', kenh: 'fb-reels', gio: 20 * 60 + 5 },
  { nen: 'instagram', ten: 'Instagram', kenh: 'ig-reels', gio: 20 * 60 + 5 },
];
const CHO_TIN = 30;       // phút sau giờ đăng: lượt (đăng + bình luận) chạy xong trong khoảng này; quá mà không có tin = trễ
export const KHO_CAN = 14; // kho dưới chừng này ngày → việc chọn chủ đề / dựng thêm
const truNgay = (iso, n) => new Date(Date.parse(iso) - n * 86_400_000).toISOString().slice(0, 10);
const cachNgay = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
/** Phút hiện tại theo giờ VN (0–1439). */
export const phutVN = () => { const [h, m] = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).split(':').map(Number); return (h % 24) * 60 + m; };
export const gioChu = (p) => `${String(Math.floor(p / 60)).padStart(2, '0')}:${String(p % 60).padStart(2, '0')}`;
/** Ảnh khung hình: YouTube có ảnh công khai theo mã video; nền khác không có → thẻ chỉ có chữ. */
export const anhVideo = (url) => { const id = String(url ?? '').match(/shorts\/([\w-]{11})/)?.[1]; return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null; };
/** Tên tạm từ slug khi video chưa đăng (chưa có tiêu đề trong số đo): thanksgiving-word-search-an → thanksgiving word search */
export const tenSlug = (s) => String(s ?? '').replace(/-an$/, '').replace(/-/g, ' ');

/** Tệp lượt đăng mới nhất của từng nền. Thiếu thư mục / tệp hỏng → bỏ qua nền đó (làn hiện "chưa có tin"). */
export function docMay(dir = path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'may')) {
  const kq = {};
  for (const { nen } of NEN_VIDEO) { try { kq[nen] = JSON.parse(fs.readFileSync(path.join(dir, `video-${nen}.json`), 'utf8')); } catch { /* chưa có lượt nào báo */ } }
  return kq;
}

/** so = dòng kenh_so_ngay ({kenh, san_pham, ngay, hien, chi_tiet}) · may = docMay() · hom = ngày VN · phut = phút hiện tại VN. */
export function lanVideo({ so, may, hom, phut }) {
  const KENH = new Set(NEN_VIDEO.map((n) => n.kenh));
  const dong = so.filter((r) => KENH.has(r.kenh));
  const soMoi = dong.map((r) => r.ngay).sort().pop() ?? null;   // ngày đo gần nhất (mọi nền)
  // video theo slug, gộp các nền; mỗi (kenh, sách) lấy dòng đo mới nhất
  const moiNhat = new Map(); for (const r of dong) { const k = `${r.kenh}|${r.san_pham}`; if (!moiNhat.has(k) || moiNhat.get(k).ngay < r.ngay) moiNhat.set(k, r); }
  const V = new Map(); let vaoShop = 0; const vaoNen = {};
  for (const r of moiNhat.values()) {
    const ct = r.chi_tiet ?? {}; const vs = (ct.vaoShop7 ?? 0) + (ct.vaoShopChung7 ?? 0); vaoShop += vs; vaoNen[r.kenh] = (vaoNen[r.kenh] ?? 0) + vs;
    for (const v of ct.videos ?? []) {
      const x = V.get(v.slug) ?? { slug: v.slug, tieuDe: v.tieuDe ?? tenSlug(v.slug), ngayDang: v.ngayDang ?? null, sach: r.san_pham, anh: null, nen: {}, xem: 0 };
      x.nen[r.kenh] = { url: v.url ?? null, xem: v.xem ?? null, ngayDang: v.ngayDang ?? null };
      x.xem += v.xem ?? 0; if (v.ngayDang && (!x.ngayDang || v.ngayDang < x.ngayDang)) x.ngayDang = v.ngayDang;
      x.anh ??= anhVideo(v.url); V.set(v.slug, x);
    }
  }
  const videos = [...V.values()].sort((a, b) => (b.ngayDang ?? '').localeCompare(a.ngayDang ?? '') || a.slug.localeCompare(b.slug));
  const homQua = truNgay(hom, 1); const viec = [];
  const nen = NEN_VIDEO.map(({ nen, ten, kenh, gio }) => {
    const m = may[nen] ?? null;
    const ganNhat = [m?.ok ? m.ngay : null, ...videos.map((v) => v.nen[kenh]?.ngayDang)].filter(Boolean).sort().pop() ?? null;
    const han = phut >= gio + CHO_TIN ? hom : homQua;   // phải có video tới ngày này (chưa tới giờ hôm nay → tính tới hôm qua)
    let trang;
    // lượt gần nhất lỗi (kể cả hôm qua) = lỗi tới khi có lượt đăng được — trừ khi số đo đã thấy chính video đó lên nền này từ ngày lượt lỗi trở đi (đăng tay bù)
    const daBu = m?.ok === false && m.slug && (V.get(m.slug)?.nen[kenh]?.ngayDang ?? '') >= (m.ngay ?? '9');
    if (m && m.ok === false && !daBu) trang = 'loi';
    else if (ganNhat === hom) trang = 'da';
    else if (ganNhat && ganNhat >= han) trang = 'cho';
    else trang = 'tre';
    const x = { nen, ten, kenh, gio: gioChu(gio), trang, ganNhat, slug: m?.slug ?? null, url: m?.url ?? null, loi: m?.loi ?? null, luc: m?.luc ?? null, ngayTin: m?.ngay ?? null, kho: m?.kho ?? null, ke: m?.ke ?? null, vaoShop: vaoNen[kenh] ?? 0 };
    const qua = ganNhat ? cachNgay(ganNhat, han) : null;
    if (trang === 'loi') viec.push({ ai: 'may', chu: `đăng video ${ten}: lượt ${m.ngay?.slice(8, 10)}/${m.ngay?.slice(5, 7)} lỗi — ${m.loi ?? 'không rõ'}`, qt: 'video-ngan', tre: true, qua, nen, slug: m.slug ?? null });
    else if (trang === 'tre') viec.push({ ai: 'may', chu: `đăng video ${ten}: ${ganNhat ? `không có video mới từ ${ganNhat.slice(8, 10)}/${ganNhat.slice(5, 7)}` : 'chưa đăng video nào'}${m ? '' : ' (máy chưa báo lượt nào)'}`, qt: 'video-ngan', tre: true, qua, nen, slug: null });
    return x;
  });
  const khoDs = nen.map((n) => n.kho).filter((k) => k != null); const kho = khoDs.length ? Math.min(...khoDs) : null;
  const ke = nen.find((n) => n.kho === kho)?.ke ?? null;
  if (kho != null && kho < KHO_CAN) viec.push({ ai: 'truong-phong', muc: 2, chu: `kho video còn ${kho} — chọn chủ đề, dựng thêm`, qt: 'chu-de-video', nen: null, slug: null });
  // số đo: lượt đo chạy sau 20:05; quá 21:30 mà chưa có số hôm nay, hoặc thiếu cả hôm qua = máy đo không chạy
  const hanDo = phut >= 21 * 60 + 30 ? hom : homQua;
  if (videos.length && (!soMoi || soMoi < hanDo)) viec.push({ ai: 'may', chu: `đo lượt xem video: số mới nhất ${soMoi ? `${soMoi.slice(8, 10)}/${soMoi.slice(5, 7)}` : 'chưa có'}`, qt: 'do-video', tre: true, qua: soMoi ? cachNgay(soMoi, hanDo) : null, nen: null, slug: null });
  return { hom, soMoi, nen, kho, ke, videos, vaoShop, xem: videos.reduce((t, v) => t + v.xem, 0), viec,
    dangHom: nen.filter((n) => n.trang === 'da').length, dangDo: videos.filter((v) => v.ngayDang && v.ngayDang > truNgay(hom, 7)).length };
}

if (process.argv.includes('--tu-kiem')) {
  const a = (c, m) => { if (!c) { console.error('✗ video:', m); process.exit(1); } };
  const vid = (slug, kenh, xem, ngayDang, url) => ({ slug, url: url ?? `https://x/${kenh}/${slug}`, xem, ngayDang, tieuDe: slug.toUpperCase() });
  const so = [
    { kenh: 'youtube', san_pham: 'pb:x', ngay: '2026-10-10', hien: 10, chi_tiet: { videos: [vid('a', 'youtube', 10, '2026-10-09', 'https://youtube.com/shorts/sOvP21oq_W4')] } },
    { kenh: 'youtube', san_pham: 'pb:x', ngay: '2026-10-11', hien: 141, chi_tiet: { videos: [vid('a', 'youtube', 141, '2026-10-09', 'https://youtube.com/shorts/sOvP21oq_W4'), vid('b', 'youtube', 5, '2026-10-11')], vaoShop7: 2 } },
    { kenh: 'fb-reels', san_pham: 'pb:x', ngay: '2026-10-11', hien: 33, chi_tiet: { videos: [vid('a', 'fb-reels', 33, '2026-10-09')], vaoShopChung7: 1 } },
    { kenh: 'pinterest', san_pham: 'pb:x', ngay: '2026-10-11', hien: 99, chi_tiet: [] },
  ];
  const may = { youtube: { ok: true, ngay: '2026-10-11', slug: 'b', kho: 53, ke: 'c-an' }, facebook: { ok: false, ngay: '2026-10-11', slug: 'b', loi: 'br click Post', kho: 54 } };
  const t = lanVideo({ so, may, hom: '2026-10-12', phut: 16 * 60 });
  a(t.videos.length === 2 && t.videos[0].slug === 'b' && t.videos[1].xem === 141 + 33, 'gộp video theo slug qua các nền, dòng đo MỚI NHẤT (không cộng 10 của hôm trước), mới đăng trước');
  a(t.videos[1].anh === 'https://i.ytimg.com/vi/sOvP21oq_W4/hqdefault.jpg' && t.videos[0].anh === null, 'ảnh khung hình chỉ từ link YouTube');
  a(t.vaoShop === 3 && t.xem === 179, 'vào shop 7 ngày cộng cả khoản chung; pinterest không tính');
  const n = Object.fromEntries(t.nen.map((x) => [x.nen, x.trang]));
  a(n.youtube === 'cho' && n.facebook === 'loi' && n.instagram === 'tre' && n.tiktok === 'tre', `16:00: YouTube đăng hôm qua = chờ giờ; Facebook lỗi = lỗi; IG/TikTok không có video = trễ (${JSON.stringify(n)})`);
  a(t.kho === 53 && t.ke === 'c-an', 'kho = nền ít nhất');
  a(t.viec.filter((v) => v.qt === 'video-ngan').length === 3 && t.viec.every((v) => v.qt !== 'do-video'), 'việc: 1 lỗi + 2 trễ; số đo hôm qua trước 21:30 chưa trễ');
  const toi = lanVideo({ so, may, hom: '2026-10-12', phut: 21 * 60 + 40 });
  a(toi.nen.find((x) => x.nen === 'youtube').trang === 'tre' && toi.viec.some((v) => v.qt === 'do-video'), '21:40 chưa có video hôm nay = trễ; số đo chưa có hôm nay = việc máy đo');
  const da = lanVideo({ so, may: { ...may, youtube: { ok: true, ngay: '2026-10-12', slug: 'c' } }, hom: '2026-10-12', phut: 20 * 60 + 10 });
  a(da.nen.find((x) => x.nen === 'youtube').trang === 'da' && da.dangHom === 1, 'máy báo đăng được hôm nay = đã đăng');
  a(lanVideo({ so, may: { youtube: { ok: true, ngay: '2026-10-11', kho: 9 } }, hom: '2026-10-12', phut: 600 }).viec.some((v) => v.qt === 'chu-de-video' && v.ai === 'truong-phong'), 'kho < 14 → việc chọn chủ đề');
  const bu = lanVideo({ so, may: { youtube: { ok: false, ngay: '2026-10-11', slug: 'b', loi: 'x' } }, hom: '2026-10-12', phut: 600 });
  a(bu.nen.find((x) => x.nen === 'youtube').trang === 'cho' && !bu.viec.some((v) => v.nen === 'youtube'), 'lượt lỗi nhưng số đo thấy video đó đã lên (đăng tay bù) → không còn lỗi');
  a(lanVideo({ so: [], may: {}, hom: '2026-10-12', phut: 600 }).viec.every((v) => v.qt === 'video-ngan'), 'không có số đo: không kêu máy đo, chỉ báo chưa đăng');
  a(gioChu(1205) === '20:05' && tenSlug('thanksgiving-word-search-an') === 'thanksgiving word search', 'giờ + tên tạm');
  const tam = fs.mkdtempSync('/tmp/cty-video-'); fs.writeFileSync(path.join(tam, 'video-youtube.json'), '{"ok":true}'); fs.writeFileSync(path.join(tam, 'video-tiktok.json'), '{hỏng');
  const m = docMay(tam); a(m.youtube?.ok === true && !('tiktok' in m) && !('facebook' in m), 'docMay: tệp hỏng / thiếu = bỏ qua nền đó');
  fs.rmSync(tam, { recursive: true });
  console.log('✓ video: 12 ca đạt (gộp số đo, trạng thái 4 nền theo giờ, kho, việc trễ, đọc tệp máy)');
}
