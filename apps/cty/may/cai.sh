#!/usr/bin/env bash
# Cài BỘ ĐIỀU PHỐI VIỆC NỀN (dieu-phoi.mjs) lên một máy Mac — việc nền DUY NHẤT của máy đó (anh 14/10/2026). Chạy trên iMac:
#   apps/cty/may/cai.sh iMac        → cài ở máy này
#   apps/cty/may/cai.sh MacBook     → đẩy sang MacBook qua ssh rồi cài ở đó
# Mỗi máy: ~/viec-nen/dieu-phoi.mjs + liên kết tên ~/viec-nen/ten/"Cty - điều phối việc nền" → node (Mục đăng nhập + Activity Monitor hiện tên
# này) + LaunchAgent tc.on.cty.dieu-phoi (KeepAlive). Việc cũ KHÔNG gỡ ở đây: bộ điều phối tự thu nhận từng plist khi lượt launchd của nó xong.
# Chạy lại an toàn (sửa dieu-phoi.mjs → chạy lại để máy dùng bản mới; việc đang chạy không bị ngắt).
set -euo pipefail
MAY=${1:?iMac|MacBook}
D=$(cd "$(dirname "$0")" && pwd)
NHAN=tc.on.cty.dieu-phoi
TEN="Cty - điều phối việc nền"

cai() {   # chạy trên máy đích; $1 = iMac|MacBook
  cat <<SH
set -euo pipefail
mkdir -p ~/viec-nen/ten ~/.cache
mv ~/viec-nen/.dieu-phoi.moi ~/viec-nen/dieu-phoi.mjs
/opt/homebrew/bin/node ~/viec-nen/dieu-phoi.mjs --tu-kiem
ln -sfn "\$(/usr/bin/python3 -c 'import os;print(os.path.realpath("/opt/homebrew/bin/node"))')" ~/viec-nen/ten/"$TEN"
cat > ~/Library/LaunchAgents/$NHAN.plist <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- Bộ điều phối việc nền — việc nền duy nhất của máy. Sổ: MOS2 apps/cty/cong-ty/viec-nen.json. Cài: apps/cty/may/cai.sh -->
<plist version="1.0"><dict>
  <key>Label</key><string>$NHAN</string>
  <key>ProgramArguments</key><array><string>\$HOME/viec-nen/ten/$TEN</string><string>\$HOME/viec-nen/dieu-phoi.mjs</string><string>chay</string><string>$1</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>AbandonProcessGroup</key><true/>
  <key>StandardOutPath</key><string>\$HOME/.cache/dieu-phoi.launchd.log</string>
  <key>StandardErrorPath</key><string>\$HOME/.cache/dieu-phoi.launchd.log</string>
</dict></plist>
PL
plutil -lint ~/Library/LaunchAgents/$NHAN.plist >/dev/null
launchctl bootout gui/\$(id -u)/$NHAN 2>/dev/null || true
# bootout chạy BẤT ĐỒNG BỘ: nạp lại ngay sau đó hay đụng "Bootstrap failed: 5: Input/output error" → bộ điều phối tắt hẳn, mọi việc nền iMac đứng
# (24/10/2026: đứng 10 phút). Thử lại tới 10 lần, cách 2 giây; vẫn hỏng thì báo to và thoát lỗi.
for i in 1 2 3 4 5 6 7 8 9 10; do launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/$NHAN.plist 2>/dev/null && break; sleep 2; done
launchctl print gui/\$(id -u)/$NHAN >/dev/null 2>&1 || { echo "✗ KHÔNG NẠP LẠI ĐƯỢC $NHAN — việc nền máy này đang đứng: launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/$NHAN.plist" >&2; exit 1; }
sleep 3
launchctl print gui/\$(id -u)/$NHAN | grep -E '^\s*(state|pid) ='
tail -3 ~/.cache/dieu-phoi.log
SH
}

case $MAY in
  iMac)    cp "$D/dieu-phoi.mjs" ~/viec-nen/.dieu-phoi.moi 2>/dev/null || { mkdir -p ~/viec-nen; cp "$D/dieu-phoi.mjs" ~/viec-nen/.dieu-phoi.moi; }
           cai iMac | bash ;;
  MacBook) ssh nguyens-macbook-pro 'mkdir -p ~/viec-nen' && scp -q "$D/dieu-phoi.mjs" nguyens-macbook-pro:viec-nen/.dieu-phoi.moi
           cai MacBook | ssh nguyens-macbook-pro bash ;;
  *) echo "dùng: $0 iMac|MacBook"; exit 2 ;;
esac
