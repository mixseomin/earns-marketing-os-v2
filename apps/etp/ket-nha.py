"""CẤT TOKEN ETHOPEX NHÀ (tài khoản htuan82) vào xv_khoa_ngoai ten='ethopex' — 18/11/2026: token 30 ngày hết hạn 13:47 VN, cả refresh_token hết cùng lúc
→ mọi lượt đồng bộ / máy luật 401, mà repo không có đường nào cất token nhà (sua-ngoai.py ket chỉ cho người team và CHẶN phiên nhà).
Dùng (box3, token đi STDIN — không qua tham số dòng lệnh, không in ra):
  <lấy Token ở app.ethopex.dev/profile (nút Copy)> | ssh root@167.233.241.16 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && python3 apps/etp/ket-nha.py'
Nhận chuỗi token trần hoặc JSON {access_token, refresh_token}. Kiểm: là JWT phiên Ethopex, còn hạn > 1 giờ, cùng user_id với token nhà cũ, đọc được camp
tài khoản nhà bằng chính token mới — đạt hết mới cất. In một dòng JSON {ok, het, so_camp, loi} (không bao giờ in token)."""
import datetime, json, os, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def ra(**k):
    print(json.dumps(k, ensure_ascii=False)); sys.exit(0 if k.get("ok") else 1)

vao = sys.stdin.read().strip().strip('"').strip("'")
ref = None
if vao.startswith("{"):
    j = json.loads(vao); vao = (j.get("access_token") or "").strip(); ref = (j.get("refresh_token") or "").strip() or None
import ethopex_api as EA
t = EA.jwt_tai(vao)
if not t or not t.get("exp"): ra(ok=False, loi="chuỗi dán vào không phải phiên Ethopex (access_token)")
if t["exp"] < time.time() + 3600: ra(ok=False, loi="token này đã / sắp hết hạn — đăng nhập lại app.ethopex.dev rồi chép lại")
cu = EA.jwt_tai(EA.T_NHA) or {}
if cu.get("user_id") is not None and t.get("user_id") != cu.get("user_id"): ra(ok=False, loi=f"token của user #{t.get('user_id')}, không phải tài khoản Nhà (#{cu.get('user_id')}) — đăng nhập đúng htuan82")
EA.T = vao; EA._NHA = None
try: n = EA.camp_nha()
except Exception as e: ra(ok=False, loi=f"token mới không đọc được Ethopex: {str(e)[:200]}")
if not n: ra(ok=False, loi="token mới không thấy camp nào của tài khoản nhà — kiểm lại tài khoản đăng nhập")
het = datetime.datetime.fromtimestamp(t["exp"], datetime.timezone.utc).isoformat()
sach = lambda s: s.replace("$", "")
# nha_token + access_token cùng lúc (#1667): máy đang chạy bằng phiên dự phòng của Sơn thì quay về Nhà NGAY, không chờ lượt đồng bộ kế (chon_token)
cau = (f"update xv_khoa_ngoai set gia_tri = gia_tri || jsonb_build_object('access_token', $T${sach(vao)}$T$, 'nha_token', $T${sach(vao)}$T$, 'het', '{het}', 'nha_het', '{het}',"
       f" 'nguon', 'nha', 'nguon_ten', 'Nhà', 'nguon_het', '{het}', 'loi_token', null, 'luc', now())"
       + (f" || jsonb_build_object('refresh_token', $T${sach(ref)}$T$)" if ref else "") + ", cap_nhat = now() where ten = 'ethopex';")
r = subprocess.run(["psql", os.environ["DATABASE_URL"], "-qtA", "-v", "ON_ERROR_STOP=1", "-f", "-"], input=cau, capture_output=True, text=True, timeout=30)   # câu chứa token → STDIN
if r.returncode: ra(ok=False, loi="không cất được token: " + r.stderr.strip()[-150:])
ra(ok=True, het=het, so_camp=len(n), loi=None)
