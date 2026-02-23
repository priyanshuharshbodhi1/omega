import { invokeAgent } from "@/lib/agent-builder";
import {
  createSupportConversationMessage,
  runElasticCompletion,
  searchSupportKnowledge,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

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
  try {
    const body = await req.json();
    const teamId = String(body?.teamId || "").trim();
    const userMessage = String(body?.message || "").trim();
    const language = String(body?.language || "en").toLowerCase();
    const sessionId = String(body?.sessionId || `session-${Date.now()}`);
    const dissatisfactionRegex =
      /(not helpful|not satisfied|unsatisfied|didn't help|did not help|human support|talk to human|agent is wrong|bad answer)/i;

    if (!teamId || !userMessage) {
      return NextResponse.json(
        { success: false, message: "Missing teamId or message." },
        { status: 400 },
      );
    }

    const maybeTranslateToEnglish = async (input: string) => {
      if (!input || language === "en") return input;
      const translated = await runElasticCompletion(
        `Translate this user query to English and return only translated text:\n${input}`,
      );
      return translated || input;
    };

    const maybeTranslateFromEnglish = async (input: string) => {
      if (!input || language === "en") return input;
      const languageLabelMap: Record<string, string> = {
        es: "Spanish",
        fr: "French",
        de: "German",
        hi: "Hindi",
        ar: "Arabic",
      };
      const target = languageLabelMap[language] || "English";
      const translated = await runElasticCompletion(
        `Translate this support response to ${target}. Keep citations like [1] unchanged:\n${input}`,
      );
      return translated || input;
    };

    const retrievalQuery = await maybeTranslateToEnglish(userMessage);

    const citations = await searchSupportKnowledge({
      teamId,
      query: retrievalQuery,
      size: 4,
    });

    const sourceContext =
      citations.length > 0
        ? citations
            .map(
              (item, idx) =>
                `[${idx + 1}] ${item.title}\nSnippet: ${item.snippet || "N/A"}\nURL: ${item.url || "N/A"}`,
            )
            .join("\n\n")
        : "No indexed support sources found for this team.";

    await createSupportConversationMessage({
      teamId,
      sessionId,
      role: "user",
      message: userMessage,
      sourceRefs: [],
    });

    if (citations.length === 0) {
      const noSourceReplyBase =
        "I do not have indexed docs for this workspace yet. Please ask your admin to add docs/website links in Integrations > Arya Knowledge Hub. If you want, I can route you to human support now.";
      const noSourceReply = await maybeTranslateFromEnglish(noSourceReplyBase);

      await createSupportConversationMessage({
        teamId,
        sessionId,
        role: "assistant",
        message: noSourceReply,
        sourceRefs: [],
      });

      return NextResponse.json({
        success: true,
        data: {
          sessionId,
          conversationId: null,
          reply: noSourceReply,
          citations: [],
          escalation: {
            suggested: true,
            reason: "no_sources",
            contactUrl: `/support/contact/${encodeURIComponent(teamId)}?sessionId=${encodeURIComponent(sessionId)}&lang=${encodeURIComponent(language)}`,
          },
        },
      });
    }

    const agentId =
      process.env.ELASTIC_CUSTOMER_AGENT_ID || "zapfeed_customer_support_agent_v1";
    const agentTimeoutMs = Number(process.env.ELASTIC_AGENT_TIMEOUT_MS || "7000");

      const prompt = `TEAM_ID=${teamId}
SESSION_ID=${sessionId}
QUESTION=${retrievalQuery}
ORIGINAL_LANGUAGE=${language}

Retrieved sources:
${sourceContext}

Respond in this format:
## Answer
<short relevant answer>

## Citations
- <statement> [1]
- <statement> [2]

## Need Clarification (only if needed)
<ask one precise follow-up question when query is ambiguous>

Rules:
- Use only the provided sources.
- Keep it concise and relevant.
- Use [1], [2], ... citations for factual claims.`;

    let conversationId =
      (body?.conversationId as string | null | undefined) || null;
    let finalReply = "";

    try {
      const agentResponse = await withTimeout(
        invokeAgent({
          agentId,
          message: prompt,
          conversationId: body?.conversationId,
        }),
        agentTimeoutMs,
        "Agent timeout",
      );

      const replyText = String(
        (agentResponse as any)?.response?.message ||
          (agentResponse as any)?.message ||
          "",
      ).trim();

      conversationId =
        (agentResponse as any)?.response?.conversation_id ||
        (agentResponse as any)?.conversation_id ||
        conversationId;
      finalReply = replyText;
    } catch {
      const top = citations.slice(0, 2);
      const bulletLines = top
        .map(
          (item, idx) =>
            `- ${item.snippet || item.title} [${idx + 1}]`,
        )
        .join("\n");
      finalReply = [
        "## Answer",
        "I found relevant information from your support docs.",
        "",
        "## Citations",
        bulletLines || "- I found a related source, but details were limited. [1]",
        "",
        "## Need Clarification",
        "Could you share which exact page or feature you're asking about so I can narrow the answer?",
      ].join("\n");
    }

    if (!finalReply) {
      finalReply =
        "I could not generate a response right now. Please try again in a moment.";
    }

    finalReply = await maybeTranslateFromEnglish(finalReply);

    const escalationNeeded =
      dissatisfactionRegex.test(userMessage) ||
      /could not generate|temporarily unavailable/i.test(finalReply);

    await createSupportConversationMessage({
      teamId,
      sessionId,
      role: "assistant",
      message: finalReply,
      sourceRefs: citations.map((item) => ({
        id: String(item.id),
        title: String(item.title),
        url: item.url ? String(item.url) : null,
      })),
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        conversationId,
        reply: finalReply,
        citations,
        escalation: {
          suggested: escalationNeeded,
          reason: escalationNeeded ? "user_dissatisfied_or_low_confidence" : null,
          contactUrl: escalationNeeded
            ? `/support/contact/${encodeURIComponent(teamId)}?sessionId=${encodeURIComponent(sessionId)}&lang=${encodeURIComponent(language)}`
            : null,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Support chat failed." },
      { status: 500 },
    );
  }
}
