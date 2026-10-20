#!/usr/bin/env python3
"""CHỮ QC CHO LÔ CREATIVE (anh: chữ QC lấy từ QC spy xếp theo số Page). Ra mảng item cho POST /api/v1/creatives/bulk-jobs.
Lọc (21/10/2026): bỏ câu nhắc app khác / tên miền (NetShort, DramaBox, ReelShort, H5SHORT…), bỏ chữ không khớp tên phim (QC spy ghép nhầm phim),
cho mọi câu qua CỔNG THOẠI (kiem-thoai.soat — Meta đọc cả chữ QC), thiếu chữ thì dùng câu mở bằng tên phim; kèm câu chung EN / ES.
Dùng: chu-qc.py <lo.json của dung-lo-dai> <chu.tsv: qc-spy-phim.sql> <lô (vd 2110ns)> <url gốc video R2> <ra.json>"""
import collections, csv, importlib.util, json, os, re, sys

D = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("kt", os.path.join(D, "kiem-thoai.py")); KT = importlib.util.module_from_spec(_s); _s.loader.exec_module(KT)
CHUNG = {"en": ["You won't get tired of watching it. Who can resist this short drama? Watch now", "If you haven't watched it yet, you're really missing out.", "It gets better and better. Don't swipe away halfway."],
         "es": ["No te cansarás de verla. ¿Quién puede resistirse a esta miniserie? Mírala ahora", "Si todavía no la has visto, te estás perdiendo algo grande.", "Cada vez se pone mejor. No la dejes a la mitad."]}
APP = re.compile(r"\b(net\s?short|drama\s?box|reel\s?short|h5short|shortmax|goodshort)\b|\b[A-Z0-9-]+\.(COM|NET|APP)\b|Low impression count|Continue Watching", re.I)

def lam_sach(chu, ten):
    chu = re.sub(r"\b(?:[A-Z0-9-]+\.)+(?:COM|NET|APP)\b", " | ", chu)
    cau = [c.strip() for c in re.split(r"\s*\|\s*", chu) if c.strip()]
    cau = [c for c in cau if not APP.search(c) and c.strip().lower() != ten.lower()]
    cau = [re.sub(r"^" + re.escape(ten) + r"\s*", "", c).strip() for c in cau]
    return [c for c in cau if len(c) > 40]

def tu_khoa(ten):   # chữ khớp phim: ít nhất một từ dài của tên phim xuất hiện, hoặc QC không nhắc tên phim nào khác
    return [w.lower() for w in re.findall(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]{5,}", ten)]

def main(lo, tsv, ma_lo, goc_url, ra):
    pg = collections.defaultdict(lambda: collections.defaultdict(set))
    for r in csv.reader(open(tsv), delimiter="\t"):
        if len(r) >= 7 and r[6].strip(): pg[r[0]][r[6].strip()].add(r[2])
    items = []
    for x in json.load(open(lo)):
        if "loi" in x: continue
        cid, ten, nn = str(x["content_id"]), x["ten"], x["lang"]
        kw = tu_khoa(ten); ds = []
        for chu, p in sorted(pg[cid].items(), key=lambda z: -len(z[1])):
            for c in lam_sach(chu, ten):
                if kw and not any(k in (chu.lower()) for k in kw): continue   # QC spy của phim khác (ghép nhầm landing)
                if KT.soat(c): continue                                      # cổng thoại cho chữ QC
                if c not in ds: ds.append(c)
        mo = f"{ten} — {'mira la historia completa gratis' if nn == 'es' else 'watch the full story free'}. {'Mira más' if nn == 'es' else 'Watch more'}"
        pt = (ds[:2] or [mo]) + CHUNG[nn]
        f = os.path.basename(x["file"])
        items.append({"name": f"{ma_lo} {ten} {nn.upper()} - phim dai {int(x['tu'])}-{int(x['den'])}s", "content_id": int(cid), "creative_type": "single_video", "traffic_source": "facebook",
                      "status": "active", "call_to_action": "LEARN_MORE", "link_url": "search.com", "image_url": [], "video_url": [f"{goc_url.rstrip('/')}/{f}"],
                      "asset_spec": {"primaryTexts": pt[:5], "headlines": [ten], "descriptions": ["Episodios completos gratis" if nn == "es" else "Watch Full Episodes!"]}})
    json.dump(items, open(ra, "w"), ensure_ascii=False, indent=1)
    for i in items: print(i["content_id"], "|", i["asset_spec"]["primaryTexts"][0][:110])

if __name__ == "__main__":
    main(*sys.argv[1:6])
