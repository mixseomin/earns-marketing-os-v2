# TRANG XEM VIDEO THÔ BẰNG three.js (anh 12/11/2026 "Làm 1 bản three.js xem nào" — theo reel Hàn: hộp chốt đường đi + nhịp, xem ngay không render).
# Đọc bộ set đã sinh (vat · khoi · may theo mã shot, cm, x đông / y bắc / z lên) + bảng shot của tập (thời lượng cắt phat_s, chuyển động máy, thoại có url)
# → MỘT tệp HTML tự chứa: dữ liệu + giọng thoại nhúng base64 (trang artifact không tải được tệp ngoài), three.js từ cdnjs.
#   python3 scripts/bo-set/xem-web/dung-trang.py <set.json> <tap.json> <ra.html> [tiêu đề]
#   tap.json = [{so, ma, phat, cd, thoai:[{loi, nhan_vat, tre, url}]}] (psql json_agg từ xv_canh)
import base64, json, sys, urllib.request

set_, tap, ra = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])), sys.argv[3]
ten = sys.argv[4] if len(sys.argv) > 4 else 'Video thô'
CHU_THICH = {   # câu tả shot (người xem đọc được chuyện khi chưa có hình thật) — theo kịch bản tập
    1: 'Chú ở cửa sổ toa, cầm tờ 5 nghìn, nhìn ra sân ga', 2: 'Góc nhìn của chú: nhóc giữa sân ga, đi lại phía cửa sổ',
    3: 'Chú gọi nhóc, nhoài ra đưa tờ 5 nghìn; nhóc nhận xong quay người về phía tiệm', 4: 'Nhóc quay nốt về phía tiệm rồi chạy lên tiệm cuối sân ga', 5: 'Chú dặn với theo',
    6: 'Bánh tàu đứng yên dưới gầm', 7: 'Chú nhìn về phía tiệm, sốt ruột', 8: 'Nhóc cầm một chai, vừa đi về vừa uống',
    9: 'Nhóc về tới cửa sổ, chú hỏi dồn; cuối shot nhóc giơ tiền thừa lên', 10: 'Cận tay ở bậu cửa: tay nhóc đưa tiền thừa, tay chú đón lấy', 11: 'Nhóc quay người về phía tiệm rồi chạy đi', 12: 'Tàu chuyển bánh, chú cầm tiền thừa nhìn theo'}
am = {}
def tai(url):
    if url not in am:
        with urllib.request.urlopen(url, timeout=30) as r: am[url] = 'data:audio/mpeg;base64,' + base64.b64encode(r.read()).decode()
    return am[url]
shots = []
for s in tap:
    m = set_['may'].get(str(s['ma']))
    if not m: continue
    shots.append({'so': s['so'], 'giay': max(0.8, float(s['phat'] or 2)), 'cd': s['cd'] or 'tinh', 'tả': CHU_THICH.get(s['so'], ''), 'may': m,
                  'thoai': [{'loi': t['loi'], 'ai': t.get('nhan_vat', ''), 'tre': float(t.get('tre') or 0), 'am': tai(t['url'])} for t in (s['thoai'] or []) if t.get('url')]})
du = {'vat': set_['vat'], 'khoi': set_['khoi'], 'shot': shots, 'moc': set_.get('moc', {}), 'ten_moc': set_.get('ten_moc', {})}
html = open(__file__.replace('dung-trang.py', 'mau.html'), encoding='utf-8').read()
open(ra, 'w', encoding='utf-8').write(html.replace('__TIEU_DE__', ten).replace('/*__DU_LIEU__*/null', json.dumps(du, ensure_ascii=False)))
print(f'{ra}: {len(shots)} shot, {sum(len(x["thoai"]) for x in shots)} câu thoại, {len(html) // 1024 + sum(len(v) for v in am.values()) // 1024} KB')
