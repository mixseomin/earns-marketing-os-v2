'use client';
// 🌐 Dịch CẢ PHIM sang ngôn ngữ khác: mọi chữ tiếng Việt còn lại — anchor (tên, mô tả, giọng), kinh thánh, tập (kịch bản, beats, phân cảnh,
// bài đăng), shot (nhãn, góc máy, hành động, diễn xuất, prompt, chữ màn, thoại). Giữ keyframe/video; đổi ngôn ngữ phim; ↶ Hoàn tác được.
// Tiền hiện trước trên nút (ước từ số ký tự còn tiếng Việt), bấm hai nhịp như mọi nút tốn tiền.
import { useEffect, useState } from 'react';
import { uocDichPhim, dichPhimSang } from '@/lib/actions';
import { NGON_NGU, tien, type Tap } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { Nut, Loi, mono } from './ui';

type Uoc = { cents: number; chars: number; soChuoi: number; soLo: number; soCoGiong: number };
export function DichPhim({ tap, ngonNgu, coAnthropic, ban, onChanged }: { tap: Tap; ngonNgu: string; coAnthropic: boolean; ban?: boolean; onChanged: () => Promise<void> }) {
  const khac = NGON_NGU.filter((x) => x.value !== ngonNgu);
  // Phim đã mang ngôn ngữ đích nhưng còn sót chữ Việt → vẫn cho dịch nốt sang CHÍNH ngôn ngữ đó.
  const [sang, setSang] = useState(ngonNgu !== 'vi' ? ngonNgu : (khac[0]?.value ?? 'en'));
  const [uoc, setUoc] = useState<Uoc | null>(null);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState('');
  const [kq, setKq] = useState('');
  useEffect(() => { let song = true; void uocDichPhim(tap.phim_id).then((r) => { if (song && r.ok) setUoc(r.data); }); return () => { song = false; }; }, [tap.phim_id, tap.kich_ban, tap.bai_dang, ngonNgu]);
  const dich = async () => {
    setDang(true); setLoi(''); setKq('');
    const r = await dichPhimSang(tap.phim_id, sang);
    setDang(false);
    if (!r.ok) { setLoi(r.loi); return; }
    setKq(`✓ đã dịch ${r.data.soBanGhi} bản ghi · ${tien(r.data.cents)}${r.data.conViet ? ` · còn ${r.data.conViet} chuỗi tiếng Việt` : ' · hết tiếng Việt'}${r.data.boGiong ? ` · ${r.data.boGiong} dòng thoại đổi lời → sinh lại giọng` : ''} · ↶ Hoàn tác được`);
    await onChanged();
  };
  const sach = uoc && !uoc.soChuoi;
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <Chon value={sang} onChange={setSang} options={NGON_NGU.filter((x) => x.value !== 'vi' || ngonNgu !== 'vi')} minWidth={120} nho title="Ngôn ngữ đích" />
      <Nut ly={(!coAnthropic && 'thiếu ANTHROPIC_API_KEY') || (sach && sang === ngonNgu && 'phim không còn chữ tiếng Việt')} ban={ban || dang} gia={uoc?.cents}
        title={uoc ? `Claude dịch ${uoc.soChuoi} chuỗi tiếng Việt còn lại của cả phim (${uoc.chars.toLocaleString('vi')} ký tự, ${uoc.soLo} lô): anchor, kinh thánh, tập, shot, thoại ≈ ${tien(uoc.cents)}; giữ keyframe/video` : 'Claude dịch cả phim, giữ keyframe/video'} onClick={() => void dich()}>
        {dang ? '… Claude đang dịch' : sach && sang === ngonNgu ? '✓ hết tiếng Việt' : `🌐 Dịch cả phim${uoc ? ` · ${uoc.soChuoi} chuỗi ≈ ${tien(uoc.cents)}` : ''}`}
      </Nut>
      {kq && <span style={{ ...mono, color: 'var(--lime)' }}>{kq}</span>}
      <Loi>{loi}</Loi>
    </span>
  );
}
