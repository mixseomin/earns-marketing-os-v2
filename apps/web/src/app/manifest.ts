import type { MetadataRoute } from 'next';

// PWA tối thiểu: "Thêm vào MH chính" (iPhone / Android) mở MOS như app riêng, không thanh địa chỉ — thành phố Social dùng trọn màn (anh 22/10/2026).
// Không khai start_url: mở lại đúng trang lúc thêm (vd /?tab=social&sts=pho).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MOS', short_name: 'MOS', display: 'standalone', background_color: '#060914', theme_color: '#060914',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
