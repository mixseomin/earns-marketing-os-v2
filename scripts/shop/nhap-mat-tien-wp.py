#!/usr/bin/env python3
"""Gieo cấu hình mặt tiền (shop_cua_hang.mat_tien) cho một shop đang chạy WordPress/Woo, trước khi chuyển sang apps/store.

Chạy TRÊN box3:  python3 nhap-mat-tien-wp.py <khoa> <thu_muc_wp> [--cau-hinh file.json]
  - Trang chính sách WP (refund/shipping/privacy/terms/contact) → mat_tien.trang (giữ nguyên chữ của shop, chỉ đổi link nội bộ sang đường mới).
  - Email hỗ trợ + địa chỉ cửa hàng Woo → mat_tien.email / dia_chi.
  - --cau-hinh: JSON trộn đè lên (thanh_tren, bac_giam, ship, cam_ket, dong_sale, do…).
Khoá đã có trong mat_tien mà file cấu hình không nhắc thì GIỮ (chạy lại không mất phần đã sửa tay ở /shop).
"""
import json, os, re, subprocess, sys

TRANG = {  # slug WP → khoá /static/<khoá> của apps/store
    'refund-policy': 'exchanges-returns', 'shipping-policy': 'orders-shipping', 'privacy-policy': 'privacy', 'terms': 'terms-of-service', 'contact': 'contact',
}
DOI_LINK = [(r'/track-order/?', '/trackings/search'), (r'/refund-policy/?', '/static/exchanges-returns'), (r'/shipping-policy/?', '/static/orders-shipping'),
            (r'/privacy-policy/?', '/static/privacy'), (r'/terms/?', '/static/terms-of-service'), (r'/contact/?', '/contact')]


def wp(thu_muc, *a):
    return subprocess.check_output(['wp', '--allow-root', f'--path={thu_muc}', *a], text=True).strip()


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    khoa, thu_muc = sys.argv[1], sys.argv[2]
    them = {}
    if '--cau-hinh' in sys.argv:
        them = json.load(open(sys.argv[sys.argv.index('--cau-hinh') + 1]))
    trang = {}
    for p in json.loads(wp(thu_muc, 'post', 'list', '--post_type=page', '--post_status=publish', '--fields=ID,post_name,post_title', '--format=json')):
        k = TRANG.get(p['post_name'])
        if not k:
            continue
        html = wp(thu_muc, 'post', 'get', str(p['ID']), '--field=post_content')
        html = re.sub(r'<!--.*?-->', '', html, flags=re.S).strip()
        for cu, moi in DOI_LINK:
            html = re.sub(r'(href="https?://[^/"]+)' + cu + '"', r'\1' + moi + '"', html)
        trang[k] = {'tieu_de': p['post_title'], 'html': html}
    dc = ', '.join(x for x in [wp(thu_muc, 'option', 'get', 'woocommerce_store_address'), wp(thu_muc, 'option', 'get', 'woocommerce_store_city'),
                               wp(thu_muc, 'option', 'get', 'woocommerce_default_country').split(':')[-1] + ' ' + wp(thu_muc, 'option', 'get', 'woocommerce_store_postcode')] if x.strip())
    goc = {'email': wp(thu_muc, 'option', 'get', 'woocommerce_email_from_address'), 'dia_chi': dc, 'trang': trang}
    db = os.environ['DATABASE_URL']
    cu = json.loads(subprocess.check_output(['psql', db, '-tAc', f"SELECT mat_tien FROM shop_cua_hang WHERE khoa = '{khoa}'"], text=True) or '{}')
    moi = {**goc, **cu, **them}           # cấu hình tay đè lên nhập từ WP; phần đã có giữ nguyên
    moi['trang'] = {**trang, **cu.get('trang', {}), **them.get('trang', {})}
    # biến psql chỉ nội suy trong đầu vào stdin (không trong -c) → câu lệnh đi qua stdin, dữ liệu qua -v (psql tự trích dấu)
    subprocess.run(['psql', db, '-v', 'ON_ERROR_STOP=1', '-v', f'mt={json.dumps(moi, ensure_ascii=False)}', '-v', f'k={khoa}'],
                   input="UPDATE shop_cua_hang SET mat_tien = :'mt'::jsonb WHERE khoa = :'k';", text=True, check=True)
    print(json.dumps({k: (list(v) if isinstance(v, dict) else v) for k, v in moi.items()}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
