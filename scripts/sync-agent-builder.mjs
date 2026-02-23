import dotenv from "dotenv";

dotenv.config();

const kibanaUrl = process.env.ELASTIC_KIBANA_URL;
const apiKey = process.env.ELASTIC_API_KEY;
const spaceId = process.env.ELASTIC_KIBANA_SPACE_ID || "default";

const insightsAgentId =
  process.env.ELASTIC_CHAT_AGENT_ID || "zapfeed_insights_agent_v1";
const execAgentId =
  process.env.ELASTIC_EXEC_AGENT_ID || "zapfeed_exec_brief_agent_v1";
const triageAgentId =
  process.env.ELASTIC_TRIAGE_AGENT_ID || "zapfeed_support_triage_agent_v1";
const customerSupportAgentId =
  process.env.ELASTIC_CUSTOMER_AGENT_ID || "zapfeed_customer_support_agent_v1";

const tools = [
  {
    id: "zapfeed_feedback_sentiment_trends_v1",
    type: "esql",
    description:
      "Trend analysis for feedback volume, sentiment mix, and rating movement for a specific team and time window.",
    tags: ["zapfeed", "analytics", "trends"],
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
    id: "zapfeed_feedback_low_rating_examples_v1",
    type: "esql",
    description:
      "Retrieve low-rated feedback examples for a team, ordered by recency, to explain root causes.",
    tags: ["zapfeed", "analytics", "quality"],
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
    id: "zapfeed_feedback_resolution_snapshot_v1",
    type: "esql",
    description:
      "Single-row operational snapshot: total, open, resolved, average rating, and negative count for a team.",
    tags: ["zapfeed", "ops", "dashboard"],
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
    id: "zapfeed_feedback_issue_buckets_v1",
    type: "esql",
    description:
      "Counts probable complaint themes (support, performance, bugs, UX, pricing, feature requests) for a team over a time window.",
    tags: ["zapfeed", "analytics", "issues"],
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
    id: "zapfeed_feedback_urgent_queue_v1",
    type: "esql",
    description:
      "Returns unresolved negative or very low-rating feedback items for urgent triage and customer follow-up.",
    tags: ["zapfeed", "ops", "triage"],
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
    id: "zapfeed_issue_clusters_snapshot_v1",
    type: "esql",
    description:
      "Returns top issue clusters detected from feedback and support conversations for a team.",
    tags: ["zapfeed", "ops", "clusters"],
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
];

const sharedTools = [
  "zapfeed_feedback_sentiment_trends_v1",
  "zapfeed_feedback_low_rating_examples_v1",
  "zapfeed_feedback_resolution_snapshot_v1",
  "zapfeed_feedback_issue_buckets_v1",
  "zapfeed_feedback_urgent_queue_v1",
  "zapfeed_issue_clusters_snapshot_v1",
  "platform.core.generate_esql",
  "platform.core.execute_esql",
];

const agents = [
  {
    id: insightsAgentId,
    name: "Zapfeed Insights Agent",
    description:
      "Analyzes customer feedback and returns evidence-backed product insights and actions.",
    labels: ["zapfeed", "analytics", "customer-feedback"],
    avatar_color: "#CFE5D6",
    avatar_symbol: "ZF",
    configuration: {
      instructions: `
You are Zapfeed's analytics copilot for product teams.
You help users understand feedback quality, sentiment trends, and action priorities.

Behavior rules:
1. Use tools only when data is needed to answer the request.
2. Do not call tools for greetings/small talk.
3. Always respect the TEAM_ID supplied in the user message and scope every analysis to that team.
4. Prefer the dedicated Zapfeed tools before general-purpose ES|QL generation.
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
    name: "Zapfeed Executive Brief Agent",
    description:
      "Produces concise executive-ready customer feedback briefings with quantified business impact.",
    labels: ["zapfeed", "executive", "briefing"],
    avatar_color: "#E8D6B2",
    avatar_symbol: "EX",
    configuration: {
      instructions: `
You are Zapfeed's executive briefing agent.
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
    name: "Zapfeed Support Triage Agent",
    description:
      "Identifies urgent unresolved feedback, proposes triage actions, and drafts customer-safe response guidance.",
    labels: ["zapfeed", "support", "triage"],
    avatar_color: "#F7D7D7",
    avatar_symbol: "TR",
    configuration: {
      instructions: `
You are Zapfeed's support triage agent.
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
    name: "Zapfeed Customer Support Agent",
    description:
      "Answers end-user support questions using retrieved docs and always cites sources.",
    labels: ["zapfeed", "support", "customer-facing"],
    avatar_color: "#DDE8FF",
    avatar_symbol: "CS",
    configuration: {
      instructions: `
You are Zapfeed's customer support assistant.
You answer customer questions using only the sources provided in the prompt context.

Rules:
1. Keep responses concise and support-oriented.
2. Cite factual claims using [1], [2], [3] style references.
3. If the provided sources do not contain the answer, say so clearly.
4. Do not invent product policies, pricing, or guarantees.
5. When relevant, include one short next step for the customer.
      `.trim(),
      tools: [{ tool_ids: sharedTools }],
    },
  },
];

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
