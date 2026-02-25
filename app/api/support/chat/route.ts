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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildSourceContext(
  citations: Array<{
    title: string;
    snippet: string;
    content?: string;
    url?: string | null;
  }>,
) {
  return citations
    .map((item, idx) => {
      const body = item.content || item.snippet || "";
      return `[Source ${idx + 1}] Title: ${item.title}\nContent: ${body}${item.url ? `\nURL: ${item.url}` : ""}`;
    })
    .join("\n\n---\n\n");
}

function computeAnswerConfidence(
  citations: Array<{ score?: number | null }>,
) {
  if (!Array.isArray(citations) || citations.length === 0) return 0;

  const top = citations.slice(0, 3);
  const meanScore =
    top.reduce((sum, item) => sum + Number(item.score || 0), 0) / top.length;

  // RRF maximum when lexical + semantic both rank a doc at #1: 2 / (60 + 1)
  const theoreticalMaxRrf = 2 / 61;
  const normalizedRelevance = clamp(meanScore / theoreticalMaxRrf, 0, 1);
  const sourceCoverage = clamp(citations.length / 3, 0, 1);
  const blended = normalizedRelevance * 0.75 + sourceCoverage * 0.25;

  return clamp(Math.round(blended * 100), 25, 99);
}

function parseFollowUpQuestions(raw: string) {
  const text = String(raw || "").trim();
  if (!text) return [];

  const withoutFences = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(withoutFences);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0)
        .slice(0, 3);
    }
  } catch {
    // Try line-based fallback below.
  }

  return withoutFences
    .split("\n")
    .map((line) => line.replace(/^[-*0-9.)\s]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);
}

async function generateFollowUpQuestions(params: {
  question: string;
  answer: string;
  citations: Array<{ title: string; snippet: string }>;
  outputLanguage: string;
}) {
  const sourceSummary = params.citations
    .slice(0, 3)
    .map((item, idx) => `[${idx + 1}] ${item.title}: ${item.snippet}`)
    .join("\n");

  const prompt = `Generate 3 short follow-up questions a customer might ask next.

Customer question: ${params.question}
Assistant answer: ${params.answer}
Relevant context:
${sourceSummary}

Rules:
- Return ONLY a JSON array of 3 strings.
- Keep each question under 90 characters.
- Avoid repeating the original question.
- Make each question concrete and useful.
- Output language: ${params.outputLanguage}.`;

  try {
    const generated = await runElasticCompletion(prompt);
    const parsed = parseFollowUpQuestions(generated);
    if (parsed.length >= 2) {
      return parsed.slice(0, 3);
    }
  } catch {
    // Fall through to static fallback.
  }

  return [
    "Can you share the exact steps to do this?",
    "Where can I verify this in the docs?",
    "What should I do if this still doesn't work?",
  ];
}

function buildAgentPrompt(
  query: string,
  sourceContext: string,
  sourceCount: number,
) {
  return `You are a helpful customer support assistant. A customer has asked the following question. Answer it using ONLY the provided sources below.

CUSTOMER QUESTION: ${query}

---
KNOWLEDGE BASE SOURCES (${sourceCount} results):
${sourceContext}
---

INSTRUCTIONS:
1. Answer the customer's question directly and naturally, as a knowledgeable support agent would.
2. Only use information from the sources above. Never make up information, policies, or details.
3. Place citation numbers like [1], [2] inline right after the sentence or fact they support. Each citation number corresponds to a source above.
4. If the sources only partially answer the question, answer what you can and clearly state what you couldn't find.
5. If the question is ambiguous or too vague to answer well, ask ONE specific clarifying question to help you give a better answer.
6. Keep your answer concise but complete. Use bullet points or short paragraphs for readability.
7. Do NOT mention "sources", "indexed documents", "knowledge base", or any internal system details. Just answer naturally.
8. Do NOT start with "Based on the provided sources" or similar meta-phrases. Jump straight into the answer.
9. If none of the sources are relevant to the question, say: "I don't have enough information to answer that question. Could you rephrase or provide more details? You can also reach out to our support team for further help."`;
}

/**
 * When the Agent Builder times out, use Elastic Completion (fast LLM) to
 * generate a proper answer from the retrieved docs instead of dumping raw
 * snippets.
 */
async function buildFallbackReply(
  query: string,
  citations: Array<{ title: string; snippet: string; content?: string; url?: string | null }>,
) {
  const top = citations.slice(0, 3);
  const context = top
    .map((item, idx) => {
      const body = item.content || item.snippet || "";
      const trimmed = body.length > 600 ? body.slice(0, 600) + "..." : body;
      return `[${idx + 1}] ${item.title}: ${trimmed}`;
    })
    .join("\n\n");

  const completionPrompt = `You are a helpful customer support assistant. Answer the customer's question using ONLY the information below. Be concise, natural, and helpful. Use [1], [2], [3] inline citations after facts. Do NOT mention "sources" or "documents". If the information doesn't fully answer the question, say what you can and ask a clarifying question.

Customer question: ${query}

Information:
${context}

Answer:`;

  try {
    const generated = await runElasticCompletion(completionPrompt);
    if (generated && generated.length > 20) {
      return generated;
    }
  } catch {
    // Fall through to static fallback
  }

  // Last-resort static fallback
  return "I wasn't able to find a specific answer to your question. Could you provide a bit more detail about what you're trying to do? That way I can help you better. You can also reach out to our support team directly.";
}

/**
 * Clean up any internal/meta language the agent may have leaked and
 * normalize formatting for the chat widget.
 */
function cleanAgentReply(text: string): string {
  let cleaned = text
    // Remove meta-phrases about sources/documents
    .replace(/\b[Bb]ased on (?:the )?(?:provided |retrieved |indexed |available )?(?:sources?|documents?|information)\b/g, "")
    .replace(/\b[Aa]ccording to (?:the )?(?:provided |indexed |retrieved )?(?:documents?|sources?|information)\b/g, "")
    .replace(/\bfrom the (?:indexed |provided |retrieved )?(?:knowledge base|sources?|documents?)\b/g, "")
    .replace(/\bthe (?:provided |indexed |retrieved )(?:sources?|documents?|information)\b/gi, "the available information")
    .replace(/\bno (?:indexed |relevant )?(?:sources?|documents?) (?:were )?found\b/gi, "I couldn't find specific information on that")
    // Clean up leading commas/whitespace left after removals
    .replace(/^\s*[,;]\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Remove "## Answer" / "## Citations" / "## Need Clarification" headers
  // that the old prompt format used - we want natural flowing text
  cleaned = cleaned
    .replace(/^##\s*Answer\s*\n*/im, "")
    .replace(/^##\s*Citations?\s*\n*/im, "\n")
    .replace(/^##\s*Need Clarification\s*\n*/im, "\n")
    .trim();

  return cleaned;
}

/**
 * Build deduplicated citation list for the client. Multiple chunks from
 * the same source get merged into one citation entry.
 */
function buildClientCitations(
  citations: Array<{
    id: string;
    title: string;
    url?: string | null;
    snippet: string;
    sourceType: string;
    sourceId?: string | null;
  }>,
) {
  const seen = new Map<string, {
    id: string;
    title: string;
    url: string | null;
    snippet: string;
    sourceType: string;
  }>();

  for (const item of citations) {
    // Deduplicate by sourceId (same document, different chunks) or by title+url
    const key = item.sourceId || `${item.title}::${item.url || ""}`;
    if (!seen.has(key)) {
      seen.set(key, {
        id: item.id,
        title: item.title,
        url: item.url || null,
        snippet: item.snippet.length > 120 ? item.snippet.slice(0, 120) + "..." : item.snippet,
        sourceType: item.sourceType,
      });
    }
  }

  return Array.from(seen.values());
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teamId = String(body?.teamId || "").trim();
    const userMessage = String(body?.message || "").trim();
    const language = String(body?.language || "en").toLowerCase();
    const sessionId = String(body?.sessionId || `session-${Date.now()}`);
    const dissatisfactionRegex =
      /(not helpful|not satisfied|unsatisfied|didn't help|did not help|human support|talk to human|agent is wrong|bad answer|speak to someone|real person|real agent)/i;

    if (!teamId || !userMessage) {
      return NextResponse.json(
        { success: false, message: "Missing teamId or message." },
        { status: 400 },
      );
    }

    const supportedLanguages: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      hi: "Hindi",
      ar: "Arabic",
    };

    // Auto-detect language from user text if not explicitly set or set to "auto"
    const detectLanguage = async (text: string): Promise<string> => {
      if (language !== "auto" && language !== "en") return language;
      if (language === "en") {
        // Quick heuristic: if text contains non-Latin characters, auto-detect
        const hasNonLatin = /[^\u0000-\u007F]/.test(text);
        if (!hasNonLatin) return "en";
      }
      try {
        const detected = await runElasticCompletion(
          `Detect the language of the following text. Reply with ONLY the ISO 639-1 two-letter language code (one of: en, es, fr, de, hi, ar). If unsure, reply "en".\n\nText: ${text}`,
        );
        const code = (detected || "en").trim().toLowerCase().slice(0, 2);
        return supportedLanguages[code] ? code : "en";
      } catch {
        return language === "auto" ? "en" : language;
      }
    };

    const detectedLang = await detectLanguage(userMessage);

    const maybeTranslateToEnglish = async (input: string) => {
      if (!input || detectedLang === "en") return input;
      const translated = await runElasticCompletion(
        `Translate this user query to English. Return only the translated text, nothing else:\n${input}`,
      );
      return translated || input;
    };

    const maybeTranslateFromEnglish = async (input: string) => {
      if (!input || detectedLang === "en") return input;
      const target = supportedLanguages[detectedLang] || "English";
      const translated = await runElasticCompletion(
        `Translate this customer support response to ${target}. Keep citation markers like [1], [2] exactly as they are. Return only the translated text:\n${input}`,
      );
      return translated || input;
    };

    const retrievalQuery = await maybeTranslateToEnglish(userMessage);

    const citations = await searchSupportKnowledge({
      teamId,
      query: retrievalQuery,
      size: 5,
    });

    await createSupportConversationMessage({
      teamId,
      sessionId,
      role: "user",
      message: userMessage,
      sourceRefs: [],
    });

    // No relevant sources found
    if (citations.length === 0) {
      const noSourceReplyBase =
        "I'm sorry, I don't have enough information to answer that right now. Would you like me to connect you with our support team? They'll be able to help you directly.";
      const noSourceReply = await maybeTranslateFromEnglish(noSourceReplyBase);
      const noSourceFollowUps = language === "en"
        ? [
            "Can I share more details so you can narrow this down?",
            "Should I contact human support for this issue?",
          ]
        : await generateFollowUpQuestions({
            question: retrievalQuery,
            answer: noSourceReply,
            citations: [],
            outputLanguage: supportedLanguages[detectedLang] || "English",
          });

      const savedAssistantMessage = await createSupportConversationMessage({
        teamId,
        sessionId,
        role: "assistant",
        message: noSourceReply,
        sourceRefs: [],
        confidenceScore: 0,
        followUpQuestions: noSourceFollowUps,
        escalationSuggested: true,
      });

      return NextResponse.json({
        success: true,
        data: {
          sessionId,
          conversationId: null,
          assistantMessageId: savedAssistantMessage.id,
          reply: noSourceReply,
          detectedLanguage: detectedLang,
          citations: [],
          confidenceScore: 0,
          followUpQuestions: noSourceFollowUps,
          escalation: {
            suggested: true,
            reason: "no_sources",
            contactUrl: `/support/contact/${encodeURIComponent(teamId)}?sessionId=${encodeURIComponent(sessionId)}&lang=${encodeURIComponent(detectedLang)}`,
          },
        },
      });
    }

    const sourceContext = buildSourceContext(citations);

    const agentId =
      process.env.ELASTIC_CUSTOMER_AGENT_ID || "omega_customer_support";
    const agentTimeoutMs = Number(process.env.ELASTIC_AGENT_TIMEOUT_MS || "15000");

    const prompt = buildAgentPrompt(retrievalQuery, sourceContext, citations.length);

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
      // Agent timed out - use Elastic Completion to generate answer from docs
      finalReply = await buildFallbackReply(retrievalQuery, citations);
    }

    if (!finalReply) {
      finalReply =
        "I'm having trouble generating a response right now. Could you try rephrasing your question, or would you like to speak with our support team?";
    }

    finalReply = cleanAgentReply(finalReply);
    finalReply = await maybeTranslateFromEnglish(finalReply);
    const confidenceScore = computeAnswerConfidence(citations);
    const followUpQuestions = await generateFollowUpQuestions({
      question: retrievalQuery,
      answer: finalReply,
      citations,
      outputLanguage: supportedLanguages[detectedLang] || "English",
    });
    const lowConfidenceThreshold = Number(
      process.env.ELASTIC_LOW_CONFIDENCE_THRESHOLD || "55",
    );

    const escalationNeeded =
      dissatisfactionRegex.test(userMessage) ||
      /having trouble generating|temporarily unavailable/i.test(finalReply) ||
      confidenceScore < lowConfidenceThreshold;

    // Fire Smart Escalation Workflow in background (non-blocking)
    if (escalationNeeded) {
      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || "http://localhost:3000";
      fetch(`${baseUrl}/api/workflows/smart-escalation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          sessionId,
          reason: dissatisfactionRegex.test(userMessage)
            ? "user_dissatisfied"
            : "low_confidence_response",
          language: detectedLang,
        }),
      }).catch(() => {
        // Workflow fire-and-forget — don't block the chat response
      });
    }

    const savedAssistantMessage = await createSupportConversationMessage({
      teamId,
      sessionId,
      role: "assistant",
      message: finalReply,
      sourceRefs: citations.map((item) => ({
        id: String(item.id),
        title: String(item.title),
        url: item.url ? String(item.url) : null,
      })),
      confidenceScore,
      followUpQuestions,
      escalationSuggested: escalationNeeded,
    });

    const clientCitations = buildClientCitations(citations);

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        conversationId,
        assistantMessageId: savedAssistantMessage.id,
        reply: finalReply,
        detectedLanguage: detectedLang,
        citations: clientCitations,
        confidenceScore,
        followUpQuestions,
        escalation: {
          suggested: escalationNeeded,
          reason: escalationNeeded ? "user_dissatisfied_or_low_confidence" : null,
          contactUrl: escalationNeeded
            ? `/support/contact/${encodeURIComponent(teamId)}?sessionId=${encodeURIComponent(sessionId)}&lang=${encodeURIComponent(detectedLang)}`
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
