import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { esClient } from "@/lib/elasticsearch";

type RouteParams = { teamId: string };

const STOPWORDS = new Set([
  "the",
  "for",
  "and",
  "are",
  "was",
  "were",
  "this",
  "that",
  "with",
  "from",
  "have",
  "has",
  "had",
  "you",
  "your",
  "our",
  "its",
  "they",
  "them",
  "there",
  "here",
  "then",
  "than",
  "when",
  "where",
  "what",
  "which",
  "how",
  "why",
  "can",
  "could",
  "should",
  "would",
  "will",
  "just",
  "very",
  "really",
  "also",
  "only",
  "about",
  "into",
  "over",
  "under",
  "more",
  "less",
  "much",
  "many",
  "some",
  "any",
  "all",
  "every",
  "each",
  "help",
  "please",
  "thanks",
  "thank",
  "hello",
  "team",
  "user",
  "users",
  "customer",
  "customers",
  "issue",
  "issues",
  "problem",
  "problems",
  "thing",
  "things",
  "app",
  "product",
  "support",
  "chat",
  "message",
  "messages",
  "hey",
]);

const ACTIONABLE_HINT_REGEX =
  /(bug|error|fail|failing|broken|crash|timeout|slow|latency|payment|billing|invoice|refund|charge|login|signin|auth|otp|2fa|permission|access|sync|duplicate|missing|dashboard|report|notification|email|sms|alert|slack|webhook|integration|api|search|filter|upload|download|feature|request|subscription|ticket)/i;

function normalizeKeyword(raw: string) {
  const cleaned = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim();
  if (!cleaned) return "";

  // Naive singularization keeps related terms together without extra deps.
  if (
    cleaned.endsWith("s") &&
    cleaned.length > 4 &&
    !cleaned.endsWith("ss") &&
    !cleaned.endsWith("us")
  ) {
    return cleaned.slice(0, -1);
  }

  return cleaned;
}

function isActionableKeyword(value: string, count: number) {
  if (!value || value.length < 3) return false;
  if (/^\d+$/.test(value)) return false;
  if (STOPWORDS.has(value)) return false;

  const containsHint = ACTIONABLE_HINT_REGEX.test(value);
  if (containsHint) return true;

  // Keep repeated unknown terms only when they are frequent enough.
  return count >= 4;
}

export async function GET(
  req: Request,
  { params }: { params: RouteParams | Promise<RouteParams> },
) {
  const { teamId } = await Promise.resolve(params);

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
        size: 0,
        query: {
          bool: {
            filter: [
              { term: { teamId } },
              { range: { createdAt: { gte: sinceIso } } },
            ],
          },
        },
        aggs: {
          keywords: {
            significant_text: {
              field: "description",
              size: 25,
              min_doc_count: 2,
              filter_duplicate_text: true,
            },
          },
        },
      }),
      esClient.search({
        index:
          process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX ||
          "support_conversations",
        size: 0,
        query: {
          bool: {
            filter: [
              { term: { teamId } },
              { term: { role: "user" } },
              { range: { createdAt: { gte: sinceIso } } },
            ],
          },
        },
        aggs: {
          keywords: {
            significant_text: {
              field: "message",
              size: 25,
              min_doc_count: 2,
              filter_duplicate_text: true,
            },
          },
        },
      }),
    ]);

    // Merge results from both indices by summing doc_counts
    const merged = new Map<string, number>();

    const feedbackBuckets =
      (feedbackRes.aggregations?.keywords as any)?.buckets || [];
    for (const bucket of feedbackBuckets) {
      const key = bucket.key as string;
      merged.set(key, (merged.get(key) || 0) + bucket.doc_count);
    }

    const supportBuckets =
      (supportRes.aggregations?.keywords as any)?.buckets || [];
    for (const bucket of supportBuckets) {
      const key = bucket.key as string;
      merged.set(key, (merged.get(key) || 0) + bucket.doc_count);
    }

    const normalized = new Map<string, number>();
    for (const [rawValue, count] of Array.from(merged.entries())) {
      const value = normalizeKeyword(rawValue);
      if (!isActionableKeyword(value, count)) continue;
      normalized.set(value, (normalized.get(value) || 0) + count);
    }

    let keywords = Array.from(normalized.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18)
      .map(([value, count]) => ({ value, count }));

    // Fallback to raw results if aggressive filtering removes everything.
    if (keywords.length === 0) {
      keywords = Array.from(merged.entries())
        .map(([rawValue, count]) => ({
          value: normalizeKeyword(rawValue),
          count,
        }))
        .filter(({ value }) => value.length >= 3 && !STOPWORDS.has(value))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
    }

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
