"""NGUỒN ĐỀ máy "Câu hỏi luyện thi" (ExamWeight — S04 bước 3, anh duyệt 22/10/2026): câu hỏi THẬT của ngân hàng đề ExamWeight (đã được duyệt lại,
repo ~/Me/GitHub/examweight/data/<kỳ>/bank.json) → mau/may/cau-hoi-thi.json cho máy studio (mẫu cau-hoi-thi, may-dung-thi.ts).
Lọc câu vừa khung video dọc: đề ≤ 230 ký tự, mỗi lựa chọn ≤ 70, không bài đọc dài, không câu tính toán; chia đều theo mảng kiến thức (blueprint),
độ khó 1–2 trước. Mỗi kỳ SO_MOI câu; slug = id câu hỏi (ổn định, chạy lại không đổi video đã đăng).
  python3 scripts/nguon/cau-hoi-thi.py > mau/may/cau-hoi-thi.json
"""
import json, re, sys
from pathlib import Path

NGUON = Path.home() / 'Me/GitHub/examweight/data'
KY = {'ptcb': 'PTCB', 'nremt': 'NREMT', 'teas': 'TEAS'}
SO_MOI = 40


def sach(t):
    return re.sub(r'\s+', ' ', str(t).replace('—', ',').replace('–', '-')).strip()


def cau_dau(t, toi_da=200):
    cau = re.split(r'(?<=[.!?])\s+', sach(t)); ra = ''
    for c in cau:
        if len(ra) + len(c) + 1 > toi_da and ra: break
        ra = f'{ra} {c}'.strip()
    return ra


DS = []
for k, ky in KY.items():
    bank = json.loads((NGUON / k / 'bank.json').read_text('utf8'))
    bp = json.loads((NGUON / k / 'blueprint.json').read_text('utf8'))
    mang = {str(d['n']): d['name'] for d in bp.get('domains', [])}
    hop = []
    for q in bank:
        lua = q.get('options') or {}
        if sorted(lua) != ['A', 'B', 'C', 'D'] or q.get('answer') not in lua: continue
        hoi = sach(q.get('stem', ''))
        if not hoi or len(hoi) > 230 or '\n' in str(q.get('stem', '')).strip() or re.search(r'passage|table below|figure|graph|chart', hoi, re.I): continue
        if str(q.get('calc')).lower() == 'true' or any(len(sach(v)) > 70 for v in lua.values()): continue
        hop.append(q)
    # chia đều theo mảng, độ khó thấp trước, giữ thứ tự ngân hàng
    theo = {}
    for q in sorted(hop, key=lambda q: int(q.get('difficulty') or 3)): theo.setdefault(str(q.get('domain')), []).append(q)
    chon, i = [], 0
    while len(chon) < SO_MOI and any(theo.values()):
        for dm in sorted(theo):
            if theo[dm] and len(chon) < SO_MOI: chon.append(theo[dm].pop(0))
    for q in chon:
        DS.append({'slug': q['id'].lower().replace('.', '-'), 'ky': ky, 'hoi': sach(q['stem']), 'lua': {c: sach(q['options'][c]) for c in 'ABCD'},
                   'dung': q['answer'], 'giai': cau_dau(q.get('explanation', '')), 'mang': mang.get(str(q.get('domain')), 'Practice')})
    print(f'{ky}: {len(hop)} câu vừa khung → chọn {len(chon)}', file=sys.stderr)

assert len({x['slug'] for x in DS}) == len(DS), 'slug trùng'
json.dump(DS, sys.stdout, ensure_ascii=False, indent=1)
