// POST /api/ext/outreach  {viec, …} — cổng lệnh của hệ outreach (khoá MOS2_EXT_KEY như mọi /api/ext): dòng lệnh chạy ĐÚNG lõi mà màn outreach.on.tc bấm
// (lib/outreach/van-hanh.ts, nap.ts, soan-thu.ts, thu-den.ts). viec:
//   ngach                                    → ngách có report + số nhà quảng cáo còn chạy (kho spy)
//   chao-report {sp_id, ben_gui, ky_ten, goc_site, ban_gi, gia?}   → lời chào dựng từ report của ngách
//   tao {da, ten, kieu, tu_email, tu_ten, tran?, cach_ngay?, so_nhac?, chao?, ngach?}
//   nap-spy {cd, sp_id, so}  ·  nap-csv {cd, chu}  ·  soan {cd, so, lai?, lam_lai?}  ·  xem {cd, so_nhap?}
//   ds {da?} · nguoi {cd, tt?, so?} · thu {so?} · phanh · duong-gui  (đọc gọn cho dòng lệnh ~/bin/outreach)  ·  chao {cd, patch} · duong-gui-sua {mien, chan_thu?, tra_loi?, tran_ngay?, bat?}
//   gui-thu {cd, toi, prospect?}  ·  cach-gui {cd, tu_gui?, tran?, so_nhac?, cach_ngay?, chay?}  ·  thu-den {so_ngay?}
// Không viec nào ở đây gửi thư cho người nhận thật: gửi thật chỉ qua nút gửi của trang outreach dự án hoặc máy tự gửi của chiến dịch đã bật.
import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { chaoTuReport, datCachGui, docMotChienDich, dsNguoi, guiThuThu, suaChao, suaDuongGui, taoChienDich } from '@/lib/outreach/van-hanh';
import { docChienDich, docThuDen } from '@/lib/outreach/du-lieu';
import { dsDuongGui, kiemDns, kiemDuongGui } from '@/lib/outreach/gui';
import { docPhanh } from '@/lib/outreach/phanh';
import { dsNgachSpy, napCsv, napTuSpy } from '@/lib/outreach/nap';
import { soanChuoi } from '@/lib/outreach/soan-thu';
import { doThuDen } from '@/lib/outreach/thu-den';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = await checkAuth(req); if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const so = (k: string, mac = 0) => (Number.isFinite(Number(b[k])) ? Number(b[k]) : mac), chu = (k: string) => String(b[k] ?? '');
  try {
    switch (chu('viec')) {
      case 'ngach': return NextResponse.json({ ok: true, ngach: await dsNgachSpy() });
      case 'chao-report': return NextResponse.json(await chaoTuReport(so('sp_id'), { benGui: chu('ben_gui'), kyTen: chu('ky_ten'), gocSite: chu('goc_site'), banGi: chu('ban_gi'), gia: chu('gia') || undefined }));
      case 'tao': return NextResponse.json(await taoChienDich({ da: chu('da'), ten: chu('ten'), kieu: chu('kieu'), tuEmail: chu('tu_email'), tuTen: chu('tu_ten'), tran: b.tran == null ? undefined : so('tran'),
        cachNgay: b.cach_ngay == null ? undefined : so('cach_ngay'), soNhac: b.so_nhac == null ? undefined : so('so_nhac'), chao: (b.chao as never) ?? null, ngach: (b.ngach as never) ?? null }));
      case 'nap-spy': return NextResponse.json(await napTuSpy(so('cd'), so('sp_id'), Math.max(1, Math.min(200, so('so', 10)))));
      case 'nap-csv': return NextResponse.json(await napCsv(so('cd'), chu('chu')));
      case 'soan': return NextResponse.json(await soanChuoi(so('cd'), so('so', 5), b.lai == null ? undefined : so('lai'), b.lam_lai === true));
      case 'xem': return NextResponse.json({ ok: true, cd: await docMotChienDich(so('cd'), so('so_nhap', 5)) });
      case 'gui-thu': return NextResponse.json(await guiThuThu(so('cd'), chu('toi'), b.prospect == null ? undefined : so('prospect')));
      case 'cach-gui': return NextResponse.json(await datCachGui(so('cd'), { tuGui: typeof b.tu_gui === 'boolean' ? b.tu_gui : undefined, tran: b.tran == null ? undefined : so('tran'), soNhac: b.so_nhac == null ? undefined : so('so_nhac'), cachNgay: b.cach_ngay == null ? undefined : so('cach_ngay'), chay: typeof b.chay === 'boolean' ? b.chay : undefined }));
      case 'thu-den': return NextResponse.json(await doThuDen(so('so_ngay', 30)));
      // ---- đọc gọn cho dòng lệnh ~/bin/outreach
      case 'ds': return NextResponse.json({ ok: true, cd: (await docChienDich()).filter((c) => !chu('da') || c.da === chu('da')) });
      case 'nguoi': return NextResponse.json({ ok: true, nguoi: await dsNguoi(so('cd'), chu('tt') || null, so('so', 100)) });
      case 'thu': return NextResponse.json({ ok: true, thu: (await docThuDen()).slice(0, so('so', 30)) });
      case 'phanh': return NextResponse.json({ ok: true, phanh: await docPhanh() });
      case 'duong-gui': { const ds = await dsDuongGui(); return NextResponse.json({ ok: true, duong: await Promise.all(ds.map(async (d) => ({ mien: d.mien, host: d.host, bat: d.bat, homNay: d.homNay, tranHomNay: d.tranHomNay, tranNgay: d.tranNgay, traLoi: d.traLoi, chanThu: d.chanThu, thieu: kiemDuongGui(d), dns: await kiemDns(d.mien, d.dkimSelector) }))) }); }
      // ---- sửa thiết lập
      case 'chao': return NextResponse.json(await suaChao(so('cd'), (b.patch ?? {}) as never));
      case 'duong-gui-sua': return NextResponse.json(await suaDuongGui(chu('mien'), { chanThu: b.chan_thu == null ? undefined : chu('chan_thu'), traLoi: b.tra_loi == null ? undefined : chu('tra_loi'), tranNgay: b.tran_ngay == null ? undefined : so('tran_ngay'), bat: typeof b.bat === 'boolean' ? b.bat : undefined }));
      default: return NextResponse.json({ ok: false, loi: 'viec không có: ds · xem · nguoi · thu · phanh · duong-gui · ngach · chao-report · tao · nap-spy · nap-csv · soan · gui-thu · cach-gui · chao · duong-gui-sua · thu-den' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, loi: String((e as Error).message ?? e).slice(0, 300) }, { status: 500 });
  }
}
