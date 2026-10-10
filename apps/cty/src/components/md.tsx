import ReactMarkdown from 'react-markdown';
export function Md({ children }: { children: string }) { return <div className="cty-md"><ReactMarkdown>{children}</ReactMarkdown></div>; }
