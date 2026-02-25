import dotenv from "dotenv";

dotenv.config();

const kibanaUrl = process.env.ELASTIC_KIBANA_URL;
const apiKey = process.env.ELASTIC_API_KEY;
const spaceId = process.env.ELASTIC_KIBANA_SPACE_ID || "default";

// ── Agent IDs ─────────────────────────────────────────────────────────
const insightsAgentId =
  process.env.ELASTIC_CHAT_AGENT_ID || "omega_insights";
const execAgentId =
  process.env.ELASTIC_EXEC_AGENT_ID || "omega_executive_brief";
const triageAgentId =
  process.env.ELASTIC_TRIAGE_AGENT_ID || "omega_support_triage";
const customerSupportAgentId =
  process.env.ELASTIC_CUSTOMER_AGENT_ID || "omega_customer_support";
const sentimentSpikeAgentId =
  process.env.ELASTIC_SENTIMENT_SPIKE_AGENT_ID || "omega_sentiment_spike_analyzer";
const escalationAgentId =
  process.env.ELASTIC_ESCALATION_AGENT_ID || "omega_smart_escalation";
const knowledgeGapAgentId =
  process.env.ELASTIC_KNOWLEDGE_GAP_AGENT_ID || "omega_knowledge_gap_detector";

// ── ES|QL Tools ───────────────────────────────────────────────────────
const tools = [
  // ── Core Feedback Tools ─────────────────────────────────────────────
  {
    id: "omega_sentiment_trends",
    type: "esql",
    description:
      "Trend analysis for feedback volume, sentiment mix, and rating movement for a specific team and time window.",
    tags: ["omega", "analytics", "trends"],
    configuration: {
      query: `
FROM feedback
| WHERE teamId == ?teamId
| WHERE createdAt >= ?startTime
| EVAL day = DATE_TRUNC(1 day, createdAt)
| STATS
    total = COUNT(*),
    avg_rating = AVG(rate),
    negative = COUNT(*) WHERE sentiment == "negative",
    neutral = COUNT(*) WHERE sentiment == "neutral",
    positive = COUNT(*) WHERE sentiment == "positive"
  BY day
| SORT day DESC
| LIMIT ?limit
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
        startTime: {
          type: "date",
          description: "Inclusive start date in ISO format",
        },
        limit: {
          type: "integer",
          description: "Maximum rows to return",
        },
      },
    },
  },
  {
    id: "omega_low_rating_examples",
    type: "esql",
    description:
      "Retrieve low-rated feedback examples for a team, ordered by recency, to explain root causes.",
    tags: ["omega", "analytics", "quality"],
    configuration: {
      query: `
FROM feedback
| WHERE teamId == ?teamId
| WHERE rate <= ?maxRate
| KEEP id, description, sentiment, rate, isResolved, createdAt
| SORT createdAt DESC
| LIMIT ?limit
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
        maxRate: {
          type: "integer",
          description: "Maximum rating threshold (for example 2 or 3)",
        },
        limit: {
          type: "integer",
          description: "Maximum rows to return",
        },
      },
    },
  },
  {
    id: "omega_resolution_snapshot",
    type: "esql",
    description:
      "Single-row operational snapshot: total, open, resolved, average rating, and negative count for a team.",
    tags: ["omega", "ops", "dashboard"],
    configuration: {
      query: `
FROM feedback
| WHERE teamId == ?teamId
| STATS
    total = COUNT(*),
    open = COUNT(*) WHERE isResolved == false,
    resolved = COUNT(*) WHERE isResolved == true,
    avg_rating = AVG(rate),
    negatives = COUNT(*) WHERE sentiment == "negative"
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
      },
    },
  },
  {
    id: "omega_issue_buckets",
    type: "esql",
    description:
      "Counts probable complaint themes (support, performance, bugs, UX, pricing, feature requests) for a team over a time window.",
    tags: ["omega", "analytics", "issues"],
    configuration: {
      query: `
FROM feedback
| WHERE teamId == ?teamId
| WHERE createdAt >= ?startTime
| WHERE sentiment != "positive"
| STATS
    total = COUNT(*),
    support = COUNT(*) WHERE MATCH(description, "support") OR MATCH(description, "customer service") OR MATCH(description, "response"),
    performance = COUNT(*) WHERE MATCH(description, "lag") OR MATCH(description, "lags") OR MATCH(description, "slow") OR MATCH(description, "latency") OR MATCH(description, "performance"),
    bugs = COUNT(*) WHERE MATCH(description, "bug") OR MATCH(description, "crash") OR MATCH(description, "error") OR MATCH(description, "broken"),
    ux = COUNT(*) WHERE MATCH(description, "ui") OR MATCH(description, "ux") OR MATCH(description, "confusing") OR MATCH(description, "hard to use"),
    pricing = COUNT(*) WHERE MATCH(description, "price") OR MATCH(description, "pricing") OR MATCH(description, "expensive") OR MATCH(description, "cost"),
    feature_requests = COUNT(*) WHERE MATCH(description, "feature request") OR MATCH(description, "please add") OR MATCH(description, "would like")
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
        startTime: {
          type: "date",
          description: "Inclusive start date in ISO format",
        },
      },
    },
  },
  {
    id: "omega_urgent_queue",
    type: "esql",
    description:
      "Returns unresolved negative or very low-rating feedback items for urgent triage and customer follow-up.",
    tags: ["omega", "ops", "triage"],
    configuration: {
      query: `
FROM feedback
| WHERE teamId == ?teamId
| WHERE isResolved == false
| WHERE sentiment == "negative" OR rate <= ?maxRate
| KEEP id, description, sentiment, rate, createdAt
| SORT createdAt DESC
| LIMIT ?limit
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
        maxRate: {
          type: "integer",
          description: "Maximum rating threshold considered urgent",
        },
        limit: {
          type: "integer",
          description: "Maximum rows to return",
        },
      },
    },
  },
  {
    id: "omega_issue_clusters",
    type: "esql",
    description:
      "Returns top issue clusters detected from feedback and support conversations for a team.",
    tags: ["omega", "ops", "clusters"],
    configuration: {
      query: `
FROM issue_clusters
| WHERE teamId == ?teamId
| SORT count DESC, lastSeenAt DESC
| LIMIT ?limit
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
        limit: {
          type: "integer",
          description: "Maximum rows to return",
        },
      },
    },
  },

  // ── Workflow 1: Sentiment Spike Tools ────────────────────────────────
  {
    id: "omega_spike_recent_metrics",
    type: "esql",
    description:
      "Returns feedback metrics from the last 1 hour for spike detection: total count, negative count, and average rating.",
    tags: ["omega", "workflow", "sentiment-spike"],
    configuration: {
      query: `
FROM feedback
| WHERE teamId == ?teamId
| WHERE createdAt >= NOW() - 1 hour
| STATS
    recent_total = COUNT(*),
    recent_negative = COUNT(*) WHERE sentiment == "negative",
    recent_avg_rating = AVG(rate)
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
      },
    },
  },
  {
    id: "omega_spike_baseline_metrics",
    type: "esql",
    description:
      "Returns feedback baseline metrics from 1-24 hours ago for comparison with recent spike metrics.",
    tags: ["omega", "workflow", "sentiment-spike"],
    configuration: {
      query: `
FROM feedback
| WHERE teamId == ?teamId
| WHERE createdAt >= NOW() - 24 hours
| WHERE createdAt < NOW() - 1 hour
| STATS
    baseline_total = COUNT(*),
    baseline_negative = COUNT(*) WHERE sentiment == "negative",
    baseline_avg_rating = AVG(rate)
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
      },
    },
  },
  {
    id: "omega_spike_recent_complaints",
    type: "esql",
    description:
      "Returns the most recent negative feedback entries during a spike for root cause analysis.",
    tags: ["omega", "workflow", "sentiment-spike"],
    configuration: {
      query: `
FROM feedback
| WHERE teamId == ?teamId
| WHERE sentiment == "negative"
| WHERE createdAt >= NOW() - 1 hour
| KEEP id, description, rate, createdAt
| SORT createdAt DESC
| LIMIT ?limit
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
        limit: {
          type: "integer",
          description: "Maximum rows to return",
        },
      },
    },
  },

  // ── Workflow 2: Smart Escalation Tools ──────────────────────────────
  {
    id: "omega_conversation_history",
    type: "esql",
    description:
      "Retrieves support conversation messages for a session to provide escalation context.",
    tags: ["omega", "workflow", "escalation"],
    configuration: {
      query: `
FROM support_conversations
| WHERE teamId == ?teamId
| WHERE sessionId == ?sessionId
| KEEP role, message, createdAt
| SORT createdAt ASC
| LIMIT ?limit
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
        sessionId: {
          type: "string",
          description: "Chat session identifier",
        },
        limit: {
          type: "integer",
          description: "Maximum messages to return",
        },
      },
    },
  },
  {
    id: "omega_ticket_stats",
    type: "esql",
    description:
      "Returns support ticket statistics for a team: total, open, in-progress, resolved counts.",
    tags: ["omega", "workflow", "escalation"],
    configuration: {
      query: `
FROM support_tickets
| WHERE teamId == ?teamId
| STATS
    total = COUNT(*),
    open_tickets = COUNT(*) WHERE status == "open",
    in_progress = COUNT(*) WHERE status == "in_progress",
    resolved = COUNT(*) WHERE status == "resolved"
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
      },
    },
  },

  // ── Workflow 3: Knowledge Gap Tools ─────────────────────────────────
  {
    id: "omega_unanswered_queries",
    type: "esql",
    description:
      "Identifies support conversations where the assistant could not answer. These represent knowledge gaps in the support docs.",
    tags: ["omega", "workflow", "knowledge-gap"],
    configuration: {
      query: `
FROM support_conversations
| WHERE teamId == ?teamId
| WHERE role == "assistant"
| WHERE MATCH(message, "enough information") OR MATCH(message, "support team") OR MATCH(message, "trouble generating")
| KEEP sessionId, message, createdAt
| SORT createdAt DESC
| LIMIT ?limit
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
        limit: {
          type: "integer",
          description: "Maximum rows to return",
        },
      },
    },
  },
  {
    id: "omega_recent_user_queries",
    type: "esql",
    description:
      "Returns recent user queries from support conversations to identify what customers are asking about.",
    tags: ["omega", "workflow", "knowledge-gap"],
    configuration: {
      query: `
FROM support_conversations
| WHERE teamId == ?teamId
| WHERE role == "user"
| WHERE createdAt >= ?startTime
| KEEP sessionId, message, createdAt
| SORT createdAt DESC
| LIMIT ?limit
      `.trim(),
      params: {
        teamId: {
          type: "string",
          description: "Team identifier to scope results",
        },
        startTime: {
          type: "date",
          description: "Inclusive start date in ISO format",
        },
        limit: {
          type: "integer",
          description: "Maximum rows to return",
        },
      },
    },
  },
];

// ── Tool Groups for Agents ────────────────────────────────────────────
const sharedTools = [
  "omega_sentiment_trends",
  "omega_low_rating_examples",
  "omega_resolution_snapshot",
  "omega_issue_buckets",
  "omega_urgent_queue",
  "omega_issue_clusters",
  "platform.core.generate_esql",
  "platform.core.execute_esql",
];

const sentimentSpikeTools = [
  ...sharedTools,
  "omega_spike_recent_metrics",
  "omega_spike_baseline_metrics",
  "omega_spike_recent_complaints",
];

const escalationTools = [
  ...sharedTools,
  "omega_conversation_history",
  "omega_ticket_stats",
];

const knowledgeGapTools = [
  ...sharedTools,
  "omega_unanswered_queries",
  "omega_recent_user_queries",
];

// ── Agent Definitions ─────────────────────────────────────────────────
const agents = [
  {
    id: insightsAgentId,
    name: "Omega Insights Agent",
    description:
      "Analyzes customer feedback and returns evidence-backed product insights and actions.",
    labels: ["omega", "analytics", "customer-feedback"],
    avatar_color: "#CFE5D6",
    avatar_symbol: "OM",
    configuration: {
      instructions: `
You are Omega's analytics copilot for product teams.
You help users understand feedback quality, sentiment trends, and action priorities.

Behavior rules:
1. Use tools only when data is needed to answer the request.
2. Do not call tools for greetings/small talk.
3. Always respect the TEAM_ID supplied in the user message and scope every analysis to that team.
4. Prefer the dedicated Omega tools before general-purpose ES|QL generation.
5. Always include concrete evidence (counts, percentages, dates, snippets).
6. If data is limited, state confidence and what data is missing.
7. For recommendation questions, provide a 7-day action plan with owner and expected impact.
8. Never invent metrics. If a number is unavailable, explicitly say so.
9. For any analytics answer, end with exactly one line: "Confidence: <high|medium|low> - <reason>".

Response format for analytics questions:
- Direct answer (1-2 lines)
- Evidence (bulleted metrics)
- Actions (numbered list)
- Confidence (high/medium/low + reason)
      `.trim(),
      tools: [{ tool_ids: sharedTools }],
    },
  },
  {
    id: execAgentId,
    name: "Omega Executive Brief Agent",
    description:
      "Produces concise executive-ready customer feedback briefings with quantified business impact.",
    labels: ["omega", "executive", "briefing"],
    avatar_color: "#E8D6B2",
    avatar_symbol: "EX",
    configuration: {
      instructions: `
You are Omega's executive briefing agent.
Create clear leadership summaries from customer feedback signals.

Rules:
1. Scope everything to TEAM_ID from the prompt.
2. Use tools to verify numbers before making claims.
3. Prioritize business risk, churn signals, and delivery priorities.
4. Keep outputs short and board-ready.
5. Never invent KPIs.

Format:
- Executive takeaway
- Top 3 risks/opportunities with evidence
- 30-day priority plan
- KPI to watch next week
      `.trim(),
      tools: [{ tool_ids: sharedTools }],
    },
  },
  {
    id: triageAgentId,
    name: "Omega Support Triage Agent",
    description:
      "Identifies urgent unresolved feedback, proposes triage actions, and drafts customer-safe response guidance.",
    labels: ["omega", "support", "triage"],
    avatar_color: "#F7D7D7",
    avatar_symbol: "TR",
    configuration: {
      instructions: `
You are Omega's support triage agent.
Focus on urgent unresolved customer pain and immediate remediation steps.

Rules:
1. Scope all analysis by TEAM_ID.
2. For triage requests, call urgent queue and low-rating tools first.
3. Rank urgent items by severity and recency.
4. Propose concrete next steps for support/product owners.
5. Draft concise, empathetic reply templates only when requested.

Output format:
- Urgent items table (id, date, rating/sentiment, risk)
- Triage actions for next 24h and next 7d
- Blockers/unknowns
      `.trim(),
      tools: [{ tool_ids: sharedTools }],
    },
  },
  {
    id: customerSupportAgentId,
    name: "Omega Customer Support Agent",
    description:
      "Answers end-user support questions using retrieved docs with grounded, cited answers.",
    labels: ["omega", "support", "customer-facing"],
    avatar_color: "#DDE8FF",
    avatar_symbol: "CS",
    configuration: {
      instructions: `
You are a friendly, knowledgeable customer support assistant. Your job is to help customers by answering their questions accurately using only the source material provided in each prompt.

Core behavior:
1. Answer the customer's question directly. Do not start with meta-phrases like "Based on the sources" or "According to the documents". Just answer naturally as a support agent would.
2. Place inline citation numbers [1], [2], [3] immediately after the specific fact or sentence they support. Every factual claim must have a citation.
3. Use only information from the provided sources. Never invent product features, pricing, policies, or guarantees.
4. If the sources partially answer the question, answer what you can and be transparent about what you couldn't find.
5. If the question is ambiguous or too vague, ask ONE specific clarifying question instead of guessing.
6. Keep responses concise but complete. Use bullet points or numbered steps for multi-part answers.
7. When helpful, suggest a clear next step the customer can take.
8. Never mention internal system details like "indexed documents", "knowledge base", "retrieved sources", or "Elasticsearch". You are a support agent, not a search engine.
9. Be warm, professional, and empathetic. Acknowledge the customer's concern before diving into the answer.
10. If the sources do not contain relevant information at all, say: "I don't have enough information to answer that question right now. Could you provide more details, or would you like to speak with our support team?"
      `.trim(),
      tools: [{ tool_ids: sharedTools }],
    },
  },

  // ── Workflow Agents ─────────────────────────────────────────────────

  {
    id: sentimentSpikeAgentId,
    name: "Omega Sentiment Spike Analyzer",
    description:
      "Analyzes negative sentiment spikes in customer feedback, determines root cause, assesses business impact severity, and recommends immediate actions.",
    labels: ["omega", "workflow", "sentiment-spike"],
    avatar_color: "#FFD6D6",
    avatar_symbol: "SS",
    configuration: {
      instructions: `
You are Omega's sentiment spike analyzer, part of an automated workflow triggered when negative feedback rates exceed normal thresholds.

Your job:
1. Analyze the provided spike metrics (recent vs baseline negative rates, rating drops).
2. Review the sample negative feedback entries to identify the root cause.
3. Classify the severity as CRITICAL, HIGH, MEDIUM, or LOW based on:
   - CRITICAL: >50% negative rate increase AND avg rating drop >1.5 stars
   - HIGH: >30% negative rate increase OR avg rating drop >1.0 stars
   - MEDIUM: >15% negative rate increase OR avg rating drop >0.5 stars
   - LOW: Slight increase, within normal variance
4. Generate a concise business impact summary suitable for stakeholders.
5. Recommend immediate actions (1-3 items).

You MUST respond in valid JSON with this exact structure:
{
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "spike_summary": "One-line summary of what happened",
  "root_cause": "Brief root cause analysis based on feedback patterns",
  "business_impact": "2-3 sentences explaining business risk for stakeholders",
  "recommended_actions": ["action 1", "action 2", "action 3"],
  "metrics": {
    "recent_negative_rate": <number>,
    "baseline_negative_rate": <number>,
    "rating_drop": <number>
  }
}

Rules:
- Only use data from the metrics and feedback provided. Never invent numbers.
- Be specific about the root cause based on actual feedback text patterns.
- Keep the business impact statement non-technical and stakeholder-friendly.
- Always scope analysis to the TEAM_ID provided.
      `.trim(),
      tools: [{ tool_ids: sentimentSpikeTools }],
    },
  },
  {
    id: escalationAgentId,
    name: "Omega Smart Escalation Agent",
    description:
      "Analyzes support conversations to assess escalation urgency, summarize issues, and recommend routing priority for support tickets.",
    labels: ["omega", "workflow", "escalation"],
    avatar_color: "#FFE5B4",
    avatar_symbol: "SE",
    configuration: {
      instructions: `
You are Omega's smart escalation agent. When a support conversation triggers an escalation signal, you analyze the full conversation context and determine the appropriate response.

Your job:
1. Review the conversation history provided.
2. Identify the customer's core issue and emotional state.
3. Assess urgency: P0 (service down/data loss), P1 (major feature broken), P2 (minor issue/question), P3 (feedback/suggestion).
4. Summarize the issue for the support team in a clear, actionable format.
5. Suggest whether immediate notification is needed or it can be queued.

You MUST respond in valid JSON with this exact structure:
{
  "priority": "P0|P1|P2|P3",
  "issue_summary": "Clear 1-2 sentence summary of the customer's problem",
  "customer_sentiment": "frustrated|confused|neutral|angry",
  "escalation_reason": "Why this was escalated",
  "suggested_response_template": "Draft response the support team can use",
  "requires_immediate_notification": true|false,
  "recommended_team": "support|engineering|billing|product"
}

Rules:
- Be empathetic in the suggested response template.
- P0 and P1 always require immediate notification.
- If the conversation shows the customer is at risk of churning, flag it explicitly.
- Keep summaries concise and actionable for the receiving team.
      `.trim(),
      tools: [{ tool_ids: escalationTools }],
    },
  },
  {
    id: knowledgeGapAgentId,
    name: "Omega Knowledge Gap Detector",
    description:
      "Analyzes support conversations to identify topics where the knowledge base lacks coverage, clusters unanswered queries, and recommends content to add.",
    labels: ["omega", "workflow", "knowledge-gap"],
    avatar_color: "#D6E8FF",
    avatar_symbol: "KG",
    configuration: {
      instructions: `
You are Omega's knowledge gap detector. You analyze support conversations to find topics where the support knowledge base could not provide adequate answers.

Your job:
1. Review the provided unanswered/escalated conversations.
2. Review recent user queries to understand what customers are asking about.
3. Cluster the unanswered topics into themes (e.g., billing, setup, integrations).
4. Rank gaps by frequency and business impact.
5. Recommend specific content pieces that should be added to close each gap.

You MUST respond in valid JSON with this exact structure:
{
  "total_gaps_detected": <number>,
  "analysis_window": "time range analyzed",
  "gaps": [
    {
      "topic": "Topic name",
      "frequency": <number of related unanswered queries>,
      "sample_queries": ["query 1", "query 2"],
      "impact": "HIGH|MEDIUM|LOW",
      "recommended_content": {
        "title": "Suggested article title",
        "outline": ["Section 1", "Section 2", "Section 3"],
        "priority": "immediate|next_sprint|backlog"
      }
    }
  ],
  "summary": "Executive summary of knowledge base health"
}

Rules:
- Only report real gaps backed by actual unanswered queries. Never invent gaps.
- Rank by frequency first, then business impact.
- The recommended content outlines should be specific enough for a content writer to act on.
- Always scope analysis to the TEAM_ID provided.
- If fewer than 3 gaps are found, say the knowledge base is in good shape.
      `.trim(),
      tools: [{ tool_ids: knowledgeGapTools }],
    },
  },
];

// ── Kibana API Helpers ────────────────────────────────────────────────

if (!kibanaUrl || !apiKey) {
  console.error("Missing ELASTIC_KIBANA_URL or ELASTIC_API_KEY.");
  process.exit(1);
}

function buildPath(path) {
  if (spaceId && spaceId !== "default") {
    return `/s/${encodeURIComponent(spaceId)}${path}`;
  }
  return path;
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${kibanaUrl}${buildPath(path)}`, {
    method,
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      "Content-Type": "application/json",
      "kbn-xsrf": "true",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text || null;
  }

  return { ok: response.ok, status: response.status, data: parsed };
}

async function upsertTool(tool) {
  const getRes = await request(
    `/api/agent_builder/tools/${encodeURIComponent(tool.id)}`,
  );

  if (getRes.ok) {
    const updateRes = await request(
      `/api/agent_builder/tools/${encodeURIComponent(tool.id)}`,
      {
        method: "PUT",
        body: {
          description: tool.description,
          tags: tool.tags,
          configuration: tool.configuration,
        },
      },
    );
    if (!updateRes.ok) {
      throw new Error(
        `Failed to update tool ${tool.id}: ${updateRes.status} ${JSON.stringify(updateRes.data)}`,
      );
    }
    console.log(`Updated tool: ${tool.id}`);
    return;
  }

  if (getRes.status !== 404) {
    throw new Error(
      `Failed to read tool ${tool.id}: ${getRes.status} ${JSON.stringify(getRes.data)}`,
    );
  }

  const createRes = await request("/api/agent_builder/tools", {
    method: "POST",
    body: tool,
  });
  if (!createRes.ok) {
    throw new Error(
      `Failed to create tool ${tool.id}: ${createRes.status} ${JSON.stringify(createRes.data)}`,
    );
  }
  console.log(`Created tool: ${tool.id}`);
}

async function upsertAgent(definition) {
  const getRes = await request(
    `/api/agent_builder/agents/${encodeURIComponent(definition.id)}`,
  );

  if (getRes.ok) {
    const updateRes = await request(
      `/api/agent_builder/agents/${encodeURIComponent(definition.id)}`,
      {
        method: "PUT",
        body: {
          name: definition.name,
          description: definition.description,
          labels: definition.labels,
          avatar_color: definition.avatar_color,
          avatar_symbol: definition.avatar_symbol,
          configuration: definition.configuration,
        },
      },
    );
    if (!updateRes.ok) {
      throw new Error(
        `Failed to update agent ${definition.id}: ${updateRes.status} ${JSON.stringify(updateRes.data)}`,
      );
    }
    console.log(`Updated agent: ${definition.id}`);
    return;
  }

  if (getRes.status !== 404) {
    throw new Error(
      `Failed to read agent ${definition.id}: ${getRes.status} ${JSON.stringify(getRes.data)}`,
    );
  }

  const createRes = await request("/api/agent_builder/agents", {
    method: "POST",
    body: definition,
  });
  if (!createRes.ok) {
    throw new Error(
      `Failed to create agent ${definition.id}: ${createRes.status} ${JSON.stringify(createRes.data)}`,
    );
  }
  console.log(`Created agent: ${definition.id}`);
}

async function main() {
  console.log("Syncing Agent Builder tools...");
  for (const tool of tools) {
    await upsertTool(tool);
  }

  console.log("Syncing Agent Builder agents...");
  for (const agent of agents) {
    await upsertAgent(agent);
  }

  console.log("Agent Builder sync complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
