-- Seed selector_overrides page_kind=composer cho reply-assist widget.
-- Cascade: engine(xenforo) + platform(reddit). Habitat override sau (train/web).
BEGIN;
DELETE FROM selector_overrides
 WHERE tenant_id='self' AND page_kind='composer'
   AND ((scope_kind='engine' AND scope_key='xenforo') OR (scope_kind='platform' AND scope_key='reddit'));

INSERT INTO selector_overrides (tenant_id, scope_kind, scope_key, page_kind, field_name, spec, source, confidence, created_at, updated_at) VALUES
-- ── XenForo (engine) ──
('self','engine','xenforo','composer','composer.anchor', jsonb_build_object('css','.formButtonGroup','notes','seed ADAPTERS'),'manual',90,now(),now()),
('self','engine','xenforo','composer','composer.editor', jsonb_build_object('css','.message-editor .fr-element[contenteditable="true"], form .fr-element[contenteditable="true"], textarea[name="message"], textarea[name="message_html"]','attr','value','notes','seed'),'manual',90,now(),now()),
('self','engine','xenforo','composer','composer.postBtn', jsonb_build_object('css','.formButtonGroup-primary button[type="submit"], .formButtonGroup button.button--icon--reply, button.button--icon--reply','notes','seed'),'manual',90,now(),now()),
('self','engine','xenforo','composer','thread.title', jsonb_build_object('css','h1.p-title-value, h1','attr','textContent','notes','seed'),'manual',90,now(),now()),
('self','engine','xenforo','composer','post.item', jsonb_build_object('css','article.message, li.message','notes','seed'),'manual',90,now(),now()),
('self','engine','xenforo','composer','post.author', jsonb_build_object('css','.message-name .username, .message-name','attr','textContent','notes','seed'),'manual',90,now(),now()),
('self','engine','xenforo','composer','post.permalink', jsonb_build_object('css','.message-attribution-main a, a[href*="/post-"]','attr','href','notes','seed'),'manual',90,now(),now()),
('self','engine','xenforo','composer','reactions', jsonb_build_object('css','.reactionsBar .reactionSummary, .reactionSummary','attr','textContent','notes','seed'),'manual',80,now(),now()),
('self','engine','xenforo','composer','replyAction', jsonb_build_object('css','a.actionBar-action--reply, a[data-xf-click="quote"], a[data-quote-href]','notes','seed'),'manual',80,now(),now()),
('self','engine','xenforo','composer','breadcrumb', jsonb_build_object('css','.p-breadcrumbs a, .breadcrumb a, nav a','attr','href','notes','seed'),'manual',80,now(),now()),
('self','engine','xenforo','composer','viewer.handle', jsonb_build_object('css','.p-navgroup--member .p-navgroup-linkText, .p-navgroup--member .username','attr','textContent','notes','seed'),'manual',80,now(),now()),
('self','engine','xenforo','composer','_adapter', jsonb_build_object('css','','quoteFormat','bbcode','insert','append','postAuthorAttr','data-author','tracked',true,'float',false,'noPost',false,'notes','behavior flags'),'manual',90,now(),now()),
-- ── Reddit (platform) ──
('self','platform','reddit','composer','composer.anchor', jsonb_build_object('css','reddit-rte, shreddit-composer, comment-composer-host, faceplate-form, form.usertext.cloneable, .commentarea .usertext','notes','seed'),'manual',85,now(),now()),
('self','platform','reddit','composer','composer.editor', jsonb_build_object('css','reddit-rte [contenteditable="true"], [slot="rte"] [contenteditable="true"], div[contenteditable="true"][role="textbox"], [contenteditable="true"][name="body"], reddit-rte textarea, textarea[name="text"]','attr','value','notes','Lexical slotted + markdown textarea'),'manual',75,now(),now()),
('self','platform','reddit','composer','composer.postBtn', jsonb_build_object('css','','notes','noPost — tự bấm Comment, track qua commentstats'),'manual',85,now(),now()),
('self','platform','reddit','composer','thread.title', jsonb_build_object('css','h1, shreddit-title, [property="og:title"]','attr','textContent','notes','seed'),'manual',85,now(),now()),
('self','platform','reddit','composer','post.item', jsonb_build_object('css','shreddit-comment, .Comment, .thing.comment','notes','seed'),'manual',80,now(),now()),
('self','platform','reddit','composer','post.author', jsonb_build_object('css','a[href^="/user/"], .author','attr','textContent','notes','seed'),'manual',80,now(),now()),
('self','platform','reddit','composer','post.permalink', jsonb_build_object('css','a[href*="/comments/"]','attr','href','notes','seed'),'manual',80,now(),now()),
('self','platform','reddit','composer','parent.container', jsonb_build_object('css','shreddit-comment, .Comment, .thing.comment, [data-testid="comment"]','notes','comment/post đang reply'),'manual',80,now(),now()),
('self','platform','reddit','composer','viewer.handle', jsonb_build_object('css','#expand-user-drawer-button span, faceplate-tracker[source="user_menu"] span','attr','textContent','notes','fallback storage viewer_handle_reddit'),'manual',60,now(),now()),
('self','platform','reddit','composer','_adapter', jsonb_build_object('css','','quoteFormat','reddit-parent','insert','append','postAuthorAttr','author','tracked',false,'float',true,'noPost',true,'notes','behavior flags'),'manual',85,now(),now());
COMMIT;
SELECT scope_kind, scope_key, count(*) FROM selector_overrides WHERE page_kind='composer' GROUP BY 1,2;
