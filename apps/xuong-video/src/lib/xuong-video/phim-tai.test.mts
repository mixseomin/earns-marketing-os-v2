import { strict as t } from 'node:assert';
import { loiPhim } from './phim-tai';

t.equal(loiPhim(null, null), null, 'bài không dùng phim → bỏ qua');
t.equal(loiPhim(219591, 'https://www.reelshort.com/episodes/episode-1-abc'), null, 'ReelShort hợp lệ');
t.equal(loiPhim(219590, 'https://netshort.com/episode/abc'), null, 'NetShort hợp lệ');
t.equal(loiPhim(1, 'https://www.dramaboxdb.com/en/ep/1_x/2_Episode-1'), null, 'DramaBox hợp lệ');
t.match(loiPhim(219774, 'https://www.flickreels.net/playlist/called-a-jinx/14928/episode-1') ?? '', /flickreels\.net.*chưa tải được tập/, 'flickreels bị chặn ngay từ cổng nạp');
t.match(loiPhim(219774, '') ?? '', /chưa có link/, 'phim thiếu link bị chặn');
t.match(loiPhim(219774, 'rác') ?? '', /chưa tải được tập/, 'link rác bị chặn, không nổ');
console.log('✓ phim-tai: chỉ nạp phim có nguồn tải được tập (ReelShort / NetShort / DramaBox)');
