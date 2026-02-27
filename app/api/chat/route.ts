import { invokeAgent } from "@/lib/agent-builder";
import {
  esClient,
  findRelatedFeedbackByVector,
  getElasticTextEmbedding,
  getTeam,
  runElasticCompletion,
} from "@/lib/elasticsearch";
import { getChatModel } from "@/lib/llm";

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

function shouldPreferAgent(question: string) {
  const text = String(question || "").toLowerCase();
  const priorityHints = [
    "urgent",
    "triage",
    "ticket",
    "incident",
    "critical",
    "p0",
    "p1",
    "executive",
    "board",
    "leadership",
    "ceo",
    "cfo",
    "quarterly",
    "qbr",
  ];
  return priorityHints.some((hint) => text.includes(hint));
}

function parseCommaSeparated(raw: string | undefined) {
  return String(raw || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
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
  const normalizedConversationId =
    typeof conversationId === "string" && conversationId.trim().length > 0
      ? conversationId.trim()
      : undefined;

  if (!Array.isArray(messages) || messages.length === 0 || !teamId) {
    return new Response("Invalid chat payload", { status: 400 });
  }

  const currentMessageContent = messages[messages.length - 1].content;
  const agentId = pickAgentId(currentMessageContent);
  const contextSize = parsePositiveInt(process.env.ELASTIC_CHAT_CONTEXT_SIZE, 6);
  const agentTimeoutMs = parsePositiveInt(process.env.ELASTIC_AGENT_TIMEOUT_MS, 7000);
  const completionTimeoutMs = parsePositiveInt(
    process.env.ELASTIC_COMPLETION_TIMEOUT_MS,
    2800,
  );
  const mode = (process.env.ELASTIC_ANALYSIS_MODE || "hybrid").toLowerCase();
  const normalizedMode = ["fast", "hybrid", "deep"].includes(mode)
    ? mode
    : "hybrid";
  const preferAgent = shouldPreferAgent(currentMessageContent);
  const chatToolIds = parseCommaSeparated(process.env.ELASTIC_CHAT_TOOL_IDS);
  const retrievalSize = preferAgent ? contextSize : Math.min(contextSize, 4);

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
        size: retrievalSize,
      });
    }

    if (relateds.length === 0) {
      const lexical = await withTimeout(
        esClient.search({
          index: "feedback",
          size: retrievalSize,
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
        }),
        2500,
        "Feedback lexical search timed out",
      ).catch(() => ({ hits: { hits: [] } } as any));

      relateds = lexical.hits.hits.map((hit: any) => ({
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
      withTimeout(
        esClient.search({
          index:
            process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX ||
            "support_conversations",
          size: Math.max(3, Math.floor(retrievalSize / 2)),
          query: {
            bool: {
              filter: [{ term: { teamId } }, { term: { role: "user" } }],
              must: [{ match: { message: { query: currentMessageContent } } }],
            },
          },
          _source: ["message", "createdAt"],
          sort: [{ createdAt: "desc" }],
        }),
        2600,
        "Support search timed out",
      ).catch(() => ({ hits: { hits: [] } } as any)),
      withTimeout(
        esClient.search({
          index: process.env.ELASTIC_ISSUE_CLUSTERS_INDEX || "issue_clusters",
          size: 5,
          query: { term: { teamId } },
          sort: [{ count: "desc" }],
          _source: ["title", "count", "status", "lastSeenAt"],
        }),
        2200,
        "Issue-cluster search timed out",
      ).catch(() => ({ hits: { hits: [] } } as any)),
      withTimeout(
        esClient.search({
          index:
            process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX ||
            "support_conversations",
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
        2200,
        "Support summary search timed out",
      ).catch(() => ({ aggregations: { sessions: { value: 0 } } } as any)),
    ]);

    const supportContext = supportChats.hits.hits
      .map((hit: any) => {
        const src = (hit._source as any) || {};
        return `- [${String(src.createdAt || "").split("T")[0] || "unknown"}] ${src.message || ""}`;
      })
      .join("\n");
    const clustersContext = issueClusters.hits.hits
      .map((hit: any) => {
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

      const respondWithCompletion = (text: string, engine: string) =>
        new Response(text, {
          headers: new Headers({ "x-chat-engine": engine }),
        });

      const respondWithAgent = (
        text: string,
        nextConversationId: string,
        engine = "agent-builder",
      ) => {
        const headers = new Headers({
          "x-chat-engine": engine,
        });
        if (nextConversationId) {
          headers.set("x-agent-conversation-id", nextConversationId);
        }
        return new Response(text, { headers });
      };

      const runCompletionAnswer = async (timeoutMs: number) => {
        const text = await withTimeout(
          runElasticCompletion(prompt),
          timeoutMs,
          "Completion timed out",
        ).catch(() => "");
        const normalized = String(text || "").trim();
        if (normalized.length > 0) {
          return normalized;
        }

        // If Elastic completion is unavailable/empty, fallback to configured LLM (OpenAI/Groq).
        try {
          const model = getChatModel(0.2);
          const backup = await withTimeout(
            model.invoke(prompt) as any,
            Math.max(2200, Math.min(timeoutMs, 5000)),
            "Backup completion timed out",
          );
          return String((backup as any)?.content || "").trim();
        } catch {
          return "";
        }
      };

      const runAgentAnswer = async (timeoutMs: number) => {
        const configurationOverrides: any = {
          instructions:
            "Return concise, data-backed product insights in no more than 8 bullet lines.",
        };
        if (chatToolIds.length > 0) {
          configurationOverrides.tools = [{ tool_ids: chatToolIds }];
        }

        const agentResponse = await withTimeout(
          invokeAgent({
            agentId,
            message: prompt,
            conversationId: normalizedConversationId,
            configurationOverrides,
          }),
          timeoutMs,
          "Agent Builder request timed out",
        );

        const text = String(
          (agentResponse as any)?.response?.message ||
            (agentResponse as any)?.message ||
            "",
        ).trim();
        const nextConversationId = String(
          (agentResponse as any)?.response?.conversation_id ||
            (agentResponse as any)?.conversation_id ||
            "",
        ).trim();

        return {
          text,
          nextConversationId,
        };
      };

      // Fast mode: prioritize low latency completion.
      if (normalizedMode === "fast") {
        const fastText = await runCompletionAnswer(
          Math.min(completionTimeoutMs, agentTimeoutMs),
        ).catch(() => "");
        if (fastText) {
          return respondWithCompletion(fastText, "elastic-completion-fast");
        }

        const backupAgent = await runAgentAnswer(Math.min(agentTimeoutMs, 4500))
          .catch(() => null);
        if (backupAgent?.text) {
          return respondWithAgent(
            backupAgent.text,
            backupAgent.nextConversationId,
            "agent-builder-fast-fallback",
          );
        }

        return new Response("No response generated.", { status: 502 });
      }

      // Deep mode (or high-priority question): prefer Agent Builder first,
      // then fallback to completion instead of failing hard.
      if (normalizedMode === "deep" || preferAgent) {
        const agentResult = await runAgentAnswer(agentTimeoutMs).catch((error) => {
          console.error("Agent Builder chat failed:", error);
          return null;
        });

        if (agentResult?.text) {
          return respondWithAgent(
            agentResult.text,
            agentResult.nextConversationId,
            "agent-builder",
          );
        }

        const completionFallback = await runCompletionAnswer(
          Math.max(2200, Math.min(completionTimeoutMs, 6000)),
        ).catch(() => "");
        if (completionFallback) {
          return respondWithCompletion(
            completionFallback,
            "elastic-completion-deep-fallback",
          );
        }

        return new Response("Omega agent is temporarily unavailable.", {
          status: 502,
        });
      }

      // Hybrid mode: race completion and agent, return the first non-empty response.
      const agentPromise = runAgentAnswer(agentTimeoutMs)
        .then((result) => ({
          source: "agent" as const,
          text: result.text,
          nextConversationId: result.nextConversationId,
        }))
        .catch((error) => {
          console.error("Agent Builder chat failed:", error);
          return {
            source: "agent" as const,
            text: "",
            nextConversationId: "",
          };
        });

      const completionPromise = runCompletionAnswer(completionTimeoutMs)
        .then((text) => ({
          source: "completion" as const,
          text,
        }))
        .catch(() => ({
          source: "completion" as const,
          text: "",
        }));

      const first = await Promise.race([agentPromise, completionPromise]);

      if (first.source === "agent" && first.text) {
        return respondWithAgent(
          first.text,
          first.nextConversationId,
          "agent-builder-hybrid",
        );
      }

      if (first.source === "completion" && first.text) {
        return respondWithCompletion(first.text, "elastic-completion-hybrid");
      }

      const second =
        first.source === "agent"
          ? await completionPromise
          : await agentPromise;

      if (second.source === "agent" && second.text) {
        return respondWithAgent(
          second.text,
          second.nextConversationId,
          "agent-builder-hybrid-fallback",
        );
      }

      if (second.source === "completion" && second.text) {
        return respondWithCompletion(
          second.text,
          "elastic-completion-hybrid-fallback",
        );
      }
    } catch (agentError) {
      console.error("Agent Builder chat failed:", agentError);
      const emergencyFallback = await runElasticCompletion(
        `${currentMessageContent}\n\nContext:\n${context || "- none"}`,
      ).catch(() => "");
      if (String(emergencyFallback || "").trim().length > 0) {
        return new Response(String(emergencyFallback), {
          headers: new Headers({
            "x-chat-engine": "elastic-completion-emergency-fallback",
          }),
        });
      }
      return new Response("Omega agent is temporarily unavailable.", { status: 502 });
    }
    return new Response("No response generated.", { status: 502 });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response("Chat is temporarily unavailable.", {
      status: 500,
    });
  }
}
