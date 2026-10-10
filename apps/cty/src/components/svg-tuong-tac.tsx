'use client';
// Làm MỌI sơ đồ SVG bấm được mà không phải sửa từng hình: bấm vào một ô (rect nhỏ nhất chứa điểm bấm) → gom các <text>
// nằm trong ô thành bảng chi tiết; tên nhân sự trong ô thành link hồ sơ; từ khoá (CỔNG, Kiên, Trang, Kệ, plays…) kèm
// gợi ý + link đúng chỗ. Ô có data-href thì bấm là đi thẳng. Dùng chung cho sơ đồ vẽ tay (cong-ty/so-do) và sơ đồ khuôn.
import { useEffect, useRef, useState } from 'react';

type Panel = { x: number; y: number; title: string; lines: string[]; links: { href: string; text: string }[] };
const GOI_Y: [RegExp, string, string][] = [
  [/cổng|anh ký|giám đốc ký|mức 3/i, 'Cổng người: mức 3 — tiền, tài khoản, xoá, mua, không hoàn tác. Hà soát bằng chứng rồi Giám đốc ký.', '/luat'],
  [/kiên|freeze|công tắc|link gate/i, 'Kiên (An toàn tài khoản): cờ freeze — bật là mọi ca có tay dừng, không đợi ký.', '/nhan-su/kien'],
  [/trang|pháp chế|khiếu nại|dmca/i, 'Trang (Pháp chế): nhận review / khiếu nại / DMCA, soạn văn bản, Giám đốc gửi.', '/nhan-su/trang'],
  [/hà soát|tuyến 3|bằng chứng/i, 'Hà (Kiểm soát): soát bằng chứng máy đọc được, thiếu thì trả về.', '/nhan-su/ha'],
  [/plays|bảng plays|play done/i, 'Bảng plays trên MOS2: một card = một link.', 'https://mos2.on.tc/plays'],
  [/sổ tiến độ|tiendo/i, 'Sổ tiến độ trên MOS2.', 'https://mos2.on.tc/plays?view=tiendo'],
  [/tài sản|san-pham|sổ mos2 tài sản/i, 'Sổ sản phẩm (MOS2 › Tài sản).', 'https://mos2.on.tc/plays?view=taisan'],
  [/kệ/i, 'Kệ kết quả: thứ đã đăng / đã giao, có link thật.', ''],
];

export function SvgTuongTac({ children, ten }: { children: React.ReactNode; ten: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState<Panel | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setP(null); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);
  const onClick = (e: React.MouseEvent) => {
    const root = ref.current; if (!root) return;
    const t = e.target as Element;
    const a = t.closest('a[href]'); if (a && !a.getAttribute('href')?.startsWith('#')) return;   // link thật: để trình duyệt đi
    const svg = t.closest('svg'); if (!svg) { setP(null); return; }
    const px = e.clientX, py = e.clientY;
    let best: Element | null = null, bestA = Infinity;
    svg.querySelectorAll('rect').forEach((r) => {
      const b = r.getBoundingClientRect();
      if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) { const ar = b.width * b.height; if (ar < bestA && ar > 400) { bestA = ar; best = r; } }
    });
    if (!best) { setP(null); return; }
    const bb = (best as Element).getBoundingClientRect();
    const texts: string[] = [];
    svg.querySelectorAll('text').forEach((x) => {
      const b = x.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      if (cx >= bb.left && cx <= bb.right && cy >= bb.top && cy <= bb.bottom && x.textContent?.trim()) texts.push(x.textContent.trim());
    });
    if (!texts.length) { setP(null); return; }
    const href = (best as Element).closest('[data-href]')?.getAttribute('data-href');
    if (href) { window.location.href = href; return; }
    const all = texts.join(' · ');
    const links: Panel['links'] = [];
    for (const [tenNs, id] of Object.entries(ten)) if (new RegExp(`(^|[^\\p{L}])${tenNs}([^\\p{L}]|$)`, 'u').test(all)) links.push({ href: `/nhan-su/${id}`, text: `hồ sơ ${tenNs}` });
    const lines: string[] = [];
    for (const [re, goiY, l] of GOI_Y) if (re.test(all)) { lines.push(goiY); if (l && !links.some((x) => x.href === l)) links.push({ href: l, text: l.startsWith('http') ? l.replace('https://', '') : l }); }
    const host = root.getBoundingClientRect();
    setP({ x: Math.min(px - host.left, host.width - 300), y: py - host.top + 12, title: texts[0] ?? '', lines: [...texts.slice(1), ...lines], links });
  };
  return (
    <div ref={ref} className="cty-tt" onClick={onClick}>
      {children}
      {p && (
        <div className="cty-tt-panel" style={{ left: Math.max(0, p.x), top: p.y }} onClick={(e) => e.stopPropagation()}>
          <div className="cty-tt-title">{p.title}<button type="button" onClick={() => setP(null)} aria-label="Đóng">×</button></div>
          {p.lines.map((l, i) => <div key={i} className="cty-tt-line">{l}</div>)}
          {p.links.length > 0 && <div className="cty-tt-links">{p.links.map((l) => <a key={l.href} href={l.href}>{l.text} →</a>)}</div>}
        </div>
      )}
    </div>
  );
}
