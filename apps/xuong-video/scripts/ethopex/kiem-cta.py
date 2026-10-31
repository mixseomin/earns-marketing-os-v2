#!/usr/bin/env python3
"""CỔNG CTA CỦA CREATIVE (Support Ads 22/10/2026, anh: "thêm rule khi lên creative"): không chữ dụ nhấp (Tap/Click/Toca…), không mũi tên / icon chỉ trỏ.
Mũi tên trong video không đọc chữ ra được, nên creative chỉ qua khi đã được ĐƯỜNG DỰNG MỚI (cta_qc.CTA, cat-canh không mũi tên) đánh dấu vào
studio xv_khoa_ngoai['ethopex_cta_dat'] {"<creative_id>": {luc, ghi}} — creative dựng trước 22/10 (nút "WATCH FREE · TAP LEARN MORE" + 2 mũi tên vàng)
không có trong sổ → chặn, kể cả khi luật NB tự nhân bản camp thắng (camp đang chạy thì không động).
Kiểm thêm chữ QC (primaryTexts / headlines / descriptions) bằng cta_qc.sai_luat.
Chạy trên box3:  kiem-cta.py <creative_id>  → "CTA OK…" (0) / "CTA CHAN: …" (2)
                 kiem-cta.py --dat <creative_id>… "<ghi chú>"   → đánh dấu đạt (sau khi soát tờ khung + thẻ cuối)"""
import datetime as dt, importlib.util, json, os, subprocess, sys, urllib.request
D = os.path.dirname(os.path.abspath(__file__))
_c = importlib.util.spec_from_file_location("cta_qc", os.path.join(D, "cta_qc.py")); CQ = importlib.util.module_from_spec(_c); _c.loader.exec_module(CQ)
q = lambda s: subprocess.run(["psql", os.environ["DATABASE_URL"], "-tAc", s], capture_output=True, text=True).stdout.strip()

def kiem(cr, so=True):
    """so=False: creative KHÔNG do xưởng nhà dựng (camp của người trong team, Luật tự động — nhan-ban.py chế độ ETP_SUA_NGUOI): sổ ethopex_cta_dat chỉ ghi
    creative xưởng nhà nên bỏ bước sổ, vẫn soát chữ QC (phần máy đọc được); creative team không đọc được bằng khoá nhà → cho qua phần chữ, không đoán."""
    cr = str(int(cr))
    if so and cr not in json.loads(q("select gia_tri::text from xv_khoa_ngoai where ten='ethopex_cta_dat'") or "{}"):
        return f"creative #{cr} chưa đạt luật CTA mới (dựng trước 22/10: nút 'TAP LEARN MORE' + mũi tên) — dựng lại bằng lam-lai-cta.py / cat-canh rồi kiem-cta.py --dat"
    T = q("select gia_tri->>'access_token' from xv_khoa_ngoai where ten='ethopex'")
    try: c = json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.ethopex.dev/api/v1/creatives/{cr}", headers={"authorization": "Bearer " + T, "user-agent": "mos2-kiem"}), timeout=60))
    except Exception:
        if so: raise
        return None
    s = json.loads((c.get("creative") or c).get("asset_spec") or "{}")
    for t in (s.get("primaryTexts") or []) + (s.get("headlines") or []) + (s.get("descriptions") or []):
        if CQ.sai_luat(t): return f"creative #{cr} chữ QC dính '{CQ.sai_luat(t)}': «{t[:90]}»"
    return None

if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["--dat"]:
        ids, gc = [x for x in a[1:] if x.isdigit()], " ".join(x for x in a[1:] if not x.isdigit())
        luc = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=7)).strftime("%H:%M %d/%m/%Y")
        v = json.dumps({i: {"luc": luc, "ghi": gc} for i in ids}, ensure_ascii=False).replace("'", "''")
        q("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_cta_dat', '{}'::jsonb) on conflict (ten) do nothing")
        q(f"update xv_khoa_ngoai set gia_tri = gia_tri || '{v}'::jsonb where ten = 'ethopex_cta_dat'"); print("đã đánh dấu đạt CTA:", ids); sys.exit(0)
    loi = kiem(a[0]); print(f"CTA CHAN: {loi}" if loi else f"CTA OK: creative #{a[0]}"); sys.exit(2 if loi else 0)
