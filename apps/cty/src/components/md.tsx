import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// remark-gfm: bảng, gạch ngang, link trần — hồ sơ phòng/mục tiêu viết bằng bảng markdown, thiếu plugin này bảng hiện thô (10/10/2026).
export function Md({ children }: { children: string }) { return <div className="cty-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown></div>; }
