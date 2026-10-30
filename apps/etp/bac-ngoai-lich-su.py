#!/usr/bin/env python3
"""NẠP LỊCH SỬ SỔ LÊN BẬC CỦA TEAM (anh 30/10/2026 "Show nhiều nhất data có thể") → etp.bac_ngoai (migration 0373 + 0375).
Trigger 0373 chỉ ghi từ 30/10; Ethopex không giữ lịch sử ngân sách (history chỉ có lúc tạo, report trả ngân sách HIỆN TẠI cho mọi ngày). Dựng lại:
  · sao_luu — etp.camp_ngoai trong bản sao lưu DB hằng ngày (/var/backups/mos2/mos2_prod-*.sql.gz, 03:00 UTC = 10:00 VN) + bảng hiện tại:
    ngân sách khác giữa hai mốc liền nhau = một lần đổi; giờ ghi = mốc sau, khoang = "giữa <mốc trước> và <mốc sau>"
  · tao_camp — mỗi camp tạo từ 18/10 (giờ tạo chính xác từ Ethopex): gốc ghi thẳng trong tên ("Dup by <id>", "_D<id>") → nhân bản chắc chắn;
    không có thì nhóm tên (Sơn "_x<N>", Kiên "… <N> - …"): camp sớm nhất cùng nhóm là gốc — tạo cách gốc ≥ 30 phút = nhân bản (goc_doan),
    cùng lô (< 30 phút) = tạo. Ngân sách lúc tạo không ai giữ → lấy mốc sao lưu đầu tiên sau giờ tạo (khoang ghi rõ).
  ROI kèm theo (camp, hoặc camp gốc khi nhân bản): ngày trước đó (hôm qua) + cả chặng tới hết hôm qua — không có số "hôm nay" (không biết giờ đổi trong ngày).
Chạy lại an toàn (khoá duy nhất camp × kiểu × giờ cho dòng nạp). Dùng (box3): python3 bac-ngoai-lich-su.py"""
import datetime as dt, glob, gzip, json, os, re, subprocess

DB = os.environ["DATABASE_URL"]
def q(s):
    r = subprocess.run(["psql", DB, "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=s, capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr.strip()[-300:])
    return r.stdout.strip()

def mot_sao_luu(tep):
    """{camp_id: ngân sách} của etp.camp_ngoai trong một bản pg_dump (None nếu bản đó chưa có bảng)"""
    cot, ra = None, {}
    with gzip.open(tep, "rt", encoding="utf-8", errors="replace") as f:
        for l in f:
            if cot is None:
                if l.startswith("COPY etp.camp_ngoai "): cot = [c.strip() for c in l[l.index("(") + 1:l.index(")")].split(",")]
                continue
            if l.startswith("\\."): break
            v = l.rstrip("\n").split("\t"); r = dict(zip(cot, v))
            if r.get("ngan_sach") not in (None, "\\N", ""): ra[int(r["camp_id"])] = float(r["ngan_sach"])
    return ra if cot else None

def main():
    moc = []   # [(giờ UTC, {camp: ns})] cũ → mới
    for tep in sorted(glob.glob("/var/backups/mos2/mos2_prod-*.sql.gz")):
        m = re.search(r"(\d{4}-\d{2}-\d{2})\.sql\.gz$", tep); s = mot_sao_luu(tep)
        if m and s: moc.append((dt.datetime.fromisoformat(m.group(1) + "T03:00:00+00:00"), s))
    camp = {}
    for l in q("select c.camp_id || '|' || c.ten || '|' || coalesce(c.ngan_sach::text, '') || '|' || coalesce(c.tao::text, '') || '|' || coalesce(t.nguoi_id::text, '') "
               "from etp.camp_ngoai c join etp.tai_khoan t using (ad_account_id) where not t.nha").splitlines():
        cid, ten, ns, tao, ng = l.split("|"); camp[int(cid)] = {"ten": ten, "ns": float(ns) if ns else None, "tao": dt.datetime.fromisoformat(tao) if tao else None, "ng": int(ng) if ng else None}
    # MỐC CUỐI = lúc trigger 0373 bắt đầu ghi (sau đó trigger lo, giờ chính xác): ngân sách lúc đó = "cũ" của dòng trigger sớm nhất, không có thì ngân sách hiện tại.
    # Mốc cố định → chạy lại không sinh dòng mới.
    tg = {}
    for l in q("select distinct on (camp_id) camp_id || '|' || coalesce(cu::text, '') || '|' || kieu from etp.bac_ngoai where nguon = 'trigger' order by camp_id, luc").splitlines():
        c, cu, k = l.split("|"); tg[int(c)] = (float(cu) if cu else None, k)
    BAT_DAU = dt.datetime.fromisoformat(q("select coalesce(min(luc), now())::text from etp.bac_ngoai where nguon = 'trigger'").replace(" ", "T"))
    BAT_DAU = min(BAT_DAU, dt.datetime(2026, 10, 30, 5, 0, tzinfo=dt.timezone.utc))
    moc.append((BAT_DAU, {c: (tg[c][0] if c in tg and tg[c][1] == "sua" else v["ns"]) for c, v in camp.items() if v["ns"] is not None and not (v["tao"] and v["tao"] >= BAT_DAU)}))
    vn = lambda t: (t + dt.timedelta(hours=7)).strftime("%H:%M %d/%m")
    rows = []
    # đổi ngân sách giữa hai mốc
    for (t1, s1), (t2, s2) in zip(moc, moc[1:]):
        for cid, ns2 in s2.items():
            ns1 = s1.get(cid)
            if cid in camp and ns1 is not None and abs(ns1 - ns2) > 1e-9:
                rows.append({"c": cid, "kieu": "sua", "luc": t2.isoformat(), "cu": ns1, "moi": ns2, "goc": None, "doan": False, "nguon": "sao_luu",
                             "khoang": f"đổi trong khoảng {vn(t1)} → {vn(t2)} (bản sao lưu hằng ngày)", "src": cid})
    # tạo / nhân bản
    def nhom(ten):
        t = re.sub(r"_x\d+.*$", "", ten)                       # Sơn: <đoạn>_x<N>[_D…]
        t = re.sub(r"\s\d+\s-\s", " - ", t)                     # Kiên: "… EP9 1 - Tên phim"
        return t if t != ten else None
    sau_tao = lambda cid, t: next(((tm, s[cid]) for tm, s in moc if tm >= t and cid in s), (None, None))
    theo_nhom = {}
    for cid, v in camp.items():
        k = nhom(v["ten"])
        if k and v["tao"]: theo_nhom.setdefault((v["ng"], k), []).append(cid)
    for cid, v in camp.items():
        if not v["tao"] or v["tao"] < dt.datetime(2026, 10, 18, tzinfo=dt.timezone.utc) or v["tao"] >= BAT_DAU: continue   # tạo sau lúc trigger chạy: trigger đã ghi
        g = re.search(r"(?i)^dup by (\d{4,})", v["ten"]) or re.search(r"_D(\d{4,})", v["ten"]); doan = False
        g = int(g.group(1)) if g and int(g.group(1)) in camp else None
        if not g:
            k = nhom(v["ten"]); ds = sorted(theo_nhom.get((v["ng"], k), []), key=lambda x: camp[x]["tao"]) if k else []
            if ds and ds[0] != cid and (v["tao"] - camp[ds[0]]["tao"]).total_seconds() >= 1800: g, doan = ds[0], True
        tm, ns = sau_tao(cid, v["tao"])
        _, ns_goc = sau_tao(g, v["tao"]) if g else (None, None)
        rows.append({"c": cid, "kieu": "nhan_ban" if g else "tao", "luc": v["tao"].isoformat(), "cu": ns_goc, "moi": ns, "goc": g, "doan": doan, "nguon": "tao_camp",
                     "khoang": (f"ngân sách lúc tạo không lưu — ${ns:g} là mốc {vn(tm)}" if tm and tm > v["tao"] + dt.timedelta(hours=1) else None) if ns is not None else "chưa có ngân sách",
                     "src": g or cid})
    j = json.dumps(rows, ensure_ascii=False).replace("$J$", "")
    n = q(f"""with x as (select * from jsonb_to_recordset($J${j}$J$::jsonb) as x(c int, kieu text, luc timestamptz, cu numeric, moi numeric, goc int, doan boolean, nguon text, khoang text, src int))
      insert into etp.bac_ngoai (camp_id, luc, nguoi_id, kieu, goc_id, cu, moi, trang_thai, chi_nay, thu_nay, chi_qua, thu_qua, chi_tron, thu_tron, nguon, khoang, goc_doan)
      select x.c, x.luc, t.nguoi_id, x.kieu, x.goc, x.cu, x.moi, k.trang_thai, null, null,
             coalesce((select sum(chi) from etp.so_ngay_ngoai s where s.camp_id = x.src and s.ngay = (x.luc at time zone 'UTC')::date - 1), 0),
             coalesce((select sum(thu) from etp.so_ngay_ngoai s where s.camp_id = x.src and s.ngay = (x.luc at time zone 'UTC')::date - 1), 0),
             coalesce((select sum(chi) from etp.so_ngay_ngoai s where s.camp_id = x.src and s.ngay < (x.luc at time zone 'UTC')::date), 0),
             coalesce((select sum(thu) from etp.so_ngay_ngoai s where s.camp_id = x.src and s.ngay < (x.luc at time zone 'UTC')::date), 0),
             x.nguon, x.khoang, x.doan
      from x join etp.camp_ngoai k on k.camp_id = x.c join etp.tai_khoan t on t.ad_account_id = k.ad_account_id
      on conflict (camp_id, kieu, luc) where nguon <> 'trigger' do nothing returning 1""")
    print(json.dumps({"moc_sao_luu": [vn(t) for t, _ in moc], "dong": len(rows), "ghi_moi": len(n.split()) if n else 0,
                      "sua": sum(r["kieu"] == "sua" for r in rows), "nhan_ban": sum(r["kieu"] == "nhan_ban" for r in rows), "tao": sum(r["kieu"] == "tao" for r in rows)}, ensure_ascii=False))

if __name__ == "__main__": main()
