'use client';
// 🌐 Dịch cả tập (kịch bản · chữ màn · thoại · bài đăng) sang ngôn ngữ khác — giữ shot/keyframe/video, chỉ đổi chữ; đổi luôn ngôn ngữ của phim.
// Tiền hiện trước trên nút (ước từ số ký tự), bấm hai nhịp như mọi nút tốn tiền.
import { useEffect, useState } from 'react';
import { uocDichTap, dichTapSang } from '@/lib/actions';
import { NGON_NGU, tien, type Tap } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { Nut, Loi, mono } from './ui';

export function DichTap({ tap, ngonNgu, coAnthropic, ban, onChanged }: { tap: Tap; ngonNgu: string; coAnthropic: boolean; ban?: boolean; onChanged: () => Promise<void> }) {
  const khac = NGON_NGU.filter((x) => x.value !== ngonNgu);
  const [sang, setSang] = useState(khac[0]?.value ?? 'en');
  const [uoc, setUoc] = useState<{ cents: number; chars: number; soShot: number; soCoGiong: number } | null>(null);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState('');
  const [kq, setKq] = useState('');
  useEffect(() => { if (!khac.some((x) => x.value === sang)) setSang(khac[0]?.value ?? 'en'); }, [ngonNgu]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { let song = true; void uocDichTap(tap.id).then((r) => { if (song && r.ok) setUoc(r.data); }); return () => { song = false; }; }, [tap.id, tap.kich_ban, tap.bai_dang]);
  const dich = async () => {
    setDang(true); setLoi(''); setKq('');
    const r = await dichTapSang(tap.id, sang);
    setDang(false);
    if (!r.ok) { setLoi(r.loi); return; }
    setKq(`✓ đã dịch ${r.data.soShot} shot${r.data.thieu ? ` (${r.data.thieu} shot Claude bỏ sót, giữ chữ cũ)` : ''}${r.data.soCoGiong ? ` · ${r.data.soCoGiong} shot có giọng cũ — sinh lại giọng ở tab Âm thanh` : ''}`);
    await onChanged();
  };
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <Chon value={sang} onChange={setSang} options={khac} minWidth={120} nho title="Ngôn ngữ đích" />
      <Nut ly={(!coAnthropic && 'thiếu ANTHROPIC_API_KEY') || (uoc && !uoc.chars && 'tập chưa có chữ để dịch')} ban={ban || dang} gia={uoc?.cents}
        title={uoc ? `Claude dịch kịch bản + chữ màn + thoại của ${uoc.soShot} shot + bài đăng (${uoc.chars.toLocaleString('vi')} ký tự) ≈ ${tien(uoc.cents)}; giữ keyframe/video; đổi ngôn ngữ phim sang ngôn ngữ đích` : 'Claude dịch cả tập, giữ keyframe/video'} onClick={() => void dich()}>
        {dang ? '… Claude đang dịch' : `🌐 Dịch tập${uoc ? ` (≈ ${tien(uoc.cents)})` : ''}`}
      </Nut>
      {kq && <span style={{ ...mono, color: 'var(--lime)' }}>{kq}</span>}
      <Loi>{loi}</Loi>
    </span>
  );
}
