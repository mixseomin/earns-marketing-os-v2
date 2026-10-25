# PAGE HOÀI CỔ · tuần thử 26/10–01/11/2026 (anh duyệt kế hoạch 25/10/2026: artifact https://claude.ai/artifact/PDt8SJax4Fdu2ariBk4zvX, "Duyệt. Lên bài đi").
# Dựng 21 bài cho 3 Page cũ (Retro Cars Club · Classical Motorcycle · Classic Car): ảnh thật độ phân giải đủ (Pexels / Wikimedia Commons, kèm ghi công
# tác giả + giấy phép), thẻ "Did you know?" chữ trên ảnh thật, ảnh bình chọn 1·2·3, cặp A/B, khung đố + đáp án cắt từ video Front Porch.
# Ra: ra/<id>-<n>.jpg + ke-hoach.json (đầu vào của apps/xuong-video/scripts/hen-page-hoai-co.mts — chấm Phòng Nội dung rồi hẹn giờ đăng qua Graph API).
#   python3 scripts/page-hoai-co/dung-anh.py            (iMac; cần ffmpeg + Pillow, gọi Pexels / Wikimedia, 0đ)
# Video mỗi Page KHÁC nhau và chưa lên Page của tài khoản khác (luật daLenTkKhac của máy đăng): classic-cars đã lên Retro Cars 25/10 nên chỉ Retro Cars
# được dùng link trang của nó.
import json, os, re, subprocess, urllib.request, urllib.parse, html
from PIL import Image, ImageDraw, ImageFont, ImageFilter

D = os.path.dirname(os.path.abspath(__file__)); RA = os.path.join(D, 'ra'); os.makedirs(RA, exist_ok=True)
UA = {'User-Agent': 'PageHoaiCo/1.0 (admin@mixseo.net)'}
PEXELS = 'dCIN8sx1PgUReuto3QPHXFT08wo1tnxvK6s3DqxlqgdE7YhdIFf5rYZ9'
NGUON = json.load(open(os.path.join(D, 'nguon-anh.json')))
F_DAM = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'; F_THUONG = '/System/Library/Fonts/Supplemental/Arial.ttf'; F_SERIF = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
VID = 'https://img.on.tc/xuong-video/may/'
UTM = lambda link, acct: f"{link}{'&' if '?' in link else '?'}utm_source=facebook&utm_medium=social&utm_campaign=page-hoai-co&utm_content=p{acct}"

def get(u, h=None, raw=False):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={**UA, **(h or {})}), timeout=60).read()
    return r if raw else json.loads(r)

def anh_goc(k):
    """ảnh độ phân giải đủ + ghi công. Pexels: bản w=1600 (giấy phép Pexels, không bắt ghi công). Wikimedia: bản 1600px + tác giả + giấy phép."""
    v = NGUON[k]; tep = os.path.join(RA, f'goc-{k}.jpg')
    if 'pexels.com' in v['nguon']:
        u = v['url'].split('?')[0] + '?auto=compress&cs=tinysrgb&w=1600'; cong = None
    else:
        t = 'File:' + urllib.parse.unquote(v['nguon'].split('File:')[1])
        r = get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'format': 'json', 'titles': t, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': 1600}))
        ii = next(iter(r['query']['pages'].values()))['imageinfo'][0]; m = ii['extmetadata']
        tg = re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', '', m.get('Artist', {}).get('value', 'Unknown')))).strip()
        u = ii['thumburl']; cong = f"📷 {tg}, {m.get('LicenseShortName', {}).get('value', '')}, via Wikimedia Commons"
    if not os.path.exists(tep): open(tep, 'wb').write(get(u, raw=True))
    return tep, cong, v['nguon']

def khung(slug, hash_, t, ten):
    tep = os.path.join(RA, ten)
    if not os.path.exists(tep): subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', f'{VID}{slug}-{hash_}.mp4', '-frames:v', '1', '-q:v', '2', tep], check=True)
    return tep

def phu(im, w):
    """co ảnh về rộng w (giữ tỉ lệ)"""
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if im.width != w else im

def cat(im, w, h):
    s = max(w / im.width, h / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2; return im.crop((x, y, x + w, y + h))

def huy_hieu(dr, cx, cy, r, chu, nen=(255, 255, 255), mau=(20, 20, 20), co=None):
    dr.ellipse((cx - r, cy - r, cx + r, cy + r), fill=nen, outline=(0, 0, 0), width=4)
    f = ImageFont.truetype(F_DAM, co or int(r * 1.15)); b = dr.textbbox((0, 0), chu, font=f)
    dr.text((cx - (b[2] + b[0]) / 2, cy - (b[3] + b[1]) / 2), chu, font=f, fill=mau)

def xuong_dong(dr, chu, f, rong):
    dong, ht = [], ''
    for w in chu.split():
        th = (ht + ' ' + w).strip()
        if dr.textlength(th, font=f) <= rong: ht = th
        else: dong.append(ht); ht = w
    return dong + [ht]

def the_biet(tep, su, ra):
    """thẻ 'Did you know?': ảnh thật phủ kín 1080×1350, dải tối mờ dần ở nửa dưới (ảnh vẫn rõ ở nửa trên), chữ trắng"""
    im = cat(Image.open(tep).convert('RGB'), 1080, 1350); lop = Image.new('L', (1080, 1350), 0); dl = ImageDraw.Draw(lop)
    for y in range(640, 1350): dl.line((0, y, 1080, y), fill=min(225, int((y - 640) / 380 * 225)))
    im = Image.composite(Image.new('RGB', im.size, (12, 12, 16)), im, lop); dr = ImageDraw.Draw(im)
    dr.text((72, 900), 'DID YOU KNOW?', font=ImageFont.truetype(F_DAM, 46), fill=(245, 190, 70))
    f = ImageFont.truetype(F_SERIF, 50); y = 975
    for d in xuong_dong(dr, su, f, 936): dr.text((72, y), d, font=f, fill=(255, 255, 255)); y += 64
    im.save(ra, quality=90)

def anh_binh(tep, ra):
    """ảnh bình chọn: ảnh thật rộng 1080, ba số 1 · 2 · 3 ở ba phần ba"""
    im = phu(Image.open(tep).convert('RGB'), 1080); dr = ImageDraw.Draw(im); y = im.height - 90
    for i, x in enumerate((180, 540, 900)): huy_hieu(dr, x, y, 54, str(i + 1))
    im.save(ra, quality=90)

def anh_ab(tep, chu, ra):
    im = cat(Image.open(tep).convert('RGB'), 1080, 1080); huy_hieu(ImageDraw.Draw(im), 110, 110, 70, chu, nen=(245, 190, 70)); im.save(ra, quality=90)

def anh_mot(tep, ra):
    phu(Image.open(tep).convert('RGB'), 1080).save(ra, quality=90)

NGAY = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']
SLOT = [('Ký ức', 'Ảnh đơn + câu hỏi'), ('Đố vui', 'Reel 9 giây'), ('Chọn một', 'Album 2 ảnh'), ('Bạn có biết', 'Thẻ chữ trên ảnh thật'),
        ('Đố vui', 'Album đố + đáp án'), ('Ký ức', 'Bình chọn 1 · 2 · 3'), ('Quảng bá', 'Bài link')]
PAGE = [
 {'k': 'rc', 'acct': 580, 'page_id': '129365743783277', 'ten': 'Retro Cars Club', 'gio': '20:00',
  'reel': ('drive-in-word-search-an2', '10bf8cdd', 'POPCORN'), 'album': ('thanksgiving-book-a-sunday-drive-to-see-the-leaves-an', '0618b058', 'OVERLOOK'),
  'link': 'https://pickjot.com/printables/classic-cars-word-search/',
  'cap': ['Who remembers riding in the way-back of a station wagon? Where did your family go on Sunday drives?', None,
          'Cruise night pick: A) Chevrolet Bel Air or B) 1966 Ford Mustang? Comment A or B.',
          "Did you know? 💡 Have you ever seen a first-generation Thunderbird out on the road? Tell us where.", None,
          'Which one would you take for a Sunday drive? Comment 1, 2 or 3.',
          'Free large-print classic cars word search, answer key included. Print it for the next rainy Sunday 👉 {link}'],
  'su': "The first Ford Thunderbird (1955–1957) was Ford's first two-seater since 1938, built as its answer to the Chevrolet Corvette."},
 {'k': 'mc', 'acct': 589, 'page_id': '111775101833474', 'ten': 'Classical Motorcycle', 'gio': '20:20',
  'reel': ('thanksgiving-book-the-roadside-farm-stand-an', '8a5eb5e6', 'MELONS'), 'album': ('winter-book-postcards-from-florida-an', '7c4667dd', 'POSTCARDS'),
  'link': 'https://pickjot.com/printables/',
  'cap': ['Rust, sand and a sidecar. Who here learned to ride on an old bike like this?', None,
          'British or American? A) Triumph Bonneville or B) 1950 Harley-Davidson Panhead. Comment A or B.',
          'Did you know? 💡 Did you or your dad ever ride a CB750? Tell us about it in the comments.', None,
          'Pick your garage: 1, 2 or 3? Tell us why in the comments.',
          'Free large-print puzzles for rainy garage days, answer keys included 👉 {link}'],
  'su': 'The 1969 Honda CB750 is regarded as the first motorcycle to be called a "superbike".'},
 {'k': 'cc', 'acct': 591, 'page_id': '111423638533699', 'ten': 'Classic Car', 'gio': '20:40',
  'reel': ('winter-book-warming-up-the-car-an', 'b62abb84', 'DEFROSTER'), 'album': ('winter-book-the-winter-carnival-an', 'ed38c23d', 'CARNIVAL'),
  'link': 'https://pickjot.com/printables/drive-in-word-search/',
  'cap': ["Burgers, neon and chrome out front. What was your town's diner called?", None,
          'Tail fins or curves? A) 1959 Cadillac Eldorado or B) Volkswagen Beetle. Comment A or B.',
          'Did you know? 💡 Did anyone in your family drive a Model T? Share the story below.', None,
          'Best in show? Vote 1, 2 or 3 in the comments.',
          'Free large-print drive-in word search, answer key included. Popcorn not included 👉 {link}'],
  'su': 'The Ford Model T (1908–1927) is regarded as the first car most middle-class Americans could afford.'},
]

bai = []
for pi, p in enumerate(PAGE):
    for di, ngay in enumerate(NGAY):
        s = (di + pi * 2) % 7; loai, fmt = SLOT[s]; id_ = f"{p['k']}-{ngay[5:].replace('-', '')}"; cong = []; nguon = []
        b = {'id': id_, 'acct': p['acct'], 'page_id': p['page_id'], 'ten': p['ten'], 'ngay': ngay, 'gio': p['gio'], 'loai': loai, 'format': fmt, 'anh': [], 'video': None, 'link': None}
        def them(k):
            t, c, n = anh_goc(k); nguon.append(n); c and cong.append(c); return t
        if p['k'] == 'rc' and di == 5:   # T7 31/10 Halloween thay ô trong lịch
            b.update(loai='Theo mùa', format='Ảnh đơn + câu hỏi'); anh_mot(them('halloween'), f'{RA}/{id_}-1.jpg'); b['anh'] = [f'{id_}-1.jpg']
            cap = 'Happy Halloween from the garage! 🎃 Did you ever drive your car to a trunk-or-treat? Tell us what you dressed up as.'
        elif s == 0: anh_mot(them(f"{p['k']}_ky_uc"), f'{RA}/{id_}-1.jpg'); b['anh'] = [f'{id_}-1.jpg']; cap = p['cap'][0]
        elif s == 1:
            sl, h, w = p['reel']; b['video'] = f'{VID}{sl}-{h}.mp4'; b['slug'] = sl
            khung(sl, h, 2, f'{id_}-1.jpg'); b['anh'] = [f'{id_}-1.jpg']
            cap = f'Only ONE says {w}. Can you spot it in 7 seconds? Comment YES or NO 👇'
        elif s == 2:
            anh_ab(them(f"{p['k']}_chon_a"), 'A', f'{RA}/{id_}-1.jpg'); anh_ab(them(f"{p['k']}_chon_b"), 'B', f'{RA}/{id_}-2.jpg'); b['anh'] = [f'{id_}-1.jpg', f'{id_}-2.jpg']; cap = p['cap'][2]
        elif s == 3: the_biet(them(f"{p['k']}_biet_anh"), p['su'], f'{RA}/{id_}-1.jpg'); b['anh'] = [f'{id_}-1.jpg']; cap = p['cap'][3]
        elif s == 4:
            sl, h, w = p['album']; b['slug'] = sl
            khung(sl, h, 2, f'{id_}-1.jpg'); khung(sl, h, 9, f'{id_}-2.jpg'); b['anh'] = [f'{id_}-1.jpg', f'{id_}-2.jpg']
            cap = f'Only one says {w} and it is hiding in plain sight. Find it, then swipe for the answer 👉'
        elif s == 5: anh_binh(them(f"{p['k']}_binh"), f'{RA}/{id_}-1.jpg'); b['anh'] = [f'{id_}-1.jpg']; cap = p['cap'][5]
        else:   # bài link như máy đăng (fb_link): ảnh đơn thật + chữ có link UTM bấm được — ảnh xem trước của trang đích là bảng chữ, không phải ảnh thật
            anh_mot(them(f"{p['k']}_link"), f'{RA}/{id_}-1.jpg'); b['anh'] = [f'{id_}-1.jpg']
            b['link'] = UTM(p['link'], p['acct']); cap = p['cap'][6].format(link=b['link'])
        b['chu'] = cap + (('\n\n' + '\n'.join(cong)) if cong else ''); b['nguon_anh'] = nguon
        bai.append(b)
json.dump(bai, open(os.path.join(D, 'ke-hoach.json'), 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(bai), 'bài ·', dict(Counter(x['format'] for x in bai)), '· link', sum(1 for x in bai if x['link']))
