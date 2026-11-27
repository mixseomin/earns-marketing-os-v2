#!/usr/bin/env python3
"""CHỮ QC CHO LÔ CREATIVE — HOOK · TIÊU ĐỀ · MÔ TẢ · CTA lấy NGUYÊN VĂN từ QC chạy lâu nhất trên spy (luật anh 31/10/2026, siết 23/11/2026).
23/11/2026 anh: "lỗi nội dung mày tự bịa làm hỏng hết… Hook, CTA, chữ chính" — bản cũ chỉ đọc QC app gốc ghép theo landing (qc-spy-phim.sql), trượt hết QC đối thủ
(landing SEARCH.COM /movie/<mã>), rồi rơi xuống "<tên> — watch the full story free" + 3 câu CHUNG, tiêu đề = tên phim, CTA LEARN_MORE. Nay:
  · nguồn: qc-spy-phim.sql (app gốc) + qc-spy-ten.sql (đối thủ cùng mã phim + QC nhắc đúng tên) — len-creative.py nối hai tệp vào chu.tsv
  · xếp: số ngày chạy (cột 8) rồi số Page → câu đầu primary text = HOOK của QC chạy lâu nhất, nguyên văn
  · tiêu đề / mô tả: tách từ chính QC đó (khối chữ spy = primary · TÊN MIỀN · tiêu đề · mô tả · nút); không có mới dùng tên phim
  · CTA: nút của QC spy chạy lâu nhất (Watch more → WATCH_MORE); ETP_CTA ghi đè; không có → WATCH_MORE
  ⚠ 24/11/2026 TẤT CẢ phần trên chỉ còn in tham khảo: chữ lên creative = FORM_CHU (apps/etp/form-chu.json), anh cấm tự viết
  · mọi câu qua cổng thoại (kiem-thoai.soat) + luật CTA Support Ads (cta_qc.sai_luat / phu_kich_thich); KHÔNG còn câu chung tự viết
  · spy không có QC nào → chữ đầu thư viện (chu_dau) hoặc câu mẫu Dol 09/11, và in CẢNH BÁO cho người duyệt
Dùng: chu-qc.py <lo.json của dung-lo-dai> <chu.tsv> <lô (vd 2110ns)> <url gốc video R2> <ra.json> [ten.tsv: id..ten ở cột 6 | -] [dạng, mặc định "phim dai"]"""
import collections, csv, importlib.util, json, os, re, sys

D = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("kt", os.path.join(D, "kiem-thoai.py")); KT = importlib.util.module_from_spec(_s); _s.loader.exec_module(KT)
_c = importlib.util.spec_from_file_location("cq", os.path.join(D, "cta_qc.py")); CQ = importlib.util.module_from_spec(_c); _c.loader.exec_module(CQ)
# chữ NÚT của QC gốc mà spy chép dính vào cuối nội dung (22/10/2026: "…Me largo. Watch more" / "…Me largo. Download" lên creative ES)
NUT = re.compile(r"(?:\s*\b(?:watch more|watch now|download|learn more|install now|play now|shop now|sign up|ver más|mira más|descargar|más información))+\s*$", re.I)
APP = re.compile(r"\b(net\s?short|drama\s?box|reel\s?short|h5short|shortmax|goodshort)\b|\b[A-Z0-9-]+\.(COM|NET|APP)\b|Low impression count|Continue Watching|having trouble with playing|\((?:doblado|dubbed|subtitulado)\)", re.I)

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

MIEN = re.compile(r"\b(?:[A-Z0-9-]+\.)+(?:COM|NET|APP|TV|IO)\b")
NUT_DS = {"watch more": "WATCH_MORE", "watch now": "WATCH_MORE", "ver más": "WATCH_MORE", "mira más": "WATCH_MORE", "learn more": "LEARN_MORE", "más información": "LEARN_MORE"}
NUT_GIUA = re.compile(r"\b(?:watch more|watch now|ver más|mira más)\b", re.I)   # tiêu đề dính chữ nút ("Watch More Now Get Out of My") = tách hỏng
NOI = {"of", "and", "the", "my", "a", "an", "to", "in", "on", "for", "with", "is", "de", "del", "mi", "y", "el", "la", "los", "las", "en", "un", "una", "-", "–", "—", "&"}

def tach_tieu_de(sau, ten=""):
    """phần sau tên miền "Start Watching Today Stream the series and uncover the truth." → (tiêu đề, mô tả): mô tả bắt đầu ở chữ HOA cuối cùng
    đứng trước chữ thường đầu tiên không phải từ nối; không tách được thì cả khối là tiêu đề"""
    sau = NUT.sub("", sau).strip()
    if ten and sau.lower().startswith(ten.lower()):   # khối bắt đầu bằng đúng tên phim: tên = tiêu đề (ES viết hoa kiểu câu, không tách theo chữ HOA được)
        return sau[:len(ten)], sau[len(ten):].strip(" -–—")
    w = sau.split()
    for i, x in enumerate(w):
        if x[:1].islower() and x.lower().strip(".,!?¡¿") not in NOI:
            j = max((k for k in range(i) if w[k][:1].isupper()), default=None)
            if j: return " ".join(w[:j]).strip(" -–—"), " ".join(w[j:]).strip()
            break
    return " ".join(w).strip(" -–—"), ""

def qua_cong(c):   # cổng thoại + luật CTA Support Ads cho MỌI câu chữ lên creative
    return c and not KT.soat(c) and not CQ.sai_luat(c) and not CQ.phu_kich_thich(c) and not APP.search(c)

# FORM CHỮ CỐ ĐỊNH (anh 24/11/2026: "Form đúng phải thế này !!" rồi "Tao cấm mày tự viết + sửa chỗ đó trong mọi phim, mọi camp"):
# MỌI creative, MỌI phim, MỌI ngôn ngữ dùng đúng một bộ chữ này — KHÔNG lấy chữ spy, KHÔNG tự viết, KHÔNG ETP_CTA ghi đè.
# Phần đọc spy phía trên chỉ còn để in tham khảo; không đi vào creative. Sửa creative đã lên: ap-form-chu.py (PATCH /api/v1/creatives/<id>).
_F = json.load(open(os.path.join(D, "..", "..", "..", "etp", "form-chu.json")))   # apps/etp/form-chu.json — sổ form duy nhất
FORM_CHU = {"call_to_action": _F["call_to_action"], "link_url": _F["link_url"],
            "asset_spec": {"primaryTexts": _F["primaryTexts"], "headlines": _F["headlines"], "descriptions": _F["descriptions"]}}

# KIỂU CHỮ (anh 27/11/2026 "Sinh kiểu Kiên là default và có option chọn sang Dol"): bản qua etp2 › Chờ lên mang x["kieu"] anh chọn lúc duyệt.
#   kien → bộ chữ CÙNG phim trong apps/etp/chu-kieu.json + link "_link_url" của kiểu (search.com) — đúng chữ anh thấy trên thẻ; dol → FORM_CHU.
#   Không có x["kieu"] (đường cũ) → dol như trước. Chọn kien mà sổ chưa có chữ phim → DỪNG (không lặng lẽ đổi sang D, không tự viết).
import importlib.util as _iuk; _sk = _iuk.spec_from_file_location("so_kieu", os.path.join(D, "..", "..", "..", "etp", "so_kieu.py")); SK = _iuk.module_from_spec(_sk); _sk.loader.exec_module(SK)   # sổ chữ kiểu: chu-kieu.json ∪ etp.chu_kieu (máy sinh)

def chu_theo_kieu(x):
    p = x.get("chu_phieu")   # PHIẾU LÊN CAMP (etp.phieu_len, anh 27/11/2026): chữ anh đã xem + link anh chọn lúc gửi phiếu — dùng nguyên
    if p:
        if not (p.get("pt") and p.get("hl")): raise SystemExit(f"phim {x['content_id']}: camp đang sản xuất thiếu chữ (pt/hl rỗng) — không tạo creative")
        ln = (x.get("link_phieu") or "").strip()
        return {"call_to_action": _F["call_to_action"], "link_url": ln if ln else (SK.link(x.get("kieu") or "kien") or _F["link_url"]),
                "asset_spec": {"primaryTexts": p["pt"], "headlines": p["hl"], "descriptions": p.get("de") or []}}
    kieu = x.get("kieu") or "dol"
    if kieu == "dol": return FORM_CHU
    b = SK.bo(kieu, x["content_id"])
    if not b: raise SystemExit(f"phim {x['content_id']}: anh chọn kiểu {kieu} nhưng sổ chữ (apps/etp/chu-kieu.json ∪ etp.chu_kieu) chưa có chữ phim này — sinh: python3 apps/etp/sinh-chu-kien.py {x['content_id']} — không tạo creative")
    return {"call_to_action": _F["call_to_action"], "link_url": SK.link(kieu) or _F["link_url"],
            "asset_spec": {"primaryTexts": b["primaryTexts"], "headlines": b["headlines"], "descriptions": b["descriptions"]}}

def main(lo, tsv, ma_lo, goc_url, ra, ten_tsv=None, dang="phim dai"):
    ten_tsv = ten_tsv if ten_tsv and ten_tsv != "-" else None   # "-" = không có danh sách tên kho (để truyền được tham số dang)
    if ten_tsv:   # danh sách tên phim kho (vd ethopex_uu_tien) để nhận QC ghép nhầm
        TEN_KHAC.extend(r[5].strip().lower() for r in csv.reader(open(ten_tsv), delimiter="\t") if len(r) > 5)
    qc = collections.defaultdict(dict)   # content_id → library_id → (nd, page, số ngày chạy, nút)
    for r in csv.reader(open(tsv), delimiter="\t"):
        if len(r) >= 7 and r[6].strip():
            ngay = int(r[7]) if len(r) > 7 and r[7].strip().lstrip("-").isdigit() else 0
            cu = qc[r[0]].get(r[1])
            if not cu or ngay > cu[2]: qc[r[0]][r[1]] = (r[6].strip(), r[2], ngay, (r[8] if len(r) > 8 else "").strip().lower())
    items = []
    for x in json.load(open(lo)):
        if "loi" in x: continue
        cid, ten, nn = str(x["content_id"]), x["ten"], x["lang"]
        nhom = collections.defaultdict(lambda: {"ngay": 0, "page": set(), "tieu": collections.Counter(), "mota": collections.Counter(), "nut": collections.Counter()})
        for nd, page, ngay, nut in qc[cid].values():
            if nham_phim(nd, ten): continue                                  # QC spy của phim khác (ghép nhầm landing)
            phan = MIEN.split(nd, maxsplit=1)
            for c in lam_sach(phan[0], ten):
                if len(c) < 60 or not qua_cong(c): continue                  # câu ngắn kiểu "Watch the video…" = câu mời chung, không phải hook cốt truyện
                k = re.sub(r"\W+", "", c.lower())[:80]
                c = next((v for v in nhom if re.sub(r"\W+", "", v.lower())[:80] == k), c)   # cùng câu khác dấu phẩy / hai chấm = một QC
                g = nhom[c]; g["ngay"] = max(g["ngay"], ngay); g["page"].add(page)
                if len(phan) > 1:
                    td, mt = tach_tieu_de(re.sub(r"\s*\((?:doblado|dubbed|subtitulado)\)", "", phan[1], flags=re.I), ten)
                    if 3 <= len(td) <= 60 and qua_cong(td) and not NUT_GIUA.search(td): g["tieu"][td] += 1
                    if 15 <= len(mt) <= 120 and qua_cong(mt): g["mota"][mt] += 1
                if nut in NUT_DS: g["nut"][NUT_DS[nut]] += 1
        xep = sorted(nhom.items(), key=lambda z: (-z[1]["ngay"], -len(z[1]["page"])))
        pt = [c for c, _ in xep[:5]]
        def gom(k):
            ra_ = []
            for _, g in xep:
                for v, _n in g[k].most_common():
                    if v not in ra_: ra_.append(v)
            return ra_
        tieu, mota, nut = gom("tieu"), gom("mota"), gom("nut")
        if not pt:   # spy KHÔNG có QC nào cho phim → chữ đầu thư viện / câu mẫu Dol 09/11, kêu to cho người duyệt
            mo = f"{ten} — {'mira la historia completa gratis' if nn == 'es' else 'watch the full story free'}. {'Mira más' if nn == 'es' else 'Watch more'}"
            pt = [x["chu_dau"]] if x.get("chu_dau") and qua_cong(x["chu_dau"]) else [mo]
            print(f"⚠ {cid} {ten}: spy không có QC nào → primary text dự phòng, người duyệt soát chữ", file=sys.stderr)
        f = x.get("ten_tep") or os.path.basename(x["file"])   # tên tệp trên kho có thể khác tệp máy (kho phat <tep> … <ten>)
        items.append({"name": f"{ma_lo} {ten} {nn.upper()} - {dang} {int(x['tu'])}-{int(x['den'])}s", "content_id": int(cid), "creative_type": "single_video", "traffic_source": "facebook",
                      "status": "active", "image_url": [], "video_url": [f"{goc_url.rstrip('/')}/{f}"], **chu_theo_kieu(x)})
    json.dump(items, open(ra, "w"), ensure_ascii=False, indent=1)
    for i in items: print(i["content_id"], "|", i["call_to_action"], "|", i["asset_spec"]["headlines"][0][:50], "|", i["asset_spec"]["primaryTexts"][0][:110])

if __name__ == "__main__":
    main(*sys.argv[1:8])
