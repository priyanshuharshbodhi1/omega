# CLAUDE.md - Omega Project Guide

## Goal
The goal of this project is to win in this hackathon: https://elasticsearch.devpost.com/ . So please do everything u do with that in mind and check like what hackathon wantes etc.

## What is Omega?

Omega is a dual-mode SaaS platform for the [Elasticsearch Agent Builder Hackathon](https://elasticsearch.devpost.com/). It combines:

1. **Feedback Analytics** - Collect, analyze, and visualize customer feedback with sentiment analysis
2. **Arya Customer Support Agent** - AI-powered support chatbot with cited answers from indexed knowledge bases

The platform is built on **Elasticsearch** as the primary data layer, using Elastic Agent Builder for AI orchestration.

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database**: Elasticsearch (all data - feedback, conversations, knowledge docs, tickets, clusters)
- **AI/Agents**: Elastic Agent Builder (4 agents, 6+ ES|QL tools) via Kibana API
- **Auth**: NextAuth
- **UI**: React 18, Tailwind CSS, Radix UI, react-color, react-markdown
- **State**: Zustand

## Key Commands

```bash
npm run dev              # Start dev server
npm run sync:agent-builder  # Sync agents + tools to Elastic Agent Builder
npm run recluster:issues    # Re-cluster complaints from feedback
npm run setup:elastic-feedback  # Initialize Elasticsearch indices
```

## Project Structure

```
app/
  (app)/              # Authenticated admin pages
    dashboard/        # Analytics dashboard
    analysis/         # AI insights chat (uses insights agent)
    widgets/          # Widget configuration (feedback vs support mode)
    integrations/     # Knowledge hub - add URLs, PDFs for Arya
    support-requests/ # Escalated ticket management
  api/
    support/
      chat/           # Main Arya chat endpoint (retrieval + agent + citations)
      index-source/   # Web crawling + indexing support docs
      index-pdf/      # PDF upload + indexing
      sources/        # Manage indexed knowledge sources
      tickets/        # Escalation ticket CRUD
    chat/             # Admin insights chat endpoint
    feedback/         # Feedback collection + analysis
    team/             # Team management + stats
  collect/[id]/       # Embedded widget page (feedback or support mode)
  support/contact/    # Human escalation form

lib/
  elasticsearch.ts    # All Elasticsearch operations (search, index, CRUD)
  agent-builder.ts    # Elastic Agent Builder API client
  store.ts            # Zustand stores

scripts/
  sync-agent-builder.mjs   # Sync 4 agents + 6 tools to Elastic
  recluster-issues.mjs     # Complaint clustering logic
  setup-elastic-feedback.mjs  # Index bootstrapping

resources/            # Reference implementations (not used in production)
  EverydayElastic/    # Grounded answers + citation patterns
  procheck/           # Citation rendering + chat UX patterns
```

## Elasticsearch Indices

| Index | Purpose |
|---|---|
| `feedback` | Customer feedback with sentiment + embeddings (ingest pipeline) |
| `support_docs` | Indexed knowledge base chunks with embeddings |
| `support_conversations` | Chat message history |
| `support_tickets` | Escalation tickets |
| `issue_clusters` | Detected complaint clusters |
| `action_audit_log` | Admin action history |
| `teams` | Team configuration |
| `users` | User accounts |

## Arya Support Chat Flow

```
User message
  -> Translate to English (if needed)
  -> Hybrid search: lexical (BM25) + semantic (KNN vector) with RRF fusion
  -> Build prompt with retrieved source context
  -> Invoke Elastic Agent Builder (customer support agent)
  -> Clean response of internal jargon
  -> Translate back to user's language (if needed)
  -> Detect escalation signals
  -> Return response with inline citations
```

## Architecture Principles

- **Elasticsearch-first**: All data lives in ES. No Prisma/SQL in new code.
- **Agent Builder for AI logic**: Prompt behavior managed in Elastic Agent Builder, not hardcoded.
- **Grounded answers only**: Arya must cite sources. Never invent information.
- **Low latency**: Parallel searches, timeouts, fallback responses.
- **No internal jargon in user-facing responses**: Never mention "indexed documents", "knowledge base", "sources retrieved", etc.

## Environment Variables

See `.env.example` for all required variables. Key ones:
- `ELASTIC_ENDPOINT` / `ELASTIC_API_KEY` - Elasticsearch connection
- `ELASTIC_KIBANA_URL` - Kibana for Agent Builder API
- `ELASTIC_CUSTOMER_AGENT_ID` - Customer support agent ID in Agent Builder

## After Changing Agent Instructions

Run `npm run sync:agent-builder` to push updated agent/tool definitions to Elastic.
