'use client';
// KHUNG CHI TIẾT PHIM CẤM (góp ý etp2 #1725, anh 20/11/2026: "Nếu bị cấm thì bấm vào phải show lý do chi tiết do cái gì: nguồn cấm, do điểm số hay do bên team Etho lọc cấm").
// Một khung dùng chung: ngăn dựng theo mẫu (bấm chữ PHIM CẤM) + đầu ngăn phim. Nguồn đọc từ dấu đầu câu lý do (lib/etp-phim-cam.ts nguonCam), dữ liệu từ ba sổ studio
// (actions/etp-phim-cam.ts docPhimCam). Phim không bị cấm → không hiện gì. CHỈ ĐỌC.
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2
import { useEffect, useState, type ReactNode } from 'react';
import { MO_SO } from '@/components/etp-so';
import { docPhimCam, type PhimCamSo } from '@/lib/actions/etp-phim-cam';
import { CAM_CHAN, nguonCam } from '@/lib/etp-phim-cam';
import { DO, XANH } from './etp-doi-thu';

// màu theo NGUỒN — tín hiệu thật (ai cấm), một màu mỗi nguồn
const MAU_LOAI: Record<string, string> = { etho: '#c084fc', anh: '#f472b6', diem: '#fb923c', ai: '#60a5fa', claude: '#60a5fa', poster: '#fbbf24', khac: MO_SO };

export function KhungPhimCam({ cid, gon }: { cid: number; /** gọi từ nút bấm: luôn hiện kết quả, kể cả khi đang đọc / không còn cấm */ gon?: boolean }) {
  const [so, setSo] = useState<PhimCamSo | { loi: string } | null>(null);
  useEffect(() => {
    let song = true;
    docPhimCam(cid).then((r) => { if (song) setSo(r); }).catch((e: unknown) => { if (song) setSo({ loi: e instanceof Error ? e.message : String(e) }); });
    return () => { song = false; };
  }, [cid]);
  if (!so) return gon ? <div style={{ fontSize: 12, color: MO_SO }}>đang đọc sổ phim cấm…</div> : null;
  if ('loi' in so) return <div style={{ fontSize: 12, color: DO }}>{so.loi}</div>;
  if (!so.cam) return gon ? <div style={{ fontSize: 12, color: XANH }}>phim #{cid} hiện không còn trong sổ cấm{so.go?.go_luc ? ` — đã gỡ lúc ${so.go.go_luc}${so.go.go_vi ? ` (${so.go.go_vi})` : ''}` : ''}</div> : null;
  const n = nguonCam(so.cam.ly_do), mau = MAU_LOAI[n.loai] ?? MO_SO;
  const dong = (nhan: string, noi: ReactNode) => <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'baseline' }}><span style={{ color: MO_SO, fontSize: 11.5 }}>{nhan}</span><span>{noi}</span></div>;
  return <div data-phim-cam={cid} style={{ fontSize: 12.5, padding: '10px 12px', borderRadius: 8, border: `1px solid ${DO}`, background: 'rgba(248,113,113,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ fontWeight: 700, color: DO }}>🚫 Phim #{cid} đang trong sổ cấm</div>
    {dong('Nguồn cấm', <b style={{ color: mau }}>{n.nguon}{n.mo_hinh ? <span style={{ fontWeight: 400, color: MO_SO }}> · mô hình {n.mo_hinh}</span> : null}</b>)}
    {dong('Cách cấm', n.cach)}
    {dong('Điểm số', n.diem.length
      ? <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{n.diem.map((d, j) => <span key={j} style={{ padding: '0 6px', borderRadius: 6, border: `1px solid ${mau}`, color: mau, whiteSpace: 'nowrap' }}>{d.nhan} <b>{d.diem.toFixed(2)}</b></span>)}</span>
      : <span style={{ color: MO_SO }}>không có điểm số — cấm theo nhận xét, không phải do điểm</span>)}
    {dong('Lý do ghi sổ', n.vi_sao)}
    {dong('Cấm lúc', so.cam.luc ?? 'sổ không ghi giờ')}
    {so.soat ? dong('Soát 18+ gần nhất', <span>{so.soat.ok === false ? <b style={{ color: DO }}>không đạt</b> : so.soat.ok ? <b style={{ color: XANH }}>đạt</b> : 'chưa rõ'}{so.soat.luc ? ` · ${so.soat.luc}` : ''}{so.soat.ghi && so.soat.ghi !== so.cam.ly_do ? <span style={{ color: MO_SO }}> · {so.soat.ghi}</span> : null}</span>) : null}
    {so.go ? dong('Lần gỡ trước', <span style={{ color: MO_SO }}>từng gỡ lúc {so.go.go_luc ?? '?'}{so.go.go_vi ? ` (${so.go.go_vi})` : ''}, sau đó bị cấm lại</span>) : null}
    {dong('Máy chặn', <span style={{ color: MO_SO }}>{CAM_CHAN}</span>)}
    {dong('Cách gỡ', <span style={{ color: MO_SO }}>máy soát lại phim đạt, hoặc anh bảo gỡ cấm phim này</span>)}
  </div>;
}
