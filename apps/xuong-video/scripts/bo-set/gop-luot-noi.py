# MỘT LƯỢT NÓI = MỘT TAKE (anh 12/11/2026 "giọng nó cứ lủng củng"): stdin = json_agg {id, thoai} của các shot → stdout = shot đổi. Bảng CACH khai câu gộp + cung cảm xúc cho từng phim.

# Gộp các câu LIỀN NHAU của cùng một người trong một shot thành MỘT lượt nói (một take) — giữ tre câu đầu, nối chữ, nối cách diễn thành cung cảm xúc
import json, sys
CACH = {
  ('Nhóc, lại đây', 'Chú cho cháu 5k'): ('Nhóc, lại đây! Chú cho cháu 5k.', 'gọi to, thân mật; rồi vừa nhoài ra cửa đưa tiền vừa nói giọng ấm, hào phóng — một hơi liền'),
  ('Cháu một chai, chú một chai', 'Đi nhanh về nhanh nhé'): ('Cháu một chai, chú một chai! Đi nhanh về nhanh nhé!', 'gọi với theo thằng bé đang chạy xa, to, nhấn chữ một, cuối câu sốt ruột — một hơi liền'),
  ('Sao giờ mới về?', 'Tàu sắp chạy rồi', 'Nước ngọt của chú đâu?'): ('Sao giờ mới về? Tàu sắp chạy rồi. Nước ngọt của chú đâu?', 'bực, hỏi dồn, gấp; câu cuối nhìn tay nhóc, chậm lại, nghi — một hơi liền'),
  ('Xin lỗi chú', 'Tiệm chỉ còn một chai nước ngọt'): ('Xin lỗi chú… Tiệm chỉ còn một chai nước ngọt.', 'cúi mặt lí nhí, ngập ngừng; rồi ngẩng lên cười gượng, thật thà — một hơi liền'),
}
rows = json.load(sys.stdin); out = []
for r in rows:
    th, moi, i = r['thoai'] or [], [], 0
    while i < len(th):
        j = i
        while j + 1 < len(th) and th[j + 1].get('nhan_vat') == th[i].get('nhan_vat'): j += 1
        cum = th[i:j + 1]; k = tuple(c['loi'] for c in cum)
        if len(cum) > 1 and k in CACH:
            loi, dx = CACH[k]; c0 = {x: v for x, v in cum[0].items() if x not in ('url', 'gon', 'dai')}
            moi.append({**c0, 'loi': loi, 'dien_xuat': dx})
        else: moi.extend(cum)
        i = j + 1
    if moi != th: out.append({'id': r['id'], 'thoai': moi})
print(json.dumps(out, ensure_ascii=False))
