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
