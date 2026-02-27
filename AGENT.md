# AGENT.md - Omega Pivot Context (Hackathon)

## Mission
Win the Elasticsearch Agent Builder Hackathon by pivoting Omega from feedback-only analytics into a lightweight customer support agent platform while preserving existing feedback flows.

› Hey remember I want to win tis hackathon: https://
  elasticsearch.devpost.com/
 

## Product Direction (User-Requested)
1. Keep existing feedback capability.
2. Add customer support chatbot capability with citations.
3. Add a mode toggle in widget style/settings:
   - `feedback` mode
   - `customer_agent` mode
4. Embedded widget/link should render behavior based on selected mode.
5. Store customer conversations in Elasticsearch.
6. Cluster similar complaints from conversations + feedback.
7. Show real-time issue/complaint trends on admin dashboard.
8. Add workflow actions last: admin verifies issue cluster -> send to Slack or create GitHub issue.

## Engineering Constraints
- Keep implementation simple and demoable (avoid over-complex architecture right now).
- Prompt behavior should be managed in Elastic Agent Builder (agents/tools), not hardcoded in app routes.
- Use terminal-based sync for Agent Builder tools/agents.
- Verify each completed step with local tests/manual checks before moving on.
- Optimize for low latency and crisp UX.

## Inspiration Sources to Reuse
- `resources/EverydayElastic`
  - grounded answers with citations
  - quick response pipeline (hybrid retrieval + concise generation)
  - action suggestions and workflow hooks
- `resources/procheck`
  - citation rendering/parsing patterns
  - chat UX patterns for perceived speed and reliability
  - performance tactics (message handling, efficient UI)

## Non-Goals (for this iteration)
- Full enterprise multi-tenant RBAC redesign
- Heavy ML clustering stack outside Elasticsearch
- Complex workflow orchestration before core chat + clustering loop works

## Demo Story Target
1. Admin selects `customer_agent` mode and embeds widget.
2. End user asks question -> receives cited answer from indexed content.
3. Multiple similar complaints accumulate.
4. Dashboard surfaces clustered issue candidate in near real-time.
5. Admin verifies candidate and triggers Slack/GitHub action.
