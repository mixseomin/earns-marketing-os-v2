"""BÀI LINK cho máy Hotel (S03 bước 4, anh chọn 21/10/2026): bài FB Page + X dẫn THẲNG về trang đích ratesbyroom.com.
Nguồn chữ = chính nội dung đã qua Phòng Nội dung của 5 bài theo chiêu (hotel-arb scripts/sites/chieu/bai.py): mỗi ví dụ thật một bài (câu móc = tin nhắn
lừa, chữ = việc nên làm), mỗi câu FAQ một bài (câu móc = câu hỏi, chữ = câu trả lời) + 6 bài cho quiz / công cụ kiểm tin nhắn.
ẢNH: MỖI BÀI MỘT ẢNH RIÊNG (anh 21/10/2026: "bài phải đa dạng không thành spam") — nen_url để trống, de.truy = từ khoá Pexels theo chủ đề bài; studio
(may.ts › xuatVideo › timAnhNen) chọn ảnh thật chưa dùng trong máy. Bài đăng = ảnh đơn + link bấm được trong chữ (không dùng thẻ xem trước: trang
nào cũng chỉ một ảnh). dang.chuyen = mã tình huống gốc → nhịp an toàn không cho cùng chuyện lên hai nền của một tài khoản trong ngày.
  python3 scripts/nguon/bai-link-hotel.py > mau/may/bai-link-hotel.json   rồi   may-dung.mts --may ratesbyroom-scam-or-real --nap < mau/may/bai-link-hotel.json
"""
import json, re, sys, importlib.util
from pathlib import Path

GOC = Path(__file__).resolve().parents[2]
CHIEU = Path.home() / 'Me/earns/hotel-arb/scripts/sites/chieu/bai.py'
SITE = 'https://ratesbyroom.com'

spec = importlib.util.spec_from_file_location('bai', CHIEU); bai = importlib.util.module_from_spec(spec); spec.loader.exec_module(bai)
QUIZ = {x['slug']: x for x in json.loads((GOC / 'mau/may/scam-or-real.json').read_text('utf8'))}


def sach(t):
    """Bỏ thẻ HTML, gạch ngang dài (luật human-voice: không em dash), gộp khoảng trắng."""
    t = re.sub(r'<[^>]+>', '', t).replace('—', ',').replace('–', '-')
    return re.sub(r'\s+', ' ', t).strip()


def cau_dau(t, toi_da=230):
    """Một hoặc hai câu đầu, không quá toi_da ký tự."""
    cau = re.split(r'(?<=[.!?])\s+', sach(t)); ra = ''
    for c in cau:
        if len(ra) + len(c) + 1 > toi_da and ra: break
        ra = f'{ra} {c}'.strip()
    return ra


# từ khoá ảnh theo chủ đề trang — xoay trong danh sách để các bài cùng trang ra cảnh khác nhau (studio vẫn chặn trùng ảnh trong máy)
TRUY = {
    'hotel-cancellation-scam': ['woman reading phone message worried', 'hotel reservation smartphone', 'traveler suitcase checking phone', 'hotel front desk', 'man phone call stressed', 'calendar booking phone', 'airport waiting phone'],
    'hotel-bank-transfer-scam': ['bank transfer smartphone app', 'qr code payment phone', 'online banking laptop', 'person paying with phone', 'wallet cards money', 'phone banking hands', 'cash and phone table'],
    'hotel-card-details-scam': ['credit card smartphone hands', 'passport and phone', 'typing credit card laptop', 'one time password phone', 'woman holding credit card', 'security code phone screen', 'id card travel documents'],
    'hotel-whatsapp-scam': ['chat messages smartphone', 'texting phone night', 'man reading messages phone', 'phone notification hand', 'woman texting cafe', 'messaging app phone screen', 'hotel lobby phone'],
    'hotel-fake-fee-scam': ['hotel bill receipt', 'checking invoice phone', 'city tax hotel', 'hotel room checkout', 'calculator receipt money', 'woman surprised bill', 'hotel room cleaning'],
    'scam-quiz': ['woman thinking phone', 'man looking at phone question', 'friends looking at phone', 'young traveler phone hostel'],
    'check-message': ['magnifying glass phone', 'reading message carefully', 'phone screen closeup hands', 'woman checking phone sofa'],
}
_dem = {}


def dong(slug, title, mo, link, anh_slug, chuyen, chu_de_anh):
    q = QUIZ[anh_slug]; ds = TRUY[chu_de_anh]; i = _dem.get(chu_de_anh, 0); _dem[chu_de_anh] = i + 1
    return {'slug': slug, 'chu_de': title, 'de': {'loai': 'bai-link', 'link': link, 'truy': ds[i % len(ds)]},
            'dang': {'loai': 'link', 'title': title, 'description': f'{mo}\n\n{link}', 'link': link, 'nhom': q['nhom'], 'chuyen': chuyen},
            'nen_url': None}


DS = []
for path, b in bai.BAI.items():
    link, ten = f'{SITE}{path}', path.strip('/')
    for v in b['vd']:
        tin = sach(v['h3']).strip('"')
        lam = sach(v['lam']); lam = lam[0].upper() + lam[1:]
        DS.append(dong(f'link-{v["slug"]}', f'Got this from your hotel? "{tin}"', f'{lam} Three real examples and what to do if you already paid:',
                       link, v['slug'], v['slug'], ten))
    for i, (cau, tra_loi) in enumerate(b['faq']):
        anh = b['vd'][i % len(b['vd'])]['slug']
        DS.append(dong(f'link-{ten}-faq{i + 1}', sach(cau), f'{cau_dau(tra_loi)} The full guide, with real messages:', link, anh, f'faq-{ten}-{i + 1}', ten))

# quiz + công cụ: chữ viết tay (ngắn, giọng người), ảnh = tình huống THẬT (ket=real) cho khỏi trùng ảnh các bài trên
THAT = [s for s, x in QUIZ.items() if x.get('ket') == 'real']
TAY = [
    ('link-quiz-1', 'Ten hotel messages. Can you tell which ones are scams?', 'Some are normal hotel texts, some are scams that took real money. Pick scam or real for each one and see the red flags you missed. Takes about a minute:', '/scam-quiz/'),
    ('link-quiz-2', 'Would you pay this hotel? Most people miss at least two of these', 'A short quiz built from real hotel messages, real and fake mixed together. You see why after every answer:', '/scam-quiz/'),
    ('link-quiz-3', 'Scam or real? A one-minute quiz with real hotel texts', 'Deadlines, new bank details, "your card was declined". Try it before the next message lands in your inbox:', '/scam-quiz/'),
    ('link-check-1', 'Got a text from your hotel asking you to pay? Paste it here first', 'The free checker reads the message and points out the red flags: deadlines, new bank details, pay links, requests for codes. Nothing is saved:', '/check-message/'),
    ('link-check-2', 'Not sure a hotel message is real? Check it in 10 seconds', 'Paste the text, see which lines are red flags and what to do next. Free, no sign-up:', '/check-message/'),
    ('link-check-3', 'Before you pay a hotel through a link, run the message through this', 'Most hotel scams use the same few lines. The checker spots them and tells you how to confirm with the hotel directly:', '/check-message/'),
]
for i, (slug, title, mo, path) in enumerate(TAY):
    DS.append(dong(slug, title, mo, f'{SITE}{path}', THAT[i % len(THAT)], slug, path.strip('/')))

tieu_de = [x['dang']['title'] for x in DS]
assert len(tieu_de) == len(set(tieu_de)), 'tiêu đề trùng'
for x in DS:
    t = x['dang']['title']; assert 25 <= len(t) <= 110, f'tiêu đề {len(t)} ký tự: {t}'
    assert '—' not in x['dang']['description'] + t
json.dump(DS, sys.stdout, ensure_ascii=False, indent=1)
print(f'{len(DS)} bài link', file=sys.stderr)
