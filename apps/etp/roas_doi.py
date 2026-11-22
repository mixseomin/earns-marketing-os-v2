#!/usr/bin/env python3
"""NHÂN ĐÔI ★ ROAS LÃI QUA ĐÊM (anh 22/11/2026 "được. Làm luôn vậy đi !!" sau bản so Sơn ↔ Nhà từ reset 20/11 — sổ luật chung etp-bang-luat.json roas_doi).
Camp ★ ROAS nhà (không phải bản nhân đôi — tên không có "duplicate by") mà ĐÊM gần nhất (giờ UTC [dem) của ngày Ethopex hôm qua = 23–07h VN)
chi ≥ chi $ và ROI > roi% → máy tạo MỘT LẦN mỗi mức trong muc một bản ★ ROAS ở ns $ (nhan-ban.py <gốc> --roas <mức> --ns <ns> --roas-doi), GIỮ NGUYÊN bản gốc.
Chỉ xét trong khung giờ VN [khung) (sáng sau đêm; bản nhân chạy ngay theo lich_len, không chờ khung tối len_roas), trần tran_ngay gốc / ngày VN, mỗi nhịp moi_nhip gốc.
Mọi cổng etp vẫn áp (cong.kiem trong nhan-ban: dừng khẩn, bảo trì, phanh chợ, phim cất, trần camp mới / ngày). Mỗi gốc chỉ thử MỘT lần (etp.cau_hinh.roas_doi_da).
Camp lên được → etp.canh_bao 'roas_doi:<camp>' (tin Telegram). Worker gọi qua nuoi_bo.py mỗi nhịp.
  python3 apps/etp/roas_doi.py --xem      → ứng viên đêm qua (không tạo gì)
  python3 apps/etp/roas_doi.py --tu-kiem  → bài tự kiểm hàm thuần + sổ"""
import datetime as dt, json, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import cong as CG
RD = CG._BL["roas_doi"]
NB = os.path.join(D, "..", "xuong-video", "scripts", "ethopex", "nhan-ban.py")
LUAT = "nhân đôi ★ ROAS lãi qua đêm"
AI = "máy: nhân đôi ★ ROAS lãi qua đêm (anh 22/11/2026 \"Làm luôn\" — cách Sơn)"
q = CG._q

def trong_khung(h, k=None):
    a, b = k or RD["khung"]
    return a <= h < b if a <= b else (h >= a or h < b)

def dem_qua(bay):
    """ngày Ethopex (UTC) của đêm vừa qua: giờ UTC [dem) của hôm qua theo UTC = 23–07h VN kết thúc sáng nay"""
    return (bay - dt.timedelta(days=1)).date()

def chon(rows, thu):
    """hàm thuần: rows [(camp_id, chi, thu)] đêm qua → gốc đạt (chi ≥ RD.chi, ROI > RD.roi%), chưa thử, xếp lãi giảm dần"""
    ds = [(int(c), float(ch), float(t)) for c, ch, t in rows if float(ch) >= float(RD["chi"]) and (float(t) - float(ch)) / float(ch) * 100 > float(RD["roi"]) and str(int(c)) not in thu]
    return [{"goc": c, "chi": round(ch, 2), "thu": round(t, 2), "roi": round((t - ch) / ch * 100)} for c, ch, t in sorted(ds, key=lambda x: x[1] - x[2])]

def da_lam():
    """số GỐC đã nhân đôi hôm nay (ngày VN) theo nhật ký nhan-ban — mỗi gốc ra len(muc) camp"""
    n = int(q(f"""select count(*) from xv_khoa_ngoai, jsonb_array_elements(gia_tri) x where ten = 'ethopex_nhat_ky' and (x->>'ok')::boolean and x->>'luat' like '{LUAT}%'
                  and split_part(x->>'luc', ' ', 2) = to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')""") or 0)
    return -(-n // len(RD["muc"]))

def nb(args, luat):
    try:
        r = subprocess.run(["python3", NB, *args, "--that", "--luat", luat, "--ai", AI], capture_output=True, text=True, timeout=1500, cwd=os.path.dirname(NB),
                           env={**os.environ, "ETP_NGUON": "roas_doi"})   # luật mới anh 22/11/2026 → cong.luat_cu_chan cho qua (NGUON_MOI)
        return json.loads(next((l for l in reversed(r.stdout.strip().splitlines()) if l.startswith("{")), "{}"))
    except Exception as e: return {"ok": False, "loi": str(e)[:200]}

def chay(xem=False):
    bay = dt.datetime.now(dt.timezone.utc); h = (bay + dt.timedelta(hours=7)).hour
    if not trong_khung(h) and not xem: return {"chay": False, "ly": f"ngoài khung {RD['khung'][0]:02d}–{RD['khung'][1]:02d}h VN"}
    ngay = dem_qua(bay); a, b = RD["dem"]
    rows = [l.split("|") for l in q(f"""select g.camp_id, sum(g.chi), sum(g.thu) from etp.so_gio_camp g join etp.camp c using (camp_id)
        where g.ngay = '{ngay}' and g.gio >= {int(a)} and g.gio < {int(b)} and c.la_roas and c.trang_thai = 'ACTIVE' and c.ten not like '%duplicate by%'
        group by 1 having sum(g.chi) > 0""").splitlines() if l.count("|") == 2]
    st = json.loads(q("select coalesce((select gia_tri::text from etp.cau_hinh where khoa = 'roas_doi_da'), '{}')") or "{}")
    thu = set(st.get("thu", []))
    uv = chon(rows, thu); con = int(RD["tran_ngay"]) - da_lam()
    kq = {"chay": True, "dem": f"{ngay} {a}–{b}h UTC", "con": con, "ung_vien": uv[:10], "lam": []}
    if xem or con <= 0: return kq
    lay = uv[:min(con, int(RD["moi_nhip"]))]
    if not lay: return kq
    # GHI "ĐÃ THỬ" TRƯỚC KHI GỌI (worker có trần giờ cho cả nuoi_bo.py): lượt bị cắt giữa chừng không nhân đôi lại gốc đó → không lên trùng
    st["thu"] = sorted(thu | {str(v["goc"]) for v in lay})
    q(f"""insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('roas_doi_da', $J${json.dumps(st)}$J$::jsonb, 'gốc ★ ROAS đã nhân đôi lãi qua đêm (apps/etp/roas_doi.py) — mỗi gốc một lần', 'roas_doi.py')
          on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()""")
    for v in lay:
        for m in RD["muc"]:
            r = nb([str(v["goc"]), "--roas", f"{float(m):g}", "--ns", f"{int(RD['ns'])}", "--roas-doi"],
                   f"{LUAT} · gốc #{v['goc']} đêm {ngay:%d/%m} chi ${v['chi']} ROI {v['roi']}% → ROAS {float(m):g}")
            kq["lam"].append({**v, "roas": m, "ok": r.get("ok"), "moi": r.get("moi"), "loi": r.get("loi")})
    for x in kq["lam"]:
        if x.get("ok") and x.get("moi"):
            chu = f"🌙 NHÂN ĐÔI ★ ROAS — gốc #{x['goc']} đêm qua chi ${x['chi']} ROI {x['roi']}% → ★ ROAS {float(x['roas']):g} · ${int(RD['ns'])} camp #{x['moi']} (giữ nguyên gốc)"
            q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) values ('roas_doi', 'roas_doi:{int(x['moi'])}', 'info', $N${chu}$N$) on conflict (khoa) do nothing""")
    return kq

def _tu_kiem():
    assert RD["muc"] == [0.9, 1.1] and RD["ns"] == 10 and RD["dem"] == [16, 24] and RD["khung"] == [7, 12], "sổ roas_doi lệch (anh 22/11/2026: ROAS 0.9 + 1.1 ở $10, đêm 23–07h VN)"
    assert all(0.9 <= m <= 1.4 for m in RD["muc"]) and 5 <= RD["ns"] <= 20, "mức / ngân sách phải qua cổng ROAS của nhan-ban (0.9–1.4, $5–20)"
    assert CG._BL["khung_doi"]["len_roas"] == [23, 3]
    u = lambda s: dt.datetime.fromisoformat(s + "+00:00")
    assert str(dem_qua(u("2026-11-23T00:30:00"))) == "2026-11-22", "07:30 VN 23/11 → đêm UTC ngày 22/11 giờ 16–23"
    assert trong_khung(7) and trong_khung(11) and not trong_khung(12) and not trong_khung(6) and trong_khung(23, [23, 3]) and trong_khung(2, [23, 3]) and not trong_khung(3, [23, 3])
    r = [(1, 3, 4), (2, 1.5, 9), (3, 5, 5), (4, 4, 3), (5, 2, 2.2), (6, 10, 20)]
    assert [x["goc"] for x in chon(r, set())] == [6, 1, 5], "chi ≥ $2 và ROI > 0%, xếp lãi giảm dần (chi < $2 / hoà / lỗ bị loại)"
    assert [x["goc"] for x in chon(r, {"6"})] == [1, 5], "gốc đã thử không lấy lại"
    print("✓ roas_doi.py tự kiểm (sổ, đêm qua, khung giờ, chọn gốc lãi)")

if __name__ == "__main__":
    if "--tu-kiem" in sys.argv: _tu_kiem(); sys.exit(0)
    print(json.dumps(chay("--xem" in sys.argv), ensure_ascii=False, default=str))
