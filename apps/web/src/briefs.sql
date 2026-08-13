-- Nối account (Page) ↔ nhóm đã tham gia bằng bảng SẴN CÓ community_briefs (account_id × habitat_id,
-- có join_status/joined_at/join_url/join_note). Không đẻ bảng mới cho việc đã có chỗ.
insert into community_briefs (tenant_id, project_id, account_id, habitat_id, join_status, joined_at, join_url, join_note)
select 'self', 'militarycalc', 390, h.id,
  case when h.status = 'joined' then 'joined' else 'pending' end,
  case when h.status = 'joined' then now() else null end,
  h.url,
  case when h.status = 'joined'
    then 'Page tự vào được, KHÔNG cần profile cá nhân (thử thật 14/08). Hộp soạn trong nhóm đứng tên MilitaryCalc.'
    else 'Nhóm kín — đã gửi yêu cầu 14/08 bằng danh nghĩa Page, chờ duyệt.' end
from habitats h
where h.project_id = 'militarycalc' and h.platform_key = 'facebook'
  and h.url like 'https://www.facebook.com/groups/%'
  and not exists (select 1 from community_briefs b where b.account_id = 390 and b.habitat_id = h.id);
