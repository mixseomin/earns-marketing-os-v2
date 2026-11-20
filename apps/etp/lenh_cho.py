#!/usr/bin/env python3
"""HÀNG LỆNH CHỜ PHANH NHẢ (anh 20/11/2026, chat: "Làm : 1, 2, 5" + "các camp roas trước dương lớn có thể mở lại 2 camp để dò đường, nếu ko thì sau đó cũng tắt").
Lệnh anh đã ra trong lúc PHANH CHỢ đang bật: cổng (apps/etp/cong.py) chặn đúng luật, lệnh chat không được miễn phanh → máy GIỮ lệnh ở đây và thực hiện
ở nhịp đầu tiên cổng không còn chặn vì phanh. Không timer / tiến trình riêng: nuoi_bo.py (nhịp worker ethopex.mjs) gọi chay() mỗi nhịp.

Khoá etp.cau_hinh.lenh_cho_phanh = {"lenh": [...], "do_duong": [...]}
  lenh     {id, viec: nhan_roas | tang, camp, roas?, ns, ai, luc, han, giu, tt: cho | dang | xong | bo | huy, ly, moi, xet}
           - thực hiện QUA CỔNG như mọi lệnh khác (nhan-ban.py --roas … --lenh-cho / lam-ethopex.py tang) — trần camp, trần ngày, trần test, phim cấm vẫn áp
           - điều kiện giữ lúc thực hiện: nhan_roas = camp gốc còn ACTIVE + ROI 3 ngày đã khép ≥ 0; tang = camp còn ACTIVE + ROI 3 ngày VÀ 7 ngày đã khép > 0
           - quá hạn (72 giờ từ lúc lệnh) mà phanh chưa nhả → huỷ + báo
           - ghi 'dang' TRƯỚC khi gọi script → mỗi lệnh chạy đúng một lần (lượt bị cắt giữa chừng không gọi lại)
  do_duong {camp, nhan, d0, tt: theo | giu | tat | het | loi, ly}
           - hết 2 ngày đã khép kể từ d0 (ngày UTC lúc bật): ROI cộng 2 ngày âm → máy tắt; ≥ 0 → giữ, bỏ nhãn
Thực hiện / bỏ / huỷ / tắt nhịp nào → MỘT tin gộp qua etp.canh_bao (chủ đề Ethopex).
  python3 apps/etp/lenh_cho.py --nap       → nạp 8 lệnh + 2 camp dò đường của 20/11/2026 (chạy lại không nhân đôi)
  python3 apps/etp/lenh_cho.py --xem       → in việc nhịp này sẽ làm, không gọi gì
  python3 apps/etp/lenh_cho.py --tu-kiem   → bài tự kiểm hàm thuần"""
# tra-repo-ok: mã dán keo nội bộ — nối sổ etp.cau_hinh với cổng cong.py và hai script nhan-ban / lam-ethopex của nhà, không có thư viện ngoài nào làm việc này
import datetime as dt, json, os, re, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import cong as CG
q = CG._q
KHOA = "lenh_cho_phanh"
SC = os.path.join(D, "..", "xuong-video", "scripts", "ethopex")
NB, LE = os.path.join(SC, "nhan-ban.py"), os.path.join(SC, "lam-ethopex.py")
HAN_GIO, MOI_NHIP = 72, 4
AI = "anh (chat 20/11/2026: Làm 1, 2, 5 — lệnh chờ phanh nhả) — máy chạy"
AI_DO = "anh (chat 20/11/2026: mở lại 2 camp dò đường, nếu ko thì sau đó cũng tắt) — máy chạy"
CHO_LAI = re.compile(r"PHANH|BẢO TRÌ|DỪNG KHẨN|RÚT KHỎI", re.I)   # lỗi do cổng phanh / bảo trì → lệnh về hàng chờ, không bỏ (con chọn)

def _u(s): return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))

def xet(l, chan, the, bay):
    """hàm thuần: lệnh + câu chặn phanh (None = nhả) + {tt, ns, r3, r7} của camp + giờ → (cho | lam | bo | huy, lý do)"""
    if bay > _u(l["han"]): return "huy", f"quá {HAN_GIO} giờ phanh chưa nhả — huỷ lệnh"
    if chan: return "cho", chan
    if (the or {}).get("tt") != "ACTIVE": return "bo", f"camp #{l['camp']} không còn ACTIVE ({(the or {}).get('tt') or 'không thấy'})"
    r3, r7 = the.get("r3"), the.get("r7")
    if l["viec"] == "nhan_roas":
        if r3 is None or r3 < 0: return "bo", f"ROI 3 ngày đã khép của gốc #{l['camp']} {'chưa có' if r3 is None else f'{r3:g}%'} < 0"
    elif l["viec"] == "tang":
        if r3 is None or r3 <= 0 or r7 is None or r7 <= 0: return "bo", f"ROI 3 ngày {r3 if r3 is not None else '?'}% · 7 ngày {r7 if r7 is not None else '?'}% — không còn cùng dương"
        if float(the.get("ns") or 0) >= float(l["ns"]): return "bo", f"camp đã ở ${float(the['ns']):g} ≥ ${float(l['ns']):g}"
    else: return "bo", f"việc lạ '{l['viec']}'"
    return "lam", None

def xet_do(d, the, hom_nay, thu, chi):
    """hàm thuần: camp dò đường → (theo | giu | tat | het, lý do). thu / chi = cộng hai ngày [d0, d0+1]"""
    if (the or {}).get("tt") != "ACTIVE": return "het", f"camp đã {(the or {}).get('tt') or 'mất'} — bỏ nhãn"
    d0 = dt.date.fromisoformat(d["d0"])
    if hom_nay <= d0 + dt.timedelta(days=1): return "theo", f"chờ khép ngày {d0 + dt.timedelta(days=1):%d/%m}"
    r = round((thu - chi) / chi * 100) if chi else 0
    return ("tat" if r < 0 else "giu"), f"ROI 2 ngày đã khép {d0:%d/%m}–{d0 + dt.timedelta(days=1):%d/%m}: {r}% (chi ${chi:g}, thu ${thu:g})"

def doc():
    return json.loads(q(f"select coalesce((select gia_tri::text from etp.cau_hinh where khoa = '{KHOA}'), '{{}}')") or "{}")

def ghi(st):
    q(f"""insert into etp.cau_hinh (khoa, gia_tri, ghi, ai) values ('{KHOA}', $J${json.dumps(st, ensure_ascii=False)}$J$::jsonb,
          'hàng lệnh chờ phanh nhả + camp dò đường (apps/etp/lenh_cho.py) — anh 20/11/2026', 'lenh_cho.py')
          on conflict (khoa) do update set gia_tri = excluded.gia_tri, luc = now()""")

def the(cid):
    """trạng thái + ngân sách + ROI 3 / 7 ngày đã khép (ngày UTC) của camp nhà"""
    l = q(f"""with d as (select (now() at time zone 'utc')::date d0)
        select c.trang_thai, c.ngan_sach,
          round((sum(n.thu) filter (where n.ngay >= d0 - 3) - sum(n.chi) filter (where n.ngay >= d0 - 3)) / nullif(sum(n.chi) filter (where n.ngay >= d0 - 3), 0) * 100, 1),
          round((sum(n.thu) - sum(n.chi)) / nullif(sum(n.chi), 0) * 100, 1)
        from etp.camp c cross join d left join etp.so_ngay n on n.camp_id = c.camp_id and n.ngay between d0 - 7 and d0 - 1
        where c.camp_id = {int(cid)} group by c.trang_thai, c.ngan_sach""")
    if not l: return None
    tt, ns, r3, r7 = (l.split("|") + ["", "", "", ""])[:4]
    f = lambda s: float(s) if s not in ("", None) else None
    return {"tt": tt, "ns": f(ns), "r3": f(r3), "r7": f(r7)}

def chay_script(args):
    try:
        r = subprocess.run(["python3", *args], capture_output=True, text=True, timeout=1500, cwd=SC)
        return json.loads(next((x for x in reversed(r.stdout.strip().splitlines()) if x.startswith("{")), "{}") or "{}")
    except Exception as e: return {"ok": False, "loi": str(e)[:200]}

def mo_ta(l):
    return (f"nhân ★ ROAS {float(l['roas']):g} · ${l['ns']} từ camp #{l['camp']}" if l["viec"] == "nhan_roas" else f"tăng camp #{l['camp']} lên ${l['ns']}")

def hop_le(goc, roas, ns):
    """nhan-ban.py --lenh-cho: chỉ cho ngân sách ★ ROAS bài cũ ngoài $15–20 khi hàng đang chạy ĐÚNG lệnh này (tt 'dang')"""
    return any(l["viec"] == "nhan_roas" and int(l["camp"]) == int(goc) and abs(float(l["roas"]) - float(roas)) < 1e-9 and int(l["ns"]) == int(ns) and l.get("tt") == "dang"
               for l in doc().get("lenh") or [])

def chay(xem=False):
    st = doc()
    if not (st.get("lenh") or st.get("do_duong")): return {"lenh": 0}
    bay = dt.datetime.now(dt.timezone.utc); luc = bay.isoformat(timespec="seconds")
    chan = CG.phanh_sx(CG.doc_cau_hinh(), bay)
    kq, bao, doi, lam = {"chan": chan, "lenh": [], "do_duong": []}, [], False, 0
    for l in st.get("lenh") or []:
        if l.get("tt") != "cho": continue
        th = None if chan else the(l["camp"])
        v, ly = xet(l, chan, th, bay)
        kq["lenh"].append({"id": l["id"], "xet": v, "ly": ly})
        if v == "cho":
            if l.get("ly") != ly: l["ly"] = ly; doi = True
            continue
        if xem: continue
        if v in ("huy", "bo"):
            l.update(tt=v, ly=ly, xet=luc); doi = True
            bao.append(f"{'⌛ huỷ' if v == 'huy' else '✋ bỏ'} lệnh {mo_ta(l)}: {ly}"); continue
        if lam >= MOI_NHIP: continue
        lam += 1
        l.update(tt="dang", xet=luc); ghi(st)   # GHI TRƯỚC khi gọi — mỗi lệnh đúng một lần
        nhan = f"lệnh chờ phanh 20/11 · anh lệnh {l['luc'][:16]}Z · ROI 3 ngày {th.get('r3')}% · 7 ngày {th.get('r7')}%"
        if l["viec"] == "nhan_roas":
            r = chay_script([NB, str(l["camp"]), "--roas", f"{float(l['roas']):g}", "--ns", str(int(l["ns"])), "--lenh-cho", "--that", "--luat", nhan, "--ai", l.get("ai") or AI])
        else:
            r = chay_script([LE, "tang", str(l["camp"]), str(int(l["ns"])), "--luat", nhan, "--ai", l.get("ai") or AI])
        if r.get("ok"):
            l.update(tt="xong", ly=None, moi=r.get("moi")); bao.append(f"✅ {mo_ta(l)}" + (f" → camp #{r['moi']}" if r.get("moi") else ""))
        elif CHO_LAI.search(str(r.get("loi") or "")):
            l.update(tt="cho", ly=str(r.get("loi"))[:200])
        else:
            l.update(tt="bo", ly=str(r.get("loi") or "script không trả kết quả")[:200]); bao.append(f"✋ bỏ lệnh {mo_ta(l)}: {l['ly']}")
        kq["lenh"][-1].update(ok=r.get("ok"), moi=r.get("moi"), loi=r.get("loi")); doi = True
    hom = bay.date()
    for d in st.get("do_duong") or []:
        if d.get("tt") != "theo": continue
        th = the(d["camp"]); d0 = dt.date.fromisoformat(d["d0"])
        tc = q(f"select coalesce(sum(thu), 0), coalesce(sum(chi), 0) from etp.so_ngay where camp_id = {int(d['camp'])} and ngay between '{d0}' and '{d0 + dt.timedelta(days=1)}'") or "0|0"
        thu, chi = (float(x or 0) for x in (tc.split("|") + ["0"])[:2])
        v, ly = xet_do(d, th, hom, thu, chi)
        kq["do_duong"].append({"camp": d["camp"], "xet": v, "ly": ly})
        if v == "theo" or xem: continue
        if v == "tat":
            r = chay_script([LE, "tat", str(d["camp"]), "--luat", f"{d['nhan']}: {ly}", "--ai", AI_DO])
            if r.get("ok"): d.update(tt="tat", ly=ly); bao.append(f"⛔ tắt camp dò đường #{d['camp']} — {ly}")
            else: d.update(tt="loi", ly=f"{ly} · tắt không được: {str(r.get('loi'))[:150]}"); bao.append(f"⚠ camp dò đường #{d['camp']} ROI âm nhưng tắt không được: {str(r.get('loi'))[:150]}")
        else:
            d.update(tt=v, ly=ly); bao.append(f"🟢 giữ camp dò đường #{d['camp']}, bỏ nhãn — {ly}" if v == "giu" else f"camp dò đường #{d['camp']}: {ly}")
        doi = True
    if doi and not xem: ghi(st)
    if bao and not xem:
        chu = "🧭 LỆNH CHỜ PHANH NHẢ (anh 20/11/2026)\n" + "\n".join(f"• {x}" for x in bao)
        q(f"""insert into etp.canh_bao (loai, khoa, muc, noi_dung) values ('lenh_cho', 'lenh_cho:{bay:%Y%m%d%H%M%S}', 'info', $N${chu}$N$) on conflict (khoa) do nothing""")
    kq["bao"] = bao
    return kq

def nap():
    st = doc(); st.setdefault("lenh", []); st.setdefault("do_duong", [])
    luc = dt.datetime.now(dt.timezone.utc).replace(microsecond=0); han = (luc + dt.timedelta(hours=HAN_GIO)).isoformat()
    giu_n, giu_t = "camp gốc còn ACTIVE + ROI 3 ngày đã khép ≥ 0", "camp còn ACTIVE + ROI 3 ngày và 7 ngày đã khép còn dương"
    moi = [{"id": f"nhan_roas:{g}:{r:g}", "viec": "nhan_roas", "camp": g, "roas": r, "ns": 5, "giu": giu_n} for g in (66055, 70189) for r in (1.0, 1.2)]
    moi += [{"id": f"tang:{c}:{n}", "viec": "tang", "camp": c, "ns": n, "truoc": t, "giu": giu_t} for c, t, n in ((102508, 2, 3), (102469, 1, 2), (101454, 2, 3), (102489, 1, 2))]
    co = {l["id"] for l in st["lenh"]}
    for l in moi:
        if l["id"] not in co: st["lenh"].append({**l, "ai": AI, "luc": luc.isoformat(), "han": han, "tt": "cho", "ly": None})
    cod = {int(d["camp"]) for d in st["do_duong"]}
    for c in (70193, 87786):
        if c not in cod: st["do_duong"].append({"camp": c, "nhan": "dò đường 20/11", "d0": "2026-11-20", "tt": "theo", "ly": None, "ai": AI_DO})
    ghi(st); return st

def _tu_kiem():
    b = _u("2026-11-20T03:00:00Z")
    l = {"id": "x", "viec": "nhan_roas", "camp": 66055, "roas": 1.0, "ns": 5, "han": "2026-11-23T02:30:00+00:00", "tt": "cho"}
    t = {"id": "y", "viec": "tang", "camp": 102508, "ns": 3, "han": "2026-11-23T02:30:00+00:00", "tt": "cho"}
    ok = {"tt": "ACTIVE", "ns": 2, "r3": 19, "r7": 12}
    # phanh còn → không thực hiện
    assert xet(l, "chờ phanh nhả: PHANH CHỢ …", ok, b)[0] == "cho" and xet(t, "chờ phanh nhả: RÚT KHỎI CHỢ", ok, b)[0] == "cho"
    # phanh nhả + đủ điều kiện → thực hiện
    assert xet(l, None, ok, b) == ("lam", None) and xet(t, None, ok, b) == ("lam", None)
    # không đủ điều kiện → bỏ kèm lý do
    v, ly = xet(l, None, {**ok, "r3": -4}, b); assert v == "bo" and "-4" in ly
    v, ly = xet(l, None, {**ok, "tt": "PAUSED"}, b); assert v == "bo" and "ACTIVE" in ly
    v, ly = xet(t, None, {**ok, "r7": -1}, b); assert v == "bo" and "7 ngày" in ly
    v, ly = xet(t, None, {**ok, "r3": 0}, b); assert v == "bo"
    v, ly = xet(t, None, {**ok, "ns": 3}, b); assert v == "bo" and "$3" in ly
    assert xet(l, None, {**ok, "r3": 0}, b)[0] == "lam"   # bước 1: ROI 3 ngày ≥ 0 là đủ
    # quá hạn → huỷ (kể cả phanh vừa nhả)
    assert xet(l, "PHANH CHỢ", ok, _u("2026-11-23T02:31:00Z"))[0] == "huy" and xet(t, None, ok, _u("2026-11-23T03:00:00Z"))[0] == "huy"
    # dò đường: chưa khép đủ 2 ngày → theo; âm → tắt; dương → giữ; camp đã tắt → hết
    d = {"camp": 70193, "d0": "2026-11-20"}
    assert xet_do(d, ok, dt.date(2026, 11, 21), 0, 10)[0] == "theo"
    assert xet_do(d, ok, dt.date(2026, 11, 22), 30, 40)[0] == "tat" and xet_do(d, ok, dt.date(2026, 11, 22), 50, 40)[0] == "giu"
    assert xet_do(d, {"tt": "PAUSED"}, dt.date(2026, 11, 22), 0, 40)[0] == "het"
    # lỗi do cổng phanh → về hàng chờ; lỗi khác → bỏ
    assert CHO_LAI.search("PHANH CHỢ tới 11:29") and not CHO_LAI.search("ngân sách camp ROAS $15–20")
    print("lenh_cho tự kiểm: xanh")

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--tu-kiem" in a: _tu_kiem()
    elif "--nap" in a: st = nap(); print(json.dumps({"ok": True, "lenh": len(st["lenh"]), "do_duong": len(st["do_duong"])}, ensure_ascii=False))
    else: print(json.dumps(chay("--xem" in a), ensure_ascii=False, default=str))
