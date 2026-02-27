<p align="center">
  <img src="public/omega_icon.png" width="200" alt="Omega Logo">
</p>

# Omega

> **Unify customer feedback and support into one AI-powered platform. Collect, analyze, and respond, all backed by Elasticsearch.**

[![Demo Video](https://img.shields.io/badge/Demo-Video-red?style=for-the-badge&logo=youtube)](https://www.youtube.com/watch?v=29ulpLYsDjM)

## The Problem

Customer feedback and customer support live in silos. Feedback gets buried in spreadsheets with no automated analysis. Support agents manually search through docs for answers. When negative sentiment spikes, nobody connects it to what customers are asking in support chats. Teams lack visibility into what their customers actually need.

## The Solution

Omega is a dual-mode SaaS platform that unifies feedback analytics and AI customer support on a single Elasticsearch-powered backend. It uses 7 specialized agents and 3 automated workflows orchestrated through Elastic Agent Builder to turn raw customer signals into action.

- **Arya** answers customer questions with grounded, cited responses from your knowledge base
- **Admin AI Chat** lets product teams query feedback trends in natural language
- **Automated workflows** detect sentiment spikes, escalate frustrated customers, and find knowledge gaps

**No hallucinations.** Arya only answers from your indexed docs with inline [1], [2] citations.
**No silos.** Feedback trends and support conversations feed into the same analytics engine.
**No manual triage.** Workflows auto-detect spikes, escalate tickets, and flag knowledge gaps.

## Key Capabilities

- **AI Customer Support (Arya)**: Embeddable chat widget with grounded, cited answers from your docs
- **Hybrid Search**: BM25 keyword + KNN vector with Reciprocal Rank Fusion (RRF) for best relevance
- **Feedback Collection**: Customizable widget with auto-sentiment analysis via Elasticsearch ingest pipeline
- **Multi-Agent Analytics**: 3 admin agents (insights, executive brief, triage) auto-selected by question keywords
- **Automated Workflows**: Sentiment spike detection (cron every 5 min), smart escalation (auto from chat), knowledge gap detection
- **Multi-Language**: Auto-detects English, Spanish, French, German, Hindi, Arabic with query/response translation
- **Slack Alerts**: Notifications for critical spikes, urgent escalations, and knowledge gaps

## Architecture

### Elasticsearch as the Complete Data Platform

All data lives in Elasticsearch across 8 indices. No secondary database.

| Index | Purpose |
|---|---|
| `feedback` | Customer feedback with auto-sentiment + vector embeddings (ingest pipeline) |
| `support_docs` | Knowledge base chunks with embeddings for hybrid search |
| `support_conversations` | Chat history for escalation context |
| `support_tickets` | Escalation tickets with priority and routing |
| `issue_clusters` | Auto-detected complaint clusters |
| `action_audit_log` | Admin action audit trail |
| `teams` | Team configuration and branding |
| `users` | User accounts |

**Elasticsearch features used:**
- Hybrid search (BM25 + KNN vector) with Reciprocal Rank Fusion (k=60)
- Ingest pipelines for auto-sentiment extraction and embedding generation at index time
- ES|QL for all analytics queries and all agent tools
- Inference endpoints for vector embedding generation

### Elastic Agent Builder: 7 Agents, 15 ES|QL Tools, 3 Workflows

All agent instructions and tool bindings managed through Agent Builder via the Kibana API.

| Agent | Purpose |
|---|---|
| `omega_insights` | Evidence-backed product insights from feedback |
| `omega_executive_brief` | Board-ready summaries with business impact |
| `omega_support_triage` | Urgent item identification and triage actions |
| `omega_customer_support` | Grounded customer answers with inline citations |
| `omega_sentiment_spike_analyzer` | Negative sentiment spike severity classification |
| `omega_smart_escalation` | Conversation-aware ticket routing (P0-P3) |
| `omega_knowledge_gap_detector` | Finds documentation gaps from unanswered queries |

Each agent has dedicated ES|QL tools (15 custom + 2 platform) that query Elasticsearch directly for sentiment trends, urgent queues, conversation history, spike baselines, and more.

**Workflows:**

| Workflow | Trigger | What Happens |
|---|---|---|
| Sentiment Spike | Cron every 5 min | Compares last-1h vs baseline, classifies severity, creates ticket + Slack alert |
| Smart Escalation | Auto from Arya chat | Reads conversation, assigns P0-P3 priority, creates routed ticket |
| Knowledge Gap | Manual / scheduled | Finds unanswered queries, clusters by topic, recommends articles to write |

### Arya's Search Pipeline

1. User message received, language auto-detected
2. Query translated to English if needed
3. Parallel Elasticsearch searches: BM25 lexical + KNN vector on `support_docs`
4. Results fused with Reciprocal Rank Fusion (RRF, k=60)
5. Top sources deduplicated, passed to `omega_customer_support` agent
6. Agent generates cited response, post-processed to remove internal jargon
7. Confidence score computed (75% relevance + 25% source coverage)
8. Response translated back to user's language
9. If escalation conditions met, Smart Escalation workflow fires in background

## 🏗️ Architecture

![Omega Architecture](generated-diagrams/omega_full_architecture.png.png)

Omega leverages a multi-agent orchestration pattern powered by **Elastic Agent Builder**. The system is composed of specialized agents that interact via a shared Elasticsearch data lake and use natively integrated tools.

## Technology Stack

- **Framework**: Next.js 14 (App Router), TypeScript
- **Search and Data**: Elasticsearch 8.x (hybrid search, ingest pipelines, ES|QL, inference endpoints)
- **AI Orchestration**: Elastic Agent Builder (7 agents, 15 ES|QL tools via Kibana API)
- **Auth**: NextAuth
- **UI**: React 18, Tailwind CSS, Radix UI, Recharts, Framer Motion, react-markdown
- **State**: Zustand

## Getting Started

### Prerequisites

- Node.js 18+
- [Elastic Cloud](https://cloud.elastic.co) deployment with Agent Builder enabled
- Kibana URL and API key

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/priyanshuharshbodhi1/omega.git
cd omega

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your Elasticsearch and Kibana credentials

# 4. Initialize Elasticsearch indices
npm run setup:elastic-feedback

# 5. Sync agents and tools to Agent Builder
npm run sync:agent-builder

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

- **Dashboard**: `/dashboard` - real-time feedback metrics and sentiment trends
- **AI Analysis**: `/analysis` - chat with feedback data using AI agents
- **Widget Config**: `/widgets` - configure and embed the feedback/support widget
- **Knowledge Hub**: `/integrations` - add URLs, PDFs to power Arya's answers
- **Support Requests**: `/support-requests` - manage escalated tickets

## Key Commands

```bash
npm run dev                    # Start dev server
npm run sync:agent-builder     # Sync agents + tools to Elastic Agent Builder
npm run setup:elastic-feedback # Initialize Elasticsearch indices
npm run recluster:issues       # Re-cluster complaints from feedback
npm run cron:sentiment         # Run sentiment spike check
```

## Project Structure

```
omega/
├── app/
│   ├── (app)/                   # Authenticated admin pages
│   │   ├── dashboard/           # Analytics dashboard
│   │   ├── analysis/            # AI insights chat
│   │   ├── widgets/             # Widget configuration
│   │   ├── integrations/        # Knowledge hub (URLs, PDFs)
│   │   └── support-requests/    # Escalated ticket management
│   ├── api/
│   │   ├── support/
│   │   │   ├── chat/            # Arya chat endpoint
│   │   │   ├── index-source/    # Web crawling + indexing
│   │   │   ├── index-pdf/       # PDF upload + indexing
│   │   │   ├── sources/         # Knowledge source management
│   │   │   └── tickets/         # Escalation ticket CRUD
│   │   ├── chat/                # Admin AI chat endpoint
│   │   ├── feedback/            # Feedback collection + analysis
│   │   ├── workflows/           # Sentiment spike, escalation, knowledge gap
│   │   └── cron/                # Scheduled sentiment checks
│   ├── collect/[id]/            # Embeddable widget (feedback + support)
│   └── support/contact/         # Human escalation form
├── lib/
│   ├── elasticsearch.ts         # All Elasticsearch operations
│   ├── agent-builder.ts         # Agent Builder API client
│   └── store.ts                 # Zustand stores
├── scripts/
│   ├── sync-agent-builder.mjs   # Sync 7 agents + 15 tools
│   ├── setup-elastic-feedback.mjs
│   ├── recluster-issues.mjs
│   └── sentiment-cron.mjs
├── .env.example
├── LICENSE
└── README.md
```

## License

MIT License. See [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
