import { auth } from "@/auth";
import { invokeAgent } from "@/lib/agent-builder";
import {
  createActionAuditLog,
  getIssueClusterById,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

const ISSUE_URL_REGEX = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/issues\/\d+/i;
const ISSUE_NUMBER_REGEX = /\/issues\/(\d+)/i;

function parseIssueMeta(text: string) {
  const issueUrl = text.match(ISSUE_URL_REGEX)?.[0] || null;
  const issueNumber = issueUrl
    ? Number(issueUrl.match(ISSUE_NUMBER_REGEX)?.[1] || "")
    : null;

  return {
    issueUrl,
    issueNumber: Number.isFinite(issueNumber as number) ? issueNumber : null,
  };
}

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
      { success: false, message: "Verify cluster before creating GitHub issue." },
      { status: 400 },
    );
  }

  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const agentId =
    process.env.ELASTIC_ISSUE_AGENT_ID || "omega_issue_triage_agent_v1";
  const workflowToolId =
    process.env.ELASTIC_GITHUB_WORKFLOW_TOOL_ID || "omega_create_github_issue_v2";

  if (!owner || !repo) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Missing GITHUB_REPO_OWNER or GITHUB_REPO_NAME in environment.",
      },
      { status: 400 },
    );
  }

  try {
    const title = `[Cluster] ${cluster.title} (${cluster.count} reports)`;
    const issueBody = [
      "## Cluster Summary",
      `- Cluster ID: ${clusterId}`,
      `- Team ID: ${cluster.teamId}`,
      `- Count: ${cluster.count}`,
      `- Status: ${cluster.status}`,
      "",
      "## Sample Customer Reports",
      ...((cluster.sampleMessages || []).slice(0, 4).map((m: string) => `- ${m}`)),
      "",
      "## Action",
      "- Investigate root cause",
      "- Confirm impact scope",
      "- Provide mitigation + ETA",
    ].join("\n");

    const prompt = [
      `Use the workflow tool \`${workflowToolId}\` exactly once.`,
      "Do not ask follow-up questions.",
      "Create a GitHub issue with these exact values:",
      `- owner: ${owner}`,
      `- repo: ${repo}`,
      `- title: ${title}`,
      `- body: ${issueBody}`,
      "- labels: [\"customer-feedback\",\"clustered-issue\"]",
      ...(githubToken ? [`- github_token: ${githubToken}`] : []),
      "",
      "After creating, respond with:",
      "1) The issue URL",
      "2) The issue number",
    ].join("\n");

    const response = await invokeAgent({
      agentId,
      message: prompt,
    });

    const agentMessage = String(
      response?.response?.message || response?.message || "",
    );
    const { issueUrl, issueNumber } = parseIssueMeta(
      `${agentMessage}\n${JSON.stringify(response || {})}`,
    );

    if (!issueUrl) {
      throw new Error("Agent responded but GitHub issue URL was not found.");
    }

    await createActionAuditLog({
      teamId: String(cluster.teamId),
      clusterId,
      action: "create_github_issue",
      status: "success",
      detail: issueUrl,
      actorEmail: session.user?.email || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "GitHub issue created via workflow tool.",
      data: {
        issueUrl,
        issueNumber,
        agentId,
        workflowToolId,
      },
    });
  } catch (error: any) {
    await createActionAuditLog({
      teamId: String(cluster.teamId),
      clusterId,
      action: "create_github_issue",
      status: "failed",
      detail: error?.message || "GitHub issue creation failed",
      actorEmail: session.user?.email || undefined,
    });

    return NextResponse.json(
      { success: false, message: error?.message || "Failed to create GitHub issue." },
      { status: 500 },
    );
  }
}
