// Sơ đồ tổ chức VẼ từ hồ sơ: Giám đốc → Văn phòng GĐ (hàng ngang) → các phòng (cột, 6 cột/hàng), mỗi người một avatar bấm được.
// Không chữ giải thích; mọi thứ bấm vào là ra hồ sơ. Kích thước tính theo dữ liệu nên thêm phòng/người không phải sửa gì.
import type { Doc } from '@/lib/cong-ty';
import { avatarDataUri, hueOf } from './avatar';

const CW = 168, GAP = 10, PER_ROW = 6, HEAD = 34, ROW = 32, PAD = 8, AV = 22;
const tenNgan = (s: string) => s.replace(/\s*\(.*\)$/, '').replace(/^Phòng /, '');

export function SoDoToChuc({ phong, ns, vpId = 'vp-giam-doc' }: { phong: Doc[]; ns: Doc[]; vpId?: string }) {
  const vp = ns.filter((d) => d.fm.phong === vpId);
  const cols = phong.filter((p) => p.id !== vpId);
  const W = PER_ROW * (CW + GAP) + GAP;
  const nguoiCua = (id: string) => ns.filter((d) => d.fm.phong === id);
  const rowH = (r: Doc[]) => HEAD + PAD + Math.max(1, ...r.map((p) => nguoiCua(p.id).length)) * ROW + PAD;
  const rows: Doc[][] = []; for (let i = 0; i < cols.length; i += PER_ROW) rows.push(cols.slice(i, i + PER_ROW));
  const yGD = 16, yVP = 96, yCols = 190;
  const rowTops: number[] = []; let y = yCols; for (const r of rows) { rowTops.push(y); y += rowH(r) + 36; }
  const H = y;
  const vpX = (i: number) => W / 2 + (i - (vp.length - 1) / 2) * 150;
  const minh = vp.findIndex((d) => d.id === 'minh'); const xMinh = minh >= 0 ? vpX(minh) : W / 2;

  return (
    <div className="cty-so-do"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sơ đồ tổ chức công ty">
      <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker></defs>
      {/* Giám đốc */}
      <g>
        <rect x={W / 2 - 80} y={yGD} width={160} height={44} rx={6} fill="var(--warn-bg)" stroke="var(--warn)" strokeWidth={2} />
        <text x={W / 2} y={yGD + 20} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--warn)">Giám đốc</text>
        <text x={W / 2} y={yGD + 36} textAnchor="middle" fontSize={10.5} fill="var(--muted)">1 tin sáng · ký ≤ 3 quyết định/ngày</text>
      </g>
      <line x1={W / 2} y1={yGD + 44} x2={W / 2} y2={yVP - 10} stroke="currentColor" />
      <line x1={vpX(0)} y1={yVP - 10} x2={vpX(vp.length - 1)} y2={yVP - 10} stroke="currentColor" />
      {/* Văn phòng Giám đốc */}
      {vp.map((d, i) => (
        <a key={d.id} href={`/nhan-su/${d.id}`}>
          <line x1={vpX(i)} y1={yVP - 10} x2={vpX(i)} y2={yVP} stroke="currentColor" />
          <rect x={vpX(i) - 66} y={yVP} width={132} height={58} rx={6} fill="var(--surface)" stroke="var(--line)" />
          <image href={avatarDataUri(d.id, hueOf(vpId))} x={vpX(i) - 58} y={yVP + 9} width={40} height={40} />
          <text x={vpX(i) - 12} y={yVP + 24} fontSize={13} fontWeight={700} fill="currentColor">{String(d.fm.ten)}</text>
          <text x={vpX(i) - 12} y={yVP + 40} fontSize={10} fill="var(--muted)">{tenNgan(String(d.fm.chuc_danh)).slice(0, 18)}</text>
        </a>
      ))}
      <text x={vpX(vp.length - 1) + 74} y={yVP + 33} fontSize={10} fill="var(--muted)">Văn phòng GĐ</text>
      {/* các phòng */}
      {rows.map((r, ri) => {
        const top = rowTops[ri] ?? yCols; const prevTop = rowTops[ri - 1];
        const xLast = GAP + (r.length - 1) * (CW + GAP) + CW / 2;
        return (
          <g key={`bus-${ri}`}>
            <line x1={4} y1={top - 18} x2={xLast} y2={top - 18} stroke="currentColor" strokeOpacity={0.6} />
            {ri === 0 ? <path d={`M${xMinh} ${yVP + 58} V${top - 18}`} fill="none" stroke="currentColor" strokeOpacity={0.6} /> : <line x1={4} y1={(prevTop ?? top) - 18} x2={4} y2={top - 18} stroke="currentColor" strokeOpacity={0.6} />}
          </g>
        );
      })}
      {rows.map((r, ri) => {
        const top = rowTops[ri] ?? yCols; const rh = rowH(r);
        return r.map((p, ci) => {
          const x = GAP + ci * (CW + GAP); const hue = hueOf(p.id); const nguoi = nguoiCua(p.id);
          return (
            <g key={p.id}>
              <path d={`M${x + CW / 2} ${top - 18} V${top}`} fill="none" stroke="currentColor" strokeOpacity={0.6} markerEnd="url(#ar)" />
              <a href={`/phong/${p.id}`}>
                <rect x={x} y={top} width={CW} height={rh} rx={6} fill="var(--surface)" stroke={`hsl(${hue} 45% 55%)`} />
                <rect x={x} y={top} width={CW} height={HEAD} rx={6} fill={`hsl(${hue} 45% 55%)`} />
                <text x={x + CW / 2} y={top + 21} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">{tenNgan(String(p.fm.ten)).slice(0, 24)}</text>
              </a>
              {nguoi.map((d, k) => (
                <a key={d.id} href={`/nhan-su/${d.id}`}>
                  <image href={avatarDataUri(d.id, hue)} x={x + 10} y={top + HEAD + PAD + k * ROW + 4} width={AV} height={AV} />
                  <text x={x + 40} y={top + HEAD + PAD + k * ROW + 15} fontSize={12} fontWeight={600} fill="currentColor">{String(d.fm.ten)}</text>
                  <text x={x + 40} y={top + HEAD + PAD + k * ROW + 26} fontSize={9} fill="var(--muted)">{tenNgan(String(d.fm.chuc_danh)).slice(0, 26)}</text>
                </a>
              ))}
              {!nguoi.length && <text x={x + CW / 2} y={top + HEAD + 22} textAnchor="middle" fontSize={10} fill="var(--muted)">trưởng dự án cầm</text>}
            </g>
          );
        });
      })}
    </svg></div>
  );
}
