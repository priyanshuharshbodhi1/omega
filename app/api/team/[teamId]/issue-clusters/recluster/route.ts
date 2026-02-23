import { auth } from "@/auth";
import {
  esClient,
  getTeam,
  listIssueClusters,
  upsertIssueCluster,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

type ClusterSeed = {
  key: string;
  title: string;
};

function classifyIssue(text: string): ClusterSeed {
  const value = String(text || "").toLowerCase();
  if (/(customer service|support|respond|response time|slow support)/.test(value)) {
    return { key: "support-response", title: "Support Response & Quality" };
  }
  if (/(lag|latency|slow|performance)/.test(value)) {
    return { key: "performance", title: "Performance & Latency" };
  }
  if (/(billing|payment|invoice|charge|subscription)/.test(value)) {
    return { key: "billing", title: "Billing & Payments" };
  }
  if (/(bug|crash|error|broken|fail)/.test(value)) {
    return { key: "bugs", title: "Bugs & Errors" };
  }
  if (/(feature|request|add|missing)/.test(value)) {
    return { key: "feature-requests", title: "Feature Requests" };
  }
  if (/(ui|ux|design|confusing|hard to use)/.test(value)) {
    return { key: "ux", title: "UX & Usability" };
  }
  return { key: "other", title: "Other Customer Issues" };
}

export async function POST(
  req: Request,
  { params }: { params: { teamId: string } },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const teamId = params.teamId;
  const team = await getTeam(teamId);
  if (!team) {
    return NextResponse.json(
      { success: false, message: "Team not found" },
      { status: 404 },
    );
  }

  try {
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [feedbackRes, supportRes] = await Promise.all([
      esClient.search({
        index: process.env.ELASTIC_FEEDBACK_INDEX || "feedback",
        size: 200,
        query: {
          bool: {
            filter: [{ term: { teamId } }, { range: { createdAt: { gte: sinceIso } } }],
            should: [
              { term: { sentiment: "negative" } },
              { range: { rate: { lte: 3 } } },
            ],
            minimum_should_match: 1,
          },
        },
        _source: ["description", "createdAt"],
      }),
      esClient.search({
        index: process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX || "support_conversations",
        size: 200,
        query: {
          bool: {
            filter: [
              { term: { teamId } },
              { term: { role: "user" } },
              { range: { createdAt: { gte: sinceIso } } },
            ],
          },
        },
        _source: ["message", "createdAt"],
      }),
    ]);

    const rawItems: Array<{ text: string; createdAt: string }> = [];

    for (const hit of feedbackRes.hits.hits) {
      const source = (hit._source as any) || {};
      const text = String(source.description || "").trim();
      if (!text) continue;
      rawItems.push({ text, createdAt: source.createdAt || new Date().toISOString() });
    }

    for (const hit of supportRes.hits.hits) {
      const source = (hit._source as any) || {};
      const text = String(source.message || "").trim();
      if (!text) continue;
      rawItems.push({ text, createdAt: source.createdAt || new Date().toISOString() });
    }

    const clusterMap = new Map<
      string,
      { title: string; count: number; samples: string[]; lastSeenAt: string }
    >();

    for (const item of rawItems) {
      const cluster = classifyIssue(item.text);
      const existing = clusterMap.get(cluster.key) || {
        title: cluster.title,
        count: 0,
        samples: [],
        lastSeenAt: item.createdAt,
      };

      existing.count += 1;
      if (existing.samples.length < 4) {
        existing.samples.push(item.text.slice(0, 220));
      }
      if (item.createdAt > existing.lastSeenAt) {
        existing.lastSeenAt = item.createdAt;
      }
      clusterMap.set(cluster.key, existing);
    }

    for (const [clusterKey, value] of Array.from(clusterMap.entries())) {
      await upsertIssueCluster({
        teamId,
        clusterKey,
        title: value.title,
        count: value.count,
        sampleMessages: value.samples,
        lastSeenAt: value.lastSeenAt,
      });
    }

    const clusters = await listIssueClusters(teamId, 30);
    return NextResponse.json({
      success: true,
      data: {
        scanned: rawItems.length,
        clusters,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to recluster issues." },
      { status: 500 },
    );
  }
}
