// TÌM ẢNH THẬT TRÊN MẠNG QUANH MỘT ĐIỂM (anh 17/11/2026: "thêm tính năng tìm ảnh trên mạng tại vị trí đó") — dùng chung:
//   máy chủ kênh (server/kenh.mjs, GET /mp/anh-quanh — nút 📷 trên trang) và lệnh kỹ sư (scripts/tim-anh.mjs — Thắng tải ảnh về đo mặt tiền).
// Hai nguồn, đều có giấy phép mở + toạ độ chỗ chụp:
//   - Wikimedia Commons: geosearch theo toạ độ chỗ chụp (không cần khoá). Commons không có hướng camera → nhinVao = null.
//   - Mapillary: ảnh đường phố, vị trí + hướng camera do Mapillary TÍNH LẠI (computed_*) — biết ảnh có NHÌN VÀO điểm đó không. Cần khoá (MLY_TOKEN).
// Mapillary chỉ giữ ảnh NHÌN VÀO điểm (lệch hướng ≤ 40°); Commons giữ hết (không có hướng). Thứ tự: xem timAnhQuanh.
// timAnhQuanh({ lat, lng, r = 120, mly, huong }) → { anh: [{ nguon, id, lat, lng, kc, toi, huong, lechNhin, doan, nhinVao, nho, lon, trang, tacGia, giayPhep, luc }], khac: […] }
// tra-repo-ok: gọi thẳng API Commons + Graph API Mapillary (như scripts/tai-mapillary.mjs, tai-anh-doi-chieu.mjs).
import { taiMang } from './tai-mang.mjs';
const M = 111320, rad = (d) => (d * Math.PI) / 180;
const boThe = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function doLech(lat, lng, la, lo) { // khoảng cách (m) + hướng la bàn TỪ chỗ chụp TỚI điểm (bắc = 0, theo chiều kim)
  const mx = M * Math.cos(rad(lat)), dx = (lng - lo) * mx, dn = (lat - la) * M;
  return { kc: Math.hypot(dx, dn), toi: ((Math.atan2(dx, dn) * 180) / Math.PI + 360) % 360 };
}
async function commons(lat, lng, r) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: String(Math.min(10000, Math.max(10, r))),
    ggsnamespace: '6', ggslimit: '50', prop: 'coordinates|imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1280', iiextmetadatafilter: 'Artist|LicenseShortName|DateTimeOriginal' })) u.searchParams.set(k, v);
  const j = await (await taiMang(u, {}, { thoiGian: 15 })).json();
  return Object.values(j.query?.pages || {}).map((p) => {
    const ii = p.imageinfo?.[0], c = p.coordinates?.[0]; if (!ii || !c || !/\.(jpe?g|png|webp)$/i.test(p.title)) return null;
    const m = ii.extmetadata || {}, { kc, toi } = doLech(lat, lng, c.lat, c.lon);
    return { nguon: 'commons', id: p.title.replace(/^File:/, ''), lat: c.lat, lng: c.lon, kc: Math.round(kc), toi: Math.round(toi), huong: null, nhinVao: null,
      // Commons chỉ nhận cỡ thu nhỏ CHUẨN (500, 1280…) — 480 px trả 400
      nho: ii.thumburl?.replace(/\/\d+px-/, '/500px-') || ii.thumburl, lon: ii.thumburl || ii.url, rong: ii.width, cao: ii.height, trang: ii.descriptionurl,
      tacGia: boThe(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons', giayPhep: boThe(m.LicenseShortName?.value) || '?', luc: boThe(m.DateTimeOriginal?.value).slice(0, 10) || null };
  }).filter(Boolean);
}
// ống kính Mapillary (mô hình OpenSfM: camera_type + camera_parameters [f, k1, k2]) — ảnh GoPro góc rộng méo thùng (k1 −0,13, 24/11/2026: 3 ảnh Torbau trượt
// định vị vì PnP coi ảnh là lỗ kim). tim-anh.mjs ghi vào sổ ảnh web, khu-meo.py nắn thẳng trước khi đo.
const ongKinh = (x) => (x.camera_type ? { kieu: x.camera_type, thamSo: x.camera_parameters || null } : null);
async function mapillary(lat, lng, r, mly) {
  if (!mly) return [];
  const mx = M * Math.cos(rad(lat)), dy = r / M, dx = r / mx;
  const f = 'id,computed_geometry,computed_compass_angle,thumb_1024_url,thumb_2048_url,captured_at,creator,is_pano,camera_type,camera_parameters,width,height';
  const res = await taiMang(`https://graph.mapillary.com/images?access_token=${mly}&fields=${f}&bbox=${lng - dx},${lat - dy},${lng + dx},${lat + dy}&limit=500`, {}, { thoiGian: 20 });
  if (!res.ok) throw new Error('Mapillary ' + res.status);
  return ((await res.json()).data || []).filter((x) => !x.is_pano && x.camera_type !== 'spherical' && x.computed_geometry && x.thumb_1024_url).map((x) => {
    const [lo, la] = x.computed_geometry.coordinates, { kc, toi } = doLech(lat, lng, la, lo), h = x.computed_compass_angle;
    const lech = h == null ? null : Math.abs((((h - toi) % 360) + 540) % 360 - 180);
    return { nguon: 'mapillary', id: x.id, lat: la, lng: lo, kc: Math.round(kc), toi: Math.round(toi), huong: h == null ? null : Math.round(h), nhinVao: lech == null ? null : lech <= 40 || kc < 6,
      nho: x.thumb_1024_url, lon: x.thumb_2048_url || x.thumb_1024_url, rong: x.width, cao: x.height, trang: `https://www.mapillary.com/app/?pKey=${x.id}`,
      tacGia: (x.creator?.username || 'Mapillary') + ' / Mapillary', giayPhep: 'CC BY-SA 4.0', luc: x.captured_at ? new Date(x.captured_at).toISOString().slice(0, 10) : null, ongKinh: ongKinh(x) };
  }).filter((x) => x.kc <= r);
}
// ẢNH COMMONS THEO DANH MỤC PHẦN LÂU ĐÀI (anh 17/11/2026 đứng sân trên: Commons gần như không có hướng chụp — 1/50 — còn ảnh đúng nhất "Oberer Schlosshof"
// lại KHÔNG có toạ độ). Commons xếp ảnh theo phần (Courtyard / East gate interior·exterior / Ritterbau / Towers) và theo hướng nhìn ("Views … from east/…"),
// có danh mục riêng ảnh chụp TỪ lâu đài ra ngoài ("Views from …") → loại. Bảng ghép khu trên mô hình → danh mục (Neuschwanstein; lâu đài khác chưa có thì rỗng).
const DM = {
  san: ['Courtyard of Neuschwanstein Castle'], congTrong: ['East gate (interior view) of the Neuschwanstein Castle'], congNgoai: ['East gate (exterior view) of the Neuschwanstein Castle', 'Gate towers of Neuschwanstein Castle'],
  ritter: ['Ritterbau of Neuschwanstein Castle'], thap: ['Towers of Neuschwanstein Castle', 'East tower of the Neuschwanstein Castle'], mat: ['Facades of Neuschwanstein Castle'],
  tu: { 0: 'Views of Neuschwanstein Castle from south', 90: 'Views of Neuschwanstein Castle from west', 180: 'Views of Neuschwanstein Castle from north', 270: 'Views of Neuschwanstein Castle from east' },
  ra: 'Views from Neuschwanstein Castle',
};
const TRONG = new Set(['courtyard', 'Palas', 'Kemenate', 'Ritterhaus', 'Viereckturm', 'Treppenturm', 'Wintergarten']);
export function chonDanhMuc({ khu, khuCam, huong }) { // khu = khu điểm đang nhìn, khuCam = khu chỗ camera / nhân vật đứng (ns.js khuTai)
  const ds = [], camTrong = khuCam === 'courtyard' || (TRONG.has(khuCam) && khuCam !== 'Torbau');
  if (camTrong) ds.push(...DM.san);
  if (khu === 'Torbau') ds.push(...(camTrong ? DM.congTrong : DM.congNgoai));
  if (khu === 'Ritterhaus') ds.push(...DM.ritter);
  if (khu === 'Viereckturm' || khu === 'Treppenturm') ds.push(...DM.thap);
  if (!camTrong) { if (Number.isFinite(huong)) ds.push(DM.tu[(Math.round(huong / 90) % 4) * 90]); ds.push(...DM.mat); }
  return [...new Set(ds)];
}
const NHO_DM = new Map(); // danh mục → { luc, ds } (1 ngày)
async function commonsDanhMuc(dm) {
  const n = NHO_DM.get(dm); if (n && Date.now() - n.luc < 864e5) return n.ds;
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [k, v] of Object.entries({ action: 'query', format: 'json', generator: 'categorymembers', gcmtitle: 'Category:' + dm, gcmtype: 'file', gcmlimit: '60', gcmsort: 'timestamp', gcmdir: 'desc',
    prop: 'imageinfo|categories', clshow: '!hidden', cllimit: 'max', iiprop: 'url|size|extmetadata', iiurlwidth: '1280', iiextmetadatafilter: 'Artist|LicenseShortName|DateTimeOriginal' })) u.searchParams.set(k, v);
  const j = await (await taiMang(u, {}, { thoiGian: 15 })).json();
  const ds = Object.values(j.query?.pages || {}).map((p) => {
    const ii = p.imageinfo?.[0]; if (!ii || !/\.(jpe?g|png|webp)$/i.test(p.title)) return null;
    if ((p.categories || []).some((c) => c.title === 'Category:' + DM.ra)) return null; // chụp từ lâu đài ra ngoài
    const m = ii.extmetadata || {};
    return { nguon: 'commons', id: p.title.replace(/^File:/, ''), lat: null, lng: null, kc: null, huong: null, danhMuc: dm.replace(/ of (the )?Neuschwanstein Castle| Neuschwanstein Castle/, ''),
      nho: ii.thumburl?.replace(/\/\d+px-/, '/500px-') || ii.thumburl, lon: ii.thumburl || ii.url, rong: ii.width, cao: ii.height, trang: ii.descriptionurl,
      tacGia: boThe(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons', giayPhep: boThe(m.LicenseShortName?.value) || '?', luc: boThe(m.DateTimeOriginal?.value).slice(0, 10) || null };
  }).filter(Boolean);
  NHO_DM.set(dm, { luc: Date.now(), ds }); return ds;
}
const gocLech = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
// huong (tuỳ chọn) = hướng la bàn camera đang nhìn (bắc = 0, theo chiều kim) — anh 17/11/2026: "ảnh tìm tự động không khớp hướng nhìn của nhân vật".
//   Mapillary (có hướng camera thật): KHỚP khi hướng chụp lệch hướng nhìn ≤ 35° VÀ ảnh nhìn vào điểm.
//   Commons (đo 17/11: 1/50 ảnh quanh Torbau có hướng, cả trang mô tả lẫn EXIF): chỉ SUY RA — chụp cách điểm ≥ 12 m từ phía sau lưng camera
//   (hướng chỗ chụp → điểm lệch hướng nhìn ≤ 30°, coi như người chụp đang chụp chính chỗ đó) → doan = true, giao diện ghi "hướng suy ra".
//   Còn lại vào `khac` (giao diện ẩn sau nút "+N ảnh khác hướng").
export async function timAnhQuanh({ lat, lng, r = 120, mly = null, toiDa = 60, huong = null, khu = null, khuCam = null }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('thiếu lat / lng');
  r = Math.max(15, Math.min(400, r));
  const dm = chonDanhMuc({ khu, khuCam, huong });
  const loi = [], [c, m, ...dmAnh] = await Promise.all([commons(lat, lng, r).catch((e) => (loi.push('Commons: ' + e.message), [])), mapillary(lat, lng, r, mly).catch((e) => (loi.push(e.message), [])),
    ...dm.map((d) => commonsDanhMuc(d).catch((e) => (loi.push('Commons danh mục: ' + e.message), [])))]);
  const theoDm = [], daCo = new Set(); for (const x of dmAnh.flat()) if (!daCo.has(x.id)) { daCo.add(x.id); theoDm.push(x); }
  // Mapillary: chỉ giữ ảnh nhìn vào điểm (ảnh quay lưng lại vô dụng để sửa), mỗi ô 10 m + mỗi 30° hướng một ảnh mới nhất cho khỏi trùng chuỗi chụp liên tiếp
  const o = new Map(); for (const x of m.filter((x) => x.nhinVao)) { const k = `${Math.round(x.lat * 9000)}:${Math.round(x.lng * 6000)}:${Math.round(x.huong / 30)}`; if (!o.has(k) || x.luc > o.get(k).luc) o.set(k, x); }
  const tatCa = [...c, ...o.values()];
  if (!Number.isFinite(huong)) { // không có hướng nhìn: như trước — Mapillary trước, Commons chụp xa, Commons chụp ngay tại điểm cuối
    const hang = (x) => (x.nguon === 'mapillary' ? 0 : x.kc >= 15 ? 1 : 2);
    return { anh: [...tatCa.sort((a, b) => hang(a) - hang(b) || a.kc - b.kc), ...theoDm.filter((x) => !tatCa.some((y) => y.id === x.id))].slice(0, toiDa), khac: [], danhMuc: dm, loi, coMapillary: !!mly };
  }
  // Mapillary có hướng thật → khớp khi lệch ≤ 35°. Commons chỉ có toạ độ (không hướng) → nhóm khác: "suy hướng từ chỗ chụp" đã sai thật
  // (17/11/2026: cảnh hồ Alpsee chụp từ ban công lọt vào khi đứng sân trên nhìn Palas). Commons theo danh mục (đúng phần lâu đài / đúng phía nhìn) xếp sau Mapillary.
  const anh = [], khac = [], daDm = new Set(theoDm.map((x) => x.id));
  for (const x of tatCa) {
    if (x.nguon === 'mapillary' && x.huong != null) { x.lechNhin = Math.round(gocLech(x.huong, huong)); (x.lechNhin <= 35 ? anh : khac).push(x); }
    else if (!daDm.has(x.id)) { x.lechNhin = Math.round(gocLech(x.toi, huong)); x.doan = true; khac.push(x); }
  }
  anh.sort((a, b) => a.lechNhin / 35 + a.kc / r - (b.lechNhin / 35 + b.kc / r)); khac.sort((a, b) => a.lechNhin - b.lechNhin || a.kc - b.kc);
  return { anh: [...anh, ...theoDm].slice(0, toiDa), khac: khac.slice(0, toiDa), danhMuc: dm, loi, coMapillary: !!mly };
}

// mã ảnh gọn (c:<tên tệp Commons> · m:<id Mapillary>, nút 📷 ghi vào thẻ) → chi tiết đủ để tải + ghi công (scripts/tim-anh.mjs --the)
export async function chiTietAnh(ma, mly = null) {
  const [loai, id] = [ma.slice(0, 1), ma.slice(2)];
  if (loai === 'c') {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    for (const [k, v] of Object.entries({ action: 'query', format: 'json', titles: 'File:' + id, prop: 'coordinates|imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1920', iiextmetadatafilter: 'Artist|LicenseShortName|DateTimeOriginal' })) u.searchParams.set(k, v);
    const p = Object.values((await (await taiMang(u, {}, { thoiGian: 15 })).json()).query?.pages || {})[0], ii = p?.imageinfo?.[0];
    if (!ii) throw new Error('Commons không có tệp ' + id);
    const m = ii.extmetadata || {}, c = p.coordinates?.[0];
    return { nguon: 'commons', id, lat: c?.lat ?? null, lng: c?.lon ?? null, huong: null, url: ii.thumburl || ii.url, trang: ii.descriptionurl,
      tacGia: boThe(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons', giayPhep: boThe(m.LicenseShortName?.value) || '?', luc: boThe(m.DateTimeOriginal?.value).slice(0, 10) || null };
  }
  if (loai === 'm') {
    if (!mly) throw new Error('thiếu khoá Mapillary cho ảnh ' + id);
    const x = await (await taiMang(`https://graph.mapillary.com/${id}?access_token=${mly}&fields=computed_geometry,computed_compass_angle,thumb_2048_url,captured_at,creator,camera_type,camera_parameters`, {}, { thoiGian: 20 })).json();
    if (!x.thumb_2048_url) throw new Error('Mapillary không trả ảnh ' + id);
    const [lo, la] = x.computed_geometry?.coordinates || [null, null];
    return { nguon: 'mapillary', id, lat: la, lng: lo, huong: x.computed_compass_angle == null ? null : Math.round(x.computed_compass_angle), url: x.thumb_2048_url,
      trang: `https://www.mapillary.com/app/?pKey=${id}`, tacGia: (x.creator?.username || 'Mapillary') + ' / Mapillary', giayPhep: 'CC BY-SA 4.0', luc: x.captured_at ? new Date(x.captured_at).toISOString().slice(0, 10) : null, ongKinh: ongKinh(x) };
  }
  throw new Error('mã ảnh lạ: ' + ma);
}
