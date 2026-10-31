#!/usr/bin/env python3
"""SỬA CAMP CỦA NGƯỜI TRONG TEAM (anh 31/10/2026: Sơn "được edit camp của Sơn" trên etp.on.tc). Nút ✎ ở ô Ngân sách → action etp-sua.ts → script này.
Đi cổng chung ethopex_api.py chế độ ETP_SUA_NGUOI=<nguoi_id>: camp phải nằm trong tài khoản QC của người đó, camp nhà / người khác bị chặn ngay ở cổng.
Đúng API giao diện Ethopex dùng (như lam-ethopex.py):
  ns  <camp_id> <ngân sách>  → POST /api/v1/campaigns/update {campaign:{campaign_id, source_payload:{daily_budget}}}
  bat <camp_id>              → POST /api/v1/campaigns/control/batch/bulk [{entity_type:'campaign', entity_ids:[id], status:'active'}]
  tat <camp_id>              → cùng API, status 'paused'
Không áp luật / trần của nhà (camp của người đó, người đó quyết). Làm xong ĐỌC LẠI camp rồi ghi etp.camp_ngoai → trigger 0373 ghi sổ lên bậc đúng giờ.
Mọi lệnh đi bằng PHIÊN ETHOPEX RIÊNG của người đó (token htuan82 chỉ được XEM tài khoản người khác — Ethopex từ chối ghi, anh 31/10/2026):
  ket <nguoi_id>             → đọc phiên từ STDIN (không qua dòng lệnh / log), kiểm rồi cất xv_khoa_ngoai['ethopex_nguoi'][<nguoi_id>]
Dùng (box3): python3 sua-ngoai.py <nguoi_id> ns|bat|tat <camp_id> [ngân sách]   → một dòng JSON {ok, viec, id, truoc, sau, loi}
             echo '<access_token>' | python3 sua-ngoai.py <nguoi_id> ket          → {ok, het, so_camp, loi}
  --may = MÁY TỰ LÀM (chế độ Luật tự động, apps/cty/worker/etp-tu-dong.mjs): qua đúng cái gác của Nhà (lam-ethopex.py) — mức trên thang ≤ $30, camp phải đang chạy,
          nhịp tăng / giảm nhip_tang.py (tăng cách ≥ 3 giờ, khoá tăng 6 giờ sau giảm, giảm cách ≥ 3 giờ). Người tự sửa tay (nút ✎) không qua các gác này."""
import json, os, subprocess, sys, time

KET = len(sys.argv) == 3 and sys.argv[1].isdigit() and sys.argv[2] == "ket"
if not KET and (len(sys.argv) < 4 or not sys.argv[1].isdigit() or sys.argv[2] not in ("ns", "bat", "tat") or not sys.argv[3].isdigit()):
    print(json.dumps({"ok": False, "loi": "dùng: sua-ngoai.py <nguoi_id> ns|bat|tat <camp_id> [ngân sách] · sua-ngoai.py <nguoi_id> ket < phiên"})); sys.exit(2)
NG, VIEC, CID = int(sys.argv[1]), sys.argv[2], (0 if KET else int(sys.argv[3]))
os.environ["ETP_SUA_NGUOI"] = str(NG); os.environ.pop("ETP_XEM_NGUOI", None)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ethopex_api as EA   # noqa: E402 — nạp SAU khi đặt chế độ
MAY = "--may" in sys.argv
import importlib.util as _iu
_s = _iu.spec_from_file_location("nhip_tang", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "xuong-video", "scripts", "ethopex", "nhip_tang.py"))
NT = _iu.module_from_spec(_s); _s.loader.exec_module(NT)

def doc():
    c = EA.api(f"/api/v1/campaigns/{CID}")["campaign"]
    return {"ns": c.get("budget_daily"), "tt": c.get("state")}

def ra(**k): print(json.dumps({"viec": VIEC, "id": CID, **k}, ensure_ascii=False)); sys.exit(0 if k.get("ok") else 1)

def ket():
    """KẾT NỐI: người dán access_token (localStorage app.ethopex.dev) → kiểm đúng là phiên CỦA NGƯỜI ĐÓ rồi mới cất"""
    import datetime
    tok = sys.stdin.read().strip().strip('"').strip("'")
    if tok.startswith("{"): tok = (json.loads(tok).get("access_token") or "").strip()
    t = EA.jwt_tai(tok)
    if not t or not t.get("exp"): ra(ok=False, loi="chuỗi dán vào không phải phiên Ethopex (access_token)")
    if t["exp"] < time.time() + 3600: ra(ok=False, loi="phiên này đã / sắp hết hạn — đăng nhập lại app.ethopex.dev rồi chép lại")
    nha = EA.jwt_tai(EA.T_NHA) or {}
    if t.get("user_id") is not None and t.get("user_id") == nha.get("user_id"): ra(ok=False, loi="đây là phiên của tài khoản Nhà, không phải của bạn")
    EA.T = tok; EA._NHA = None
    n = EA.camp_nha()   # đọc BẰNG phiên mới: phải thấy camp trong tài khoản QC của người này
    if not n: ra(ok=False, loi="phiên này không thấy camp nào trong tài khoản QC của bạn — kiểm lại đã đăng nhập đúng tài khoản Ethopex chưa")
    het = datetime.datetime.fromtimestamp(t["exp"], datetime.timezone.utc).isoformat()
    cau = ("insert into xv_khoa_ngoai (ten, gia_tri) values ('ethopex_nguoi', '{}'::jsonb) on conflict (ten) do nothing;"
           f" update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('{NG}', jsonb_build_object('access_token', $T${tok.replace('$', '')}$T$, 'het', '{het}',"
           f" 'user_id', {int(t.get('user_id') or 0)}, 'luc', now())), cap_nhat = now() where ten = 'ethopex_nguoi';")
    # câu chứa phiên → đi STDIN (-f -), không qua tham số dòng lệnh (ps thấy được)
    r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=cau, capture_output=True, text=True, timeout=30)
    if r.returncode: ra(ok=False, loi="không cất được phiên: " + r.stderr.strip()[-150:])
    ra(ok=True, het=het, so_camp=len(n), loi=None)

try:
    if KET: ket()
    if CID not in EA.camp_nha(): ra(ok=False, loi=f"camp {CID} không thuộc tài khoản QC của người #{NG}")
    truoc = doc()
    if VIEC == "ns":
        if len(sys.argv) < 5 or not sys.argv[4].isdigit() or not 1 <= int(sys.argv[4]) <= 1000: ra(ok=False, truoc=truoc, loi="ngân sách phải là số nguyên $1–$1000")
        ns = int(sys.argv[4])
        if truoc["ns"] is not None and int(float(truoc["ns"])) == ns: ra(ok=True, truoc=truoc, sau=truoc, loi=None)
        if MAY:   # máy tự làm: cùng gác với Nhà
            cu = float(truoc["ns"] or 0)
            if ns not in NT.BAC or ns > 30: ra(ok=False, truoc=truoc, loi=f"${ns} không phải mức trên thang (trần máy $30)")
            if truoc["tt"] != "ACTIVE": ra(ok=False, truoc=truoc, loi="camp không chạy — máy không đổi ngân sách")
            ly = NT.chan_tang(lambda p: EA.api(p), CID) if ns > cu else NT.chan_giam(lambda p: EA.api(p), CID)
            if ly: ra(ok=False, truoc=truoc, loi=ly)
        EA.api("/api/v1/campaigns/update", {"campaign": {"campaign_id": CID, "source_payload": {"daily_budget": ns}}})
    else:
        EA.api("/api/v1/campaigns/control/batch/bulk", [{"entity_type": "campaign", "entity_ids": [CID], "status": "active" if VIEC == "bat" else "paused"}])
    sau = doc()
    for _ in range(3):   # Ethopex ghi trễ vài giây
        if (VIEC == "ns" and sau["ns"] is not None and int(float(sau["ns"])) == ns) or (VIEC == "bat" and sau["tt"] == "ACTIVE") or (VIEC == "tat" and sau["tt"] == "PAUSED"): break
        time.sleep(3); sau = doc()
    dat = (VIEC == "ns" and sau["ns"] is not None and int(float(sau["ns"])) == ns) or (VIEC == "bat" and sau["tt"] == "ACTIVE") or (VIEC == "tat" and sau["tt"] == "PAUSED")
    if dat and os.environ.get("DATABASE_URL"):
        subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtAc", f"update etp.camp_ngoai set ngan_sach = {float(sau['ns'] or 0)}, trang_thai = '{sau['tt']}' where camp_id = {CID}"], capture_output=True, timeout=30)
    ra(ok=dat, truoc=truoc, sau=sau, loi=None if dat else "Ethopex chưa nhận — đọc lại camp vẫn như cũ")
except EA.NgoaiNha as e: ra(ok=False, loi=str(e))
except Exception as e: ra(ok=False, loi=f"{type(e).__name__}: {str(e)[:200]}")
