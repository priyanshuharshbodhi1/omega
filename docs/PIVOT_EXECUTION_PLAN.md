# Zapfeed Pivot Execution Plan (Step-by-Step)

## Goal
Deliver a hackathon-ready pivot from feedback analytics to a dual-mode platform: feedback + customer support agent with citations, clustering, real-time dashboard, and admin-triggered actions.

## Branch
`pivot/customer-support-agent-hackathon`

## Step 0 - Baseline and Safety
### Work
- Freeze current baseline behavior for chat, feedback, and agent sync.
- Ensure existing lint/build passes before feature work.

### Validation
- `npm run lint`
- `node scripts/eval-agent-chat.mjs`
- Manual check: `/analysis` chat still responds.

---

## Step 1 - Data Model Extension (Minimal)
### Work
- Add ES indices/mappings for support chat and issue clusters:
  - `support_conversations`
  - `issue_clusters`
- Keep fields minimal:
  - `teamId`, `sessionId`, `userType`, `message`, `role`, `createdAt`, `sourceRefs`
  - `clusterKey`, `title`, `count`, `sampleMessages`, `status`, `lastSeenAt`
- Add helper methods in `lib/elasticsearch.ts`.

### Validation
- Index create/update script runs successfully.
- Insert/read test docs from local script.

---

## Step 2 - Widget Mode Toggle
### Work
- Add `chatMode` setting on team style/settings (`feedback` | `customer_agent`).
- Update widget render path to branch behavior by mode.
- Preserve current feedback mode unchanged.

### Validation
- Toggle in settings persists.
- Embedded widget shows feedback flow when `feedback`.
- Embedded widget shows customer agent flow when `customer_agent`.

---

## Step 3 - Customer Agent API with Citations
### Work
- Add route (or extend existing chat route with explicit mode context) for customer-agent questions.
- Pipeline:
  - retrieve relevant docs/knowledge snippets (hybrid-ish via current tools and/or ES query)
  - invoke Agent Builder support agent
  - return answer + citations list
- Save conversation turn to `support_conversations`.

### Validation
- API returns answer with citation markers and source list.
- Conversation docs appear in ES.
- P95 response time target for demo flow: under ~3-4s on small dataset.

---

## Step 4 - Citation UX in Widget
### Work
- Add citation parsing/rendering inspired by `resources/procheck/src/lib/citation-utils.ts`.
- Show clickable source badges and compact source drawer under assistant message.

### Validation
- Citations render correctly for formats `[1]`, `[Source 1]`.
- Clicking a citation highlights/opens source metadata.

---

## Step 5 - Similar Complaint Clustering (Simple, Effective)
### Work
- Build a lightweight clustering job/API:
  - Query recent negative/support-friction conversation + feedback entries.
  - Group by normalized complaint signature (keyword + semantic fallback).
  - Upsert top clusters into `issue_clusters` with counts and examples.
- Keep deterministic rules first; optional semantic merge if time remains.

### Validation
- Running clustering updates `issue_clusters` with expected counts.
- Repeated complaint samples merge into same cluster.

---

## Step 6 - Real-Time Admin Dashboard Cards
### Work
- Add dashboard widgets:
  - top active complaint clusters
  - new complaints in last 24h
  - unresolved issue candidates
- Polling every 15-30s (simple and reliable for hackathon demo).

### Validation
- Dashboard updates after new test chats.
- Counts match `issue_clusters` docs.

---

## Step 7 - Agent Builder Alignment (Terminal Sync)
### Work
- Update `scripts/sync-agent-builder.mjs`:
  - ensure support agent instructions enforce citations + no hallucinated claims
  - ensure tools for issue trends/urgent queue/clusters are present
- Keep prompts in Agent Builder definitions, not in route code.

### Validation
- Run `node scripts/sync-agent-builder.mjs`.
- Run eval prompts to confirm citations + actionability.

---

## Step 8 - Workflow Actions (Do Last)
### Work
- Add admin action buttons on cluster detail:
  - `Send to Slack`
  - `Create GitHub Issue`
- Actions only enabled after admin verification.
- Log every action in `action_audit_log` (or equivalent existing storage).

### Validation
- Manual end-to-end test:
  - create complaints -> cluster appears -> verify -> trigger Slack/GitHub -> success response and log entry.

---

## Step 9 - Latency and Demo Polish
### Work
- Apply low-latency patterns inspired by EverydayElastic/procheck:
  - limit context chunks
  - pre-filter by team + recent window
  - show immediate typing placeholder / optimistic UI
  - avoid unnecessary tool calls for small talk
- Add a one-command demo script with seeded data.

### Validation
- Measure response times on 10 sample prompts.
- Confirm stable, consistent citation responses.

---

## Step 10 - Submission Assets
### Work
- Update architecture diagram and README demo flow.
- Include explicit Agent Builder + ES features list used.
- Capture 2-minute demo script and screenshots.

### Validation
- Fresh clone checklist runs.
- Demo script reproducible without manual patching.

## Implementation Order for This Week
1. Steps 1-4 (core pivot visible)
2. Steps 5-6 (wow factor: clustering + live dashboard)
3. Step 7 (agent/tool hardening)
4. Step 8 (workflow actions)
5. Steps 9-10 (performance and submission polish)
