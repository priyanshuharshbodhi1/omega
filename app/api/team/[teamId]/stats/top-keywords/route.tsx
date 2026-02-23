import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { esClient } from "@/lib/elasticsearch";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "this",
  "from",
  "your",
  "you",
  "are",
  "our",
  "was",
  "were",
  "have",
  "has",
  "had",
  "not",
  "but",
  "can",
  "could",
  "would",
  "should",
  "there",
  "their",
  "they",
  "them",
  "about",
  "what",
  "when",
  "where",
  "which",
  "while",
  "been",
  "being",
  "into",
  "over",
  "under",
  "after",
  "before",
  "please",
  "thanks",
  "thank",
  "hello",
  "hi",
  "help",
  "need",
  "want",
  "just",
  "very",
  "more",
  "less",
  "also",
  "only",
  "will",
  "able",
  "using",
  "used",
  "use",
  "app",
  "team",
  "user",
  "users",
  "customer",
  "customers",
  "support",
  "arya",
  "chatbot",
]);

function extractTokens(text: string) {
  const normalized = String(text || "").toLowerCase();
  const parts = normalized.match(/[a-z][a-z0-9_-]{2,}/g) || [];
  return parts.filter((token) => !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

export async function GET(
  req: Request,
  { params }: { params: { teamId: string } },
) {
  const teamId = params.teamId;

  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const sinceIso = new Date(
      Date.now() - 45 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [feedbackRes, supportRes] = await Promise.all([
      esClient.search({
        index: process.env.ELASTIC_FEEDBACK_INDEX || "feedback",
        size: 700,
        query: {
          bool: {
            filter: [
              { term: { teamId } },
              { range: { createdAt: { gte: sinceIso } } },
            ],
          },
        },
        _source: ["description"],
      }),
      esClient.search({
        index:
          process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX ||
          "support_conversations",
        size: 700,
        query: {
          bool: {
            filter: [
              { term: { teamId } },
              { term: { role: "user" } },
              { range: { createdAt: { gte: sinceIso } } },
            ],
          },
        },
        _source: ["message"],
      }),
    ]);

    const counter = new Map<string, number>();

    for (const hit of feedbackRes.hits.hits) {
      const description = String((hit._source as any)?.description || "");
      for (const token of extractTokens(description)) {
        counter.set(token, (counter.get(token) || 0) + 1);
      }
    }

    for (const hit of supportRes.hits.hits) {
      const message = String((hit._source as any)?.message || "");
      for (const token of extractTokens(message)) {
        counter.set(token, (counter.get(token) || 0) + 1);
      }
    }

    const keywords = Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 28)
      .map(([value, count]) => ({ value, count }));

    return NextResponse.json({
      success: true,
      message: "Success to get top keywords",
      data: keywords,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
