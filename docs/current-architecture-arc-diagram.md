# Zapfeed Current Architecture Arc Diagram

```mermaid
flowchart LR
  subgraph FE[Frontend - Next.js App Router]
    A1[Analysis Chat UI\napp/(app)/analysis/chat.tsx]
    A2[Feedback Pages + Dashboard]
  end

  subgraph API[Backend API Routes]
    B1[/POST /api/chat\napp/api/chat/route.ts/]
    B2[/POST /api/feedback/summary/]
    B3[/POST /api/feedback/collect/]
    B4[/POST /api/feedback/:id/github-issue/]
    B5[/Team Stats APIs/]
  end

  subgraph AB[Elastic Agent Builder]
    C1[Agent: zapfeed_insights_agent_v1\nProduct insights + actions]
    C2[Agent: zapfeed_exec_brief_agent_v1\nExec briefings]
    C3[Agent: zapfeed_support_triage_agent_v1\nUrgent support triage]

    T1[Tool: zapfeed_feedback_sentiment_trends_v1]
    T2[Tool: zapfeed_feedback_low_rating_examples_v1]
    T3[Tool: zapfeed_feedback_resolution_snapshot_v1]
    T4[Tool: zapfeed_feedback_issue_buckets_v1]
    T5[Tool: zapfeed_feedback_urgent_queue_v1]
    T6[Tool: platform.core.generate_esql]
    T7[Tool: platform.core.execute_esql]
  end

  subgraph ES[Elasticsearch]
    D1[(Index: feedback)]
    D2[(Index: teams)]
    D3[(Index: users)]
    D4[Inference: text_embedding\n.openai-text-embedding-3-small]
    D5[Inference: completion\n.openai-gpt-4.1-mini-completion]
    D6[Feedback ingest pipeline\nfeedback-ingest-pipeline]
  end

  subgraph EXT[External Systems]
    E1[GitHub API]
    E2[Linear API]
  end

  A1 --> B1
  A2 --> B2
  A2 --> B3
  A2 --> B4
  A2 --> B5

  B1 -->|Intent routing| C1
  B1 -->|Exec query keywords| C2
  B1 -->|Urgent/triage keywords| C3

  C1 --> T1
  C1 --> T2
  C1 --> T3
  C1 --> T4
  C1 --> T5
  C1 --> T6
  C1 --> T7

  C2 --> T1
  C2 --> T3
  C2 --> T4
  C2 --> T6
  C2 --> T7

  C3 --> T2
  C3 --> T5
  C3 --> T6
  C3 --> T7

  T1 --> D1
  T2 --> D1
  T3 --> D1
  T4 --> D1
  T5 --> D1
  T6 --> D1
  T7 --> D1

  B3 -->|Index new feedback| D6
  D6 --> D1

  B1 -->|Semantic retrieval pre-context| D4
  B1 -->|Fallback answer path| D5
  B2 -->|Summary fallback| D5

  B1 --> D2
  B5 --> D1
  B5 --> D2
  B5 --> D3

  B4 -->|Workflow / fallback| E1
  B4 -->|Tracker preference| E2
```

## Notes
- Chat quality is now primarily governed in Elastic Agent Builder agent/tool configuration (synced by `scripts/sync-agent-builder.mjs`).
- App runtime sends dynamic context (`TEAM_ID`, question, evidence), while behavior rules remain in Agent Builder.
