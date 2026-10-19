#!/usr/bin/env python3
"""CỔNG NGÔN NGỮ camp Ethopex — chặn Publish khi phim / creative / nhắm ngôn ngữ / trang đích không cùng một thứ tiếng
(anh 19/10/2026: "phim tiếng Đức thì mọi thứ phải đồng bộ từ ads… rule hoá để chặn nếu lên sai, không là đốt tiền oan").
Vào (stdin JSON): {"lang": "<en|es|de|…> ngôn ngữ lô khai", "content_locale": "<ngôn ngữ nội dung Ethopex>",
                   "locales": [mã FB locale của Ad Set], "texts": [primary/headline/description của creative],
                   "final_url": "<trang đích, có sau khi lên — tuỳ chọn>"}
Ra: in "OK" (mã 0) hoặc "CHAN: <lý do>" từng dòng (mã 2). dung-camp.sh không đánh dấu nút Publish khi cổng chặn.
Tự kiểm: python3 kiem-ngon-ngu.py --tu-kiem"""
import json, re, sys

# mã FB locale được phép theo ngôn ngữ phim (bảng mã lấy từ chính Ethopex: normalize-campaign-template.js)
LOCALE = {
    "en": {6, 24, 1001},        # English (US) · English (UK) · English (All)
    "es": {23, 7, 1002},        # Spanish · Spanish (Spain) · Spanish (All)
    "de": {5},                  # German
    "fr": {9, 44, 1003},        # French (France) · French (Canada) · French (All)
    "pt": {16, 31, 1005},       # Portuguese (Brazil) · Portuguese (Portugal) · Portuguese (All)
}
# từ chức năng hay gặp — đủ để nhận chữ QC ngắn thuộc thứ tiếng nào
TU = {
    "en": "the a and to my of his her i was you they me he she it free watch full story episodes in for".split(),
    "es": "el la los las de mi y que en un una su por con gratis mira historia completa episodios años".split(),
    "de": "der die das und ich mein meine nicht ist ein eine zu mit kostenlos jetzt ganze geschichte folgen".split(),
    "fr": "le la les et je mon ma ne est un une de avec gratuit regarde histoire complète épisodes".split(),
    "pt": "o a os as e eu meu minha não é um uma de com grátis assista história completa episódios".split(),
}

def doan_tieng(chu):
    tu = re.findall(r"[a-záéíóúñüäößàâçèêëîïôûœ']+", chu.lower())
    diem = {k: sum(w in set(v) for w in tu) for k, v in TU.items()}
    best = max(diem, key=diem.get)
    return best if diem[best] >= 2 and list(diem.values()).count(diem[best]) == 1 else None

def kiem(d):
    lang = (d.get("lang") or "").lower(); loi = []
    if lang not in LOCALE: return [f"ngôn ngữ lô '{lang}' chưa có trong bảng LOCALE — thêm mã rồi mới lên"]
    cl = (d.get("content_locale") or "").lower()[:2]
    if cl != lang: loi.append(f"nội dung Ethopex là '{cl or '?'}' nhưng lô khai '{lang}'")
    locs = [int(x) for x in d.get("locales") or []]
    if not locs: loi.append("Ad Set không nhắm ngôn ngữ nào (phải nhắm đúng tiếng của phim)")
    sai = [x for x in locs if x not in LOCALE[lang]]
    if sai: loi.append(f"Ad Set nhắm mã ngôn ngữ {sai} không thuộc tiếng '{lang}' (được: {sorted(LOCALE[lang])})")
    chu = " ".join(d.get("texts") or [])
    t = doan_tieng(chu)
    if not chu.strip(): loi.append("creative không có chữ QC")
    elif t != lang: loi.append(f"chữ QC của creative đọc ra tiếng '{t or '?'}' chứ không phải '{lang}'")
    u = d.get("final_url") or ""
    m = re.search(r"[?&]hl=([a-z]{2})", u)
    if u and (m.group(1) if m else "en") != lang: loi.append(f"trang đích mở tiếng '{m.group(1) if m else 'en (mặc định)'}' chứ không phải '{lang}'")
    return loi

def tu_kiem():
    ok = {"lang": "es", "content_locale": "es", "locales": [1002], "texts": ["Mi esposo ayudó al asesino de mi hermana. Mira la historia completa gratis."]}
    assert kiem(ok) == [], kiem(ok)
    assert kiem({**ok, "locales": [6]}), "nhắm English cho phim ES phải bị chặn"
    assert kiem({**ok, "content_locale": "de"}), "nội dung DE gắn lô ES phải bị chặn"
    assert kiem({**ok, "texts": ["They called me a nobody. Watch the full story free."]}), "chữ QC tiếng Anh cho phim ES phải bị chặn"
    assert kiem({**ok, "locales": []}), "không nhắm ngôn ngữ phải bị chặn"
    assert kiem({**ok, "final_url": "https://x/movie/a/confirm?arb_aid=1"}), "trang đích không hl=es phải bị chặn"
    assert kiem({**ok, "final_url": "https://x/movie/a/confirm?hl=es&lp_id=2"}) == []
    de = {"lang": "de", "content_locale": "de", "locales": [5], "texts": ["Ich war die Königin. Jetzt die ganze Geschichte kostenlos ansehen, mit allen Folgen."]}
    assert kiem(de) == [], kiem(de)
    en = {"lang": "en", "content_locale": "en", "locales": [6], "texts": ["They called me a nobody. Then the NBA picked me number one. Watch the full story free."]}
    assert kiem(en) == [], kiem(en)
    print("tự kiểm: 9/9 đạt")

if __name__ == "__main__":
    if "--tu-kiem" in sys.argv: tu_kiem(); sys.exit(0)
    loi = kiem(json.load(sys.stdin))
    print("OK" if not loi else "\n".join("CHAN: " + x for x in loi)); sys.exit(2 if loi else 0)
