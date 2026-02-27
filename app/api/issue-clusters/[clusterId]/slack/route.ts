import { auth } from "@/auth";
import {
  createActionAuditLog,
  getIssueClusterById,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

type RouteParams = { clusterId: string };

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

  const { clusterId: clusterIdParam } = await Promise.resolve(params);
  const clusterId = decodeURIComponent(clusterIdParam);
  const cluster = await getIssueClusterById(clusterId);
  if (!cluster) {
    return NextResponse.json(
      { success: false, message: "Issue cluster not found" },
      { status: 404 },
    );
  }

  if (cluster.status !== "verified") {
    return NextResponse.json(
      { success: false, message: "Verify cluster before sending to Slack." },
      { status: 400 },
    );
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, message: "Missing SLACK_WEBHOOK_URL in environment." },
      { status: 400 },
    );
  }

  try {
    const priority = String((cluster as any).priority || "medium").toUpperCase();
    const breakdown = (cluster as any).sourceBreakdown || { feedback: 0, support: 0 };
    const recommendedAction =
      String((cluster as any).recommendedAction || "Assign owner and investigate impact.");
    const slackSummary =
      String((cluster as any).slackSummary || "").trim() ||
      `[${priority}] ${cluster.title} (${cluster.count} reports)`;

    const body = {
      text: `Omega issue cluster alert: ${cluster.title} (${cluster.count} reports)` ,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Omega Issue Cluster*\n*${cluster.title}*\nPriority: *${priority}*\nCount: ${cluster.count}\nStatus: ${cluster.status}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Signals: feedback=${breakdown.feedback}, support=${breakdown.support}\nAction: ${recommendedAction}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Slack Brief:\n${slackSummary}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Sample:\n${
              (cluster.sampleMessages || []).slice(0, 2).map((m: string) => `• ${m}`).join("\n") || "N/A"
            }`,
          },
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Slack webhook failed: ${response.status} ${txt}`);
    }

    await createActionAuditLog({
      teamId: String(cluster.teamId),
      clusterId,
      action: "send_slack",
      status: "success",
      detail: `Sent to Slack webhook`,
      actorEmail: session.user?.email || undefined,
    });

    return NextResponse.json({ success: true, message: "Sent to Slack." });
  } catch (error: any) {
    await createActionAuditLog({
      teamId: String(cluster.teamId),
      clusterId,
      action: "send_slack",
      status: "failed",
      detail: error?.message || "Slack send failed",
      actorEmail: session.user?.email || undefined,
    });

    return NextResponse.json(
      { success: false, message: error?.message || "Failed to send Slack message." },
      { status: 500 },
    );
  }
}
