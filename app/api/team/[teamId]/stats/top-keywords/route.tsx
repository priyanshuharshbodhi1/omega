import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { esClient } from "@/lib/elasticsearch";

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

    const keywords = Array.from(merged.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18)
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
