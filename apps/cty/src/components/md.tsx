import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// remark-gfm: bảng, gạch ngang, link trần — hồ sơ phòng/mục tiêu viết bằng bảng markdown, thiếu plugin này bảng hiện thô (10/10/2026).
// singleTilde tắt: card plays ghi đường dẫn `~/Me/…` — hai dấu ~ đơn trên một đoạn bị gạch ngang cả đoạn (12/10/2026); gạch ngang vẫn dùng `~~`.
// Link ra ngoài (http…) mở tab mới: ngăn kéo không được đổi trang cty; link nội bộ (/nhan-su/…) để NganLinks mở ngăn.
const A = ({ href, children }: { href?: string; children?: React.ReactNode }) =>
  /^https?:\/\//.test(href ?? '') ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <a href={href}>{children}</a>;
export function Md({ children }: { children: string }) { return <div className="cty-md"><ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]} components={{ a: A }}>{children}</ReactMarkdown></div>; }
