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
  recommendedAction: string;
};

type RouteParams = { teamId: string };

type RawItem = {
  text: string;
  createdAt: string;
  source: "feedback" | "support";
};

const ACTIONABLE_SIGNAL_REGEX =
  /(error|bug|broken|fail|failing|not working|can't|cannot|unable|stuck|blocked|slow|latency|timeout|refund|charged|missing|wrong|sync|disconnect|login|otp|2fa|unauthorized|denied|crash|outage|downtime|escalat|urgent|critical|incident)/i;

const HIGH_SEVERITY_REGEX =
  /(critical|urgent|blocker|outage|downtime|security|data loss|cannot login|unable to login|charged twice|refund|payment failed|for all users|everyone)/i;

const MEDIUM_SEVERITY_REGEX =
  /(error|failed|crash|timeout|slow|not working|broken|wrong|missing|stuck|can'?t|cannot|unable)/i;

const NON_ACTIONABLE_SHORT_REGEX = /^(hi|hello|thanks|thank you|ok|okay|great|cool|nice|bye)[.!]*$/i;

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueMessageKey(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .slice(0, 18)
    .join(" ");
}

function getSeverityScore(text: string) {
  const value = normalizeText(text);
  let score = 0;
  if (HIGH_SEVERITY_REGEX.test(value)) score += 2;
  if (MEDIUM_SEVERITY_REGEX.test(value)) score += 1;
  if (/(again|still|every time|always|recurring|repeated)/i.test(value)) score += 1;
  return Math.min(score, 4);
}

function classifyIssue(text: string): ClusterSeed | null {
  const value = normalizeText(text);

  if (
    /(login|signin|sign in|auth|authentication|otp|2fa|password|access denied|permission|unauthorized)/i.test(
      value,
    )
  ) {
    return {
      key: "auth-access",
      title: "Login & Access Failures",
      recommendedAction: "Escalate to auth/on-call and validate login flow, token expiry, and permission checks.",
    };
  }

  if (
    /(billing|payment|invoice|charge|charged|subscription|refund|plan|checkout|card declined)/i.test(
      value,
    )
  ) {
    return {
      key: "billing-payments",
      title: "Billing & Payment Failures",
      recommendedAction: "Review payment logs, failed transactions, and trigger customer remediation/refund workflow.",
    };
  }

  if (/(slack|webhook|integration|channel|bot|mention)/i.test(value)) {
    return {
      key: "slack-integration",
      title: "Slack Alerts/Integration Issues",
      recommendedAction: "Validate webhook credentials, channel config, and retry failed notification events.",
    };
  }

  if (/(lag|latency|slow|performance|timeout|freez|stuck|loading)/i.test(value)) {
    return {
      key: "performance-latency",
      title: "Performance & Latency Problems",
      recommendedAction: "Check API latency, DB/ES query load, and add immediate mitigation for impacted flows.",
    };
  }

  if (/(sync|synced|syncing|duplicate|missing data|wrong data|dashboard|report|analytics count)/i.test(value)) {
    return {
      key: "data-sync-reporting",
      title: "Data Sync & Reporting Mismatch",
      recommendedAction: "Audit ingestion/sync pipeline and reconcile metric discrepancies in reporting views.",
    };
  }

  if (/(notification|email|sms|alert|didn't receive|not receiving)/i.test(value)) {
    return {
      key: "notifications-delivery",
      title: "Notification Delivery Failures",
      recommendedAction: "Inspect notification queue/provider errors and re-send failed critical alerts.",
    };
  }

  if (/(bug|crash|exception|error|broken|doesn't work|not work|fails)/i.test(value)) {
    return {
      key: "bugs-errors",
      title: "Bugs & Runtime Errors",
      recommendedAction: "Create engineering bug ticket with stack traces and affected paths from sample reports.",
    };
  }

  if (/(support|agent|no response|waiting|resolved|escalat)/i.test(value)) {
    return {
      key: "support-quality",
      title: "Support Resolution Gaps",
      recommendedAction: "Triage support queue and publish Slack escalation with owner + ETA for unresolved sessions.",
    };
  }

  if (/(ui|ux|confusing|hard to use|difficult|cannot find|navigation)/i.test(value)) {
    return {
      key: "ux-friction",
      title: "UX Friction Blocking Users",
      recommendedAction: "Share UX pain points with product/design and prioritize quick usability fixes.",
    };
  }

  if (/(feature|request|missing|need ability|would like|please add)/i.test(value)) {
    return {
      key: "feature-gaps",
      title: "High-Demand Feature Gaps",
      recommendedAction: "Convert frequent requests into product backlog items with customer impact context.",
    };
  }

  return {
    key: "misc-issues",
    title: "General Customer Issues",
    recommendedAction: "Review sample messages, validate impact, and route to the right owner.",
  };
}

function isActionableMessage(text: string) {
  const value = String(text || "").trim();
  if (!value || value.length < 14) return false;
  if (NON_ACTIONABLE_SHORT_REGEX.test(value)) return false;
  return ACTIONABLE_SIGNAL_REGEX.test(value) || value.split(/\s+/).length >= 4;
}

function getPriority(count: number, maxSeverity: number) {
  if (maxSeverity >= 3 || count >= 8) return "high";
  if (maxSeverity >= 2 || count >= 4) return "medium";
  return "low";
}

export async function POST(
  req: Request,
  { params }: { params: RouteParams | Promise<RouteParams> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { teamId } = await Promise.resolve(params);
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
        size: 350,
        query: {
          bool: {
            filter: [{ term: { teamId } }, { range: { createdAt: { gte: sinceIso } } }],
          },
        },
        _source: ["description", "createdAt"],
      }),
      esClient.search({
        index: process.env.ELASTIC_SUPPORT_CONVERSATIONS_INDEX || "support_conversations",
        size: 500,
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

    const rawItems: RawItem[] = [];
    const seenMessages = new Set<string>();

    for (const hit of feedbackRes.hits.hits) {
      const source = (hit._source as any) || {};
      const text = String(source.description || "").trim();
      if (!isActionableMessage(text)) continue;
      const key = uniqueMessageKey(text);
      if (seenMessages.has(key)) continue;
      seenMessages.add(key);
      rawItems.push({
        text,
        createdAt: source.createdAt || new Date().toISOString(),
        source: "feedback",
      });
    }

    for (const hit of supportRes.hits.hits) {
      const source = (hit._source as any) || {};
      const text = String(source.message || "").trim();
      if (!isActionableMessage(text)) continue;
      const key = uniqueMessageKey(text);
      if (seenMessages.has(key)) continue;
      seenMessages.add(key);
      rawItems.push({
        text,
        createdAt: source.createdAt || new Date().toISOString(),
        source: "support",
      });
    }

    const clusterMap = new Map<
      string,
      {
        title: string;
        count: number;
        samples: string[];
        lastSeenAt: string;
        maxSeverity: number;
        recommendedAction: string;
        sourceBreakdown: {
          feedback: number;
          support: number;
        };
      }
    >();

    for (const item of rawItems) {
      const cluster = classifyIssue(item.text);
      if (!cluster) continue;
      const existing = clusterMap.get(cluster.key) || {
        title: cluster.title,
        count: 0,
        samples: [],
        lastSeenAt: item.createdAt,
        maxSeverity: 0,
        recommendedAction: cluster.recommendedAction,
        sourceBreakdown: {
          feedback: 0,
          support: 0,
        },
      };

      existing.count += 1;
      existing.sourceBreakdown[item.source] += 1;
      existing.maxSeverity = Math.max(existing.maxSeverity, getSeverityScore(item.text));
      if (existing.samples.length < 4) {
        existing.samples.push(item.text.slice(0, 220));
      }
      if (item.createdAt > existing.lastSeenAt) {
        existing.lastSeenAt = item.createdAt;
      }
      clusterMap.set(cluster.key, existing);
    }

    const activeClusters = Array.from(clusterMap.entries())
      .filter(([, value]) => value.count >= 1)
      .sort((a, b) => {
        const aScore = a[1].count * 2 + a[1].maxSeverity * 3 + a[1].sourceBreakdown.support;
        const bScore = b[1].count * 2 + b[1].maxSeverity * 3 + b[1].sourceBreakdown.support;
        return bScore - aScore;
      });

    const activeClusterKeys = new Set(activeClusters.map(([clusterKey]) => clusterKey));

    for (const [clusterKey, value] of activeClusters) {
      const priority = getPriority(value.count, value.maxSeverity);
      const impactScore =
        value.count * 2 + value.maxSeverity * 3 + value.sourceBreakdown.support;
      const slackSummary = `[${priority.toUpperCase()}] ${value.title}: ${
        value.count
      } reports (${value.sourceBreakdown.feedback} feedback, ${
        value.sourceBreakdown.support
      } support). Latest sample: "${value.samples[0] || "N/A"}"`;

      await upsertIssueCluster({
        teamId,
        clusterKey,
        title: value.title,
        count: value.count,
        sampleMessages: value.samples,
        lastSeenAt: value.lastSeenAt,
        priority,
        sourceBreakdown: value.sourceBreakdown,
        impactScore,
        recommendedAction: value.recommendedAction,
        slackSummary,
      });
    }

    // Close stale clusters so the dashboard only shows currently actionable topics.
    const existingClusters = await listIssueClusters(teamId, 100);
    for (const existing of existingClusters) {
      const clusterKey = String((existing as any).clusterKey || "");
      if (!clusterKey || activeClusterKeys.has(clusterKey)) continue;

      await upsertIssueCluster({
        teamId,
        clusterKey,
        title: String((existing as any).title || "Issue Cluster"),
        count: 0,
        sampleMessages: Array.isArray((existing as any).sampleMessages)
          ? (existing as any).sampleMessages
          : [],
        lastSeenAt: String((existing as any).lastSeenAt || new Date().toISOString()),
        status: "closed",
        priority: "low",
        sourceBreakdown: { feedback: 0, support: 0 },
        impactScore: 0,
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
