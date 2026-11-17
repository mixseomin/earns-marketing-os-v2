// TÌM ẢNH THẬT TRÊN MẠNG QUANH MỘT ĐIỂM (anh 17/11/2026: "thêm tính năng tìm ảnh trên mạng tại vị trí đó") — dùng chung:
//   máy chủ kênh (server/kenh.mjs, GET /mp/anh-quanh — nút 📷 trên trang) và lệnh kỹ sư (scripts/tim-anh.mjs — Thắng tải ảnh về đo mặt tiền).
// Hai nguồn, đều có giấy phép mở + toạ độ chỗ chụp:
//   - Wikimedia Commons: geosearch theo toạ độ chỗ chụp (không cần khoá). Commons không có hướng camera → nhinVao = null.
//   - Mapillary: ảnh đường phố, vị trí + hướng camera do Mapillary TÍNH LẠI (computed_*) — biết ảnh có NHÌN VÀO điểm đó không. Cần khoá (MLY_TOKEN).
// Mapillary chỉ giữ ảnh NHÌN VÀO điểm (lệch hướng ≤ 40°); Commons giữ hết (không có hướng). Thứ tự: xem timAnhQuanh.
// timAnhQuanh({ lat, lng, r = 120, mly }) → [{ nguon, id, lat, lng, kc, huong, nhinVao, nho, lon, trang, tacGia, giayPhep, luc }]
// tra-repo-ok: gọi thẳng API Commons + Graph API Mapillary (như scripts/tai-mapillary.mjs, tai-anh-doi-chieu.mjs).
const UA = { 'User-Agent': 'castle-lau-dai-that/1.0 (anh-quanh)' };
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
  const j = await (await fetch(u, { headers: UA, signal: AbortSignal.timeout(15000) })).json();
  return Object.values(j.query?.pages || {}).map((p) => {
    const ii = p.imageinfo?.[0], c = p.coordinates?.[0]; if (!ii || !c || !/\.(jpe?g|png|webp)$/i.test(p.title)) return null;
    const m = ii.extmetadata || {}, { kc } = doLech(lat, lng, c.lat, c.lon);
    return { nguon: 'commons', id: p.title.replace(/^File:/, ''), lat: c.lat, lng: c.lon, kc: Math.round(kc), huong: null, nhinVao: null,
      // Commons chỉ nhận cỡ thu nhỏ CHUẨN (500, 1280…) — 480 px trả 400
      nho: ii.thumburl?.replace(/\/\d+px-/, '/500px-') || ii.thumburl, lon: ii.thumburl || ii.url, rong: ii.width, cao: ii.height, trang: ii.descriptionurl,
      tacGia: boThe(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons', giayPhep: boThe(m.LicenseShortName?.value) || '?', luc: boThe(m.DateTimeOriginal?.value).slice(0, 10) || null };
  }).filter(Boolean);
}
async function mapillary(lat, lng, r, mly) {
  if (!mly) return [];
  const mx = M * Math.cos(rad(lat)), dy = r / M, dx = r / mx;
  const f = 'id,computed_geometry,computed_compass_angle,thumb_1024_url,thumb_2048_url,captured_at,creator,is_pano,camera_type,width,height';
  const res = await fetch(`https://graph.mapillary.com/images?access_token=${mly}&fields=${f}&bbox=${lng - dx},${lat - dy},${lng + dx},${lat + dy}&limit=500`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('Mapillary ' + res.status);
  return ((await res.json()).data || []).filter((x) => !x.is_pano && x.camera_type !== 'spherical' && x.computed_geometry && x.thumb_1024_url).map((x) => {
    const [lo, la] = x.computed_geometry.coordinates, { kc, toi } = doLech(lat, lng, la, lo), h = x.computed_compass_angle;
    const lech = h == null ? null : Math.abs((((h - toi) % 360) + 540) % 360 - 180);
    return { nguon: 'mapillary', id: x.id, lat: la, lng: lo, kc: Math.round(kc), huong: h == null ? null : Math.round(h), nhinVao: lech == null ? null : lech <= 40 || kc < 6,
      nho: x.thumb_1024_url, lon: x.thumb_2048_url || x.thumb_1024_url, rong: x.width, cao: x.height, trang: `https://www.mapillary.com/app/?pKey=${x.id}`,
      tacGia: (x.creator?.username || 'Mapillary') + ' / Mapillary', giayPhep: 'CC BY-SA 4.0', luc: x.captured_at ? new Date(x.captured_at).toISOString().slice(0, 10) : null };
  }).filter((x) => x.kc <= r);
}
export async function timAnhQuanh({ lat, lng, r = 120, mly = null, toiDa = 60 }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('thiếu lat / lng');
  r = Math.max(15, Math.min(400, r));
  const loi = [], [c, m] = await Promise.all([commons(lat, lng, r).catch((e) => (loi.push('Commons: ' + e.message), [])), mapillary(lat, lng, r, mly).catch((e) => (loi.push(e.message), []))]);
  // Mapillary: chỉ giữ ảnh nhìn vào điểm (ảnh quay lưng lại vô dụng để sửa), mỗi ô 10 m một ảnh mới nhất cho khỏi trùng chuỗi chụp liên tiếp
  const o = new Map(); for (const x of m.filter((x) => x.nhinVao)) { const k = `${Math.round(x.lat * 9000)}:${Math.round(x.lng * 6000)}:${Math.round(x.huong / 30)}`; if (!o.has(k) || x.luc > o.get(k).luc) o.set(k, x); }
  // xếp (anh 17/11/2026: ảnh Commons chụp NGAY tại điểm phần lớn là cảnh núi chụp ra ngoài): Mapillary nhìn vào điểm trước, rồi Commons chụp cách ≥ 15 m
  // (đứng xa chụp lại → hay thấy chính chỗ đó), Commons chụp ngay tại điểm xuống cuối; trong mỗi nhóm gần trước
  const hang = (x) => (x.nguon === 'mapillary' ? 0 : x.kc >= 15 ? 1 : 2);
  const ds = [...c, ...o.values()].sort((a, b) => hang(a) - hang(b) || a.kc - b.kc);
  return { anh: ds.slice(0, toiDa), loi, coMapillary: !!mly };
}

// mã ảnh gọn (c:<tên tệp Commons> · m:<id Mapillary>, nút 📷 ghi vào thẻ) → chi tiết đủ để tải + ghi công (scripts/tim-anh.mjs --the)
export async function chiTietAnh(ma, mly = null) {
  const [loai, id] = [ma.slice(0, 1), ma.slice(2)];
  if (loai === 'c') {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    for (const [k, v] of Object.entries({ action: 'query', format: 'json', titles: 'File:' + id, prop: 'coordinates|imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '2400', iiextmetadatafilter: 'Artist|LicenseShortName|DateTimeOriginal' })) u.searchParams.set(k, v);
    const p = Object.values((await (await fetch(u, { headers: UA, signal: AbortSignal.timeout(15000) })).json()).query?.pages || {})[0], ii = p?.imageinfo?.[0];
    if (!ii) throw new Error('Commons không có tệp ' + id);
    const m = ii.extmetadata || {}, c = p.coordinates?.[0];
    return { nguon: 'commons', id, lat: c?.lat ?? null, lng: c?.lon ?? null, huong: null, url: ii.thumburl || ii.url, trang: ii.descriptionurl,
      tacGia: boThe(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons', giayPhep: boThe(m.LicenseShortName?.value) || '?', luc: boThe(m.DateTimeOriginal?.value).slice(0, 10) || null };
  }
  if (loai === 'm') {
    if (!mly) throw new Error('thiếu khoá Mapillary cho ảnh ' + id);
    const x = await (await fetch(`https://graph.mapillary.com/${id}?access_token=${mly}&fields=computed_geometry,computed_compass_angle,thumb_2048_url,captured_at,creator`, { signal: AbortSignal.timeout(20000) })).json();
    if (!x.thumb_2048_url) throw new Error('Mapillary không trả ảnh ' + id);
    const [lo, la] = x.computed_geometry?.coordinates || [null, null];
    return { nguon: 'mapillary', id, lat: la, lng: lo, huong: x.computed_compass_angle == null ? null : Math.round(x.computed_compass_angle), url: x.thumb_2048_url,
      trang: `https://www.mapillary.com/app/?pKey=${id}`, tacGia: (x.creator?.username || 'Mapillary') + ' / Mapillary', giayPhep: 'CC BY-SA 4.0', luc: x.captured_at ? new Date(x.captured_at).toISOString().slice(0, 10) : null };
  }
  throw new Error('mã ảnh lạ: ' + ma);
}
