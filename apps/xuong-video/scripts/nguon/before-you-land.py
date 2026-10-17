#!/usr/bin/env python3
"""Nguồn đề mẫu máy "Before you land" (ngách eSIM du lịch → esimfares.com, roadmap S02 17/10/2026).
Nước lấy từ kho CỦA esimfares (hotel-arb scripts/sites/data-esim/locations.json — 155 nước đã dò trang đối tác Airalo): video chỉ làm cho nước có trang thật.
Sân bay: cửa ngõ chính khai tay bằng mã IATA, ĐỐI CHIẾU với OurAirports (CC0, du-lieu/ourairports-iata-lon.csv — sân bay lớn/vừa có chuyến thường lệ,
lọc từ davidmegginson.github.io/ourairports-data/airports.csv 17/10/2026): tên + thành phố lấy từ đó; mã không có / sai nước thì bỏ, không đưa vào video.
Kho esimfares thiếu nhiều cửa ngõ lớn (NRT, HND, FCO, LHR…) nên không dùng danh sách sân bay của kho.
Ảnh nền: mỗi nước một ảnh dọc từ Pexels (free, link trang ảnh ghi ở nen_nguon) — luật 'nền lớn = ảnh thật' (skill design/stock-photo-apis).
Ảnh đã chọn giữ nguyên qua các lần chạy (đọc lại tệp ra); khoá PEXELS_KEY lấy từ môi trường.
→ apps/xuong-video/mau/may/before-you-land.json
  PEXELS_KEY=… python3 before-you-land.py [đường-dẫn-locations.json]
"""
import csv, json, os, sys, urllib.request, urllib.parse
GOC = os.path.dirname(os.path.abspath(__file__))
KHO = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Me/Earns/hotel-arb/scripts/sites/data-esim/locations.json')
RA = os.path.join(GOC, '..', '..', 'mau', 'may', 'before-you-land.json')
# nước → cửa ngõ quốc tế chính (IT FCO thay cho Rome) (thứ tự = hiện trên video), theo lượng khách quốc tế phổ biến
CUA = {
 'JP': ['NRT', 'HND', 'KIX'], 'IT': ['FCO', 'MXP', 'VCE'], 'FR': ['CDG', 'ORY', 'NCE'], 'ES': ['MAD', 'BCN', 'AGP'], 'GB': ['LHR', 'LGW', 'MAN'],
 'MX': ['MEX', 'CUN', 'PVR'], 'TH': ['BKK', 'DMK', 'HKT'], 'GR': ['ATH', 'JTR', 'HER'], 'PT': ['LIS', 'OPO', 'FAO'], 'DE': ['FRA', 'MUC', 'BER'],
 'TR': ['IST', 'SAW', 'AYT'], 'KR': ['ICN', 'GMP', 'PUS'], 'VN': ['SGN', 'HAN', 'DAD'], 'ID': ['DPS', 'CGK'], 'IS': ['KEF'],
 'NL': ['AMS'], 'CH': ['ZRH', 'GVA'], 'IE': ['DUB', 'SNN'], 'HR': ['DBV', 'SPU', 'ZAG'], 'EG': ['CAI', 'HRG', 'SSH'],
 'MA': ['RAK', 'CMN'], 'AE': ['DXB', 'AUH'], 'AU': ['SYD', 'MEL', 'BNE'], 'NZ': ['AKL', 'CHC', 'ZQN'], 'PE': ['LIM', 'CUZ'],
 'CR': ['SJO', 'LIR'], 'CO': ['BOG', 'MDE', 'CTG'], 'PH': ['MNL', 'CEB'], 'SG': ['SIN'], 'TW': ['TPE', 'TSA'],
}
kho = list(json.load(open(KHO)).values())[0]
OA = {r['iata']: r for r in csv.DictReader(open(os.path.join(GOC, 'du-lieu', 'ourairports-iata-lon.csv'), encoding='utf-8'))}
cu = {}
try: cu = {x['slug']: x for x in json.load(open(RA))}
except FileNotFoundError: pass
KEY = os.environ.get('PEXELS_KEY', '')
dung = {x.get('nen_nguon') for x in cu.values()}
def anh(nuoc):
    """Ảnh dọc đầu tiên chưa dùng cho '<nước> skyline landmark' trên Pexels → (url 1080x1920 cắt sẵn, link trang ảnh)."""
    if not KEY: sys.exit('thiếu PEXELS_KEY (ảnh nền bắt buộc)')
    q = urllib.request.Request('https://api.pexels.com/v1/search?' + urllib.parse.urlencode({'query': f'{nuoc} skyline landmark', 'orientation': 'portrait', 'per_page': 10}),
                               headers={'Authorization': KEY, 'User-Agent': 'Mozilla/5.0'})
    for p in json.load(urllib.request.urlopen(q, timeout=30))['photos']:
        if p['url'] in dung: continue
        dung.add(p['url'])
        return p['src']['original'] + '?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop', p['url']
    sys.exit(f'Pexels không có ảnh cho {nuoc}')
ra, bo = [], []
for ma, ds in CUA.items():
    n = kho.get(ma)
    if not n: bo.append(f'{ma}: không có trong kho'); continue
    hop = [c for c in ds if c in OA and OA[c]['nuoc'] == ma]
    sb = [{'iata': c, 'ten': OA[c]['ten'], 'tp': OA[c]['tp']} for c in hop]
    bo += [f'{ma} {c}: không có trong OurAirports / sai nước' for c in ds if c not in hop]
    if not sb: bo.append(f'{ma}: không còn sân bay nào'); continue
    slug = f"land-{n['slug']}"
    nen, nguon = (cu[slug]['nen_url'], cu[slug]['nen_nguon']) if cu.get(slug, {}).get('nen_url') else anh(n['ten'])
    ra.append({'slug': slug, 'iso': ma.lower(), 'nuoc': n['ten'], 'san_bay': sb[:3], 'link': f'https://esimfares.com/{ma.lower()}/', 'nen_url': nen, 'nen_nguon': nguon})
json.dump(ra, open(RA, 'w'), ensure_ascii=False, indent=1)
print(f'→ {os.path.normpath(RA)}: {len(ra)} nước'); [print('  bỏ', x) for x in bo]
