// Phase 12+ — Workflow definitions cho multi-step coordination demo.
// Plain TypeScript module (NOT 'use server') — exported constants accessible
// từ cả server actions + client components.
//
// Pattern: mỗi workflow là chain of steps. Mỗi step assign 1 squad + body
// template. Sau successful run, worker auto-spawn next step's card với
// body filled từ prev outputs.
//
// User trigger: tạo card với workflow_key='reddit-launch' + workflow_step='plan'
// → chain tự chạy đến cuối qua các squad.

export interface WorkflowStep {
  stepKey: string;                // 'plan' / 'write' / 'design' / 'publish'
  label: string;                  // hiển thị UI
  squadKey: string;               // squad nào đảm nhiệm
  agentKind: string;              // model dùng ('gpt-4o-mini' / 'claude-haiku-4-5' etc)
  // Body template — placeholders {{key}} được fill từ workflow_context.
  // {{brief}}: original brief từ anchor card.
  // {{plan}}: output của step plan.
  // {{post}}: output của step write.
  // {{imageUrl}}: media URL từ step design.
  bodyTemplate: string;
  trustLevel: 1 | 2 | 3 | 4;
  isFinal?: boolean;              // step cuối → không spawn next.
}

export interface WorkflowDef {
  key: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export const WORKFLOWS: Record<string, WorkflowDef> = {
  'medium-publish': {
    key: 'medium-publish',
    name: 'Medium Long-form Publish',
    description: 'Plan → write (long-form 1500-2500 words) → design hero → human handoff to publish on Medium.',
    steps: [
      {
        stepKey: 'plan',
        label: '🧭 Plan',
        squadKey: 'wf-planner',
        agentKind: 'gpt-4o-mini',
        trustLevel: 1,
        bodyTemplate: `Bạn là Planner cho Medium long-form article. Lên outline dựa trên brief:

{{brief}}

Output structure (markdown):
## Mục tiêu article
1-2 câu — mục đích article phục vụ ai và để làm gì.

## Target reader
Persona cụ thể (vd: "Indie devs, privacy-conscious users đang tìm app alternatives, 25-40 tuổi").

## Angle / hook
Góc nhìn độc đáo + hook line cho intro.

## Outline 6-9 sections
Liệt kê heading H2 + 1 dòng tóm tắt mỗi section. Đảm bảo flow:
- Intro hook
- Problem framing
- Body sections (deep value, examples, data nếu có)
- Counter-argument hoặc nuance
- Practical takeaway / CTA cuối

## Tags Medium (5-8)
Tags phù hợp Medium algorithm (mix broad + niche).

## Hero image concept
1-2 câu mô tả ảnh đại diện (Designer step dùng).

BẮT BUỘC: gọi tool save-knowledge với title='Plan: Medium article' + content=full outline markdown để Writer step đọc.`,
      },
      {
        stepKey: 'write',
        label: '✍️ Write',
        squadKey: 'wf-writer',
        agentKind: 'gpt-4o-mini',
        trustLevel: 2,
        bodyTemplate: `Bạn là Writer Medium long-form. Viết bài hoàn chỉnh dựa trên plan:

## Plan từ Planner
{{plan}}

## Yêu cầu output
- Title hấp dẫn ≤ 80 chars (Medium SEO-friendly).
- Subtitle 1 dòng (deck) — tóm tắt value của article.
- Body markdown 1500-2500 từ. Mỗi section H2 có ≥ 2 đoạn văn.
- Có ít nhất 1 list (bulleted hoặc numbered).
- Có ít nhất 1 pull quote (blockquote) làm điểm nhấn.
- Code blocks nếu là technical content.
- Tone: nửa formal nửa câu chuyện (Medium voice). KHÔNG hard-sell.
- Kết: 1-2 câu CTA mềm + 1 câu hỏi cho reader engage comments.

Format final output:
## Title
<title>

## Subtitle
<subtitle>

## Body
<full markdown body với H2 sections>

## Tags
<5-8 tags, comma-separated>

BẮT BUỘC: gọi save-knowledge với title='Medium article draft' + content=full title+subtitle+body+tags để Designer + Publisher step đọc.`,
      },
      {
        stepKey: 'design',
        label: '🎨 Design',
        squadKey: 'wf-designer',
        agentKind: 'gpt-4o-mini',
        trustLevel: 2,
        bodyTemplate: `Bạn là Designer Medium hero image.

## Article content
{{post}}

## Image concept gợi ý từ Planner
{{imageConcept}}

## Yêu cầu hero image
- 1600x900 (Medium recommended ratio 16:9).
- Style editorial — clean, không bịa data/text.
- Avoid: stock photo cliché, generic abstract gradients.
- Prefer: meaningful visual metaphor, illustrative, one focal subject.

BẮT BUỘC: gọi image-gen với detailed prompt + ratio 16:9. Sau khi có ảnh, gọi save-knowledge với title='Hero image for Medium article' + content=mô tả ảnh + URL.`,
      },
      {
        stepKey: 'publish',
        label: '🚀 Publish',
        squadKey: 'wf-publisher',
        agentKind: 'gpt-4o-mini',
        trustLevel: 3,
        isFinal: true,
        bodyTemplate: `Bạn là Publisher Medium. Workflow đã có article + hero image. Tạo human task để user đăng thủ công.

## Article
{{post}}

## Hero image
{{imageUrl}} (media asset id: {{imageAssetId}})

## Plan (target reader + tags)
{{plan}}

BẮT BUỘC: gọi tool human-handoff với:
- platform = 'medium'
- title = title của article
- instructions = 1. Mở https://medium.com/new-story. 2. Upload hero image (16:9). 3. Paste title + subtitle + body markdown. 4. Add tags (5-8). 5. Set canonical URL nếu cross-post từ orit.app blog. 6. Publish hoặc Save as draft. 7. Copy story URL.
- prepPayload = { caption: <full body markdown>, imageUrls: [<URL>], hashtags: [<tags array>] }
- slaMinutes = 480 (8h)

Sau khi gọi xong, output 1 dòng confirm 'Đã queue human task Medium'.`,
      },
    ],
  },
  'reddit-launch': {
    key: 'reddit-launch',
    name: 'Reddit Launch Post',
    description: 'Plan → write → design → publish (human handoff). 4 steps qua 4 squads.',
    steps: [
      {
        stepKey: 'plan',
        label: '🧭 Plan',
        squadKey: 'wf-planner',
        agentKind: 'gpt-4o-mini',
        trustLevel: 1,
        bodyTemplate: `Bạn là Planner. Lên kế hoạch cho 1 Reddit launch post dựa trên brief:

{{brief}}

Output structure (markdown):
## Mục tiêu post
1 câu rõ ràng mục đích launch.

## Subreddit target (1-3)
Liệt kê subreddit phù hợp + lý do.

## Tone & angle
Hook style (curiosity/contrarian/story). Tone (formal/casual/dev-bro).

## Key points (3-5 bullets)
Những điểm chính bài viết phải truyền tải.

## Hook draft (1 dòng)
Title gợi ý.

## Image concept
1 câu mô tả image hỗ trợ post (cho Designer agent dùng tiếp).

BẮT BUỘC: gọi tool save-knowledge với title='Plan: Reddit launch [date]' + content=full plan markdown để Writer step kế tiếp đọc được.`,
      },
      {
        stepKey: 'write',
        label: '✍️ Write',
        squadKey: 'wf-writer',
        agentKind: 'gpt-4o-mini',
        trustLevel: 2,
        bodyTemplate: `Bạn là Writer. Viết Reddit post hoàn chỉnh dựa trên plan đã có:

## Plan từ Planner
{{plan}}

## Yêu cầu output
- Title ≤ 100 chars (theo "Hook draft" trong plan).
- Body markdown 200-400 từ. Tone phù hợp subreddit + plan.
- KHÔNG self-promo lộ liễu. KHÔNG link đến product trong body trừ khi context cho phép.
- Kết thúc bằng 1 câu hỏi để engage comments.

Format final output:
## Title
<title>

## Body
<markdown body>

BẮT BUỘC: gọi save-knowledge với title='Reddit post draft' + content=full title+body để Designer step + Publisher step kế tiếp đọc được.`,
      },
      {
        stepKey: 'design',
        label: '🎨 Design',
        squadKey: 'wf-designer',
        agentKind: 'gpt-4o-mini',
        trustLevel: 2,
        bodyTemplate: `Bạn là Designer. Tạo hero image cho Reddit post.

## Post content
{{post}}

## Image concept gợi ý từ Planner
{{imageConcept}}

## Yêu cầu
- 1024x1024, style minimalist + bold typography.
- Avoid text-heavy designs (Reddit hiển thị thumbnail nhỏ).
- KHÔNG cần đầy đủ branding, chỉ hint visual.

BẮT BUỘC: gọi tool image-gen với detailed prompt. Sau khi có ảnh, gọi save-knowledge với title='Image notes for post' + content=mô tả + URL image (mediaAssetId từ output) để Publisher step đọc.`,
      },
      {
        stepKey: 'publish',
        label: '🚀 Publish',
        squadKey: 'wf-publisher',
        agentKind: 'gpt-4o-mini',
        trustLevel: 3,
        isFinal: true,
        bodyTemplate: `Bạn là Publisher. Workflow đã có post + image. Tạo human task để user đăng thủ công lên Reddit.

## Reddit post content
{{post}}

## Image
{{imageUrl}} (media asset id: {{imageAssetId}})

## Plan (subreddit target)
{{plan}}

BẮT BUỘC: gọi tool human-handoff với:
- platform = 'reddit'
- title = title của post
- instructions = 1. Mở https://reddit.com/r/<subreddit>/submit. 2. Paste title + body. 3. Upload image. 4. Submit. 5. Copy URL post sau khi đăng.
- prepPayload = { caption: <full body>, imageUrls: [<URL>], hashtags: [] }
- slaMinutes = 240 (4h)

Sau khi gọi xong, output 1 dòng confirm 'Đã queue human task'.`,
      },
    ],
  },
};

export function getNextStep(workflowKey: string, currentStep: string): WorkflowStep | null {
  const wf = WORKFLOWS[workflowKey];
  if (!wf) return null;
  const idx = wf.steps.findIndex((s) => s.stepKey === currentStep);
  if (idx < 0 || idx >= wf.steps.length - 1) return null;
  return wf.steps[idx + 1] ?? null;
}

export function getWorkflow(key: string): WorkflowDef | null {
  return WORKFLOWS[key] ?? null;
}

// Tìm step theo key (dùng khi skip step trong revise loop).
export function getStep(workflowKey: string, stepKey: string): WorkflowStep | null {
  const wf = WORKFLOWS[workflowKey];
  if (!wf) return null;
  return wf.steps.find((s) => s.stepKey === stepKey) ?? null;
}

// Render body template với context. {{key}} → context[key] || '(empty)'.
export function renderBodyTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = context[key];
    if (v === null || v === undefined) return '(empty)';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    return JSON.stringify(v);
  });
}
