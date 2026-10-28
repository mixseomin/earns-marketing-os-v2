#!/usr/bin/env python3
"""CHỮ QC CHO LÔ CREATIVE (nút CTA theo lô: ETP_CTA=WATCH_MORE… — anh 28/10/2026 "thử CTA khác"; mặc định LEARN_MORE) (anh: chữ QC lấy từ QC spy xếp theo số Page). Ra mảng item cho POST /api/v1/creatives/bulk-jobs.
Lọc (21/10/2026): bỏ câu nhắc app khác / tên miền (NetShort, DramaBox, ReelShort, H5SHORT…), bỏ chữ không khớp tên phim (QC spy ghép nhầm phim),
cho mọi câu qua CỔNG THOẠI (kiem-thoai.soat — Meta đọc cả chữ QC), thiếu chữ thì dùng câu mở bằng tên phim; kèm câu chung EN / ES.
Dùng: chu-qc.py <lo.json của dung-lo-dai> <chu.tsv: qc-spy-phim.sql> <lô (vd 2110ns)> <url gốc video R2> <ra.json> [ten.tsv: id..ten ở cột 6 | -] [dạng, mặc định "phim dai"]"""
import collections, csv, importlib.util, json, os, re, sys

D = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("kt", os.path.join(D, "kiem-thoai.py")); KT = importlib.util.module_from_spec(_s); _s.loader.exec_module(KT)
CHUNG = {"en": ["You won't get tired of watching it. Who can resist this short drama? Watch now", "If you haven't watched it yet, you're really missing out.", "It gets better and better. Don't swipe away halfway."],
         "es": ["No te cansarás de verla. ¿Quién puede resistirse a esta miniserie? Mírala ahora", "Si todavía no la has visto, te estás perdiendo algo grande.", "Cada vez se pone mejor. No la dejes a la mitad."]}
# chữ NÚT của QC gốc mà spy chép dính vào cuối nội dung (22/10/2026: "…Me largo. Watch more" / "…Me largo. Download" lên creative ES)
NUT = re.compile(r"(?:\s*\b(?:watch more|watch now|download|learn more|install now|play now|shop now|sign up|ver más|descargar|más información))+\s*$", re.I)
APP = re.compile(r"\b(net\s?short|drama\s?box|reel\s?short|h5short|shortmax|goodshort)\b|\b[A-Z0-9-]+\.(COM|NET|APP)\b|Low impression count|Continue Watching", re.I)

def lam_sach(chu, ten):
    """khối chữ → các đoạn sạch: tách theo tên miền, bỏ tên phim lặp đầu đoạn, bỏ TỪNG CÂU nhắc app khác (không bỏ cả đoạn — 21/10/2026 tóm tắt hay
    đi chung khối với câu "Todo gratis en Netshort" nên bị loại oan)"""
    chu = re.sub(r"\b(?:[A-Z0-9-]+\.)+(?:COM|NET|APP)\b", " | ", chu)
    ra = []
    for doan in [c.strip() for c in re.split(r"\s*\|\s*", chu) if c.strip()]:
        doan = re.sub(r"^" + re.escape(ten) + r"\s*", "", doan).strip()
        cau = [c for c in re.split(r"(?<=[.!?¡¿])\s+", doan) if c and not APP.search(c)]
        doan = NUT.sub("", " ".join(cau)).strip()
        if len(doan) > 40 and doan.lower() != ten.lower(): ra.append(doan)
    return ra

TEN_KHAC: list[str] = []   # tên các phim khác trong kho (nạp ở main) — chữ QC nhắc tên phim khác = QC spy ghép nhầm landing
def nham_phim(chu, ten):
    t = chu.lower()
    return any(k in t for k in TEN_KHAC if k != ten.lower() and len(k) >= 12 and k not in ten.lower())

def main(lo, tsv, ma_lo, goc_url, ra, ten_tsv=None, dang="phim dai"):
    ten_tsv = ten_tsv if ten_tsv and ten_tsv != "-" else None   # "-" = không có danh sách tên kho (để truyền được tham số dang)
    if ten_tsv:   # danh sách tên phim kho (vd ethopex_uu_tien) để nhận QC ghép nhầm
        TEN_KHAC.extend(r[5].strip().lower() for r in csv.reader(open(ten_tsv), delimiter="\t") if len(r) > 5)
    pg = collections.defaultdict(lambda: collections.defaultdict(set))
    for r in csv.reader(open(tsv), delimiter="\t"):
        if len(r) >= 7 and r[6].strip(): pg[r[0]][r[6].strip()].add(r[2])
    items = []
    for x in json.load(open(lo)):
        if "loi" in x: continue
        cid, ten, nn = str(x["content_id"]), x["ten"], x["lang"]
        ds = []
        for chu, p in sorted(pg[cid].items(), key=lambda z: -len(z[1])):
            if nham_phim(chu, ten): continue                                 # QC spy của phim khác (ghép nhầm landing)
            for c in lam_sach(chu, ten):
                if KT.soat(c): continue                                      # cổng thoại cho chữ QC
                if c not in ds: ds.append(c)
        mo = f"{ten} — {'mira la historia completa gratis' if nn == 'es' else 'watch the full story free'}. {'Mira más' if nn == 'es' else 'Watch more'}"
        pt = (ds[:2] or [mo]) + CHUNG[nn]
        f = x.get("ten_tep") or os.path.basename(x["file"])   # tên tệp trên kho có thể khác tệp máy (kho phat <tep> … <ten>)
        items.append({"name": f"{ma_lo} {ten} {nn.upper()} - {dang} {int(x['tu'])}-{int(x['den'])}s", "content_id": int(cid), "creative_type": "single_video", "traffic_source": "facebook",
                      "status": "active", "call_to_action": os.environ.get("ETP_CTA", "LEARN_MORE"), "link_url": "search.com", "image_url": [], "video_url": [f"{goc_url.rstrip('/')}/{f}"],
                      "asset_spec": {"primaryTexts": pt[:5], "headlines": [ten], "descriptions": ["Episodios completos gratis" if nn == "es" else "Watch Full Episodes!"]}})
    json.dump(items, open(ra, "w"), ensure_ascii=False, indent=1)
    for i in items: print(i["content_id"], "|", i["asset_spec"]["primaryTexts"][0][:110])

if __name__ == "__main__":
    main(*sys.argv[1:8])
