#!/usr/bin/env node
// VÒNG ĐỜI REEL AFFILIATE (anh 10/11/2026: "sau 3 ngày nếu ko tăng view thì xoá luôn rồi đăng lại" — lý do anh nói rõ:
// "xoá đi là để ko cho đối thủ biết cách làm việc của page này. Page này sẽ đăng bài thông thường hàng ngày").
//
// Reel gắn link affiliate sống NGAY_SONG ngày trên Page; quá hạn mà lượt phát ĐÃ ĐỨNG IM thì gỡ, còn lên view thì GIỮ. Người ngoài vào Page chỉ thấy bài thường,
// không đọc ra được Page đang chạy mô hình gì. Đây KHÔNG phải xoá vì reach kém — reach chỉ quyết định có nên dựng lại
// cảnh đó nữa hay không.
//
//   node apps/xuong-video/scripts/reel-vong-doi.mjs --ghi <page_id> <video_id> <link> [ghi_chu]   ghi một Reel vào sổ
//   node apps/xuong-video/scripts/reel-vong-doi.mjs --xem                                         bảng Reel đang sống + lượt phát
//   node apps/xuong-video/scripts/reel-vong-doi.mjs --don                                         gỡ Reel quá hạn ĐÃ đứng view (THẬT)
//   node apps/xuong-video/scripts/reel-vong-doi.mjs --don --thu                                   chạy khô, chỉ in sẽ gỡ cái nào
//
// Sổ: ~/.cache/reel-vong-doi.json (KHÔNG để scratchpad — /private/tmp bị macOS xoá mỗi lần khởi động lại).
// Trước khi gỡ, số liệu cuối của Reel được ghi lại vào sổ (mục `so_cuoi`) để còn đo, và một dòng báo gửi Telegram
// chủ đề Aff Convert. Gỡ là việc KHÔNG hoàn tác được: chỉ gỡ Reel CÓ TRONG SỔ, quá hạn, trên đúng Page đã ghi.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const BOX = 'root@167.233.241.16';
const SO = `${process.env.HOME}/.cache/reel-vong-doi.json`;
const TG = `${process.env.HOME}/bin/tg`;
const NGAY_SONG = 3;
// Lượt phát phải nhích hơn mốc lần đo trước chừng này mới tính là 'còn lên view' (nhích vài lượt là nhiễu, không phải Facebook còn đẩy).
const TANG_TOI_THIEU = 30;
// Khoảng cách tối thiểu giữa hai mốc đem ra so (giờ). Lịch chạy mỗi giờ nên không so lượt-chạy-trước mà so mốc cách một ngày.
const GIO_SO = 22;
// Lượt phát phải nhảy thêm chừng này so với lần đã nhắn thì mới nhắn tiếp — chạy mỗi giờ, không để nó nhắn vì vài lượt lẻ.
const BUOC_BAO = 100;
// Khoá sản phẩm trên bảng Social Traffic › Kênh (cột Lượt xem đọc kenh_so_ngay theo khoá này).
const SAN_PHAM = 'affiliate:mia-calloway';

const ag = process.argv.slice(2);
const co = (t) => ag.includes(t);
const gioVN = (d = new Date()) => d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });

const docSo = () => { try { return JSON.parse(readFileSync(SO, 'utf8')); } catch { return { reel: [] }; } };
const ghiSo = (d) => { mkdirSync(path.dirname(SO), { recursive: true }); writeFileSync(SO, JSON.stringify(d, null, 2)); };

/** Chạy một đoạn python trên box3 (token Page nằm ở đó, không rời máy chủ). */
function trenBox(py) {
  return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', BOX, 'python3 -'],
    { input: py, encoding: 'utf8', timeout: 180_000 });
}

/** Lượt phát + tương tác của một Reel. Trả null khi Facebook không cho đọc (video đã gỡ / token sai Page). */
function soLieu(pageId, videoId) {
  const py = `
import json, urllib.request, urllib.parse, urllib.error
d = json.load(open("/root/.secrets/fb-pages.json"))
pid, vid = ${JSON.stringify(String(pageId))}, ${JSON.stringify(String(videoId))}
tok = d.get(pid, {}).get("token")
if not tok: print(json.dumps({"_loi": "box3 khong co token Page " + pid})); raise SystemExit
def g(duoi, p):
    u = f"https://graph.facebook.com/v21.0/{duoi}?" + urllib.parse.urlencode({**p, "access_token": tok})
    try: return json.load(urllib.request.urlopen(u, timeout=25))
    except urllib.error.HTTPError as e:
        try: return {"_loi": json.load(e)["error"]["message"][:120]}
        except Exception: return {"_loi": f"HTTP {e.code}"}
    except Exception as e: return {"_loi": str(e)[:90]}
ra = {}
# likes/comments summary doi quyen app chua co (do 10/11/2026: "(#200) Missing Permissions") -> chi doc truong co quyen.
j = g(vid, {"fields": "created_time,permalink_url"})
if j.get("_loi"): ra["_loi"] = j["_loi"]
else:
    ra["tao"] = j.get("created_time")
m = g(f"{vid}/video_insights", {"metric": "fb_reels_total_plays,blue_reels_play_count"})
if not m.get("_loi"):
    for x in m.get("data", []):
        v = (x.get("values") or [{}])[0].get("value")
        ra[x.get("name")] = v
print(json.dumps(ra, ensure_ascii=False))
`;
  try { return JSON.parse(chayBox(py)); } catch { return null; }
}
const chayBox = (py) => { try { return trenBox(py).trim().split('\n').pop(); } catch { return '{}'; } };

/** Gỡ một Reel. Facebook: DELETE /{video_id}. Trả true khi Facebook xác nhận. */
function goReel(pageId, videoId) {
  const py = `
import json, urllib.request, urllib.parse, urllib.error
d = json.load(open("/root/.secrets/fb-pages.json"))
pid, vid = ${JSON.stringify(String(pageId))}, ${JSON.stringify(String(videoId))}
tok = d[pid]["token"]
u = f"https://graph.facebook.com/v21.0/{vid}?" + urllib.parse.urlencode({"access_token": tok})
r = urllib.request.Request(u, method="DELETE")
try: print(json.dumps(json.load(urllib.request.urlopen(r, timeout=30))))
except urllib.error.HTTPError as e:
    try: print(json.dumps({"_loi": json.load(e)["error"]["message"][:140]}))
    except Exception: print(json.dumps({"_loi": f"HTTP {e.code}"}))
`;
  try { const r = JSON.parse(chayBox(py)); return r.success === true || r.success === 'true'; } catch { return false; }
}


/** ẨN Reel (anh 11/11/2026 "bài aff ko tăng traffic nữa thì nên ẩn đi") — KHÁC gỡ: bài biến khỏi Page + khỏi mắt đối thủ
 *  nhưng video còn nguyên, số liệu còn đọc được, bật lại được bất cứ lúc nào. Gỡ là mất hẳn, không lấy lại số.
 *  Đường: /{video_id}?fields=post_id → POST /{post_id} is_hidden=true (Reel nằm trên Page dưới dạng một bài feed). */
function anReel(pageId, videoId, hien = false) {
  const py = `
import json, urllib.request, urllib.parse, urllib.error
d = json.load(open("/root/.secrets/fb-pages.json"))
pid, vid = ${JSON.stringify(String(pageId))}, ${JSON.stringify(String(videoId))}
tok = d[pid]["token"]
def goi(u, data=None, method=None):
    r = urllib.request.Request(u, data=data, method=method)
    return json.load(urllib.request.urlopen(r, timeout=30))
try:
    v = goi(f"https://graph.facebook.com/v21.0/{vid}?" + urllib.parse.urlencode({"fields": "post_id", "access_token": tok}))
    post = v.get("post_id")
    if not post: print(json.dumps({"_loi": "video khong co post_id — khong an duoc"}))
    else:
        body = urllib.parse.urlencode({"is_hidden": ${JSON.stringify(hien ? 'false' : 'true')}, "access_token": tok}).encode()
        print(json.dumps({"ok": goi(f"https://graph.facebook.com/v21.0/{post}", body, "POST"), "post_id": post}))
except urllib.error.HTTPError as e:
    try: print(json.dumps({"_loi": json.load(e)["error"]["message"][:160]}))
    except Exception: print(json.dumps({"_loi": f"HTTP {e.code}"}))
`;
  try { const r = JSON.parse(chayBox(py)); if (r._loi) { console.log(`  ✗ ${r._loi}`); return false; } return r.ok === true || r.ok?.success === true; } catch (e) { console.log(`  ✗ ${String(e.message).slice(0, 120)}`); return false; }
}

/** Ghi tổng lượt phát của mọi Reel đang sống vào kenh_so_ngay — cột "Lượt xem" của bảng Social Traffi › Kênh đọc từ đây.
 *  Khuôn theo dòng đã có trên bảng (đo 10/11/2026): kenh='fb-reels', san_pham='<dự án>:<nhóm>', nguon='graph-video-insights'. */
function ghiSoNgay(sanPham, hien, soMuc, chiTiet) {
  const lenh = `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; psql "$DATABASE_URL" -q -f -`;
  const sqlText = `insert into kenh_so_ngay (kenh, san_pham, ngay, hien, tuong_tac, click, so_muc, chi_tiet, nguon)\n`
    + `values ('fb-reels', '${sanPham}', current_date, ${Number(hien) || 0}, 0, 0, ${Number(soMuc) || 0}, '${JSON.stringify(chiTiet).replace(/'/g, "''")}'::jsonb, 'graph-video-insights')\n`
    + `on conflict (kenh, san_pham, ngay) do update set hien = excluded.hien, so_muc = excluded.so_muc, chi_tiet = excluded.chi_tiet, cap_nhat = now();`;
  try { execFileSync('ssh', ['-o', 'BatchMode=yes', BOX, lenh], { input: sqlText, encoding: 'utf8', timeout: 90_000 }); return true; }
  catch (e) { console.error(`ghi kenh_so_ngay hỏng: ${String(e.message).slice(0, 160)}`); return false; }
}

const main = () => {
  const so = docSo();

  if (co('--ghi')) {
    const i = ag.indexOf('--ghi');
    const [pageId, videoId, link] = [ag[i + 1], ag[i + 2], ag[i + 3]];
    if (!pageId || !videoId) { console.error('cần: --ghi <page_id> <video_id> <link> [ghi chú]'); process.exit(1); }
    if (so.reel.some((r) => r.video_id === videoId)) { console.log(`${videoId} đã có trong sổ`); return; }
    so.reel.push({ page_id: pageId, video_id: videoId, link: link ?? null, ghi_chu: ag[i + 4] ?? null, dang_luc: new Date().toISOString(), go_luc: null, so_cuoi: null });
    ghiSo(so);
    console.log(`đã ghi Reel ${videoId} (Page ${pageId}) — sống ${NGAY_SONG} ngày`);
    return;
  }

  const song = so.reel.filter((r) => !r.go_luc);
  if (co('--xem')) {
    if (!song.length) { console.log('sổ không có Reel nào đang sống'); return; }
    for (const r of song) {
      const s = soLieu(r.page_id, r.video_id) || {};
      const tuoi = ((Date.now() - new Date(r.dang_luc).getTime()) / 86_400_000).toFixed(1);
      console.log(`${r.video_id} · ${tuoi} ngày · phát ${s.fb_reels_total_plays ?? '?'} (riêng FB ${s.blue_reels_play_count ?? '?'})${s._loi ? ` · LỖI ${s._loi}` : ''}`);
      r.phat = Number(s.fb_reels_total_plays ?? 0); r.do_luc = new Date().toISOString();
    }
    const tong = song.reduce((t, r) => t + Number(r.phat ?? 0), 0);
    if (ghiSoNgay(SAN_PHAM, tong, song.length, { videos: song.map((r) => ({ url: r.link, xem: Number(r.phat ?? 0) })) }))
      console.log(`đã ghi kenh_so_ngay: fb-reels / ${SAN_PHAM} · ${tong} lượt phát / ${song.length} Reel`);
    // TỰ BÁO, KHÔNG BẮT ANH MỞ TRANG (anh cấm tư vấn làm tay khi còn đường máy): lượt phát nhảy ≥ BUOC_BAO so với lần
    // đã báo thì nhắn thẳng chủ đề Aff Convert. Chạy mỗi giờ nên mốc này giữ cho nó không nhắn liên tục vì vài lượt lẻ.
    const daBao = Number(so.bao_tong ?? 0);
    if (tong - daBao >= BUOC_BAO) {
      const bang = song.map((r) => `${String(r.ghi_chu ?? r.video_id).slice(0, 22).padEnd(22)} ${String(r.phat ?? 0).padStart(6)}`).join('\n');
      const tep = `${process.env.HOME}/.cache/reel-view.html`;
      writeFileSync(tep, `<b>Reel Mia Calloway - ${tong} lượt phát</b>\n<pre>${bang}</pre>\nTrước đó ${daBao} · lúc ${gioVN()}`);
      try { execFileSync(TG, ['send', 'mine', '--topic', 'Aff Convert', '--file', tep], { timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }); so.bao_tong = tong; console.log(`đã nhắn Telegram (${daBao} → ${tong})`); }
      catch (e) { console.error(`nhắn Telegram hỏng: ${String(e.message).slice(0, 140)}`); }
    }
    ghiSo(so);
    return;
  }

  // ẨN / HIỆN LẠI theo tay: node … --an <video_id> [<video_id> …]   ·   --hien <video_id> …
  if (co('--an') || co('--hien')) {
    const hien = co('--hien');
    const i = ag.indexOf(hien ? '--hien' : '--an');
    const ids = ag.slice(i + 1).filter((x) => !x.startsWith('--'));
    if (!ids.length) { console.error(`cần: ${hien ? '--hien' : '--an'} <video_id> [<video_id> …]`); process.exit(1); }
    for (const vid of ids) {
      const r = so.reel.find((x) => x.video_id === vid);
      if (!r) { console.log(`✗ ${vid}: không có trong sổ`); continue; }
      // GIỮ SỐ TRƯỚC KHI ẨN: bài ẩn vẫn đọc được insights, nhưng ghi lại mốc cho chắc
      const s2 = soLieu(r.page_id, r.video_id) || {};
      const ok = anReel(r.page_id, r.video_id, hien);
      if (ok) { r.an_luc = hien ? null : new Date().toISOString(); if (!hien) r.so_khi_an = s2; }
      console.log(`${ok ? (hien ? '✓ đã hiện lại' : '✓ đã ẩn') : '✗ hỏng'} ${vid} — phát ${s2.fb_reels_total_plays ?? '?'}`);
    }
    ghiSo(so);
    return;
  }

  if (co('--don')) {
    const thu = co('--thu');
    const hetHan = song.filter((r) => Date.now() - new Date(r.dang_luc).getTime() >= NGAY_SONG * 86_400_000);
    if (!hetHan.length) { console.log(`không Reel nào quá ${NGAY_SONG} ngày (đang sống: ${song.length})`); return; }
    const dong = [];
    for (const r of hetHan) {
      const s = soLieu(r.page_id, r.video_id) || {};
      const phat = Number(s.fb_reels_total_plays ?? 0);
      const tom = `phát ${s.fb_reels_total_plays ?? '?'}`;
      // CÒN LÊN VIEW THÌ GIỮ (anh 10/11/2026 "nếu vẫn có view thì ko cần xoá"): Reel quá hạn mà lượt phát vẫn nhích
      // so với lần đo trước thì Facebook còn đang đẩy — gỡ lúc này là tự cắt. Chỉ gỡ cái đã đứng im.
      // SO THEO NGÀY, KHÔNG THEO LƯỢT CHẠY (anh 10/11/2026 cho chạy mỗi giờ): một giờ mà lượt phát không nhích 30 là
      // chuyện thường của Reel nhỏ — so như thế thì Reel nào cũng bị coi là chết. Mốc chỉ được làm mới khi đã cách ≥ GIO_SO giờ.
      const mocLuc = r.moc_luc ? new Date(r.moc_luc).getTime() : 0;
      const dayGio = (Date.now() - mocLuc) / 3_600_000;
      const truoc = Number(r.phat_moc ?? -1);
      r.phat = phat; r.do_luc = new Date().toISOString();
      if (truoc < 0 || dayGio >= GIO_SO) { r.phat_moc = phat; r.moc_luc = new Date().toISOString(); }
      if (truoc < 0) { console.log(`giữ ${r.video_id} — vừa đặt mốc đầu sau hạn (${tom}), ${GIO_SO} giờ nữa mới so được`); continue; }
      if (dayGio < GIO_SO) { console.log(`giữ ${r.video_id} — mốc mới ${dayGio.toFixed(1)}/${GIO_SO} giờ (${tom})`); continue; }
      if (phat > truoc + TANG_TOI_THIEU) { console.log(`giữ ${r.video_id} — còn lên view ${truoc} → ${phat} trong ${GIO_SO} giờ (${tom})`); continue; }
      // GIỮ SỐ TRƯỚC KHI GỠ: gỡ xong Facebook không trả lại số nào nữa, mất là mất hẳn.
      r.so_cuoi = s;
      if (thu) { console.log(`[thử] sẽ gỡ ${r.video_id} — đứng im ${truoc} → ${phat} suốt ${dayGio.toFixed(0)} giờ · ${tom}`); continue; }
      const ok = goReel(r.page_id, r.video_id);
      r.go_luc = ok ? new Date().toISOString() : null;
      console.log(`${ok ? 'đã gỡ' : 'GỠ HỎNG'} ${r.video_id} — ${tom}`);
      dong.push(`${r.video_id.padEnd(18)} ${tom}`);
    }
    if (!thu) {
      ghiSo(so);
      if (dong.length) {
        const tep = `${process.env.HOME}/.cache/reel-go.html`;
        writeFileSync(tep, `<b>Đã gỡ ${dong.length} Reel quá ${NGAY_SONG} ngày</b>\n<pre>${dong.join('\n')}</pre>\nLúc ${gioVN()} · Page Mia Calloway`);
        try { execFileSync(TG, ['send', 'mine', '--topic', 'Aff Convert', '--file', tep], { timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { /* sổ Telegram hỏng không chặn việc gỡ */ }
      }
    }
    return;
  }

  console.log('dùng: --ghi <page_id> <video_id> <link> | --xem | --don [--thu]');
};

main();
