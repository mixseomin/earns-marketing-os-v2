'use client';
// LỜI TRONG LUỒNG GÓP Ý hiện có định dạng (anh 20/11/2026: "phần trình bày reply trên gopy cũng phải nâng cấp tương ứng cho mọi con AI").
// Kỹ sư AI trả lời theo khuôn Nguyên nhân / Cách sửa / Kết quả (cty may/luat-ky-su.mjs GIONG_TRA_LOI) bằng markdown: **đậm**, gạch đầu dòng, bảng, link.
// MỘT bộ hiện cho mọi nơi đọc luồng: hòm 💬 dùng chung (client.tsx — mos2, city, cty, studio, etp2, studio2 qua hòm phủ) và thẻ card plays (apps/web trao-doi-card.tsx).
// Dùng react-markdown + remark-gfm (đã có trong repo, card-modal mos2 / cty dùng), không tự viết bộ đọc; HTML thô trong chữ bị bỏ (mặc định react-markdown).
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CSSProperties } from 'react';

const CSS = `.gy-vb{font-size:12.5px;line-height:1.55;overflow-wrap:anywhere}
.gy-vb>:first-child{margin-top:0}.gy-vb>:last-child{margin-bottom:0}
.gy-vb p{margin:0 0 6px}.gy-vb ul,.gy-vb ol{margin:0 0 6px;padding-left:18px}.gy-vb li{margin:2px 0}
.gy-vb h1,.gy-vb h2,.gy-vb h3,.gy-vb h4{font-size:13px;font-weight:700;margin:8px 0 4px}
.gy-vb strong{font-weight:700;color:var(--fg-1)}.gy-vb a{color:var(--accent);text-decoration:underline;word-break:break-all}
.gy-vb code{font-family:var(--font-mono);font-size:11.5px;background:var(--bg-2);border:1px solid var(--line);border-radius:4px;padding:0 4px}
.gy-vb pre{background:var(--bg-2);border:1px solid var(--line);border-radius:6px;padding:6px 8px;overflow-x:auto;margin:0 0 6px}.gy-vb pre code{border:0;padding:0}
.gy-vb blockquote{margin:0 0 6px;padding-left:8px;border-left:2px solid var(--line);color:var(--fg-3)}
.gy-vb table{border-collapse:collapse;margin:0 0 6px;font-size:12px;display:block;overflow-x:auto}.gy-vb th,.gy-vb td{border:1px solid var(--line);padding:3px 7px;text-align:left}
.gy-vb th{background:var(--bg-2)}.gy-vb hr{border:0;border-top:1px solid var(--line);margin:8px 0}`;

/** Chữ một tin trong luồng góp ý: markdown (GFM) → giao diện. Một dòng xuống dòng đơn vẫn xuống dòng như trước (lời người gõ tay không mất bố cục). */
export function VanBan({ chu, style }: { chu: string; style?: CSSProperties }) {
  const md = String(chu ?? '').replace(/^(\s*)•\s*/gm, '$1- ').replace(/([^\n])\n(?=[^\n])/g, (m, a: string, i: number, s: string) => {
    const sau = s.slice(i + 2);
    // dòng kế là phần tử khối markdown (gạch đầu dòng, số, bảng, tiêu đề, trích) → để nguyên; còn lại giữ xuống dòng cứng
    return /^\s*([-*+]\s|\d+[.)]\s|\||#|>|```)/.test(sau) || /^\s*\|/.test(s.slice(s.lastIndexOf('\n', i) + 1, i + 1)) ? m : `${a}  \n`;
  });
  return (
    <div className="gy-vb" style={style}>
      <style>{CSS}</style>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{md}</ReactMarkdown>
    </div>
  );
}
