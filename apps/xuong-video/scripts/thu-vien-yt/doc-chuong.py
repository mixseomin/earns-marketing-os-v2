#!/usr/bin/env python3
# ĐỌC CHAPTER THẬT của video YouTube làm ví dụ cho thư viện điện ảnh (anh 18/10/2026: "cần thêm hình minh hoạ, video một đoạn mô tả về nó từ film
# đang có, link từ YT ở vị trí liên quan"). Đọc trang xem công khai (không tải video), lấy tiêu đề + kênh + chapter (tên + giây bắt đầu) → chuong.json.
# Mốc giây CHỈ đến từ đây — dung-vi-du.mts từ chối mọi ví dụ trỏ vào chapter không có trong tệp này (không bịa link / giây).
# Chạy trên máy Mac (IP máy chủ bị YouTube đòi đăng nhập): python3 apps/xuong-video/scripts/thu-vien-yt/doc-chuong.py
import json, re, sys, time, urllib.request
from pathlib import Path

NGUON = Path(__file__).with_name('nguon.txt')     # mỗi dòng một videoId (11 ký tự), # = chú thích
RA = Path(__file__).with_name('chuong.json')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36'

def doc(vid):
    rq = urllib.request.Request(f'https://www.youtube.com/watch?v={vid}', headers={'User-Agent': UA, 'Accept-Language': 'en-US'})
    s = urllib.request.urlopen(rq, timeout=40).read().decode('utf-8', 'ignore')
    tieu_de = re.search(r'<meta name="title" content="(.*?)"', s)
    kenh = re.search(r'"ownerChannelName":"(.*?)"', s)
    dai = re.search(r'"lengthSeconds":"(\d+)"', s)
    ch, thay = [], set()
    for t, ms in re.findall(r'"chapterRenderer":\{"title":\{"simpleText":"(.*?)"\},"timeRangeStartMillis":(\d+)', s):
        if ms in thay: continue
        thay.add(ms); ch.append({'ten': json.loads(f'"{t}"'), 'tu': int(ms) // 1000})
    import html
    return {'id': vid, 'tieu_de': html.unescape(tieu_de.group(1)) if tieu_de else '', 'kenh': json.loads(f'"{kenh.group(1)}"') if kenh else '',
            'dai': int(dai.group(1)) if dai else None, 'chuong': ch, 'ngay_doc': time.strftime('%Y-%m-%d')}

cu = {v['id']: v for v in json.loads(RA.read_text())} if RA.exists() else {}
ids = [l.split('#')[0].strip() for l in NGUON.read_text().splitlines() if l.split('#')[0].strip()]
for vid in ids:
    try:
        v = doc(vid)
        if not v['tieu_de']: raise RuntimeError('không đọc được trang')
        cu[vid] = v; print(f"✓ {vid} {len(v['chuong'])} chapter · {v['kenh']} · {v['tieu_de'][:70]}")
    except Exception as e:
        print(f'✗ {vid}: {e}', file=sys.stderr)
    time.sleep(1.5)
RA.write_text(json.dumps(list(cu.values()), ensure_ascii=False, indent=1))
print(f'ghi {RA.name}: {len(cu)} video')
