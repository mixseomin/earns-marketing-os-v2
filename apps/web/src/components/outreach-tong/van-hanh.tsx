'use client';
// NGĂN VẬN HÀNH của outreach.on.tc (nhịp 2–4, 20/11/2026): tạo chiến dịch theo kiểu · nạp người nhận (nhà quảng cáo từ spy / dán danh sách) ·
// soạn chuỗi thư · gửi thử + bật tắt máy tự gửi. Hai ngăn kéo, cả hai nằm trên URL (F5 / gửi link mở lại đúng chỗ):
//   ?cdm=1 → ngăn tạo chiến dịch   ·   ?cd=<id>&cdt=<nap|soan|gui|chao> → ngăn vận hành một chiến dịch.
// Mọi lỗi của một lần bấm hiện thành ô báo ngay dưới nút vừa bấm (câu máy chủ trả), không nuốt vào console.
// Việc gửi thư THẬT cho người nhận không nằm ở đây: ngăn này chỉ gửi thử về địa chỉ của nhà; gửi thật là máy tự gửi của chiến dịch (bật ở thẻ Gửi)
// hoặc nút gửi từng thư ở trang outreach của dự án.
// Chữ trên mặt chỉ là nhãn ngắn; lời giải thích nằm sau dấu ℹ (InfoHint) hoặc trong hint của ô nhập.
// tra-repo-ok: màn điều khiển nội bộ dựng trên primitive nhà (Drawer, TextField, SelectField, Segmented, GuardedButton, InfoHint).
// ngan-moi-ok: chiến dịch outreach — đã tra (20/11/2026): trang outreach của dự án chỉ có form tạo / sửa chiến dịch nằm TRONG DÒNG (CampaignForm ở outreach-page.tsx,
//   không phải ngăn, không có kiểu theo sổ, ngách, nạp người nhận, soạn chuỗi thư, gửi thử); chưa có ngăn nào cho chiến dịch. Sửa TỪNG người nhận / từng thư vẫn mở đúng
//   ngăn sẵn có của trang dự án (link "sửa từng thư"), không dựng lại ở đây.
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, GuardedButton, InfoHint, Segmented, SelectField, TextAreaField, TextField } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import { KIEU, type MaKieu } from '@/lib/outreach/kieu';
import type { MotChienDich } from '@/lib/outreach/van-hanh';
import type { NgachSpy } from '@/lib/outreach/nap';
import type { LoiChao } from '@/lib/outreach/soan-thu';
import { obCachGui, obGuiThu, obLuuChao, obMotChienDich, obNapCsv, obNapSpy, obNgach, obSoan, obTao } from '@/lib/actions/outreach-he';

const DO = 'var(--bad, #f87171)', XANH = 'var(--neon-lime, #4ade80)', MO = 'var(--fg-3)';
const nut = { padding: '6px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-0)', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const;
const nutChinh = { ...nut, background: 'var(--accent)', color: 'var(--bg-0)', borderColor: 'var(--accent)' } as const;
/** ô báo kết quả của một lần bấm — đỏ khi lỗi, đứng ngay dưới nút */
const Bao = ({ loi, tin }: { loi?: string | null; tin?: ReactNode }) => (loi
  ? <div role="alert" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, border: `1px solid ${DO}`, color: DO, fontSize: 12 }}>{loi}</div>
  : tin ? <div role="status" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 12 }}>{tin}</div> : null);
/** tiêu đề mục + dấu ℹ mang lời giải thích (mặt chỉ có nhãn ngắn) */
const Dau = ({ children, giai }: { children: ReactNode; giai?: string }) => (
  <h4 style={{ margin: '18px 0 8px', fontSize: 11, color: MO, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>{children}{giai ? <InfoHint size={11}>{giai}</InfoHint> : null}</h4>);
const vnd = (usd: number) => `${Math.round(usd * 26_000).toLocaleString('vi-VN')}₫`;
const GIAI = {
  moi: 'Chiến dịch mới luôn ở chế độ gửi tay. Máy không gửi thư nào cho tới khi bật tự gửi trong ngăn vận hành.',
  ngach: 'Chọn ngách thì máy lấy các phát hiện của report ngách đó làm nội dung được phép nêu trong thư, và nạp được nhà quảng cáo của ngách.',
  spy: 'Thương hiệu còn chạy quảng cáo trong 21 ngày gần nhất, nhiều quảng cáo trước. Máy vào website từng thương hiệu tìm email liên hệ công khai; không thấy email thì không nạp.',
  chao: 'Máy soạn thư chỉ được nói những gì ghi ở đây về bên gửi, cộng với dữ kiện về quảng cáo của từng người nhận. Sửa lời chào không đổi thư đã soạn; muốn áp thì soạn lại.',
  soan: 'Mỗi người nhận một chuỗi ba thư (thư đầu, nhắc 1, nhắc 2) viết theo quảng cáo của chính họ. Soạn xong máy không gửi gì. Tiền mô hình vài chục đồng mỗi người, số thật hiện sau từng mẻ.',
  thu: 'Gửi thư đầu của người nhận đầu tiên qua đúng đường gửi thật. Không đổi trạng thái ai, không tính vào trần ngày.',
  tuGui: 'Khi bật: mỗi ngày lúc 21:00 giờ Việt Nam máy dò thư trả lời, gửi thư nhắc tới hạn, rồi gửi thư đầu cho người chờ gửi theo trần. Ai trả lời, xin thôi hoặc bị dội thì ra khỏi chuỗi.',
};

/** nút + ngăn tạo chiến dịch (đặt trên đầu Bảng chiến dịch) */
export function TaoChienDich({ duAn }: { duAn: string[] }) {
  const router = useRouter();
  const [mo, datMo] = useShallowParam('cdm', ''), [, datCd] = useShallowParam('cd', '');
  const [f, setF] = useState({ da: duAn.includes('anglebrief') ? 'anglebrief' : duAn[0] ?? '', ten: '', kieu: 'khach' as MaKieu, tuEmail: '', tuTen: '', tran: 10, spId: 0, benGui: '', kyTen: '', gocSite: '', banGi: '', gia: '' });
  const [ngach, setNgach] = useState<NgachSpy[] | null>(null), [loi, setLoi] = useState<string | null>(null), [dang, chay] = useTransition();
  const dat = (v: Partial<typeof f>) => setF((c) => ({ ...c, ...v }));
  const coNgach = (KIEU[f.kieu].nguon as readonly string[]).includes('spy_nha_qc');
  useEffect(() => { if (mo === '1' && coNgach && !ngach) void obNgach().then((r) => { if (r.ok) setNgach(r.ngach); else setLoi(r.loi); }); }, [mo, coNgach, ngach]);
  const sua = !!(f.ten || f.tuEmail || f.banGi);
  const thieu = !f.da ? 'Chọn dự án' : !f.ten.trim() ? 'Đặt tên chiến dịch' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.tuEmail.trim()) ? 'Nhập địa chỉ người gửi' : !f.tuTen.trim() ? 'Nhập tên người gửi'
    : f.spId && (!f.benGui.trim() || !f.kyTen.trim() || !f.gocSite.trim() || !f.banGi.trim()) ? 'Lấy lời chào từ report cần đủ: bên gửi, tên ký, địa chỉ site, một câu bán gì' : '';
  const tao = () => chay(async () => {
    setLoi(null);
    const r = await obTao({ ...f, spId: f.spId || undefined });
    if (!r.ok) { setLoi(r.loi); return; }
    datMo(''); datCd(String(r.id)); router.refresh();
  });
  return (<>
    <button type="button" style={nutChinh} onClick={() => datMo('1')} title="Tạo chiến dịch outreach mới cho một dự án">＋ Chiến dịch mới</button>
    {mo === '1' && (
      /* ngan-moi-ok: tạo chiến dịch outreach — đã tra, chưa có ngăn (form cũ nằm trong dòng của trang dự án) */
      <Drawer onClose={() => datMo('')} width={560} dirty={sua}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, display: 'flex', gap: 8, alignItems: 'center' }}>Chiến dịch outreach mới<InfoHint size={12}>{GIAI.moi}</InfoHint></h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <SelectField label="Dự án" required value={f.da} onChange={(e) => dat({ da: e.target.value })}>{duAn.map((d) => <option key={d} value={d}>{d}</option>)}</SelectField>
          <SelectField label="Kiểu" required value={f.kieu} onChange={(e) => dat({ kieu: e.target.value as MaKieu, spId: 0 })} hint={`Gửi cho: ${KIEU[f.kieu].nhan}. Tính thắng khi: ${KIEU[f.kieu].dich}.`}>
            {(Object.keys(KIEU) as MaKieu[]).map((k) => <option key={k} value={k}>{KIEU[k].ten}</option>)}
          </SelectField>
          <TextField label="Tên chiến dịch" required gridColumn="1 / -1" value={f.ten} onChange={(e) => dat({ ten: e.target.value })} placeholder="vd Hiking boots - thương hiệu đang quảng cáo" />
          <TextField label="Địa chỉ người gửi" required value={f.tuEmail} onChange={(e) => dat({ tuEmail: e.target.value })} placeholder="hello@anglebrief.net" hint="Tên miền của địa chỉ này phải có đường gửi ở màn Hạ tầng gửi." />
          <TextField label="Tên người gửi" required value={f.tuTen} onChange={(e) => dat({ tuTen: e.target.value })} placeholder="AngleBrief" />
          <TextField label="Thư đầu mỗi ngày (trần)" type="number" min={1} max={200} value={f.tran} onChange={(e) => dat({ tran: Number(e.target.value) || 1 })} hint="Số thư đầu máy được gửi mỗi ngày khi bật tự gửi. Trần của cả tên miền gửi chặn thêm một lớp." />
        </div>
        {coNgach && (<>
          <Dau giai={GIAI.ngach}>Lời chào từ report của một ngách</Dau>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <SelectField label="Ngách" gridColumn="1 / -1" value={f.spId} onChange={(e) => dat({ spId: Number(e.target.value) })}>
              <option value={0}>{ngach ? 'Không dùng report, tự viết lời chào sau' : 'đang đọc danh sách ngách…'}</option>
              {(ngach ?? []).map((n) => <option key={n.spId} value={n.spId}>{n.ten} · {n.nhaQc} nhà quảng cáo còn chạy</option>)}
            </SelectField>
            {f.spId > 0 && (<>
              <TextField label="Bên gửi" required value={f.benGui} onChange={(e) => dat({ benGui: e.target.value })} placeholder="AngleBrief" />
              <TextField label="Tên ký cuối thư" required value={f.kyTen} onChange={(e) => dat({ kyTen: e.target.value })} placeholder="tên người viết thư" />
              <TextField label="Địa chỉ site bán report" required value={f.gocSite} onChange={(e) => dat({ gocSite: e.target.value })} placeholder="https://anglebrief.net" />
              <TextField label="Giá nêu ở thư nhắc cuối" value={f.gia} onChange={(e) => dat({ gia: e.target.value })} placeholder="from $24, one-time" />
              <TextAreaField label="Bán gì cho ai (một câu tiếng Anh)" required gridColumn="1 / -1" value={f.banGi} onChange={(e) => dat({ banGi: e.target.value })} hint="Máy soạn thư dùng nguyên văn câu này để giới thiệu bên gửi." />
            </>)}
          </div>
        </>)}
        <div style={{ marginTop: 16 }}>
          <GuardedButton reason={dang ? 'Đang tạo…' : thieu} style={nutChinh} onClick={tao}>{dang ? 'Đang tạo…' : 'Tạo chiến dịch'}</GuardedButton>
          <Bao loi={loi} />
        </div>
      </Drawer>
    )}
  </>);
}

type The = 'nap' | 'soan' | 'gui' | 'chao';
/** ngăn vận hành một chiến dịch — tự mở theo ?cd=<id>; đặt MỘT lần trong Bảng chiến dịch */
export function NganChienDich({ emailNha }: { emailNha: string }) {
  const router = useRouter();
  const [cdP, datCd] = useShallowParam('cd', ''), [theP, datThe] = useShallowParam('cdt', '');
  const id = /^\d+$/.test(cdP) ? Number(cdP) : 0, the: The = (['nap', 'soan', 'gui', 'chao'] as The[]).includes(theP as The) ? (theP as The) : 'nap';
  const [cd, setCd] = useState<MotChienDich | null>(null), [loiDoc, setLoiDoc] = useState<string | null>(null);
  const doc = async () => { if (!id) return; const r = await obMotChienDich(id); if (r.ok) { setCd(r.cd); setLoiDoc(null); } else setLoiDoc(r.loi); };
  useEffect(() => { setCd(null); setLoiDoc(null); if (id) void doc(); }, [id]);
  if (!id) return null;
  const dong = () => { datCd(''); datThe(''); router.refresh(); };
  const kieu = cd ? KIEU[(Object.prototype.hasOwnProperty.call(KIEU, cd.kieu) ? cd.kieu : 'khac') as MaKieu].ten : '';
  return (
    /* ngan-moi-ok: vận hành chiến dịch outreach (nạp · lời chào · soạn · gửi) — đã tra, chưa có ngăn */
    <Drawer onClose={dong} width={760}>
      {loiDoc ? <Bao loi={loiDoc} /> : !cd ? <p style={{ color: MO, fontSize: 12 }}>đang đọc chiến dịch…</p> : (<>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{cd.ten}</h3>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--fg-2)' }} title={`gửi từ ${cd.tuTen ? `${cd.tuTen} ` : ''}${cd.tuEmail ?? 'chưa đặt'}`}>
          {cd.da} · {kieu} · {cd.n} người nhận · {cd.daGui} đã gửi · {cd.traLoi} trả lời ·{' '}
          <a href={`/p/${cd.da}/outreach?c=${cd.id}`} style={{ color: 'var(--accent)' }} title="Đọc và sửa từng thư ở trang outreach của dự án">sửa từng thư</a>
        </p>
        <Segmented size="sm" value={the} onChange={(v) => datThe(v === 'nap' ? '' : v)} options={[
          { value: 'nap', label: 'Nạp người nhận', title: `${cd.n} người nhận` }, { value: 'chao', label: 'Lời chào' },
          { value: 'soan', label: 'Soạn thư', title: `${cd.coChuoi}/${cd.n} người đã có chuỗi thư` }, { value: 'gui', label: 'Gửi', title: cd.tuGui ? 'tự gửi đang bật' : 'đang gửi tay' }]} />
        {the === 'nap' && <TheNap cd={cd} xong={doc} />}
        {the === 'chao' && <TheChao cd={cd} xong={doc} />}
        {the === 'soan' && <TheSoan cd={cd} xong={doc} />}
        {the === 'gui' && <TheGui cd={cd} xong={doc} emailNha={emailNha} />}
      </>)}
    </Drawer>
  );
}

function TheNap({ cd, xong }: { cd: MotChienDich; xong: () => Promise<void> }) {
  const [so, setSo] = useState(25), [csv, setCsv] = useState('');
  const [tin, setTin] = useState<ReactNode>(null), [loi, setLoi] = useState<string | null>(null), [dang, setDang] = useState(false);
  const [tinCsv, setTinCsv] = useState<ReactNode>(null), [loiCsv, setLoiCsv] = useState<string | null>(null), [dangCsv, chayCsv] = useTransition();
  // nạp từ spy theo MẺ: mỗi lượt gọi dò web ~40 giây → gọi lặp tới khi đủ số, hiện tiến độ sau từng mẻ; hết ứng viên hoặc lỗi thì dừng và nói rõ
  const napSpy = async () => {
    if (!cd.ngach) return;
    setDang(true); setLoi(null); let them = 0, khong = 0, luot = 0;
    try {
      while (them < so && luot < 30) {
        luot++;
        const r = await obNapSpy(cd.id, cd.ngach.spId, Math.min(25, so - them));
        if (!r.ok) { setLoi(r.loi ?? 'Máy chủ không trả lý do.'); break; }
        them += r.them; khong += r.khongEmail;
        setTin(<>Đã nạp <b>{them}</b>/{so} · {khong} không có email công khai · còn {r.conLai} ứng viên{them < so && r.conLai > 0 ? ' · đang dò tiếp…' : ''}</>);
        if (r.conLai <= 0 || r.xet === 0) break;
      }
    } finally { setDang(false); await xong(); }
  };
  return (<>
    <Dau giai={GIAI.spy}>Nhà quảng cáo từ kho spy</Dau>
    {cd.ngach ? (<>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <TextField label={`Nạp thêm · ngách ${cd.ngach.ten}`} type="number" min={1} max={200} value={so} onChange={(e) => setSo(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} style={{ width: 160 }} hint={`Đã xét ${cd.daXet} tên miền của ngách này.`} />
        <GuardedButton reason={dang ? 'Đang dò website các thương hiệu…' : ''} style={nutChinh} onClick={napSpy}>{dang ? 'Đang dò…' : 'Nạp từ spy'}</GuardedButton>
      </div>
      <Bao loi={loi} tin={tin} />
    </>) : <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-2)' }} title="Ngách được chọn lúc tạo chiến dịch">Chiến dịch không gắn ngách nào của kho spy.</p>}
    <Dau>Dán danh sách</Dau>
    <TextAreaField label="Mỗi dòng: tên, email, website" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'Trail Co, hello@trailco.com, trailco.com'} style={{ minHeight: 110, fontFamily: 'var(--font-mono)' }} />
    <div style={{ marginTop: 8 }}>
      <GuardedButton reason={dangCsv ? 'Đang nạp…' : !csv.trim() ? 'Dán danh sách trước' : ''} style={nut}
        onClick={() => chayCsv(async () => { setLoiCsv(null); const r = await obNapCsv(cd.id, csv); if (!r.ok) setLoiCsv(r.loi ?? 'Máy chủ không trả lý do.'); else { setTinCsv(<>Đã nạp <b>{r.them}</b> · {r.daCo} đã có sẵn · {r.hong} dòng thiếu email</>); setCsv(''); } await xong(); })}>Nạp danh sách</GuardedButton>
      <Bao loi={loiCsv} tin={tinCsv} />
    </div>
  </>);
}

function TheChao({ cd, xong }: { cd: MotChienDich; xong: () => Promise<void> }) {
  const c0: LoiChao = cd.chao ?? { ben_gui: '', ky_ten: '', ban_gi: '', phat_hien: [] };
  const [c, setC] = useState({ ...c0, ph: c0.phat_hien.join('\n') }), [loi, setLoi] = useState<string | null>(null), [tin, setTin] = useState<ReactNode>(null), [dang, chay] = useTransition();
  const dat = (v: Partial<typeof c>) => setC((x) => ({ ...x, ...v }));
  const sua = JSON.stringify({ ...c0, ph: c0.phat_hien.join('\n') }) !== JSON.stringify(c);
  return (<>
    <Dau giai={GIAI.chao}>Điều máy được nói về bên gửi</Dau>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <TextField label="Bên gửi" required value={c.ben_gui} onChange={(e) => dat({ ben_gui: e.target.value })} />
      <TextField label="Tên ký cuối thư" required value={c.ky_ten} onChange={(e) => dat({ ky_ten: e.target.value })} />
      <TextAreaField label="Bán gì cho ai (một câu tiếng Anh)" required gridColumn="1 / -1" value={c.ban_gi} onChange={(e) => dat({ ban_gi: e.target.value })} />
      <TextAreaField label="Phát hiện được nêu (mỗi dòng một cái)" required gridColumn="1 / -1" value={c.ph} onChange={(e) => dat({ ph: e.target.value })} style={{ minHeight: 170 }} hint="Thư đầu chọn một phát hiện hợp nhất với quảng cáo của người nhận, thư nhắc 1 chọn một cái khác." />
      <TextField label="Các phát hiện dựa trên" gridColumn="1 / -1" value={c.co_so ?? ''} onChange={(e) => dat({ co_so: e.target.value })} />
      <TextField label="Link miễn phí (thư đầu)" value={c.link_mien_phi ?? ''} onChange={(e) => dat({ link_mien_phi: e.target.value })} />
      <TextField label="Link trang bán (thư nhắc cuối)" value={c.link_ban ?? ''} onChange={(e) => dat({ link_ban: e.target.value })} />
      <TextField label="Giá nêu ở thư nhắc cuối" value={c.gia ?? ''} onChange={(e) => dat({ gia: e.target.value })} />
    </div>
    <div style={{ marginTop: 12 }}>
      <GuardedButton reason={dang ? 'Đang lưu…' : !sua ? 'Chưa sửa gì' : ''} style={nutChinh} onClick={() => chay(async () => {
        setLoi(null); setTin(null);
        const { ph, ...rest } = c;
        const r = await obLuuChao(cd.id, { ...rest, phat_hien: ph.split('\n'), link_mien_phi: rest.link_mien_phi?.trim() || undefined, link_ban: rest.link_ban?.trim() || undefined, gia: rest.gia?.trim() || undefined, co_so: rest.co_so?.trim() || undefined });
        if (!r.ok) setLoi(r.loi); else { setTin('Đã lưu lời chào.'); await xong(); }
      })}>Lưu lời chào</GuardedButton>
      <Bao loi={loi} tin={tin} />
    </div>
  </>);
}

function TheSoan({ cd, xong }: { cd: MotChienDich; xong: () => Promise<void> }) {
  const thieu = cd.n - cd.coChuoi;
  const [tin, setTin] = useState<ReactNode>(null), [loi, setLoi] = useState<string | null>(null), [dang, setDang] = useState(false), [mo, setMo] = useState<number | null>(cd.nhap[0]?.id ?? null);
  // soạn theo MẺ 5 người: mỗi mẻ một lượt gọi máy chủ, hiện số đã xong + tiền thật sau từng mẻ; mẻ nào không soạn được thư nào thì dừng và in lỗi đầu tiên
  const soan = async () => {
    setDang(true); setLoi(null); let xongN = 0, hong = 0, usd = 0;
    try {
      for (let luot = 0; luot < 60; luot++) {
        const r = await obSoan(cd.id, 5);
        if (!r.ok) { setLoi(r.loi ?? 'Máy chủ không trả lý do.'); break; }
        xongN += r.xong; hong += r.hong; usd += r.usd;
        setTin(<>Đã soạn <b>{xongN}</b> · {hong} chưa viết được · còn {r.con} người · ~{vnd(usd)}{r.con > 0 && r.xong > 0 ? ' · đang soạn tiếp…' : ''}</>);
        if (r.con <= 0) break;
        if (r.xong === 0) { setLoi(`Mẻ vừa rồi không soạn được thư nào nên máy dừng. Lỗi đầu tiên: ${r.loiDau ?? 'không rõ'}`); break; }
      }
    } finally { setDang(false); await xong(); }
  };
  return (<>
    <Dau giai={GIAI.soan}>Chuỗi ba thư cho từng người</Dau>
    <GuardedButton reason={dang ? 'Đang soạn…' : !cd.chao ? 'Chiến dịch chưa có lời chào (thẻ Lời chào)' : thieu <= 0 ? 'Mọi người nhận đã có chuỗi thư' : ''} style={nutChinh} onClick={soan}>{dang ? 'Đang soạn…' : `Soạn cho ${Math.max(0, thieu)} người chưa có thư`}</GuardedButton>
    <Bao loi={loi} tin={tin} />
    <Dau>Thư nháp · {cd.nhap.length} người đầu đang chờ gửi</Dau>
    {cd.nhap.length ? cd.nhap.map((p) => (
      <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 6, marginBottom: 6 }}>
        <button type="button" onClick={() => setMo(mo === p.id ? null : p.id)} aria-expanded={mo === p.id} title={`${p.email}${p.soQc ? ` · ${p.soQc} quảng cáo` : ''}`}
          style={{ display: 'flex', width: '100%', gap: 8, padding: '7px 10px', background: 'none', border: 0, color: 'var(--fg-0)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
          <span>{mo === p.id ? '▾' : '▸'}</span><b>{p.ten}</b><span style={{ marginLeft: 'auto', color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.chuoi[0]?.tieu_de}</span>
        </button>
        {mo === p.id && <div style={{ padding: '0 10px 10px', display: 'grid', gap: 8 }}>{p.chuoi.map((t, i) => (
          <div key={i}><div style={{ fontSize: 10, color: MO, textTransform: 'uppercase', letterSpacing: '0.06em' }} title={i === 0 ? undefined : 'nối cùng luồng thư với thư đầu'}>{i === 0 ? `Thư đầu · ${t.tieu_de}` : `Thư nhắc ${i} · sau ${cd.cachNgay * i} ngày`}</div>
            <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', font: '12px/1.5 var(--font-sans)', color: 'var(--fg-1)' }}>{t.noi_dung}</pre></div>))}</div>}
      </div>)) : <p style={{ margin: 0, fontSize: 12, color: MO }}>Chưa có thư nháp nào.</p>}
  </>);
}

function TheGui({ cd, xong, emailNha }: { cd: MotChienDich; xong: () => Promise<void>; emailNha: string }) {
  const [toi, setToi] = useState(emailNha), [tran, setTran] = useState(cd.tran);
  const [loi, setLoi] = useState<string | null>(null), [tin, setTin] = useState<ReactNode>(null), [dang, chay] = useTransition();
  const [loi2, setLoi2] = useState<string | null>(null), [tin2, setTin2] = useState<ReactNode>(null), [dang2, chay2] = useTransition(), [chac, setChac] = useState(false);
  const datGui = (tuGui: boolean) => chay2(async () => {
    setLoi2(null); setTin2(null); setChac(false);
    const r = await obCachGui(cd.id, { tuGui, tran });
    if (!r.ok) setLoi2(r.loi); else { setTin2(tuGui ? `Đã bật tự gửi, tối đa ${tran} thư đầu mỗi ngày, lượt kế 21:00.` : 'Đã tắt tự gửi.'); await xong(); }
  });
  return (<>
    <Dau giai={GIAI.thu}>Gửi thử về địa chỉ của nhà</Dau>
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <TextField label="Gửi tới" value={toi} onChange={(e) => setToi(e.target.value)} style={{ width: 260 }} />
      <GuardedButton reason={dang ? 'Đang gửi…' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toi.trim()) ? 'Nhập địa chỉ nhận thư thử' : cd.coChuoi === 0 ? 'Chưa có thư nháp (thẻ Soạn thư)' : ''} style={nut}
        onClick={() => chay(async () => { setLoi(null); setTin(null); const r = await obGuiThu(cd.id, toi.trim()); if (!r.ok) setLoi(r.loi); else setTin(<>Đã gửi thử thư của <b>{r.ten}</b> tới {toi.trim()}.</>); })}>Gửi thử</GuardedButton>
    </div>
    <Bao loi={loi} tin={tin} />
    <Dau giai={`${GIAI.tuGui} Thư nhắc cách nhau ${cd.cachNgay} ngày, tối đa ${cd.soNhac} lần.`}>Máy tự gửi · {cd.tuGui ? <b style={{ color: XANH }}>đang bật</b> : 'đang tắt'}</Dau>
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <TextField label="Thư đầu mỗi ngày (trần)" type="number" min={1} max={200} value={tran} onChange={(e) => setTran(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} style={{ width: 120 }} />
      {cd.tuGui ? <GuardedButton reason={dang2 ? 'Đang lưu…' : ''} style={nut} onClick={() => datGui(false)}>Tắt tự gửi</GuardedButton>
        : chac ? <><b style={{ fontSize: 12, color: DO }}>Gửi thư thật cho {cd.choGui} người từ 21:00 hôm nay?</b>
            <GuardedButton reason={dang2 ? 'Đang lưu…' : ''} style={{ ...nut, borderColor: DO, color: DO }} onClick={() => datGui(true)}>Bật tự gửi</GuardedButton><button type="button" style={nut} onClick={() => setChac(false)}>Thôi</button></>
          : <GuardedButton reason={cd.choGui === 0 ? 'Không có ai chờ gửi' : cd.coChuoi === 0 ? 'Chưa có thư nháp (thẻ Soạn thư)' : ''} style={nut} onClick={() => setChac(true)}>Bật tự gửi…</GuardedButton>}
      {cd.tuGui && tran !== cd.tran && <GuardedButton reason={dang2 ? 'Đang lưu…' : ''} style={nut} onClick={() => datGui(true)}>Lưu trần mới</GuardedButton>}
    </div>
    <Bao loi={loi2} tin={tin2} />
  </>);
}
