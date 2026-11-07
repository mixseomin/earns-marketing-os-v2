// PHẦN CHUNG CỦA CÁC MÁY VIẾT KÊNH (audit 07/11/2026: cùng các định nghĩa này từng chép tay ở 6 máy, màu + ký hiệu playlist gõ tay ở 10 máy): thứ tự nhà, ngày tháng, ký hiệu sao, nhãn playlist.
export const THANG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const THU = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
export const KY = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', Chiron: '⚷', Lilith: '⚸', Ceres: '⚳', Eris: '⯰', Ascendant: 'AC', MC: 'MC' };
/** năm thiên văn → chữ: -0584 → "585 BC", 1066 → "1066" */
export const namChu = (y) => (y <= 0 ? `${1 - y} BC` : String(y));
export const tachNgay = (d) => { const m = /^(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(d); return m ? { y: +m[1], m: m[2] ? +m[2] : null, d: m[3] ? +m[3] : null } : null; };
/** "2014-08-23" → "August 23, 2014" · "2012-04" → "April 2012" · "1066" → "1066" */
export const ngayChu = (s) => { const n = tachNgay(s); return n.d ? `${THANG[n.m - 1]} ${n.d}, ${namChu(n.y)}` : n.m ? `${THANG[n.m - 1]} ${namChu(n.y)}` : namChu(n.y); };
/** nhãn playlist trên trang dựng (tap.playlist = { ten, mau màu, ic }) lấy từ sổ kênh: playlist.mau_nhan + playlist.ic. Lưu ý: playlist.mau trong sổ là DANH SÁCH MẪU, không phải màu */
export const nhanPlaylist = (pl) => ({ ten: pl.ten, mau: pl.mau_nhan, ic: pl.ic });

if (process.argv[1]?.endsWith('viet-chung.mjs')) {
  const { strict: t } = await import('node:assert');
  t.equal(THU(1), '1st'); t.equal(THU(2), '2nd'); t.equal(THU(3), '3rd'); t.equal(THU(11), '11th'); t.equal(THU(12), '12th');
  t.equal(ngayChu('2014-08-23'), 'August 23, 2014'); t.equal(ngayChu('2012-04'), 'April 2012'); t.equal(ngayChu('1066'), '1066'); t.equal(ngayChu('-0584-05-28'), 'May 28, 585 BC');
  t.deepEqual(nhanPlaylist({ ten: 'A', mau_nhan: '#111', ic: 'x', mau: ['m'] }), { ten: 'A', mau: '#111', ic: 'x' });
  console.log('viet-chung: tự kiểm đạt');
}
