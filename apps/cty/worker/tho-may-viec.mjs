// HÀNG VIỆC THỢ MÁY (anh 23–24/10/2026: "làm sao để mày biết mà fix rồi mày báo cho tao" → "có, dựng thợ máy tự sửa ở iMac", duyệt trần 6 lượt/ngày).
// Phòng Tài nguyên (tai-nguyen.mjs) phát cảnh báo máy cào mới → `them` một việc kèm mã tin Telegram. Thợ máy (apps/cty/may/tho-may.mjs, Claude Code không
// giao diện, CHỈ chạy trên iMac — luật anh 23/10/2026, gói thuê bao không qua API) mỗi 5 phút `--lay` một việc, `--nhan` báo đã nhận, sửa, `--bao` trả
// lời NGAY DƯỚI tin cảnh báo. Trần: TRAN_NGAY lượt / ngày giờ VN (dùng bình thường của một cá nhân — luật Anthropic, đã đọc 23/10/2026), việc đang làm
// quá TREO_PHUT coi như treo. Chỉ việc máy móc (làn đứng, box3 / VPS quá tải, thiếu RAM, daemon tắt) — khoá 2proxy / tài sản hết hạn là chuyện tiền, anh quyết.
//   node worker/tho-may-viec.mjs --lay | --nhan <id> | --bao <id> <da_sua|khong_sua|can_anh> (chữ ở stdin) | --xem | --tu-kiem
import fs from 'node:fs';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const TEP = () => `${DATA()}/tho-may.json`;
export const TRAN_NGAY = 6, TREO_PHUT = 45;
export const LOAI_SUA = /^(lan|box3|vps):/;   // khoá cảnh báo thợ máy được nhận (xetCanhBao trong tai-nguyen.mjs)
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
/** Thuần — nhận việc cũ nhất đang chờ (trong trần ngày); việc đang làm quá TREO_PHUT → treo. Trả { st, viec | null, ly_do } */
export function layViec(st, luc = Date.now()) {
  const hang = (st.hang || []).map((v) => (v.tt === 'dang' && luc - Date.parse(v.bat_dau) > TREO_PHUT * 6e4 ? { ...v, tt: 'treo', xong: new Date(luc).toISOString() } : v));
  const ngay = { ...(st.ngay || {}) }, hom = ngayVN(luc);
  if (hang.some((v) => v.tt === 'dang')) return { st: { ...st, hang }, viec: null, ly_do: 'đang có việc' };
  if ((ngay[hom] || 0) >= TRAN_NGAY) return { st: { ...st, hang, ngay }, viec: null, ly_do: `đủ ${TRAN_NGAY} lượt hôm nay` };
  const i = hang.findIndex((v) => v.tt === 'cho'); if (i < 0) return { st: { ...st, hang }, viec: null, ly_do: 'không có việc' };
  hang[i] = { ...hang[i], tt: 'dang', bat_dau: new Date(luc).toISOString() }; ngay[hom] = (ngay[hom] || 0) + 1;
  return { st: { ...st, hang, ngay }, viec: hang[i], ly_do: '' };
}
const doc = () => { try { return JSON.parse(fs.readFileSync(TEP(), 'utf8')); } catch { return { hang: [], ngay: {} }; } };
const ghi = (st) => { fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(TEP(), JSON.stringify(st, null, 1)); };
export const themTuCanhBao = (ds, tg) => { const r = themViec(doc(), ds, tg); if (r.them) ghi(r.st); return r.them; };

async function tg(phuong, body) {
  if (!process.env.TG_BOT_TOKEN) try { for (const l of fs.readFileSync('/root/.secrets/mine-tg.env', 'utf8').split('\n')) { const m = l.match(/^(?:export\s+)?(TG_BOT_TOKEN|TG_CHAT)=["']?([^"'\s]+)/); if (m) process.env[m[1]] = m[2]; } } catch { /* không có */ }
  const { TG_BOT_TOKEN: T, TG_CHAT: C } = process.env; if (!T || !C) throw new Error('thiếu TG_BOT_TOKEN / TG_CHAT');
  return (await fetch(`https://api.telegram.org/bot${T}/${phuong}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: C, ...body }), signal: AbortSignal.timeout(15000) })).json();
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const traLoi = (v, html) => tg('sendMessage', { parse_mode: 'HTML', text: html.slice(0, 3900), ...(v.tg?.topic ? { message_thread_id: v.tg.topic } : {}), ...(v.tg?.msg ? { reply_parameters: { message_id: v.tg.msg, allow_sending_without_reply: true } } : {}) });
const KET = { da_sua: '✅ Đã sửa', khong_sua: '⚠️ Không sửa được', can_anh: '🙋 Cần anh quyết', treo: '⏱ Hết giờ' };

if (process.argv[1]?.endsWith('tho-may-viec.mjs')) {
  const a = process.argv.slice(2), id = Number(a[1]);
  if (a[0] === '--tu-kiem') {
    const assert = (await import('node:assert')).default, t0 = Date.parse('2026-10-24T03:00:00Z');
    let { st, them } = themViec({}, [{ khoa: 'lan:doi_thu', chu: 'đứng' }, { khoa: 'het:08wY', chu: 'khoá hết hạn' }, { khoa: 'taisan:17', chu: 'VPS' }, { khoa: 'vps:may-cao-vn:tai', chu: 'tải' }], { luc: t0, msg: 9 });
    assert.strictEqual(them, 2, 'chỉ nhận việc máy móc (lan / vps), bỏ khoá 2proxy + tài sản');
    assert.strictEqual(themViec(st, [{ khoa: 'lan:doi_thu', chu: 'lại' }], { luc: t0 }).them, 0, 'khoá đang chờ: không xếp đôi');
    let r = layViec(st, t0); assert.strictEqual(r.viec.khoa, 'lan:doi_thu', 'lấy việc cũ nhất'); st = r.st;
    assert.strictEqual(layViec(st, t0 + 6e4).viec, null, 'đang có việc: không lấy thêm');
    r = layViec(st, t0 + 46 * 6e4); assert.strictEqual(r.st.hang[0].tt, 'treo', 'quá 45 phút = treo'); assert.strictEqual(r.viec.khoa, 'vps:may-cao-vn:tai', 'treo xong lấy việc kế');
    st = { hang: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, khoa: `lan:x${i}`, tt: 'cho' })), ngay: {} };
    for (let i = 0; i < TRAN_NGAY; i++) { const k = layViec(st, t0 + i * 6e4); st = { ...k.st, hang: k.st.hang.map((v) => (v.tt === 'dang' ? { ...v, tt: 'xong' } : v)) }; }
    assert.ok(/đủ 6/.test(layViec(st, t0 + 3600e3).ly_do), 'trần 6 lượt / ngày VN');
    assert.ok(layViec(st, t0 + 20 * 36e5).viec, 'sang ngày mới (giờ VN) lấy tiếp');
    assert.strictEqual(themViec({ hang: [{ id: 1, khoa: 'lan:a', tt: 'xong' }] }, [{ khoa: 'lan:a', chu: 'tái phát' }]).them, 1, 'đã xong rồi tái phát: nhận lại');
    console.log('tho-may-viec tu-kiem ok');
  } else if (a[0] === '--lay') {
    const r = layViec(doc()); ghi(r.st); console.log(JSON.stringify(r.viec ? { viec: r.viec } : { ly_do: r.ly_do }));
  } else if (a[0] === '--nhan') {
    const v = doc().hang.find((x) => x.id === id); if (!v) throw new Error('không có việc ' + id);
    await traLoi(v, `<b>🔧 Thợ máy</b> đã nhận: ${esc(v.chu.replace(/<[^>]+>/g, ''))} — đang tìm gốc (tối đa 30 phút).`); console.log('ok');
  } else if (a[0] === '--bao') {
    const ket = KET[a[2]] ? a[2] : 'khong_sua', chu = fs.readFileSync(0, 'utf8').trim(), st = doc(), v = st.hang.find((x) => x.id === id); if (!v) throw new Error('không có việc ' + id);
    v.tt = ket === 'da_sua' ? 'xong' : 'ket'; v.ket = ket; v.xong = new Date().toISOString(); v.ket_qua = chu.slice(0, 2000); ghi(st);
    const j = await traLoi(v, `<b>🔧 Thợ máy · ${KET[ket]}</b>\n${esc(chu)}`); console.log(j.ok ? 'ok' : JSON.stringify(j).slice(0, 200));
  } else if (a[0] === '--xem') console.log(JSON.stringify(doc(), null, 1));
  else { console.error('dùng: --lay | --nhan <id> | --bao <id> <da_sua|khong_sua|can_anh> | --xem | --tu-kiem'); process.exit(2); }
}
