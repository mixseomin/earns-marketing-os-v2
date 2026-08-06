import fs from 'node:fs';
// Pull the shared MOS2 review queue (bugs flagged 🚩 across projects → assigned to AI).
// Usage: node review-pull.mjs [id]   — no id = list pending AI items; id = full JSON of that item.
const id = process.argv[2];
const tok = (fs.readFileSync('/opt/earns-marketing-os-v2/.env.production', 'utf8').match(/^MOS2_AGENT_TOKEN=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '') || '';
if (!tok) { console.log('NO MOS2_AGENT_TOKEN'); process.exit(1); }
const r = await fetch('http://127.0.0.1:3821/api/review?assignedTo=ai&status=pending', { headers: { 'x-agent-token': tok } });
const d = await r.json();
const items = Array.isArray(d) ? d : (d.items || d.tasks || d.data || []);
if (id) {
  const h = items.find(x => String(x.id) === String(id));
  console.log(h ? JSON.stringify(h, null, 2) : `#${id} not in the pending AI queue (already resolved? wrong id?)`);
} else {
  console.log(`${items.length} pending AI review(s) [assignedTo=ai · status=pending]:`);
  for (const x of items) console.log(`  #${x.id} [${x.project_id}] ${x.title} — ${x.instructions || ''}`);
  if (!items.length) console.log('  (queue empty)');
  console.log('\nResolve: node review-resolve.mjs <id> "<note>"  ·  or POST /api/review/<id> {action:resolve,note}');
}
