# PHỦ — adapter cho trang /p/<project>/phu

Mọi số liệu của trang đổ qua hai cửa: `POST /api/phu/ingest` (Bearer MOS2_EXT_KEY, cho cron)
và `GET|POST /api/phu/postback?k=<token nguồn>` (mạng affiliate gọi về).

Cron trên box3 (`crontab -e`, env lấy từ .env.production):
```
*/15 * * * * cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && node scripts/phu/log-box2.mjs >> /var/log/mos2-phu.log 2>&1
20 5 * * *   cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && node scripts/phu/chaturbate.mjs >> /var/log/mos2-phu.log 2>&1
```
- `log-box2.mjs` — click (/px, có `s=` sid) + out (/r/) từ nhật ký nginx box2, nhịp tim lander.
- `chaturbate.mjs` — payout/ngày từ apistats (không có breakdown campaign → dòng organic).
- Postback: dán URL mẫu (trên trang, mỗi nguồn một token) vào CrakRevenue (Postbacks Options),
  AWEmpire (Postback Editor), Stripcash (Service → Postback Setup); macro sub id của mạng vào `sid=`.
- Chi phí QC: nhập tay trên trang ("+ nhập chi") hoặc adapter API mạng đổ vào `chi[]`.
