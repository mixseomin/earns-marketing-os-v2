'use client';
// M1 — DẢI SỐ AGENTS (dữ liệu cty /api/agents?phan=so; đếm bằng đúng hàm lọc Trạng thái của bảng nhân sự cty).
// Bấm thẻ trạng thái = lọc ô Bảng agents cùng màn (tham số ?agtt=), bấm Việc máy lỗi = lọc ô Việc máy (?agvt=loi). Không rời trang.
import { StatsStrip, type StatCard } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import type { CardKet, SoAgents } from '@/lib/cty-agents-kieu';
import { tien } from './chung';

export function SoAgentsW({ du, cardKet = [] }: { du: SoAgents; cardKet?: CardKet[] }) {
  const ket = du.ket + cardKet.length;  // người kẹt (cty) + card góp ý kẹt — cùng luật M7 Việc theo phòng
  const [tt, datTt] = useShallowParam('agtt', ''), [, datVt] = useShallowParam('agvt', '');
  const loc = (v: string) => () => datTt(tt === v ? '' : v);
  const cards: StatCard[] = [
    { key: 'ns', label: 'Nhân sự', value: du.nhanSu, sub: `${du.cli} CLI · ${du.api} API`, onClick: loc(''), active: !tt, color: '#94a3b8' },
    { key: 'lam', label: 'Đang làm', value: du.lam, color: '#4ade80', onClick: loc('lam'), active: tt === 'lam' },
    { key: 'ket', label: 'Kẹt', value: ket, sub: cardKet.length ? `${du.ket} người · ${cardKet.length} card` : undefined, color: ket ? '#f87171' : undefined, onClick: loc('ket'), active: tt === 'ket',
      title: ['Người: chạy quá trần, 3 lần lỗi liền, hoặc việc lịch dày im quá 30 phút. Card góp ý: hòng (broken) hoặc Đang làm quá 45 phút không phiên nào chạy.', ...cardKet.map((c) => `#${c.id} ${c.tieuDe} · hòm ${c.hom}`)].join('\n') },
    { key: 'ranh', label: 'Rảnh', value: du.ranh, color: '#60a5fa', onClick: loc('ranh'), active: tt === 'ranh' },
    { key: 'tat', label: 'Tắt', value: du.tat, onClick: loc('tat'), active: tt === 'tat', color: '#94a3b8' },
    { key: 'vm', label: 'Việc máy bật', value: `${du.viecMayBat}/${du.viecMay}`, sub: du.viecMayLoi ? <span style={{ color: '#f87171' }}>{du.viecMayLoi} lỗi</span> : 'không lỗi',
      onClick: du.viecMayLoi ? () => datVt('loi') : undefined, title: 'Timer và cron trên box3, box1 (máy dò mỗi 10 phút)' },
    { key: 'chi', label: `Chi API T${du.thang}`, value: tien(du.chiThang), sub: du.luotThang != null ? `${du.luotThang.toLocaleString('vi-VN')} lời gọi` : 'không nối được DB', title: 'Tiền gọi mô hình qua cổng của cty, tháng lịch này (sổ ai_usage)' },
    { key: 'phien', label: 'Phiên CLI hôm nay', value: du.phienNay, sub: `chi thật ${tien(du.usdPhienNay)}${du.goiPhienNay != null ? ` · gói ${tien(du.goiPhienNay)}` : ''}`, title: 'Phiên Claude Code của kỹ sư CLI · chi thật = tiền cổng AI trừ thật · gói = giá niêm yết API của phiên chạy gói, không phải tiền chi thêm' },
  ];
  return <StatsStrip cards={cards} minColWidth={92} />;
}
