// HÀNG VIỆC THỢ MÁY (anh 23–24/10/2026: "làm sao để mày biết mà fix rồi mày báo cho tao" → "có, dựng thợ máy tự sửa ở iMac", duyệt trần 6 lượt/ngày).
// Phòng Tài nguyên (tai-nguyen.mjs) phát cảnh báo máy cào mới → `them` một việc kèm mã tin Telegram. Thợ máy (apps/cty/may/tho-may.mjs, Claude Code không
// giao diện, CHỈ chạy trên iMac — luật anh 23/10/2026, gói thuê bao không qua API) mỗi 5 phút `--lay` một việc, `--nhan` báo đã nhận, sửa, `--bao` trả
// lời NGAY DƯỚI tin cảnh báo. Trần: TRAN_NGAY lượt / ngày giờ VN (dùng bình thường của một cá nhân — luật Anthropic, đã đọc 23/10/2026), việc đang làm
// quá TREO_PHUT coi như treo. Chỉ việc máy móc (làn đứng, box3 / VPS quá tải, thiếu RAM, daemon tắt) — khoá 2proxy / tài sản hết hạn là chuyện tiền, anh quyết.
// MÁY ĐĂNG (anh 25/10/2026 "cho Mạnh quản lý luôn"): Phòng Nội dung (cham-dang.mjs › soiMayDang) xếp kênh LỠ LƯỢT THẬT thành việc `dang:lo|<máy>|<nền>`;
// tài khoản bị nền tảng chặn (canh|) và kho cạn (kho| — phải làm bài, có thể tốn tiền) vẫn để anh quyết, không vào hàng.
//   node worker/tho-may-viec.mjs --lay | --nhan <id> | --bao <id> <da_sua|khong_sua|can_anh> (chữ ở stdin) | --xem | --tu-kiem
import fs from 'node:fs';
import { ghiNut, NUT_HOI } from './tg-phong.mjs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const TEP = () => `${DATA()}/tho-may.json`;
export const TRAN_NGAY = 6, TREO_PHUT = 45;
// kenh: = dây chuyền KÊNH NỘI DUNG (kênh lịch sử, apps/xuong-video/scripts/lich-su — anh 03/11/2026: "thế này mà cho tự chạy … không có ai sửa à?"):
// chay-kenh.mjs xếp `kenh:<kênh>|<tập>` khi một lượt làm tập hỏng
export const LOAI_SUA = /^(lan|box3|vps|dang|kenh|anh):/;   // khoá cảnh báo thợ máy được nhận (xetCanhBao trong tai-nguyen.mjs · soiMayDang trong cham-dang.mjs · chay-kenh.mjs)
const ngayVN = (t = Date.now()) => new Date(t + 7 * 36e5).toISOString().slice(0, 10);

/** Thuần — thêm việc cho các cảnh báo mới; bỏ khoá không thuộc thợ máy, bỏ khoá đang chờ / đang làm (không xếp đôi). */
export function themViec(st, ds, { luc = Date.now(), topic = null, msg = null } = {}) {
  const hang = st.hang || [], dang = new Set(hang.filter((v) => v.tt === 'cho' || v.tt === 'dang').map((v) => v.khoa));
  let them = 0, so = hang.reduce((a, v) => Math.max(a, v.id), 0);
  for (const c of ds) {
    if (!LOAI_SUA.test(c.khoa) || dang.has(c.khoa)) continue;
    hang.push({ id: ++so, khoa: c.khoa, chu: c.chu, luc: new Date(luc).toISOString(), tg: { topic, msg }, tt: 'cho' }); dang.add(c.khoa); them++;
  }
  return { st: { ...st, hang: hang.slice(-200) }, them };
}
/** Thuần — BẬC RẺ KHÔNG SỬA ĐƯỢC (anh 05/11/2026, model theo việc): việc vừa chạy model rẻ mà KHONG_SUA / treo → xếp lại MỘT lần cùng khoá, đánh dấu nang
 *  (thợ máy chạy bậc chính, Opus). CAN_ANH / DA_SUA không nâng; việc đã nâng không nâng nữa. Trả { st, nang: việc mới | null } */
export function nangBac(st, id, ket, luc = Date.now()) {
  const hang = st.hang || [], v = hang.find((x) => x.id === id);
  if (!v || v.nang || !['khong_sua', 'treo'].includes(ket)) return { st, nang: null };
  const moi = { id: hang.reduce((a, x) => Math.max(a, x.id), 0) + 1, khoa: v.khoa, chu: v.chu, luc: new Date(luc).toISOString(), tg: v.tg, tt: 'cho', nang: true, ...(v.goc ? { goc: v.goc } : {}) };
  return { st: { ...st, hang: [...hang, moi].slice(-200) }, nang: moi };
}
/** Thuần — nhận việc cũ nhất đang chờ (trong trần ngày); việc đang làm quá TREO_PHUT → treo. Trả { st, viec | null, ly_do } */
export function layViec(st, luc = Date.now()) {
  const hang = (st.hang || []).map((v) => (v.tt === 'dang' && luc - Date.parse(v.bat_dau) > TREO_PHUT * 6e4 ? { ...v, tt: 'treo', xong: new Date(luc).toISOString() } : v));
  const ngay = { ...(st.ngay || {}) }, hom = ngayVN(luc);
  if (hang.some((v) => v.tt === 'dang')) return { st: { ...st, hang }, viec: null, ly_do: 'đang có việc' };
  // LỆNH ANH (anh: — anh 05/11/2026 "tao đã đồng ý, nó đã hiểu mà rồi lại hỏi lại"): nhận TRƯỚC mọi việc và KHÔNG tính trần ngày (trần dành cho việc máy tự xếp).
  const iAnh = hang.findIndex((v) => v.tt === 'cho' && /^anh:/.test(v.khoa));
  if (iAnh >= 0) { hang[iAnh] = { ...hang[iAnh], tt: 'dang', bat_dau: new Date(luc).toISOString() }; return { st: { ...st, hang, ngay }, viec: hang[iAnh], ly_do: '' }; }
  if ((ngay[hom] || 0) >= TRAN_NGAY) return { st: { ...st, hang, ngay }, viec: null, ly_do: `đủ ${TRAN_NGAY} lượt hôm nay` };
  // việc KÊNH (kenh:…) nhận TRƯỚC (04/11/2026: tập kênh hỏng 10:38 đứng chờ sau việc cào / đăng tới hết 6 lượt — tập tự động mà thợ máy không tới thì phải chờ người); trần ngày giữ nguyên
  // + LỠ LƯỢT ĐĂNG (dang:lo|, anh 05/11/2026 "Đăng tự động mà … cũng gọi tao" — dang-may xếp ngay lần hỏng đầu; chờ sau việc cào là mất lượt trong ngày)
  const ik = hang.findIndex((v) => v.tt === 'cho' && /^(kenh:|dang:lo\|)/.test(v.khoa)), i = ik >= 0 ? ik : hang.findIndex((v) => v.tt === 'cho'); if (i < 0) return { st: { ...st, hang }, viec: null, ly_do: 'không có việc' };
  hang[i] = { ...hang[i], tt: 'dang', bat_dau: new Date(luc).toISOString() }; ngay[hom] = (ngay[hom] || 0) + 1;
  return { st: { ...st, hang, ngay }, viec: hang[i], ly_do: '' };
}
const doc = () => { try { return JSON.parse(fs.readFileSync(TEP(), 'utf8')); } catch { return { hang: [], ngay: {} }; } };
const doc2 = (st, v) => { const moi = doc(); return { ...moi, hang: moi.hang.map((x) => (x.id === v.id ? { ...x, tin_nhan: v.tin_nhan } : x)) }; };   // đọc lại: gửi Telegram mất vài giây, thư ký có thể vừa xếp việc mới
const ghi = (st) => { fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(TEP(), JSON.stringify(st, null, 1)); };
/** Máy của một khoá việc: 'dang:lo|<máy>|<nền>' → máy; 'kenh:<kênh>|…' → kênh; khoá khác → null. */
export const mayCua = (k) => (String(k ?? '').match(/^dang:[^|]*\|([^|]+)/) || String(k ?? '').match(/^kenh:([^|]+)/) || [])[1] ?? null;
/** Thuần — xếp LỆNH ANH (câu anh trả lời / giao trên Telegram). goc = khoá việc đang được trả lời. Việc đang chờ cùng máy (vd cả 3 nền của một máy cùng hết bài) đóng luôn:
 *  chạy tiếp sẽ hỏi lại đúng câu anh vừa trả lời (04/11/2026: #63 hỏi, anh trả lời, #64 cùng máy vẫn chạy và hỏi lại). */
export function themAnh(st, { chu, cau_hoi = '', anh, goc = null, phong = null, tg = {} }, luc = Date.now()) {
  const m = mayCua(goc), hang = (st.hang || []).map((v) => (m && v.tt === 'cho' && mayCua(v.khoa) === m ? { ...v, tt: 'gop', xong: new Date(luc).toISOString(), ket_qua: 'gộp vào lệnh anh' } : v));
  const id = hang.reduce((a, v) => Math.max(a, v.id), 0) + 1, viec = { id, khoa: `anh:${id}`, chu, cau_hoi, anh, goc, phong, luc: new Date(luc).toISOString(), tg, tt: 'cho' };
  return { st: { ...st, hang: [...hang, viec].slice(-200) }, viec };
}
/** Thuần — điều anh đã chốt cho cùng máy trong 7 ngày: thợ máy đọc trước khi làm, không hỏi lại. */
export const quyetGan = (st, v, luc = Date.now()) => { const m = mayCua(v.goc ?? v.khoa); return !m ? [] : (st.hang || []).filter((x) => /^anh:/.test(x.khoa) && x.id !== v.id && mayCua(x.goc) === m && luc - Date.parse(x.luc) < 7 * 864e5).map((x) => `${x.luc.slice(0, 16)}: ${x.anh}${x.ket_qua ? ` → ${x.ket_qua.slice(0, 300)}` : ' (đang làm)'}`); };
/** Việc mà một tin Telegram của thợ máy thuộc về (trả lời dưới tin đó = trả lời cho việc đó). */
export const viecCuaTin = (mid) => (doc().hang || []).find((v) => mid && (v.tin_bao === mid || v.tin_nhan === mid)) ?? null;
export const giaoAnh = (x) => { const r = themAnh(doc(), x); ghi(r.st); return r.viec; };
export const themTuCanhBao = (ds, tg) => { const r = themViec(doc(), ds, tg); if (r.them) ghi(r.st); return r.them; };

async function tg(phuong, body) {
  if (!process.env.TG_BOT_TOKEN) try { for (const l of fs.readFileSync('/root/.secrets/mine-tg.env', 'utf8').split('\n')) { const m = l.match(/^(?:export\s+)?(TG_BOT_TOKEN|TG_CHAT)=["']?([^"'\s]+)/); if (m) process.env[m[1]] = m[2]; } } catch { /* không có */ }
  const { TG_BOT_TOKEN: T, TG_CHAT: C } = process.env; if (!T || !C) throw new Error('thiếu TG_BOT_TOKEN / TG_CHAT');
  return ghiNut(async (m, b) => (await fetch(`https://api.telegram.org/bot${T}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: C, ...b }), signal: AbortSignal.timeout(15000) })).json())(phuong, body);
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const traLoi = (v, html, them = {}) => tg('sendMessage', { ...them, parse_mode: 'HTML', text: html.slice(0, 3900), ...(v.tg?.topic ? { message_thread_id: v.tg.topic } : {}), ...(v.tg?.msg ? { reply_parameters: { message_id: v.tg.msg, allow_sending_without_reply: true } } : {}) });
const tenViec = (v) => (String(v.khoa).startsWith('anh:') ? 'Lệnh anh' : String(v.khoa).startsWith('kenh:') ? 'Kênh nội dung tự sửa' : String(v.khoa).startsWith('dang:') ? 'Máy đăng tự sửa' : 'Spy tự sửa máy cào');
const KET = { da_sua: '✅ Đã sửa', khong_sua: '⚠️ Không sửa được', can_anh: '🙋 Cần anh quyết', treo: '⏱ Hết giờ' };

if (process.argv[1]?.endsWith('tho-may-viec.mjs')) {
  const a = process.argv.slice(2), id = Number(a[1]);
  if (a[0] === '--tu-kiem') {
    const assert = (await import('node:assert')).default, t0 = Date.parse('2026-10-24T03:00:00Z');
    let { st, them } = themViec({}, [{ khoa: 'lan:doi_thu', chu: 'đứng' }, { khoa: 'het:08wY', chu: 'khoá hết hạn' }, { khoa: 'taisan:17', chu: 'VPS' }, { khoa: 'vps:may-cao-vn:tai', chu: 'tải' }, { khoa: 'canh|r|dailymotion', chu: 'bị chặn' }], { luc: t0, msg: 9 });
    assert.strictEqual(them, 2, 'chỉ nhận việc máy móc (lan / vps), bỏ khoá 2proxy + tài sản + cảnh báo tài khoản');
    assert.strictEqual(themViec({}, [{ khoa: 'dang:lo|m|instagram', chu: 'lỡ' }]).them, 1, 'nhận lỡ lượt máy đăng');
    assert.strictEqual(layViec({ hang: [{ id: 1, khoa: 'lan:x', tt: 'cho' }, { id: 2, khoa: 'dang:lo|m|youtube', tt: 'cho' }] }).viec.id, 2, 'lỡ lượt đăng nhận trước việc cào');
    assert.strictEqual(themViec({}, [{ khoa: 'kenh:parody|tap-1', chu: 'hỏng ở bước viết' }]).them, 1, 'nhận lượt hỏng của kênh nội dung');
    assert.strictEqual(themViec(st, [{ khoa: 'lan:doi_thu', chu: 'lại' }], { luc: t0 }).them, 0, 'khoá đang chờ: không xếp đôi');
    let r = layViec(st, t0); assert.strictEqual(r.viec.khoa, 'lan:doi_thu', 'lấy việc cũ nhất'); st = r.st;
    assert.strictEqual(layViec(st, t0 + 6e4).viec, null, 'đang có việc: không lấy thêm');
    r = layViec(st, t0 + 46 * 6e4); assert.strictEqual(r.st.hang[0].tt, 'treo', 'quá 45 phút = treo'); assert.strictEqual(r.viec.khoa, 'vps:may-cao-vn:tai', 'treo xong lấy việc kế');
    st = { hang: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, khoa: `lan:x${i}`, tt: 'cho' })), ngay: {} };
    for (let i = 0; i < TRAN_NGAY; i++) { const k = layViec(st, t0 + i * 6e4); st = { ...k.st, hang: k.st.hang.map((v) => (v.tt === 'dang' ? { ...v, tt: 'xong' } : v)) }; }
    assert.ok(/đủ 6/.test(layViec(st, t0 + 3600e3).ly_do), 'trần 6 lượt / ngày VN');
    { const s2 = { hang: [{ id: 1, khoa: 'lan:a', tt: 'cho' }, { id: 2, khoa: 'kenh:parody|x', tt: 'cho' }], ngay: {} }; assert.equal(layViec(s2, t0).viec.id, 2, 'việc kênh nhận trước'); }
    assert.ok(layViec(st, t0 + 20 * 36e5).viec, 'sang ngày mới (giờ VN) lấy tiếp');
    assert.strictEqual(themViec({ hang: [{ id: 1, khoa: 'lan:a', tt: 'xong' }] }, [{ khoa: 'lan:a', chu: 'tái phát' }]).them, 1, 'đã xong rồi tái phát: nhận lại');
    { const s = { hang: [{ id: 1, khoa: 'dang:lo|m1|facebook', tt: 'ket', tin_bao: 50 }, { id: 2, khoa: 'dang:lo|m1|fb_anh', tt: 'cho' }, { id: 3, khoa: 'dang:lo|m2|x', tt: 'cho' }], ngay: { [ngayVN(t0)]: TRAN_NGAY } };
      const a0 = themAnh(s, { chu: 'Sx thêm video cho', anh: 'Sx thêm video cho', goc: 'dang:lo|m1|facebook', tg: { topic: 2307, msg: 99 } }, t0);
      assert.equal(a0.st.hang[1].tt, 'gop', 'việc chờ cùng máy gộp vào lệnh anh (không hỏi lại)'); assert.equal(a0.st.hang[2].tt, 'cho', 'máy khác giữ nguyên');
      const l = layViec(a0.st, t0); assert.equal(l.viec.khoa, 'anh:4', 'lệnh anh nhận trước dù đủ trần ngày'); assert.equal(l.st.ngay[ngayVN(t0)], TRAN_NGAY, 'lệnh anh không tính trần');
      assert.deepEqual(quyetGan(l.st, { id: 9, khoa: 'dang:lo|m1|fb_link' }, t0).length, 1, 'việc sau cùng máy đọc được điều anh đã chốt'); assert.equal(quyetGan(l.st, { id: 9, khoa: 'dang:lo|m2|x' }, t0).length, 0);
      assert.equal(mayCua('kenh:parody|t1'), 'parody'); assert.equal(mayCua('lan:a'), null); }
    { const s0 = { hang: [{ id: 1, khoa: 'dang:lo|m|youtube', chu: 'lỡ', tt: 'ket', tg: {} }] };
      const n1 = nangBac(s0, 1, 'khong_sua'); assert.equal(n1.nang?.nang, true, 'rẻ không sửa → xếp lại bậc chính'); assert.equal(n1.nang.khoa, 'dang:lo|m|youtube');
      assert.equal(nangBac(s0, 1, 'can_anh').nang, null, 'cần anh không nâng'); assert.equal(nangBac(s0, 1, 'da_sua').nang, null, 'đã sửa không nâng');
      assert.equal(nangBac(n1.st, 2, 'treo').nang, null, 'đã nâng thì không nâng nữa'); }
    console.log('tho-may-viec tu-kiem ok');
  } else if (a[0] === '--lay') {
    const r = layViec(doc()); ghi(r.st); console.log(JSON.stringify(r.viec ? { viec: { ...r.viec, quyet_gan: quyetGan(r.st, r.viec) } } : { ly_do: r.ly_do }));
  } else if (a[0] === '--nhan') {
    const st = doc(), v = st.hang.find((x) => x.id === id); if (!v) throw new Error('không có việc ' + id);
    const j = await traLoi(v, `<b>🔧 ${tenViec(v)}</b> đã nhận: ${esc(v.chu.replace(/<[^>]+>/g, '').slice(0, 200))} — ${/^anh:/.test(v.khoa) ? 'đang làm' : 'đang tìm gốc'} (tối đa 30 phút).`); v.tin_nhan = j?.result?.message_id ?? null; ghi(doc2(st, v)); console.log('ok');
  } else if (a[0] === '--bao') {
    const ket = KET[a[2]] ? a[2] : 'khong_sua', chu = fs.readFileSync(0, 'utf8').trim(), st = doc(), v = st.hang.find((x) => x.id === id); if (!v) throw new Error('không có việc ' + id);
    v.tt = ket === 'da_sua' ? 'xong' : 'ket'; v.ket = ket; v.xong = new Date().toISOString(); v.ket_qua = chu.slice(0, 2000);
    const nb = a.includes('--re') ? nangBac(st, id, ket) : { st, nang: null }; ghi(nb.st);
    if (nb.nang) { console.log(`nâng bậc → việc #${nb.nang.id}`); process.exit(0); }   // bậc rẻ không sửa được: im lặng, bậc chính làm lại rồi mới báo (anh không cần đọc lượt thử)
    // "Cần anh quyết" LUÔN có nút (05/11/2026: tin này gửi riêng, không qua ghiNut nên không có nút); trả lời dưới tin = lệnh cho đúng việc này (thu-ky.mjs › viecCuaTin)
    const j = await traLoi(v, `<b>🔧 ${tenViec(v)} · ${KET[ket]}</b>\n${esc(chu)}`, ket === 'can_anh' ? { reply_markup: NUT_HOI } : {}); const st2 = doc(), v2 = st2.hang.find((x) => x.id === id); if (v2 && j?.result?.message_id) { v2.tin_bao = j.result.message_id; ghi(st2); } console.log(j.ok ? 'ok' : JSON.stringify(j).slice(0, 200));
  } else if (a[0] === '--them') {   // xếp một việc từ ngoài (chay-kenh.mjs): --them <khoá> , chữ cảnh báo ở stdin. In số việc đã thêm (0 = khoá đang chờ / không thuộc thợ máy)
    console.log(themTuCanhBao([{ khoa: a[1], chu: fs.readFileSync(0, 'utf8').trim().slice(0, 3000) }], {}));
  } else if (a[0] === '--xem') console.log(JSON.stringify(doc(), null, 1));
  else { console.error('dùng: --lay | --nhan <id> | --bao <id> <da_sua|khong_sua|can_anh> | --them <khoá> (chữ ở stdin) | --xem | --tu-kiem'); process.exit(2); }
}
