#!/usr/bin/env python3
"""Ảnh nền thật cho mẫu máy "Scam or Real?" (ngách khách sạn → ratesbyroom.com) — luật anh 18/10/2026: mọi bài đăng / nội dung có ảnh minh hoạ thật
đúng chủ đề, nhìn rõ (chuẩn apps/cty/cong-ty/quy-dinh/noi-dung/chuan-bai-dang.md). Trước đó mẫu dựng nền gradient trơn — anh: "nhìn rất chán".
Mỗi đề một ảnh dọc Pexels KHÔNG trùng nhau, truy vấn theo chủ đề chiêu (từ khoá trong 'goi' / 'kenh'); ảnh đã chọn giữ nguyên qua các lần chạy.
Ghi nen_url (1080x1920 cắt sẵn) + nen_nguon (trang ảnh) vào chính mau/may/scam-or-real.json (đề viết tay, script chỉ thêm 2 trường ảnh).
  PEXELS_KEY=… python3 scam-or-real-anh.py
"""
import json, os, sys, urllib.request, urllib.parse
RA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'mau', 'may', 'scam-or-real.json')
KEY = os.environ.get('PEXELS_KEY', '')
# từ khoá trong tên chiêu → truy vấn ảnh (khớp đầu tiên thắng); không khớp thì theo kênh tin
CHU_DE = [
    ('taxi', 'airport taxi traveler suitcase'), ('wi-fi', 'hotel room laptop wifi'), ('passport', 'passport travel documents hotel'),
    ('qr', 'qr code payment phone'), ('crypto', 'cryptocurrency payment phone'), ('gift card', 'gift cards wallet'),
    ('bank', 'online banking laptop'), ('card', 'credit card payment smartphone'), ('damage', 'hotel room checkout'),
    ('towel', 'hotel towels room'), ('receipt', 'hotel receipt front desk'), ('check-in', 'hotel check in reception'),
    ('checkin', 'hotel check in reception'), ('upgrade', 'luxury hotel suite'), ('queue', 'hotel lobby queue'),
    ('points', 'travel loyalty card phone'), ('review', 'hotel review smartphone'), ('city tax', 'european city street hotel'),
    ('overbooked', 'hotel reception desk night'), ('cancel', 'traveler worried phone hotel'), ('refund', 'woman reading phone message'),
    ('deposit', 'hotel booking payment laptop'), ('price', 'hotel booking website laptop'), ('confirm', 'hotel booking confirmation email laptop'),
    ('call', 'man calling phone hotel room'), ('chat', 'texting smartphone hands'),
]
THEO_KENH = {'WhatsApp': 'texting smartphone hands hotel', 'SMS': 'reading text message phone', 'Email': 'reading email laptop hotel room'}

def truyVan(x):
    g = x['goi'].lower()
    return next((q for k, q in CHU_DE if k in g), THEO_KENH.get(x.get('kenh'), 'hotel reception'))

def main():
    if not KEY: sys.exit('thiếu PEXELS_KEY (ảnh nền bắt buộc)')
    ds = json.load(open(RA))
    dung = {x['nen_nguon'] for x in ds if x.get('nen_nguon')}
    moi = 0
    for x in ds:
        if x.get('nen_url'): continue
        q = truyVan(x)
        r = urllib.request.Request('https://api.pexels.com/v1/search?' + urllib.parse.urlencode({'query': q, 'orientation': 'portrait', 'per_page': 15}),
                                   headers={'Authorization': KEY, 'User-Agent': 'Mozilla/5.0'})
        p = next((p for p in json.load(urllib.request.urlopen(r, timeout=30))['photos'] if p['url'] not in dung), None)
        if not p: sys.exit(f'Pexels hết ảnh chưa dùng cho "{q}" ({x["slug"]}) — dừng, không để video nào thiếu ảnh')
        dung.add(p['url'])
        x['nen_url'] = p['src']['original'] + '?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop'
        x['nen_nguon'] = p['url']
        moi += 1
        print(f'  {x["slug"]}: "{q}" → {p["url"]}')
    json.dump(ds, open(RA, 'w'), ensure_ascii=False, indent=1)
    print(f'→ {os.path.normpath(RA)}: {moi} ảnh mới, {len(ds)} đề')

if __name__ == '__main__':
    main()
