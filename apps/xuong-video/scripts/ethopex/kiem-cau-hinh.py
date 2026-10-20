#!/usr/bin/env python3
"""CỔNG CẤU HÌNH camp Ethopex (20/10/2026: một lượt dựng để tên mặc định "New Sales Campaign" + Page trống mà cổng studio/ngôn ngữ vẫn qua).
Vào: dòng "PAYLOAD {json}" do dung-camp.sh in từ View create payload; tham số: <tên camp> <creative_id>.
Payload phải đúng khuôn đang chạy (kb #261 mục 4, anh chốt): ETP_440 · Page Andrew Rebecca Akumiah · $1 · Pixel_AFC_02 + PURCHASE · 39 nước.
Ra: "CAU HINH OK" (mã 0) hoặc từng dòng "CAU HINH CHAN: …" (mã 2). Tự kiểm: python3 kiem-cau-hinh.py --tu-kiem"""
import json, sys

KHUON = {"tk": (11183179, "tài khoản ETP_440"), "page": (1295495, "Page Andrew Rebecca Akumiah"), "ngan_sach": (1, "ngân sách $1 (camp mới luôn $1, tăng theo rule)"),
         "pixel": (2096879631042039, "Pixel_AFC_02"), "su_kien": ("PURCHASE", "sự kiện PURCHASE"), "nuoc": (39, "39 nước whitelist")}

def kiem(dong, ten, cr):
    dong = (dong or "").strip()
    if not dong.startswith("PAYLOAD "): return ["không đọc được payload"]
    d = json.loads(dong[8:]); loi = []
    if d.get("ten") != ten: loi.append("tên camp '%s' khác '%s'" % (d.get("ten"), ten))
    if d.get("cr") != cr: loi.append("creative %s khác %s" % (d.get("cr"), cr))
    for k, (v, mo_ta) in KHUON.items():
        if d.get(k) != v: loi.append("%s: đang là %s, phải là %s" % (mo_ta, d.get(k), v))
    return loi

def tu_kiem():
    ok = 'PAYLOAD {"ten":"A","tk":11183179,"page":1295495,"cr":5,"content":1,"ngan_sach":1,"pixel":2096879631042039,"su_kien":"PURCHASE","nuoc":39}'
    assert kiem(ok, "A", 5) == []
    assert kiem(ok.replace('"ten":"A"', '"ten":"New Sales Campaign"'), "A", 5), "tên mặc định phải chặn"
    assert kiem(ok.replace('"page":1295495', '"page":null'), "A", 5), "Page trống phải chặn"
    assert kiem(ok.replace('"ngan_sach":1', '"ngan_sach":3'), "A", 5), "ngân sách khác $1 phải chặn"
    assert kiem(ok.replace('"nuoc":39', '"nuoc":1'), "A", 5), "thiếu nước phải chặn"
    assert kiem(ok, "A", 6), "sai creative phải chặn"
    assert kiem("", "A", 5), "không có payload phải chặn"
    print("tự kiểm: 7/7 đạt")

if __name__ == "__main__":
    if "--tu-kiem" in sys.argv: tu_kiem(); sys.exit(0)
    loi = kiem(sys.stdin.read(), sys.argv[1], int(sys.argv[2]))
    print("\n".join("CAU HINH CHAN: " + x for x in loi) or "CAU HINH OK"); sys.exit(2 if loi else 0)
