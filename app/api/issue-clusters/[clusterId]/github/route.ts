import { auth } from "@/auth";
import { invokeAgent } from "@/lib/agent-builder";
import {
  createActionAuditLog,
  getIssueClusterById,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

const ISSUE_URL_REGEX = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/issues\/\d+/i;
const ISSUE_NUMBER_REGEX = /\/issues\/(\d+)/i;
const GITHUB_API_BASE = "https://api.github.com";

type RouteParams = { clusterId: string };

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

async function createIssueDirectly(params: {
  owner: string;
  repo: string;
  title: string;
  body: string;
  githubToken: string;
}) {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${params.owner}/${params.repo}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: params.title,
        body: params.body,
        labels: ["customer-feedback", "clustered-issue"],
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub API failed (${response.status}): ${errorText.slice(0, 220)}`,
    );
  }

  const data = (await response.json()) as {
    html_url?: string;
    number?: number;
  };

  return {
    issueUrl: String(data.html_url || ""),
    issueNumber:
      typeof data.number === "number" && Number.isFinite(data.number)
        ? data.number
        : null,
    provider: "github_api",
  };
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

    let issueUrl: string | null = null;
    let issueNumber: number | null = null;
    let provider = "agent_workflow";

    if (githubToken) {
      const directResult = await createIssueDirectly({
        owner,
        repo,
        title,
        body: issueBody,
        githubToken,
      });
      issueUrl = directResult.issueUrl;
      issueNumber = directResult.issueNumber;
      provider = directResult.provider;
    } else {
      const prompt = [
        `Use the workflow tool \`${workflowToolId}\` exactly once.`,
        "Do not ask follow-up questions.",
        "Create a GitHub issue with these exact values:",
        `- owner: ${owner}`,
        `- repo: ${repo}`,
        `- title: ${title}`,
        `- body: ${issueBody}`,
        "- labels: [\"customer-feedback\",\"clustered-issue\"]",
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
      const parsed = parseIssueMeta(
        `${agentMessage}\n${JSON.stringify(response || {})}`,
      );
      issueUrl = parsed.issueUrl;
      issueNumber = parsed.issueNumber;
    }

    if (!issueUrl) {
      throw new Error("Issue creation succeeded but GitHub issue URL was not returned.");
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
      message:
        provider === "github_api"
          ? "GitHub issue created."
          : "GitHub issue created via workflow tool.",
      data: {
        issueUrl,
        issueNumber,
        provider,
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
