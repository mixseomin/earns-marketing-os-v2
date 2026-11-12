// CHỌN MỨC EFFORT THEO VIỆC — dùng chung cho mọi kỹ sư Claude (Thành ~/bin/thanh/chay.mjs, Mạnh tho-may.mjs, Huy etp-sua.mjs, Khang social-sua.mjs).
// Anh 12/11/2026: "đã có cơ chế tự chọn model và mức effort cho phù hợp theo từng loại tasks chưa". Model giữ theo từng người (SOUL / bậc việc của Mạnh);
// hàm này chỉ chọn effort, KHÔNG bao giờ hạ dưới mức mặc định của người đó. Thuần, có tự kiểm: node apps/cty/may/chon-muc.mjs --tu-kiem
export const MUC = ['low', 'medium', 'high'];
const cao = (a, b) => (MUC.indexOf(a) >= MUC.indexOf(b) ? a : b);

/** chu: lời yêu cầu (đề bài + góp ý của anh, không gồm lời AI trả lời) · soAnh: số ảnh đính kèm · lanLamLai: số lần anh trả về làm lại
 *  · boDo: từng bỏ dở · macDinh: mức của người đó. Trả { effort, ly_do: [] } — ly_do ghi vào nhật ký để sau đo được có đáng không. */
export function chonMuc({ chu = '', soAnh = 0, lanLamLai = 0, boDo = false, macDinh = 'low' } = {}) {
  const t = String(chu), ly = [];
  let m = 'low';
  // HIGH: lần trước đã hỏng — làm lại y mức cũ thì hỏng y cũ
  if (lanLamLai >= 2) ly.push(`làm lại lần ${lanLamLai}`);
  if (boDo) ly.push('từng bỏ dở');
  if (/⚠\s*LẶP/.test(t)) ly.push('lỗi tái phát (LẶP)');
  if (ly.length) m = 'high';
  else {
    // MEDIUM: việc nặng — thiết kế, dữ liệu, tính năng mới, nhiều ý, nhiều ảnh
    if (/thiết\s*kế|bản\s*mẫu|mockup|\bdesign\b/i.test(t)) ly.push('thiết kế');
    if (/interp2|\w+Tbl\b|google sheet|docs\.google\.com\/spreadsheets|seeder|cơ sở dữ liệu|database/i.test(t)) ly.push('dữ liệu / bảng');
    if (/tính năng mới|(thêm|tạo|bổ sung)\s+(một\s+|1\s+)?(tab|mục|trang|bảng|cột|bộ lọc)\b/i.test(t)) ly.push('tính năng mới');
    const y = (t.match(/^\s*(?:[-*•]|\d+[.)])\s+\S/gm) || []).length;
    if (y >= 4) ly.push(`${y} ý`);
    if (soAnh >= 3) ly.push(`${soAnh} ảnh`);
    if (ly.length) m = 'medium';
  }
  const effort = cao(m, MUC.includes(macDinh) ? macDinh : 'low');
  if (effort !== m) ly.push(`mặc định ${macDinh}`);
  return { effort, ly_do: ly.length ? ly : ['việc vặt'] };
}
/** Cả lô (một phiên làm nhiều task): lấy mức cao nhất, gộp lý do. */
export const chonMucLo = (ds, macDinh = 'low') => ds.map((x) => chonMuc({ macDinh, ...x })).reduce((a, b) => ({ effort: cao(a.effort, b.effort), ly_do: [...new Set([...a.ly_do, ...b.ly_do])] }), { effort: macDinh, ly_do: [] });

if (process.argv[1]?.endsWith('chon-muc.mjs') && process.argv.includes('--tu-kiem')) {
  const t = (await import('node:assert/strict')).default;
  t.equal(chonMuc({ chu: 'Xoá chữ "Beta" ở tiêu đề' }).effort, 'low', 'việc vặt');
  t.equal(chonMuc({ chu: 'Hãy format lại, giống như bản thiết kế' }).effort, 'medium', 'thiết kế');
  t.equal(chonMuc({ chu: 'cập nhật lại table PlanetRulersbyHouseHellenisticTbl' }).effort, 'medium', 'bảng Interp2');
  t.equal(chonMuc({ chu: 'Hãy bổ sung thêm một mục mới, mô tả Ruler' }).effort, 'medium', 'tính năng mới');
  t.equal(chonMuc({ chu: '1. a\n2. b\n3. c\n4. d' }).effort, 'medium', '4 ý');
  t.equal(chonMuc({ chu: '1. a\n2. b' }).effort, 'low', '2 ý vẫn vặt');
  t.equal(chonMuc({ chu: 'x', soAnh: 3 }).effort, 'medium', '3 ảnh');
  t.equal(chonMuc({ chu: 'Xoá chữ', lanLamLai: 2 }).effort, 'high', 'làm lại lần 2');
  t.equal(chonMuc({ chu: 'Xoá chữ', lanLamLai: 1 }).effort, 'low', 'làm lại lần 1 chưa lên');
  t.equal(chonMuc({ chu: 'x', boDo: true }).effort, 'high', 'từng bỏ dở');
  t.equal(chonMuc({ chu: 'lỗi luật\n\n⚠ LẶP: lỗi này đã báo' }).effort, 'high', 'LẶP');
  t.equal(chonMuc({ chu: 'Xoá chữ', macDinh: 'medium' }).effort, 'medium', 'không hạ dưới mặc định');
  t.deepEqual(chonMuc({ chu: 'Xoá chữ', macDinh: 'medium' }).ly_do, ['mặc định medium']);
  t.equal(chonMuc({ chu: 'theo Design System' }).effort, 'medium', 'chữ design trong đề bài vẫn tính (người gọi chỉ đưa đề bài, không đưa lời AI)');
  const lo = chonMucLo([{ chu: 'Xoá chữ' }, { chu: 'bản thiết kế' }]); t.equal(lo.effort, 'medium'); t.ok(lo.ly_do.includes('thiết kế'));
  t.equal(chonMucLo([]).effort, 'low', 'lô rỗng = mặc định');
  console.log('chon-muc: tự kiểm đạt');
}
