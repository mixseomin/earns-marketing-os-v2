# Xưởng video — studio.on.tc (apps/xuong-video)

App RIÊNG (không nằm trong mos2): Next 15, cổng 3840, `mos2-studio.service`, vhost studio.on.tc trên **box3 167.233.241.16**.
Dùng chung DB `mos2_prod` + `.env.production` + phiên SSO `mos2-session` (.on.tc). Deploy = commit + push main (GHA → deploy.sh khối 5c/5d).

- **Góp ý của anh** → card plays dự án `xuong-video` (mos2.on.tc/p/xuong-video/plays). Nhặt + xử bằng **`/tasks-studio`**
  (`ssh root@167.233.241.16 GOPY_PROJECT=xuong-video /opt/earns-marketing-os-v2/scripts/gop-y.sh list|show|claim|reply|submit`).
  Không đụng card của dự án khác; nộp Review, không tự đóng.
- Sinh ảnh chạy trên Cloudflare Worker `xv-worker` (tài khoản CF Astrolas, Workers Paid) qua queue `xv-jobs`; Worker báo về `/api/xv/xong`.
- Luật: **CẤM tự sinh video bằng AI** (hook rule 23); mọi lượt sinh tốn tiền chỉ do anh bấm. Giá chỉ ghi dạng `$`. Giờ GMT+7.
- File chính: `src/lib/actions.ts` (server actions), `src/components/trang.tsx` (UI), `timeline.tsx`, `gop-y.tsx`, `src/lib/xuong-video/*` (provider, worker job), `worker/`.
