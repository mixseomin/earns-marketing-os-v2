"""SỔ MẪU CREATIVE cho máy Python — đọc apps/etp2/src/lib/etp-mau-cr.json (một nơi; tab Mẫu Creative của etp2 đọc cùng tệp).
LUẬT (anh 19/11/2026): "khi lên creative, phải dựa vào 1 mẫu nào đó! Nếu chưa có mẫu thì phải tìm cho ra hoặc phải bổ sung mới!! Ko còn creative tự do nữa".
→ len-creative.py (cổng DUY NHẤT tải creative lên Ethopex) gọi chon() cho từng bản: không gắn được công thức trong sổ thì bản đó KHÔNG được tải lên;
  bản tải lên được ghi mẫu vào etp.creative_mau (creative_id → mẫu) để tab Mẫu Creative đo hiệu suất từng mẫu.
Dùng: sys.path có apps/etp → import so_mau as SM
  SM.chon(dang, goi_y="")  → mục công thức | None   (tìm theo dạng; nhiều công thức cùng dạng thì khớp 'nhan' trong goi_y, không khớp → mac_dinh)
  SM.ly_do(dang)           → câu báo vì sao không có mẫu (để in / ghi lỗi)
Tự kiểm: python3 so_mau.py --tu-kiem  (đỏ nếu dạng có dòng phim mà chưa có công thức máy, công thức trỏ dạng không có, mã trùng,
  hay có tệp ngoài len-creative.py gọi thẳng bulk-jobs của Ethopex = đường tải creative tự do)"""
import json, os, re, sys
_D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _D); import so_dang as DG
TEP = os.path.join(_D, "..", "etp2", "src", "lib", "etp-mau-cr.json")
DS = json.load(open(TEP, encoding="utf-8"))["mau"]
DUOC_LEN = {"may", "thu"}   # công thức có mã dựng — "chua" là tham chiếu, chưa dựng được
CONG_THUC = [x for x in DS if x.get("loai") == "cong_thuc"]
TAB = "https://etp2.on.tc/?t=mau"

def chon(dang, goi_y=""):
    """dạng (có dấu / không dấu) + chữ gợi ý (ghi chú bản dựng, tên lô…) → mục công thức trong sổ, hoặc None khi dạng chưa có công thức dựng được"""
    d = DG.CHUAN.get((dang or "").strip().lower(), (dang or "").strip())
    ung = [x for x in CONG_THUC if x["dang"] == d and x["trang_thai"] in DUOC_LEN]
    if not ung: return None
    g = goi_y or ""
    khop = [x for x in ung if x.get("nhan") and re.search(rf"(?<![\w.]){re.escape(x['nhan'])}(?![\w.])", g)]
    if len(khop) == 1: return khop[0]
    md = [x for x in ung if x.get("mac_dinh")]
    return md[0] if md else (ung[0] if len(ung) == 1 else None)

def ly_do(dang):
    return (f"CREATIVE TỰ DO BỊ CHẶN: dạng '{dang}' chưa có công thức dựng trong sổ mẫu (luật anh 19/11/2026 — mọi creative phải dựa vào một mẫu). "
            f"Tìm mẫu hợp hoặc bổ sung mẫu mới ở {TAB} (sổ apps/etp2/src/lib/etp-mau-cr.json) rồi chạy lại.")

def bang_sql():
    """bảng ghi mẫu của creative — dựng tại chỗ (không đụng migration chung của repo)"""
    return ("create table if not exists etp.creative_mau (creative_id integer primary key, mau text not null, dang text, lo text, luc timestamptz not null default now()); "
            "create index if not exists creative_mau_mau on etp.creative_mau (mau);")

def tu_kiem():
    loi, ma = [], [x["ma"] for x in DS]
    if len(ma) != len(set(ma)): loi.append(f"mã mẫu trùng: {sorted({m for m in ma if ma.count(m) > 1})}")
    dang_co = {x["dang"] for x in DG.DS}
    for x in CONG_THUC:
        if x.get("dang") not in dang_co: loi.append(f"công thức {x['ma']} trỏ dạng '{x.get('dang')}' không có trong sổ dạng")
    for dong, dang in DG.DONG.items():
        if not chon(dang): loi.append(f"dạng '{dang}' (dòng {dong}) chưa có công thức dựng — máy dòng phim sẽ bị chặn ở bước tải creative")
    # đường tải creative tự do: mọi tệp khác len-creative.py gọi thẳng bulk-jobs
    goc = os.path.normpath(os.path.join(_D, ".."))
    for thu_muc in ("etp", "xuong-video/scripts", "etp2/src", "web/src"):
        for r, ds, fs in os.walk(os.path.join(goc, thu_muc)):
            ds[:] = [d for d in ds if d not in ("node_modules", "__pycache__", ".next")]
            for f in fs:
                if not f.endswith((".py", ".ts", ".tsx", ".mts", ".mjs", ".sh")) or f in ("len-creative.py", "so_mau.py"): continue
                try: t = open(os.path.join(r, f), encoding="utf-8", errors="ignore").read()
                except OSError: continue
                if "creatives/bulk-jobs\"" in t or "creatives/bulk-jobs'" in t or "creatives/bulk-jobs`" in t or "/creatives/bulk-jobs/%s" in t:
                    loi.append(f"{os.path.relpath(os.path.join(r, f), goc)} gọi thẳng bulk-jobs — creative phải đi qua len-creative.py (cổng mẫu)")
    # phá thử: dạng không có thì phải ra None, PO.5 phải nhận đúng
    if chon("dạng không có") is not None: loi.append("chon() trả mẫu cho dạng không có")
    po = chon("poster động", "Poster (PO) PO.5 bản 1/3")
    if not po or po["ma"] != "po_ai": loi.append(f"chon() PO.5 ra {po and po['ma']}")
    if (chon("poster dong", "") or {}).get("ma") != "po_goc": loi.append("chon() poster không gợi ý phải ra mặc định po_goc")
    return loi

if __name__ == "__main__":
    if "--tu-kiem" in sys.argv:
        l = tu_kiem(); print("\n".join(l) if l else f"✓ sổ mẫu: {len(CONG_THUC)} công thức · mọi dạng có dòng phim đều có mẫu · không đường tải tự do"); sys.exit(1 if l else 0)
    for x in CONG_THUC: print(x["ma"], "·", x["dang"], "·", x["trang_thai"], "·", x.get("nhan") or "")
