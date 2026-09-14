# PHỦ — adapter cho trang /p/<project>/phu

Mọi số liệu của trang đổ qua hai cửa: `POST /api/phu/ingest` (Bearer MOS2_EXT_KEY, cho cron)
và `GET|POST /api/phu/postback?k=<token nguồn>` (mạng affiliate gọi về).

Cron trên box3 (`crontab -e`, env lấy từ .env.production):
```
*/15 * * * * cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && node scripts/phu/log-box2.mjs >> /var/log/mos2-phu.log 2>&1
20 5 * * *   cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && node scripts/phu/chaturbate.mjs >> /var/log/mos2-phu.log 2>&1
10 1-23/2 * * * cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && node scripts/phu/bidvertiser.mjs >> /var/log/mos2-phu.log 2>&1
40 0 * * *   cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && node scripts/phu/bidvertiser.mjs --hom-qua >> /var/log/mos2-phu.log 2>&1
```
- `log-box2.mjs` — click (/px, có `s=` sid) + out (/r/) từ nhật ký nginx box2, nhịp tim lander.
- `chaturbate.mjs` — payout/ngày từ apistats (không có breakdown campaign → dòng organic).
- `bidvertiser.mjs` — chi/visit/bid-request theo NGÀY × camp (`phu_chi`), tự khai camp `bv-*` vào `phu_camp`
  (prefix `bidvertiser_<tên>`), balance vào ghi chú nguồn. Creds: `/etc/mos2-phu/bidvertiser.env`
  (`BV_EMAIL`/`BV_PASS`/`BV_API_KEY`, root 600; gốc mã hoá ở Directus earns accounts fb5974e1). Cron:
  `10 1,3,…,23 * * *` hôm nay; `40 0 * * *` với `--hom-qua` chốt hôm qua. URL đích camp:
  `?s=bidvertiser_<tên>_{BV_SRCID}`.
- Postback: dán URL mẫu (trên trang, mỗi nguồn một token) vào CrakRevenue (Postbacks Options),
  AWEmpire (Postback Editor), Stripcash (Service → Postback Setup); macro sub id của mạng vào `sid=`.
- Chi phí QC: nhập tay trên trang ("+ nhập chi") hoặc adapter API mạng đổ vào `chi[]`.
