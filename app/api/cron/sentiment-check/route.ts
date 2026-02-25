import { NextResponse } from "next/server";
import { esClient } from "@/lib/elasticsearch";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Cron-triggered sentiment spike check.
 * For each team, compares the negative feedback rate in the last hour
 * against the baseline (1–24 hours ago). If a spike is detected,
 * fires the /api/workflows/sentiment-spike workflow.
 *
 * Protected by CRON_SECRET Bearer token.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    // Get all teams
    const teamsRes = await esClient.search({
      index: process.env.ELASTIC_TEAMS_INDEX || "teams",
      size: 100,
      _source: ["id", "name"],
      query: { match_all: {} },
    });

    const teams = teamsRes.hits.hits.map((hit: any) => ({
      id: (hit._source as any)?.id || hit._id,
      name: (hit._source as any)?.name || "Unknown",
    }));

    const results: Array<{
      teamId: string;
      teamName: string;
      spikeDetected: boolean;
      recentNegRate: number;
      baselineNegRate: number;
      recentTotal: number;
    }> = [];

    for (const team of teams) {
      const [recentRes, baselineRes] = await Promise.all([
        // Recent: last 1 hour
        esClient.search({
          index: process.env.ELASTIC_FEEDBACK_INDEX || "feedback",
          size: 0,
          query: {
            bool: {
              filter: [
                { term: { teamId: team.id } },
                { range: { createdAt: { gte: "now-1h" } } },
              ],
            },
          },
          aggs: {
            total: { value_count: { field: "sentiment" } },
            negative: { filter: { term: { sentiment: "negative" } } },
          },
        }),
        // Baseline: 1h to 24h ago
        esClient.search({
          index: process.env.ELASTIC_FEEDBACK_INDEX || "feedback",
          size: 0,
          query: {
            bool: {
              filter: [
                { term: { teamId: team.id } },
                { range: { createdAt: { gte: "now-24h", lt: "now-1h" } } },
              ],
            },
          },
          aggs: {
            total: { value_count: { field: "sentiment" } },
            negative: { filter: { term: { sentiment: "negative" } } },
          },
        }),
      ]);

      const recentTotal =
        (recentRes.aggregations?.total as any)?.value || 0;
      const recentNeg =
        (recentRes.aggregations?.negative as any)?.doc_count || 0;
      const baselineTotal =
        (baselineRes.aggregations?.total as any)?.value || 0;
      const baselineNeg =
        (baselineRes.aggregations?.negative as any)?.doc_count || 0;

      const recentNegRate = recentTotal > 0 ? recentNeg / recentTotal : 0;
      const baselineNegRate =
        baselineTotal > 0 ? baselineNeg / baselineTotal : 0;

      const spikeDetected =
        recentTotal >= 3 && recentNegRate > baselineNegRate * 1.3;

      results.push({
        teamId: team.id,
        teamName: team.name,
        spikeDetected,
        recentNegRate: Math.round(recentNegRate * 100) / 100,
        baselineNegRate: Math.round(baselineNegRate * 100) / 100,
        recentTotal,
      });

      if (spikeDetected) {
        // Fire the sentiment-spike workflow
        const baseUrl =
          process.env.NEXTAUTH_URL ||
          (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000");
        try {
          await fetch(`${baseUrl}/api/workflows/sentiment-spike`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId: team.id }),
          });
        } catch (err) {
          console.error(
            `Failed to trigger sentiment-spike workflow for team ${team.id}:`,
            err,
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      teamsChecked: results.length,
      spikesDetected: results.filter((r) => r.spikeDetected).length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
