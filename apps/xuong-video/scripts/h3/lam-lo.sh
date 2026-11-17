#!/bin/bash
# CẢ LÔ H3 CHẠY TÁCH HẲN TRÊN MÁY THUÊ (16/11/2026: mạng iMac chập hai lần làm đứt phiên ssh giữa lúc cài → máy xoá, mất lượt). may-h3.sh chỉ thả tệp này
# chạy nền (setsid) rồi ghé vào kéo clip; mất kết nối thì lần ghé sau nối lại. Kết quả: /root/h3/ra/<tên>.mp4 + /root/h3/ra/so.jsonl; xong ghi /root/h3/ra/XONG.
# LƯỚI AN TOÀN tự thân: cả lô có trần $1 phút; xong việc mà 20 phút không ai xoá máy (iMac mất liên lạc) → máy tự TẮT / tự XOÁ (RunPod runpodctl · Vast khoá riêng của máy).
#   bash lam-lo.sh <trần phút>
TRAN=${1:-110}; mkdir -p /root/h3/ra; cd /root/h3
# TỰ TẮT cả hai nhà: RunPod = runpodctl; VAST = xoá chính máy bằng khoá riêng Vast cấp cho từng máy (CONTAINER_ID + CONTAINER_API_KEY trong môi trường
# tiến trình 1 — phiên ssh có thể không có, đọc /proc/1/environ). 17/11/2026: máy Vast thử model vẫn chạy $0,71/giờ sau khi iMac dừng lượt — lưới cũ chỉ có runpodctl.
moi1() { tr '\0' '\n' < /proc/1/environ 2>/dev/null | sed -n "s/^$1=//p" | head -1; }
tu_xoa() {
  runpodctl stop pod "$RUNPOD_POD_ID" >/dev/null 2>&1 || true
  local id=${CONTAINER_ID:-$(moi1 CONTAINER_ID)} k=${CONTAINER_API_KEY:-$(moi1 CONTAINER_API_KEY)}
  [ -n "$id" ] && [ -n "$k" ] && curl -s -m 30 -X DELETE -H "Authorization: Bearer $k" "https://console.vast.ai/api/v0/instances/$id/" >/dev/null 2>&1 || true
}
tat() { sleep "${1:-1200}"; tu_xoa; }
( sleep $(( TRAN * 60 + 1200 )); tu_xoa ) &   # trần cứng, kể cả khi bước nào treo
if ! bash /root/h3/tren-may.sh > /root/h3/ra/cai.log 2>&1 || ! curl -s -m 3 127.0.0.1:8188/system_stats >/dev/null; then
  echo '{"loi":"cài lỗi"}' > /root/h3/ra/XONG; tail -30 /root/comfyui.log >> /root/h3/ra/cai.log 2>/dev/null; tat; exit 1
fi
T0=$(date +%s); dau=1
for v in $(cat /root/h3/thu-tu.txt); do
  con=$(( TRAN * 60 - ($(date +%s) - T0) )); [ $con -gt 120 ] || { echo "{\"vao\":\"$v\",\"ok\":false,\"kq\":\"hết trần\"}" >> ra/so.jsonl; break; }
  KQ=$(timeout $con python3 /root/h3/${XV_CHAY:-chay-h3.py} /root/h3/vao/$v.json 2>&1 | tail -5)   # XV_CHAY=chay-anh.py: keyframe Qwen-Image-Edit
  # mỗi bản (so_ban, luật chuẩn H3) → ra/<tên>.b<k>.mp4; bản đầu cũng là ra/<tên>.mp4 (đường cũ đọc tên này)
  MP4S=$(echo "$KQ" | tail -1 | python3 -c 'import json,sys; d=json.load(sys.stdin); print(" ".join(d.get("mp4s") or ([d["mp4"]] if d.get("mp4") else [])))' 2>/dev/null)
  ok=false; k=0
  for f in $MP4S; do [ -f "$f" ] || continue; k=$((k + 1)); d=${f##*.}; cp "$f" "ra/$v.b$k.$d"; [ $k = 1 ] && cp "$f" "ra/$v.$d"; ok=true; done   # đuôi theo tệp (mp4 video · png keyframe)
  echo "{\"vao\":\"$v\",\"ok\":$ok,\"kq\":$(echo "$KQ" | tail -1 | python3 -c 'import json,sys; t=sys.stdin.read().strip(); print(t if t.startswith("{") else json.dumps(t[-600:]))')}" >> ra/so.jsonl
  [ "$ok" = false ] && [ $dau = 1 ] && { echo "cụm ĐẦU hỏng — dừng lô" >> ra/so.jsonl; break; }
  dau=0
done
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader >> ra/cai.log
echo "{\"giay\":$(( $(date +%s) - T0 ))}" > ra/XONG
tat
