#!/bin/bash
# CẢ LÔ H3 CHẠY TÁCH HẲN TRÊN MÁY THUÊ (16/11/2026: mạng iMac chập hai lần làm đứt phiên ssh giữa lúc cài → máy xoá, mất lượt). may-h3.sh chỉ thả tệp này
# chạy nền (setsid) rồi ghé vào kéo clip; mất kết nối thì lần ghé sau nối lại. Kết quả: /root/h3/ra/<tên>.mp4 + /root/h3/ra/so.jsonl; xong ghi /root/h3/ra/XONG.
# LƯỚI AN TOÀN tự thân: cả lô có trần $1 phút; xong việc mà 20 phút không ai xoá máy (iMac mất liên lạc) → máy tự TẮT (runpodctl stop pod — hết tính tiền GPU).
#   bash lam-lo.sh <trần phút>
TRAN=${1:-110}; mkdir -p /root/h3/ra; cd /root/h3
tat() { sleep "${1:-1200}"; runpodctl stop pod "$RUNPOD_POD_ID" >/dev/null 2>&1 || true; }
( sleep $(( TRAN * 60 + 1200 )); runpodctl stop pod "$RUNPOD_POD_ID" >/dev/null 2>&1 ) &   # trần cứng, kể cả khi bước nào treo
if ! bash /root/h3/tren-may.sh > /root/h3/ra/cai.log 2>&1 || ! curl -s -m 3 127.0.0.1:8188/system_stats >/dev/null; then
  echo '{"loi":"cài lỗi"}' > /root/h3/ra/XONG; tail -30 /root/comfyui.log >> /root/h3/ra/cai.log 2>/dev/null; tat; exit 1
fi
T0=$(date +%s); dau=1
for v in $(cat /root/h3/thu-tu.txt); do
  con=$(( TRAN * 60 - ($(date +%s) - T0) )); [ $con -gt 120 ] || { echo "{\"vao\":\"$v\",\"ok\":false,\"kq\":\"hết trần\"}" >> ra/so.jsonl; break; }
  KQ=$(timeout $con python3 /root/h3/chay-h3.py /root/h3/vao/$v.json 2>&1 | tail -5)
  MP4=$(echo "$KQ" | tail -1 | python3 -c 'import json,sys; print(json.load(sys.stdin).get("mp4",""))' 2>/dev/null)
  if [ -n "$MP4" ] && [ -f "$MP4" ]; then cp "$MP4" "ra/$v.mp4"; ok=true; else ok=false; fi
  echo "{\"vao\":\"$v\",\"ok\":$ok,\"kq\":$(echo "$KQ" | tail -1 | python3 -c 'import json,sys; t=sys.stdin.read().strip(); print(t if t.startswith("{") else json.dumps(t[-600:]))')}" >> ra/so.jsonl
  [ "$ok" = false ] && [ $dau = 1 ] && { echo "cụm ĐẦU hỏng — dừng lô" >> ra/so.jsonl; break; }
  dau=0
done
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader >> ra/cai.log
echo "{\"giay\":$(( $(date +%s) - T0 ))}" > ra/XONG
tat
