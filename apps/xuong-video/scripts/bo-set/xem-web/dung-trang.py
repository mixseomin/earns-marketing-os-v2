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
    3: 'Chú gọi nhóc, nhoài ra đưa tờ 5 nghìn; nhóc nhận, vẫn đứng nhìn chú chờ dặn', 4: 'Nhóc nghe chú dặn mua hai chai, nghe xong mới quay người chạy về phía tiệm', 5: 'Chú dặn với theo',
    6: 'Bánh tàu đứng yên dưới gầm', 7: 'Chú nhìn về phía tiệm, sốt ruột', 8: 'Nhóc cầm một chai (tay trái), vừa đi về vừa hút hai ngụm',
    9: 'Nhóc về tới cửa sổ, chú hỏi dồn; cuối shot nhóc giơ tiền thừa lên', 10: 'Cận tay ở bậu cửa: tay nhóc đưa tiền thừa, tay chú đón lấy', 11: 'Nhóc quay người về phía tiệm rồi chạy đi', 12: 'Tàu chuyển bánh, chú cầm tiền thừa nhìn theo',
    13: 'Cận mặt chú (phản ứng chốt cảnh): nhìn theo nhóc, cúi nhìn nắm tiền thừa, ngẩng lên — mặt đứng hình'}
am = {}
def tai(url):
    if url not in am:
        with urllib.request.urlopen(url, timeout=30) as r: am[url] = 'data:audio/mpeg;base64,' + base64.b64encode(r.read()).decode()
    return am[url]
NHANH_TOI_DA = 1.35   # cùng am-thanh.ts › NHANH_TOI_DA — câu dài hơn phần shot còn lại thì đọc nhanh lên tối đa chừng này
def xep_thoai(ds, phat):
    """Xếp câu thoại ĐÚNG như bản xuất (am-thanh.ts › tDong): câu sau bắt đầu ở max(tre, câu trước dứt + 0,15 s), không quá phat - 0,2; câu dài hơn phần
    còn lại thì đọc nhanh (≤ NHANH_TOI_DA). Trang xem phát theo lịch này → nhịp lời / động tác trên trang khớp bản xuất (trước: phát theo tre thô, câu chồng nhau)."""
    t, ra = 0.0, []
    for c in ds:
        if c['tre'] > t: t = min(c['tre'], max(0.0, phat - 0.2))
        con = max(0.2, phat - t); dai = c['dai'] or phat / max(1, len(ds))
        nh = min(NHANH_TOI_DA, dai / con) if dai > con + 0.05 else 1.0
        ra.append({**c, 'tre': round(t, 3), 'dai': round(dai / nh, 3), 'toc': round(nh, 3)}); t += dai / nh + 0.15
    return ra
shots = []
for s in tap:
    m = set_['may'].get(str(s['ma']))
    if not m: continue
    shots.append({'so': s['so'], 'giay': max(0.8, float(s['phat'] or 2)), 'cd': s['cd'] or 'tinh', 'tả': CHU_THICH.get(s['so'], ''), 'may': m,
                  'thoai': xep_thoai([{'loi': t['loi'], 'ai': t.get('nhan_vat', ''), 'tre': float(t.get('tre') or 0), 'dai': float(t.get('dai') or 0), 'am': tai(t['url'])} for t in (s['thoai'] or []) if t.get('url')], max(0.8, float(s['phat'] or 2)))})
du = {'vat': set_['vat'], 'khoi': set_['khoi'], 'shot': shots, 'moc': set_.get('moc', {}), 'ten_moc': set_.get('ten_moc', {}), 'do_en': set_.get('do_en', {})}
html = open(__file__.replace('dung-trang.py', 'mau.html'), encoding='utf-8').read()
open(ra, 'w', encoding='utf-8').write(html.replace('__TIEU_DE__', ten).replace('/*__DU_LIEU__*/null', json.dumps(du, ensure_ascii=False)))
print(f'{ra}: {len(shots)} shot, {sum(len(x["thoai"]) for x in shots)} câu thoại, {len(html) // 1024 + sum(len(v) for v in am.values()) // 1024} KB')
