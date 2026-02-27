import { invokeAgent } from "@/lib/agent-builder";
import {
  createSupportConversationMessage,
  runElasticCompletion,
  searchSupportKnowledge,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

const HUMAN_SUPPORT_INTENT_REGEX =
  /\b(customer\s*(care|support)|human\s*support|live\s*(agent|support)|real\s*(person|agent)|support\s*(agent|team|executive|representative)|customer\s*service|talk to (a )?human|talk to (a )?person|talk to (a )?agent|speak to (a )?human|speak to (a )?person|speak to (a )?agent|connect me|transfer me|escalate)\b/i;

const HUMAN_SUPPORT_VERB_PATTERN =
  /\b(talk|tlk|speak|connect|transfer|escalate|contact|reach|need|want)\b.*\b(human|humna|person|agent|representative|support|care)\b/i;

const QUICK_FOLLOW_UPS: Record<string, string[]> = {
  en: [
    "How can I contact human support directly?",
    "What details should I share for faster help?",
    "Can you summarize my issue for the support team?",
  ],
  hi: [
    "मैं सीधे मानव सपोर्ट से कैसे संपर्क करूँ?",
    "तेज़ सहायता के लिए मुझे कौन-सी जानकारी देनी चाहिए?",
    "क्या आप मेरी समस्या सपोर्ट टीम के लिए संक्षेप में बता सकते हैं?",
  ],
  es: [
    "¿Cómo contacto soporte humano directamente?",
    "¿Qué detalles debo compartir para recibir ayuda más rápido?",
    "¿Puedes resumir mi problema para el equipo de soporte?",
  ],
  fr: [
    "Comment contacter directement un support humain ?",
    "Quels détails dois-je partager pour une aide plus rapide ?",
    "Peux-tu résumer mon problème pour l’équipe support ?",
  ],
  de: [
    "Wie kontaktiere ich direkt den menschlichen Support?",
    "Welche Details soll ich für schnellere Hilfe teilen?",
    "Kannst du mein Problem für das Support-Team zusammenfassen?",
  ],
  ar: [
    "كيف أتواصل مباشرةً مع الدعم البشري؟",
    "ما التفاصيل التي يجب أن أشاركها للحصول على مساعدة أسرع؟",
    "هل يمكنك تلخيص مشكلتي لفريق الدعم؟",
  ],
};

const HUMAN_SUPPORT_REPLY: Record<string, string> = {
  en: "Connecting you to human support right now. Please use the button below and share your details so the team can follow up quickly.",
  hi: "मैं आपको अभी मानव सपोर्ट से जोड़ रहा हूँ। नीचे दिए गए बटन का उपयोग करें और अपनी जानकारी साझा करें ताकि टीम जल्दी सहायता कर सके।",
  es: "Te estoy conectando ahora mismo con soporte humano. Usa el botón de abajo y comparte tus detalles para que el equipo te ayude rápido.",
  fr: "Je vous mets en relation avec le support humain immédiatement. Utilisez le bouton ci-dessous et partagez vos détails pour une prise en charge rapide.",
  de: "Ich verbinde Sie jetzt direkt mit dem menschlichen Support. Nutzen Sie die Schaltfläche unten und teilen Sie Ihre Details für schnelle Hilfe.",
  ar: "يتم الآن تحويلك إلى الدعم البشري. استخدم الزر أدناه وشارك التفاصيل ليتمكن الفريق من مساعدتك بسرعة.",
};

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

function detectLanguageHeuristic(text: string) {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  return "en";
}

function resolveQuickLanguage(preferred: string, text: string) {
  if (preferred && preferred !== "auto") {
    return QUICK_FOLLOW_UPS[preferred] ? preferred : "en";
  }
  return detectLanguageHeuristic(text);
}

function shouldEscalateImmediatelyToHuman(input: string) {
  const normalized = String(input || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return HUMAN_SUPPORT_INTENT_REGEX.test(normalized) || HUMAN_SUPPORT_VERB_PATTERN.test(normalized);
}

function getQuickFollowUps(languageCode: string) {
  return QUICK_FOLLOW_UPS[languageCode] || QUICK_FOLLOW_UPS.en;
}

function getHumanSupportReply(languageCode: string) {
  return HUMAN_SUPPORT_REPLY[languageCode] || HUMAN_SUPPORT_REPLY.en;
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
    const generated = await withTimeout(
      runElasticCompletion(completionPrompt),
      4500,
      "Fallback completion timeout",
    );
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
      /(not helpful|not satisfied|unsatisfied|didn't help|did not help|agent is wrong|bad answer|speak to someone|real person|real agent)/i;

    if (!teamId || !userMessage) {
      return NextResponse.json(
        { success: false, message: "Missing teamId or message." },
        { status: 400 },
      );
    }

    await createSupportConversationMessage({
      teamId,
      sessionId,
      role: "user",
      message: userMessage,
      sourceRefs: [],
    });

    // Fast path: if the user explicitly asks for human support, skip retrieval/LLM.
    if (shouldEscalateImmediatelyToHuman(userMessage)) {
      const quickLang = resolveQuickLanguage(language, userMessage);
      const followUpQuestions = getQuickFollowUps(quickLang);
      const escalationReply = getHumanSupportReply(quickLang);
      const contactUrl = `/support/contact/${encodeURIComponent(teamId)}?sessionId=${encodeURIComponent(sessionId)}&lang=${encodeURIComponent(quickLang)}`;

      const savedAssistantMessage = await createSupportConversationMessage({
        teamId,
        sessionId,
        role: "assistant",
        message: escalationReply,
        sourceRefs: [],
        confidenceScore: 99,
        followUpQuestions,
        escalationSuggested: true,
      });

      const baseUrl =
        process.env.NEXTAUTH_URL || process.env.VERCEL_URL || "http://localhost:3000";
      fetch(`${baseUrl}/api/workflows/smart-escalation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          sessionId,
          reason: "user_requested_human_support",
          language: quickLang,
        }),
      }).catch(() => {
        // Fire-and-forget; do not block customer response.
      });

      return NextResponse.json({
        success: true,
        data: {
          sessionId,
          conversationId: body?.conversationId || null,
          assistantMessageId: savedAssistantMessage.id,
          reply: escalationReply,
          detectedLanguage: quickLang,
          citations: [],
          confidenceScore: 99,
          followUpQuestions,
          escalation: {
            suggested: true,
            reason: "user_requested_human_support",
            contactUrl,
          },
        },
      });
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
        const detected = await withTimeout(
          runElasticCompletion(
            `Detect the language of the following text. Reply with ONLY the ISO 639-1 two-letter language code (one of: en, es, fr, de, hi, ar). If unsure, reply "en".\n\nText: ${text}`,
          ),
          2500,
          "Language detection timeout",
        );
        const code = (detected || "en").trim().toLowerCase().slice(0, 2);
        return supportedLanguages[code] ? code : "en";
      } catch {
        return language === "auto" ? detectLanguageHeuristic(text) : language;
      }
    };

    const detectedLang = await detectLanguage(userMessage);

    const maybeTranslateToEnglish = async (input: string) => {
      if (!input || detectedLang === "en") return input;
      try {
        const translated = await withTimeout(
          runElasticCompletion(
            `Translate this user query to English. Return only the translated text, nothing else:\n${input}`,
          ),
          3000,
          "Query translation timeout",
        );
        return translated || input;
      } catch {
        return input;
      }
    };

    const maybeTranslateFromEnglish = async (input: string) => {
      if (!input || detectedLang === "en") return input;
      const target = supportedLanguages[detectedLang] || "English";
      try {
        const translated = await withTimeout(
          runElasticCompletion(
            `Translate this customer support response to ${target}. Keep citation markers like [1], [2] exactly as they are. Return only the translated text:\n${input}`,
          ),
          3200,
          "Response translation timeout",
        );
        return translated || input;
      } catch {
        return input;
      }
    };

    const retrievalQuery = await maybeTranslateToEnglish(userMessage);

    const citations = await searchSupportKnowledge({
      teamId,
      query: retrievalQuery,
      size: 5,
    });

    // No relevant sources found
    if (citations.length === 0) {
      const noSourceReplyBase =
        "I'm sorry, I don't have enough information to answer that right now. Would you like me to connect you with our support team? They'll be able to help you directly.";
      const noSourceReply = await maybeTranslateFromEnglish(noSourceReplyBase);
      const noSourceFollowUps = getQuickFollowUps(detectedLang);

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
    const agentTimeoutMs = Number(process.env.ELASTIC_AGENT_TIMEOUT_MS || "9000");

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
    const shouldGenerateDynamicFollowUps =
      process.env.ELASTIC_DYNAMIC_FOLLOWUPS === "true";
    let followUpQuestions = getQuickFollowUps(detectedLang);
    if (shouldGenerateDynamicFollowUps) {
      try {
        const generated = await withTimeout(
          generateFollowUpQuestions({
            question: retrievalQuery,
            answer: finalReply,
            citations,
            outputLanguage: supportedLanguages[detectedLang] || "English",
          }),
          2200,
          "Follow-up generation timeout",
        );
        if (Array.isArray(generated) && generated.length > 0) {
          followUpQuestions = generated;
        }
      } catch {
        // Keep static follow-ups.
      }
    }
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
