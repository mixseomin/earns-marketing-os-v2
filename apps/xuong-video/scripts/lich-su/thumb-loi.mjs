// Xếp lời chặn thumbnail của Ngọc thành lỗi CHỮ (thử bản gọn cùng ảnh) hay lỗi ẢNH (đổi ảnh) — thumb.mjs gọi; tự kiểm: node thumb-loi.mjs
// "rối" ở BẢN GỌN (chỉ còn chữ to + tên kênh) = ẢNH rối, không phải chữ (05/11/2026, Agincourt: "rối, không có điểm nhìn — tranh trận chiến nhiều chi tiết"
// bị xếp là lỗi chữ → dừng luôn, không thử ảnh 3) → bản gọn mà còn rối thì đổi ảnh.
export function loaiChanThumb(chan, gon) {
  return {
    veChu: chan.some((c) => /chữ khó đọc|quá 5 từ|tràn|lặp nguyên tiêu đề/.test(c) || (!gon && /rối/.test(c))),
    veAnh: chan.some((c) => /chủ thể|điểm nhìn|lệch|AI|logo|nhạy cảm/.test(c) || (gon && /rối/.test(c))),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (await import('node:assert')).default;
  const roi = ['thumbnail: rối mắt (Ngọc: tranh nhiều chi tiết)'];   // không kèm "điểm nhìn" — kẻo khớp nhánh ảnh, test không cô lập luật bản gọn
  assert.deepEqual(loaiChanThumb(roi, false), { veChu: true, veAnh: false }, 'bản đủ rối → thử bản gọn');
  assert.equal(loaiChanThumb(['thumbnail: rối, không có điểm nhìn'], false).veAnh, true, 'không có điểm nhìn = lỗi ảnh');
  assert.deepEqual(loaiChanThumb(roi, true), { veChu: false, veAnh: true }, 'bản gọn rối → đổi ảnh');
  assert.deepEqual(loaiChanThumb(['thumbnail: chữ khó đọc'], true), { veChu: true, veAnh: false }, 'chữ khó đọc ở bản gọn vẫn là lỗi chữ');
  assert.deepEqual(loaiChanThumb([], true), { veChu: false, veAnh: false });
  console.log('thumb-loi: đạt');
}
