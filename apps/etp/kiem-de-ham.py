#!/usr/bin/env python3
"""Gác lớp lỗi "biến tầng ngoài đè hàm" trong máy Ethopex (22/11/2026).

Vì sao: luật RN gán `ke = min(...)` ở tầng ngoài luat-ethopex.py, đè hàm `ke()` (bậc kế) định
nghĩa từ trước → thẻ xét luật gọi ke(...) gãy 'int' object is not callable trên mọi camp được xét.
Script máy luật chạy ở tầng ngoài nên mọi biến vòng lặp / tạm đều là biến toàn cục: đặt trùng tên
hàm là đè im lặng, chỉ nổ khi có hàm khác gọi tên đó lúc chạy.

Máy kiểm: tên được định nghĩa là hàm ở tầng ngoài (def, hoặc `x = lambda`) mà sau đó bị gán lại
bằng giá trị KHÔNG phải hàm (gán thường, gán nhiều tên, biến vòng for, with … as) ở tầng ngoài → đỏ.
Định nghĩa lại bằng def / lambda (vd bọc api) là cố ý, bỏ qua.
Chạy: python3 apps/etp/kiem-de-ham.py [tệp…]   (không truyền tệp = các máy Ethopex mặc định)
"""
import ast, sys, os

MAC = ["apps/xuong-video/scripts/ethopex/luat-ethopex.py", "apps/xuong-video/scripts/ethopex/nhan-ban.py",
       "apps/xuong-video/scripts/ethopex/lam-ethopex.py", "apps/xuong-video/scripts/ethopex/nhip_tang.py",
       "apps/etp/cong.py", "apps/etp/ethopex_api.py", "apps/etp/dong-bo.py", "apps/etp/canh-bao.py", "apps/etp/doc_lai_roas.py"]


def la_ham(v):
    return isinstance(v, ast.Lambda)


def ten_gan(node):
    for x in ast.walk(node):
        if isinstance(x, ast.Name) and isinstance(x.ctx, ast.Store):
            yield x


def kiem(tep):
    t = ast.parse(open(tep, encoding="utf8").read(), tep)
    ham, loi = {}, []

    def quet(stmts):
        for n in stmts:
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
                ham.setdefault(n.name, n.lineno); continue
            if isinstance(n, ast.ClassDef):
                continue
            dich = []
            if isinstance(n, ast.Assign):
                if la_ham(n.value) or isinstance(n.value, ast.Name):   # gán lại bằng lambda / trả hàm gốc (vd bài tự kiểm nhip_tang: du_don = _goc_dd) là cố ý
                    for g in n.targets:
                        if isinstance(g, ast.Name): ham.setdefault(g.id, n.lineno)
                    continue
                dich = n.targets
            elif isinstance(n, (ast.AugAssign, ast.AnnAssign)):
                dich = [n.target]
            elif isinstance(n, (ast.For, ast.AsyncFor)):
                dich = [n.target]
            elif isinstance(n, (ast.With, ast.AsyncWith)):
                dich = [i.optional_vars for i in n.items if i.optional_vars is not None]
            for g in dich:
                for x in ten_gan(g):
                    if x.id in ham and x.lineno > ham[x.id]:
                        loi.append(f"ĐỎ {tep}:{x.lineno}: '{x.id}' gán giá trị thường, đè hàm '{x.id}' dòng {ham[x.id]} — đổi tên biến")
            for f in ("body", "orelse", "finalbody"):
                quet(getattr(n, f, []) or [])
            for h in getattr(n, "handlers", []) or []:
                quet(h.body)

    quet(t.body)
    return loi


if __name__ == "__main__":
    if "--tu-kiem" in sys.argv:
        import tempfile
        mau = "ke = lambda b: b + 1\nfor l in [1]:\n    ke = 5\ndef f(x): return x\nf = 3\napi = lambda p: p\napi = lambda p: api(p)\n_g = api\napi = _g\n"
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as fh:
            fh.write(mau)
        r = kiem(fh.name); os.unlink(fh.name)
        assert len(r) == 2 and "'ke'" in r[0] and "'f'" in r[1], r
        print("✓ kiem-de-ham --tu-kiem: bắt 2/2 chỗ đè, bỏ qua định nghĩa lại bằng lambda")
        sys.exit(0)
    tep = [a for a in sys.argv[1:] if not a.startswith("-")] or [p for p in MAC if os.path.exists(p)]
    loi = [l for p in tep for l in kiem(p)]
    print("\n".join(loi) if loi else f"✓ kiem-de-ham: {len(tep)} tệp, không biến tầng ngoài nào đè hàm")
    sys.exit(1 if loi else 0)
