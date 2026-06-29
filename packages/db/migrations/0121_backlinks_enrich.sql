-- Enrich backlink node: expose source_url + metrics (DA/dofollow/traffic/rank/mechanism)
-- + per-site status (site_status) from human_tasks.prep_payload. All idempotent.

-- 1) View with prep_payload extractions + derived applies_to + site_status.
-- DROP+CREATE (not REPLACE): new columns inserted before applies_to → column order changes.
DROP VIEW IF EXISTS backlinks;
CREATE VIEW backlinks AS
  SELECT id, project_id, title, status, publish_url, screenshot_url, claimed_by,
         instructions, notes, created_at, updated_at,
         prep_payload->>'source_url' AS source_url,
         prep_payload->>'da'         AS da,
         prep_payload->>'dofollow'   AS dofollow,
         prep_payload->>'traffic'    AS traffic,
         prep_payload->>'rank'       AS rank,
         prep_payload->>'mechanism'  AS mechanism,
         COALESCE(prep_payload->'site_status', '{}'::jsonb) AS site_status,
         CASE WHEN title ~* '(Featured|Qwoted|Source of Sources|YouTube|Hacker News|HackerNoon|Indie Hackers|Cool Tools|Substack|Flipboard|Pinterest|Softpedia|WebCatalog|MentionMatch|SourceBottle|JournoRequest|dev\.to|WordPress|Crunchbase|Product Hunt|AlternativeTo|SaaSHub|Medium|LinkedIn|Quora|llms|BetaList|Wikidata|GitHub)'
              THEN '["militarycalc","govcalcs","visagps"]'::jsonb
              ELSE jsonb_build_array(project_id)
         END AS applies_to
  FROM human_tasks
  WHERE platform_key = 'backlink';

-- 2) Per-task metadata (merge into prep_payload). Harmless if a row id is absent.
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://featured.com","da":"high","dofollow":"dofollow","traffic":"high","rank":1,"mechanism":"expert Q&A republished by media"}'::jsonb WHERE id = 39;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://qwoted.com","da":"high","dofollow":"dofollow","traffic":"high","rank":1,"mechanism":"journalist source profile + answers"}'::jsonb WHERE id = 40;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://sourceofsources.com","da":"high","dofollow":"dofollow","traffic":"high","rank":1,"mechanism":"answer journalist queries, cited"}'::jsonb WHERE id = 41;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.fedweek.com/forum/","da":"high","dofollow":"mixed","traffic":"high","rank":1,"mechanism":"answer FERS/TSP/pay threads"}'::jsonb WHERE id = 42;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://hackernoon.com","da":"high","dofollow":"mixed","traffic":"medium","rank":2,"mechanism":"contributor explainer, contextual link"}'::jsonb WHERE id = 43;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.indiehackers.com","da":"high","dofollow":"mixed","traffic":"medium","rank":2,"mechanism":"product page + build-in-public post"}'::jsonb WHERE id = 44;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://kk.org/cooltools/submit-a-tool/","da":"high","dofollow":"mixed","traffic":"medium","rank":2,"mechanism":"submit-a-tool first-person review"}'::jsonb WHERE id = 45;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://substack.com","da":"high","dofollow":"mixed","traffic":"medium","rank":2,"mechanism":"own publication + Notes in-text links"}'::jsonb WHERE id = 46;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://flipboard.com","da":"high","dofollow":"mixed","traffic":"medium","rank":2,"mechanism":"own curated magazine, outbound clicks"}'::jsonb WHERE id = 47;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.springshare.com/libguides/","da":"high","dofollow":"dofollow","traffic":"low","rank":4,"mechanism":"email librarian to add to box"}'::jsonb WHERE id = 48;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://mentionmatch.com","da":"med","dofollow":"dofollow","traffic":"low","rank":4,"mechanism":"answer finance queries with link"}'::jsonb WHERE id = 49;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.sourcebottle.com","da":"med","dofollow":"dofollow","traffic":"low","rank":4,"mechanism":"reply to twice-daily call alerts"}'::jsonb WHERE id = 50;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://journorequest.bsky.social","da":"high","dofollow":"mixed","traffic":"low","rank":4,"mechanism":"monitor hashtags, fast reply with stat"}'::jsonb WHERE id = 51;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://wordpress.org/plugins/developers/add/","da":"100","dofollow":"dofollow","traffic":"medium","rank":2,"mechanism":"submit free plugin, readme links site"}'::jsonb WHERE id = 14;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.crunchbase.com","da":"91","dofollow":"dofollow","traffic":"medium","rank":2,"mechanism":"add company, website field"}'::jsonb WHERE id = 15;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://dev.to/new","da":"90","dofollow":"dofollow","traffic":"medium","rank":2,"mechanism":"publish article, canonical to tool"}'::jsonb WHERE id = 16;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.producthunt.com/posts/new","da":"91","dofollow":"mixed","traffic":"high","rank":2,"mechanism":"launch product, listing link"}'::jsonb WHERE id = 17;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://alternativeto.net","da":"87","dofollow":"mixed","traffic":"medium","rank":2,"mechanism":"suggest app as alternative"}'::jsonb WHERE id = 18;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.saashub.com/submit","da":"72","dofollow":"dofollow","traffic":"medium","rank":2,"mechanism":"free submit form"}'::jsonb WHERE id = 19;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://medium.com/new-story","da":"95","dofollow":"nofollow","traffic":"medium","rank":2,"mechanism":"publish article, canonical to tool"}'::jsonb WHERE id = 20;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.linkedin.com","da":"98","dofollow":"mixed","traffic":"medium","rank":2,"mechanism":"company page + published article"}'::jsonb WHERE id = 21;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.quora.com","da":"92","dofollow":"nofollow","traffic":"medium","rank":2,"mechanism":"answer questions, link calc, AI-cited"}'::jsonb WHERE id = 22;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://money.stackexchange.com","da":"92","dofollow":"nofollow","traffic":"medium","rank":2,"mechanism":"answer military-pay questions"}'::jsonb WHERE id = 23;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://directory.llmstxt.cloud","da":"low","dofollow":"dofollow","traffic":"low","rank":3,"mechanism":"submit llms.txt to directory"}'::jsonb WHERE id = 24;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.calculator.net","da":"mixed","dofollow":"mixed","traffic":"low","rank":3,"mechanism":"submit to free-tool list forms"}'::jsonb WHERE id = 25;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.reddit.com/r/MilitaryFinance/","da":"91","dofollow":"nofollow","traffic":"medium","rank":2,"mechanism":"get into subreddit tool wiki, AI-cited"}'::jsonb WHERE id = 26;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.rallypoint.com","da":"65","dofollow":"mixed","traffic":"low","rank":3,"mechanism":"profile + share useful posts"}'::jsonb WHERE id = 27;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.govloop.com","da":"75","dofollow":"mixed","traffic":"low","rank":3,"mechanism":"profile + blog post"}'::jsonb WHERE id = 28;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://en.wikipedia.org","da":"100","dofollow":"nofollow","traffic":"medium","rank":3,"mechanism":"add external link, high revert risk"}'::jsonb WHERE id = 29;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.slant.co","da":"80","dofollow":"mixed","traffic":"low","rank":3,"mechanism":"recommend as best pay calculator"}'::jsonb WHERE id = 30;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://themilitarywallet.com","da":"med","dofollow":"mixed","traffic":"low","rank":3,"mechanism":"suggest tool on resources pages"}'::jsonb WHERE id = 31;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.pebforum.com","da":"med","dofollow":"dofollow","traffic":"high","rank":1,"mechanism":"signature link + answer rating threads"}'::jsonb WHERE id = 32;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.youtube.com","da":"high","dofollow":"nofollow","traffic":"high","rank":1,"mechanism":"BAH explainer, tool link in description"}'::jsonb WHERE id = 33;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://news.ycombinator.com/submit","da":"high","dofollow":"mixed","traffic":"high","rank":2,"mechanism":"Show HN launch, fast first replies"}'::jsonb WHERE id = 34;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.springshare.com/libguides/","da":"high","dofollow":"dofollow","traffic":"low","rank":4,"mechanism":"email librarian to add to guide"}'::jsonb WHERE id = 35;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://varc.sdes.ucf.edu/resources/","da":"high","dofollow":"dofollow","traffic":"low","rank":4,"mechanism":"email VRC coordinator to add resource"}'::jsonb WHERE id = 36;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.softpedia.com/user/submit.shtml","da":"high","dofollow":"dofollow","traffic":"low","rank":4,"mechanism":"free submit form, editorial listing"}'::jsonb WHERE id = 37;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://webcatalog.io/apps/submit","da":"med","dofollow":"dofollow","traffic":"low","rank":4,"mechanism":"free self-serve submit, dofollow link"}'::jsonb WHERE id = 38;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.expat.com/en/forum/north-america/usa/","da":"high","dofollow":"nofollow","traffic":"high","rank":1,"mechanism":"answers + signature link"}'::jsonb WHERE id = 52;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://forums.immigration.com","da":"high","dofollow":"nofollow","traffic":"high","rank":1,"mechanism":"answers + profile signature"}'::jsonb WHERE id = 53;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.visajourney.com/forums/","da":"high","dofollow":"nofollow","traffic":"high","rank":1,"mechanism":"answers + low-key signature"}'::jsonb WHERE id = 54;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.recomendo.com/about","da":"med","dofollow":"mixed","traffic":"medium","rank":2,"mechanism":"submit recommendation via form"}'::jsonb WHERE id = 55;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://www.pinterest.com/business/create/","da":"high","dofollow":"nofollow","traffic":"medium","rank":2,"mechanism":"business profile + checklist Pins"}'::jsonb WHERE id = 56;
UPDATE human_tasks SET prep_payload = prep_payload || '{"source_url":"https://guides.mysapl.org/uscitizenship","da":"high","dofollow":"dofollow","traffic":"low","rank":4,"mechanism":"email librarian to add web resource"}'::jsonb WHERE id = 57;

-- 3) Init per-site status from applies_to (only if not already set). site = its own site → mirror
--    current scalar status; other applicable sites → 'pending'. Source of truth for Option B pills.
UPDATE human_tasks h SET prep_payload = prep_payload || jsonb_build_object('site_status', (
  SELECT jsonb_object_agg(site, CASE WHEN site = h.project_id THEN h.status ELSE 'pending' END)
  FROM jsonb_array_elements_text(
    CASE WHEN h.title ~* '(Featured|Qwoted|Source of Sources|YouTube|Hacker News|HackerNoon|Indie Hackers|Cool Tools|Substack|Flipboard|Pinterest|Softpedia|WebCatalog|MentionMatch|SourceBottle|JournoRequest|dev\.to|WordPress|Crunchbase|Product Hunt|AlternativeTo|SaaSHub|Medium|LinkedIn|Quora|llms|BetaList|Wikidata|GitHub)'
         THEN '["militarycalc","govcalcs","visagps"]'::jsonb
         ELSE jsonb_build_array(h.project_id) END
  ) AS site
))
WHERE platform_key = 'backlink' AND NOT (prep_payload ? 'site_status');
