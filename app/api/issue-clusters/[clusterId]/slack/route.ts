import { auth } from "@/auth";
import {
  createActionAuditLog,
  getIssueClusterById,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { clusterId: string } },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const clusterId = decodeURIComponent(params.clusterId);
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
    const body = {
      text: `Omega issue cluster alert: ${cluster.title} (${cluster.count} reports)` ,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Omega Issue Cluster*\n*${cluster.title}*\nCount: ${cluster.count}\nStatus: ${cluster.status}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Sample:\n${(cluster.sampleMessages || []).slice(0, 2).map((m: string) => `• ${m}`).join("\n") || "N/A"}`,
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
