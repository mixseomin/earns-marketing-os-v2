// Sơ đồ phòng vẽ từ KHUÔN khi phòng chưa có sơ đồ riêng (so_do trống): năm khuôn, năm hình, nhãn lấy từ frontmatter
// (trưởng, đơn vị việc, cổng người, nhân sự). Phòng nào có SVG riêng trong cong-ty/so-do thì trang dùng bản đó.
import type { Doc } from '@/lib/cong-ty';

const W = 920, H = 300;
const Box = ({ x, y, w, h, t, s, warn, teal }: { x: number; y: number; w: number; h: number; t: string; s?: string; warn?: boolean; teal?: boolean }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={5} fill={warn ? 'var(--warn-bg)' : 'var(--surface)'} stroke={warn ? 'var(--warn)' : teal ? 'var(--accent)' : 'currentColor'} strokeWidth={warn || teal ? 2 : 1.2} />
    <text x={x + w / 2} y={y + (s ? h / 2 - 3 : h / 2 + 4)} textAnchor="middle" fontSize={12} fontWeight={700} fill={warn ? 'var(--warn)' : teal ? 'var(--accent)' : 'currentColor'}>{t}</text>
    {s && <text x={x + w / 2} y={y + h / 2 + 13} textAnchor="middle" fontSize={10} fill="var(--muted)">{s.slice(0, 34)}</text>}
  </g>
);
const Ar = ({ d, warn, dash }: { d: string; warn?: boolean; dash?: boolean }) => <path d={d} fill="none" stroke={warn ? 'var(--warn)' : 'currentColor'} strokeWidth={warn ? 2 : 1.2} strokeDasharray={dash ? '3 3' : undefined} markerEnd="url(#ar2)" />;

export function SoDoKhuon({ p, ns }: { p: Doc; ns: Doc[] }) {
  const f = p.fm; const khuon = String(f.khuon); const truong = String(f.truong ?? ''); const dv = String(f.don_vi_viec ?? ''); const cong = String(f.cong_nguoi ?? '');
  const nguoi = ns.map((d) => String(d.fm.ten)).join(' · ') || truong;
  let body: React.ReactNode;
  if (khuon === 'vong-toi-uu') body = (<>
    <Box x={380} y={30} w={160} h={44} t="CHẠY" s={dv} />
    <Box x={640} y={128} w={160} h={44} t="ĐO" s="số thật mỗi nhịp" />
    <Box x={380} y={226} w={160} h={44} t="QUYẾT" s={truong} />
    <Box x={120} y={128} w={160} h={44} t="CHỈNH" s="trong phạm vi không thêm tiền" />
    <Ar d="M540 52 Q680 52 720 126" /><Ar d="M720 172 Q720 248 542 248" /><Ar d="M380 248 Q200 248 200 174" /><Ar d="M200 128 Q200 52 378 52" />
    <Box x={740} y={30} w={170} h={50} t="CỔNG TIỀN" s={cong} warn />
    <Ar d="M800 128 V82" warn />
    <Box x={640} y={200} w={160} h={34} t="Kiên · công tắc" teal />
  </>);
  else if (khuon === 'hat-nho') body = (<>
    {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={60 + (i % 3) * 30} cy={70 + Math.floor(i / 3) * 30} r={9} fill="var(--soft)" stroke="var(--accent)" />)}
    <text x={95} y={140} textAnchor="middle" fontSize={10} fill="var(--muted)">{dv.slice(0, 30)}</text>
    <Ar d="M160 85 H198" />
    {['nhận', 'dựng standing', 'soạn', 'gửi'].map((t, i) => <Box key={t} x={200 + i * 130} y={62} w={118} h={44} t={t} s={i === 1 ? 'tenure · karma · seeds' : undefined} />)}
    {[0, 1, 2].map((i) => <Ar key={i} d={`M${318 + i * 130} 84 H${328 + i * 130}`} />)}
    <Ar d="M708 84 H738" />
    <Box x={740} y={56} w={170} h={56} t="CỔNG" s={cong} warn />
    <Box x={460} y={190} w={200} h={34} t="Kiên · link gate / freeze" teal />
    <Ar d="M560 190 V108" dash />
    <Box x={200} y={190} w={240} h={44} t="Kệ kết quả" s="pending → submitted → verified" />
    <Ar d="M825 112 V212 H442" warn />
  </>);
  else if (khuon === 'dung-san-pham') body = (<>
    {['ISSUE', 'BUILD', 'TỰ KIỂM', 'HÀ SOÁT', 'DEPLOY = git push', 'VERIFY'].map((t, i) => <Box key={t} x={30 + i * 148} y={62} w={132} h={44} t={t} s={i === 1 ? truong : i === 4 ? 'không scp' : undefined} />)}
    {[0, 1, 2, 3, 4].map((i) => <Ar key={i} d={`M${162 + i * 148} 84 H${176 + i * 148}`} />)}
    <Box x={560} y={190} w={330} h={50} t="CỔNG anh ký (ngoài đường chính)" s={cong} warn />
    <Ar d="M690 190 V106" warn dash />
    <Box x={250} y={190} w={250} h={34} t="Kiên · freeze deploy khi sự cố" teal />
    <Ar d="M375 190 V106" dash />
    <text x={96} y={212} textAnchor="middle" fontSize={10} fill="var(--muted)">{dv.slice(0, 28)}</text>
  </>);
  else if (khuon === 'bo-loc') body = (<>
    <Box x={30} y={40} w={200} h={160} t="Phát sinh" s="mọi nguồn đổ vào" />
    <Ar d="M230 120 H298" />
    <Box x={300} y={90} w={180} h={60} t={truong.split(' ')[0] || 'Tiếp nhận'} s="phân loại, không giải quyết" />
    <Ar d="M480 108 H548" /><Ar d="M480 120 H548 V160" /><Ar d="M480 132 H548 V214" />
    <Box x={550} y={44} w={180} h={40} t="Gấp" s="ca ngoài giờ ngay" warn />
    <Box x={550} y={140} w={180} h={40} t="Cần bàn" s="chương trình họp" />
    <Box x={550} y={194} w={180} h={40} t="Thường" s="trưởng dự án" />
    <Box x={760} y={90} w={150} h={60} t="Giám đốc" s={cong} warn />
    <Ar d="M730 64 H790 V88" warn />
    <text x={460} y={260} textAnchor="middle" fontSize={10} fill="var(--muted)">{dv}</text>
  </>);
  else if (khuon === 'theo-du-an') body = (<>
    <Box x={380} y={30} w={160} h={44} t="Minh" s="Chánh văn phòng" />
    {ns.map((d, i) => { const x = 40 + i * 175; return (<g key={d.id}><Ar d={`M460 74 V100 H${x + 70} V128`} /><a href={`/nhan-su/${d.id}`}><Box x={x} y={130} w={140} h={50} t={String(d.fm.ten)} s={String(d.fm.chuc_danh).replace('Trưởng dự án ', '')} /></a></g>); })}
    <text x={460} y={240} textAnchor="middle" fontSize={10} fill="var(--muted)">mỗi trưởng dự án cầm một phòng theo khuôn của dự án đó</text>
  </>);
  else body = (<>
    {['1 nhận việc', '2 làm (máy)', '3 tự kiểm', '4 nộp bằng chứng'].map((t, i) => <Box key={t} x={30 + i * 150} y={62} w={136} h={44} t={t} s={i === 0 ? dv.slice(0, 30) : i === 1 ? truong : undefined} />)}
    {[0, 1, 2].map((i) => <Ar key={i} d={`M${166 + i * 150} 84 H${178 + i * 150}`} />)}
    <Ar d="M616 84 H658" />
    <Box x={660} y={54} w={240} h={60} t="5 CỔNG" s={cong} warn />
    <Ar d="M780 114 V150" warn />
    <Box x={660} y={152} w={240} h={34} t="Kiên · cờ freeze" teal />
    <Ar d="M780 186 V212" />
    <Box x={660} y={214} w={240} h={40} t="Kệ kết quả" s="đã đăng / đã giao" />
    <Box x={30} y={190} w={330} h={44} t="Trang · sau sự cố" s="review, khiếu nại → soạn, anh ký" warn />
    <Ar d="M660 234 H362" warn dash />
  </>);
  return (
    <div className="cty-so-do"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sơ đồ ${String(f.ten)} theo khuôn ${khuon}`}>
      <defs><marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker></defs>
      <text x={16} y={20} fontSize={13} fontWeight={700} fill="currentColor">{String(f.ten)} — {truong}</text>
      <text x={W - 16} y={20} textAnchor="end" fontSize={10} fill="var(--muted)">{nguoi.slice(0, 60)}</text>
      {body}
    </svg></div>
  );
}
