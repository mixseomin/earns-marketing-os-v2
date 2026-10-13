// LỆNH CHO MÁY — nút "Chạy lại ngay" trên việc trễ ở tab Dây chuyền (anh 13/10/2026: "nhiệm vụ trễ muốn set để thực hiện trên đó").
// cty chỉ GHI lệnh vào ${CTY_DATA_DIR}/may/lenh/<id>.json; máy Mac (puzzle-books scripts/nhan-lenh.mjs, LaunchAgent mỗi 60 giây) hỏi box, nhận lệnh
// của máy mình, chạy ĐÚNG script nó đã khai, ghi kết quả về cùng tệp → nút đọc lại tệp, hiện "đang chạy / xong / lỗi gì" ngay dưới nút.
// LENH_MAY phải khớp LENH của nhan-lenh.mjs — máy chỉ chạy lệnh có trong danh sách CỦA NÓ (lệnh lạ nằm chờ mãi, cty báo "máy chưa nhận").
//   node worker/lenh-may.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';

export const LENH_MAY = {
  'video:youtube': { may: 'MacBook', ten: 'Đăng video YouTube' },
  'video:facebook': { may: 'MacBook', ten: 'Đăng video Facebook' },
  'video:instagram': { may: 'MacBook', ten: 'Đăng video Instagram' },
  'video:tiktok': { may: 'iMac', ten: 'Đăng video TikTok' },
  'do-video': { may: 'MacBook', ten: 'Đo lượt xem video' },
  'gom-kenh': { may: 'MacBook', ten: 'Gom số kênh kéo khách' },
  // máy SÁCH: nhan-lenh.mjs đánh thức chính việc nền theo lịch (launchctl kickstart) — làm đúng việc lượt theo lịch làm, không hơn. qt = quy trình
  // của việc trễ → dòng việc máy trễ trong bảng có nút; phi = tiền thật mỗi lần (hiện trong ô xác nhận)
  'sach:sx': { may: 'iMac', ten: 'Dựng sách (cuốn tới hạn)', qt: 'san-xuat' },
  'sach:kdp': { may: 'iMac', ten: 'Máy KDP: tạo nháp + bấm Publish (cuốn đã duyệt, tới ngày)', qt: 'dang-kdp' },
  'sach:etsy': { may: 'iMac', ten: 'Bật bán Etsy (cuốn đã duyệt, tới ngày, ≤ 3/ngày)', qt: 'bat-ban-etsy', phi: 'phí Etsy ~$0,20 mỗi cuốn bật bán' },
  'sach:gumroad': { may: 'MacBook', ten: 'Đăng Gumroad (cuốn đã duyệt, tới ngày)', qt: 'dang-gumroad' },
};
export const CHO_NHAN = 5 * 60_000;      // máy hỏi mỗi phút; quá 5 phút chưa nhận = máy đang ngủ / tắt → báo, cho gửi lại
const CHAY_TOI_DA = 30 * 60_000;         // nhan-lenh.mjs dừng script sau 25 phút; quá 30 phút vẫn "đang" = máy chết giữa chừng
const GIU = 7 * 86_400_000;              // tệp lệnh giữ 7 ngày rồi dọn
const THU = () => path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'may', 'lenh');

/** Mọi lệnh (mới trước). Tệp hỏng bỏ qua. */
export function dsLenh(dir = THU()) {
  let ds = []; try { ds = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('.')); } catch { return []; }
  return ds.map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } }).filter(Boolean)
    .sort((a, b) => String(b.luc).localeCompare(String(a.luc)));
}
/** Trạng thái để hiện: cho (chờ máy nhận) · dang · xong · loi · ngu (quá CHO_NHAN chưa nhận) · chet (chạy quá lâu không về). */
export function trangLenh(x, gio = Date.now()) {
  if (x.trang === 'cho') return gio - Date.parse(x.luc) > CHO_NHAN ? 'ngu' : 'cho';
  if (x.trang === 'dang') return gio - Date.parse(x.nhan_luc ?? x.luc) > CHAY_TOI_DA ? 'chet' : 'dang';
  return x.trang === 'xong' ? 'xong' : 'loi';
}
/** Lệnh gần nhất của từng loại lệnh → nút hiện trạng thái lần bấm trước. */
export function lenhGanNhat(dir = THU(), gio = Date.now()) {
  const kq = {}; for (const x of dsLenh(dir)) if (!kq[x.lenh]) kq[x.lenh] = { ...x, hien: trangLenh(x, gio) }; return kq;
}
/** Ghi một lệnh mới. Từ chối lệnh lạ và lệnh cùng loại đang chờ / đang chạy (bấm hai lần ≠ hai lượt đăng). */
export function taoLenh(lenh, ai, dir = THU(), gio = Date.now()) {
  if (!LENH_MAY[lenh]) return { loi: `Lệnh lạ "${lenh}" — máy không nhận.` };
  const truoc = lenhGanNhat(dir, gio)[lenh];
  if (truoc && ['cho', 'dang'].includes(truoc.hien)) return { loi: `Đã có lệnh "${LENH_MAY[lenh].ten}" ${truoc.hien === 'cho' ? 'chờ máy nhận' : `đang chạy trên ${LENH_MAY[lenh].may}`} — đợi lệnh đó xong.` };
  fs.mkdirSync(dir, { recursive: true });
  for (const x of dsLenh(dir)) if (gio - Date.parse(x.luc) > GIU) try { fs.unlinkSync(path.join(dir, `${x.id}.json`)); } catch { /* đã dọn */ }
  const id = `${gio}-${lenh.replace(/[^\w]/g, '-')}`;
  const tam = path.join(dir, `.${id}.tam`);
  fs.writeFileSync(tam, JSON.stringify({ id, lenh, luc: new Date(gio).toISOString(), ai, trang: 'cho' })); fs.renameSync(tam, path.join(dir, `${id}.json`));
  return { id };
}

if (process.argv.includes('--tu-kiem')) {
  const a = (c, m) => { if (!c) { console.error('✗ lenh-may:', m); process.exit(1); } };
  const dir = fs.mkdtempSync('/tmp/cty-lenh-'); const t0 = Date.parse('2026-10-13T03:00:00Z');
  a(taoLenh('rm -rf /', 'x', dir, t0).loi, 'lệnh lạ bị từ chối');
  const l1 = taoLenh('video:youtube', 'anh', dir, t0); a(l1.id && !fs.readdirSync(dir).some((f) => f.endsWith('.tam')), 'ghi lệnh (không để tệp tạm)');
  a(/chờ máy nhận/.test(taoLenh('video:youtube', 'anh', dir, t0 + 1000).loi ?? ''), 'bấm lần hai khi lệnh trước còn chờ → từ chối');
  a(taoLenh('video:facebook', 'anh', dir, t0 + 1000).id, 'lệnh loại khác vẫn gửi được');
  a(lenhGanNhat(dir, t0 + CHO_NHAN + 1000)['video:youtube'].hien === 'ngu', 'quá 5 phút chưa nhận → máy ngủ');
  a(taoLenh('video:youtube', 'anh', dir, t0 + CHO_NHAN + 2000).id, 'máy ngủ → cho gửi lại');
  const f = path.join(dir, `${l1.id}.json`); fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(fs.readFileSync(f, 'utf8')), trang: 'dang', nhan_luc: new Date(t0).toISOString() }));
  a(trangLenh(JSON.parse(fs.readFileSync(f, 'utf8')), t0 + 31 * 60_000) === 'chet' && trangLenh({ trang: 'xong' }) === 'xong' && trangLenh({ trang: 'loi' }) === 'loi', 'chạy quá 30 phút → chết; xong / lỗi giữ nguyên');
  fs.writeFileSync(path.join(dir, 'hong.json'), '{hỏng'); a(dsLenh(dir).length === 3, 'tệp hỏng bỏ qua');
  taoLenh('do-video', 'anh', dir, t0 + 8 * 86_400_000); a(!fs.existsSync(f), 'lệnh quá 7 ngày được dọn');
  fs.rmSync(dir, { recursive: true });
  console.log('✓ lenh-may: 9 ca đạt (lệnh lạ, chống bấm đôi, máy ngủ, chạy chết, tệp hỏng, dọn cũ)');
}
