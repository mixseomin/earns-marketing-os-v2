#!/usr/bin/env node
// ĐO NHU CẦU DẠNG KÊNH (anh 02/11/2026: "đo xong update luôn vào thư viện sau không phải chạy lại, kèm time update để quá lâu mới phải update lại").
// Mỗi dạng kênh dựng được bằng code (Thư viện › 🧪 Prompt Opus) có vài cụm tìm; mỗi cụm đo 20 kết quả YouTube đầu (lượt xem, kênh, độ dài) bằng máy
// cào spy.on.tc trên box3 (yt-dlp + proxy làn 13 — không lộ IP nhà). Kết quả + do_luc ghi vào scripts/du-lieu/thu-vien/dang-kenh.json; chỉ đo lại cụm
// cũ hơn han_ngay (mặc định 30) — thư viện hiện tuổi số đo. 0đ (proxy đã trả theo tháng).
//   node scripts/do-dang-kenh.mjs            # đo cụm quá hạn / chưa đo
//   node scripts/do-dang-kenh.mjs --ep       # đo lại tất cả
//   node scripts/do-dang-kenh.mjs --id vat_ly # chỉ một dạng
// Thêm dạng / cụm: sửa tệp JSON (id, ten, mo_ta, khop = regex lọc prompt Opus, cum[].q) rồi chạy — cụm chưa có do_luc tự được đo.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const TEP = new URL('./du-lieu/thu-vien/dang-kenh.json', import.meta.url);
const a = process.argv.slice(2), ep = a.includes('--ep'), chiId = a.includes('--id') ? a[a.indexOf('--id') + 1] : null;
const kho = JSON.parse(readFileSync(TEP, 'utf8')), han = (kho.han_ngay ?? 30) * 86400_000;
const BOX = 'root@167.233.241.16';
// chạy trên box3: lấy IP proxy mới của làn 13, tìm 20 video, in một dòng JSON tóm tắt
const LENH = `GOC=/opt/spy; export GOC; . $GOC/scripts/proxy-chung.sh; LAN_CURL=13; EP=$(ip_moi_curl 2>/dev/null | tail -1); [ -n "$EP" ] || { echo '{"loi":"không có proxy"}'; exit 0; }
python3 /opt/spy/bin/yt-dlp --proxy "http://$EP" --flat-playlist -j --no-warnings "ytsearch20:$CUM" 2>/dev/null | python3 -c '
import json,sys
ds=[json.loads(l) for l in sys.stdin if l.strip()]; v=sorted([d.get("view_count") or 0 for d in ds],reverse=True)
print(json.dumps({"n":len(ds),"trung_vi":v[len(v)//2] if v else 0,"top":[{"xem":d.get("view_count"),"kenh":d.get("channel"),"giay":d.get("duration"),"ten":(d.get("title") or "")[:80],"url":d.get("url")} for d in sorted(ds,key=lambda d:-(d.get("view_count") or 0))[:5]]},ensure_ascii=False))'`;
let doi = 0;
for (const d of kho.ds) {
  if (chiId && d.id !== chiId) continue;
  for (const c of d.cum) {
    if (!ep && c.do_luc && Date.now() - Date.parse(c.do_luc) < han) continue;
    const ra = execFileSync('ssh', [BOX, `CUM=${JSON.stringify(c.q)} bash -s`], { input: LENH, encoding: 'utf8', timeout: 180_000 }).trim().split('\n').pop() || '{}';
    const kq = JSON.parse(ra);
    if (kq.loi || !kq.n) { console.log(`✗ ${d.id} · "${c.q}": ${kq.loi || 'không có kết quả'}`); continue; }
    Object.assign(c, kq, { do_luc: new Date().toISOString().replace(/\.\d+Z$/, 'Z') }); doi++;
    console.log(`✓ ${d.id} · "${c.q}": trung vị ${kq.trung_vi.toLocaleString('vi-VN')} lượt xem`);
  }
}
if (doi) writeFileSync(TEP, JSON.stringify(kho, null, 1) + '\n');
console.log(doi ? `đã ghi ${doi} cụm → ${TEP.pathname}` : `không cụm nào quá hạn ${kho.han_ngay ?? 30} ngày — dùng số cũ`);
