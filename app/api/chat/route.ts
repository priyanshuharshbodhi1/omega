import { invokeAgent } from "@/lib/agent-builder";
import {
  esClient,
  findRelatedFeedbackByVector,
  getElasticTextEmbedding,
  getTeam,
  runElasticCompletion,
} from "@/lib/elasticsearch";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function pickAgentId(question: string) {
  const text = String(question || "").toLowerCase();
  const triageHints = [
    "urgent",
    "triage",
    "ticket",
    "incident",
    "critical",
    "p0",
    "p1",
    "complaint follow up",
  ];
  const execHints = [
    "executive",
    "board",
    "leadership",
    "ceo",
    "cfo",
    "quarterly",
    "qbr",
    "business impact",
  ];

  if (triageHints.some((hint) => text.includes(hint))) {
    return process.env.ELASTIC_TRIAGE_AGENT_ID || "omega_support_triage";
  }
  if (execHints.some((hint) => text.includes(hint))) {
    return process.env.ELASTIC_EXEC_AGENT_ID || "omega_executive_brief";
  }
  return (
    process.env.ELASTIC_CHAT_AGENT_ID ||
    process.env.ELASTIC_SUMMARY_AGENT_ID ||
    "omega_insights"
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

export async function POST(req: Request) {
  const { messages, team, session, conversationId } = await req.json();
  const teamId = team?.id;

  if (!Array.isArray(messages) || messages.length === 0 || !teamId) {
    return new Response("Invalid chat payload", { status: 400 });
  }

  const currentMessageContent = messages[messages.length - 1].content;
  const agentId = pickAgentId(currentMessageContent);
  const contextSize = parsePositiveInt(process.env.ELASTIC_CHAT_CONTEXT_SIZE, 6);
  const agentTimeoutMs = parsePositiveInt(process.env.ELASTIC_AGENT_TIMEOUT_MS, 7000);
  const mode = (process.env.ELASTIC_ANALYSIS_MODE || "deep").toLowerCase();

  try {
    const teamDetails = await getTeam(teamId);
    const issueTracker = teamDetails?.issueTracker || "github";
    let relateds: any[] = [];

    const queryVector = await withTimeout(
      getElasticTextEmbedding(currentMessageContent),
      4000,
      "Embedding timeout",
    ).catch(() => null);

    if (queryVector) {
      relateds = await findRelatedFeedbackByVector({
        queryVector,
        teamId,
        size: contextSize,
      });
    }

    if (relateds.length === 0) {
      const lexical = await esClient.search({
        index: "feedback",
        size: contextSize,
        query: {
          bool: {
            filter: [{ term: { teamId } }],
            must: [
              {
                match: {
                  description: {
                    query: currentMessageContent,
                  },
                },
              },
            ],
          },
        },
        _source: ["description", "sentiment", "rate", "createdAt"],
      });

      relateds = lexical.hits.hits.map((hit) => ({
        description: (hit._source as any)?.description || "",
        sentiment: (hit._source as any)?.sentiment || "neutral",
        rate: (hit._source as any)?.rate ?? null,
        createdAt: (hit._source as any)?.createdAt || null,
      }));
    }

    const context = relateds
      .map(
        (r) =>
          `- [${String(r.createdAt || "").split("T")[0] || "unknown"}] (${r.sentiment}, ${r.rate ?? "N/A"}★): ${r.description}`,
      )
      .join("\n");

    const [supportChats, issueClusters, supportSummary] = await Promise.all([
      esClient.search({
        index: process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX || "support_conversations",
        size: Math.max(4, Math.floor(contextSize / 2)),
        query: {
          bool: {
            filter: [{ term: { teamId } }, { term: { role: "user" } }],
            must: [{ match: { message: { query: currentMessageContent } } }],
          },
        },
        _source: ["message", "createdAt"],
        sort: [{ createdAt: "desc" }],
      }),
      esClient.search({
        index: process.env.ELASTIC_ISSUE_CLUSTERS_INDEX || "issue_clusters",
        size: 5,
        query: { term: { teamId } },
        sort: [{ count: "desc" }],
        _source: ["title", "count", "status", "lastSeenAt"],
      }),
      esClient.search({
        index: process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX || "support_conversations",
        size: 0,
        query: {
          bool: {
            filter: [
              { term: { teamId } },
              { range: { createdAt: { gte: "now-7d/d" } } },
            ],
          },
        },
        aggs: {
          sessions: {
            cardinality: { field: "sessionId" },
          },
        },
      }),
    ]);

    const supportContext = supportChats.hits.hits
      .map((hit) => {
        const src = (hit._source as any) || {};
        return `- [${String(src.createdAt || "").split("T")[0] || "unknown"}] ${src.message || ""}`;
      })
      .join("\n");
    const clustersContext = issueClusters.hits.hits
      .map((hit) => {
        const src = (hit._source as any) || {};
        return `- ${src.title} | count=${src.count || 0} | status=${src.status || "open"} | lastSeen=${String(src.lastSeenAt || "").split("T")[0] || "N/A"}`;
      })
      .join("\n");
    const sessions7d = Number((supportSummary.aggregations as any)?.sessions?.value || 0);

    try {
      const prompt = `TEAM_ID=${teamId}
USER=${session?.user?.name || "Unknown"}
QUESTION=${currentMessageContent}
TARGET_AGENT=${agentId}
ISSUE_TRACKER=${issueTracker}

Recent feedback evidence:
${context || "- No direct matches found."}

Recent support-chat evidence:
${supportContext || "- No support chat matches found."}

Top issue clusters:
${clustersContext || "- No clusters yet."}

Operational support metrics:
- Support sessions in last 7d: ${sessions7d}

Answer requirements:
- Keep answer under 8 bullet lines.
- Focus on actionable answer to the question.
- If data is insufficient, say exactly what is missing.
- Mention whether evidence came from feedback, support chat, or both.
`;

      if (mode === "fast") {
        const text = await withTimeout(
          runElasticCompletion(prompt),
          Math.min(agentTimeoutMs, 6000),
          "Completion timed out",
        );
        if (String(text).trim().length > 0) {
          return new Response(String(text), {
            headers: new Headers({ "x-chat-engine": "elastic-completion-fast" }),
          });
        }
      } else {
        const agentResponse = await withTimeout(
          invokeAgent({
            agentId,
            message: prompt,
            conversationId,
          }),
          agentTimeoutMs,
          "Agent Builder request timed out",
        );

        const text =
          (agentResponse as any)?.response?.message ||
          (agentResponse as any)?.message ||
          "";
        const nextConversationId =
          (agentResponse as any)?.response?.conversation_id ||
          (agentResponse as any)?.conversation_id ||
          "";

        if (String(text).trim().length > 0) {
          const headers = new Headers({
            "x-chat-engine": "agent-builder",
          });
          if (nextConversationId) {
            headers.set("x-agent-conversation-id", String(nextConversationId));
          }
          return new Response(String(text), { headers });
        }
      }
    } catch (agentError) {
      console.error("Agent Builder chat failed:", agentError);
      return new Response("Omega agent is temporarily unavailable.", {
        status: 502,
      });
    }
    return new Response("No response generated.", { status: 502 });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response("Chat is temporarily unavailable.", {
      status: 500,
    });
  }
}
