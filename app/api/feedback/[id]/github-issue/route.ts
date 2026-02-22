import { auth } from "@/auth";
import { invokeAgent } from "@/lib/agent-builder";
import { esClient, getTeam } from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

const ISSUE_URL_REGEX = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/issues\/\d+/i;
const ISSUE_NUMBER_REGEX = /\/issues\/(\d+)/i;

interface GitHubIssue {
  number: number;
  html_url: string;
  title: string;
  body?: string | null;
  created_at: string;
  pull_request?: unknown;
}

function makeDefaultTitle(description: string) {
  const clean = description.trim().replace(/\s+/g, " ");
  const short = clean.length > 70 ? `${clean.slice(0, 67)}...` : clean;
  return `[Customer Feedback] ${short || "Reported issue"}`;
}

function makeDefaultBody(feedback: any) {
  const created = feedback?.createdAt
    ? new Date(feedback.createdAt).toISOString()
    : "unknown";
  const summary = String(feedback?.description || "No description available.")
    .trim()
    .replace(/\s+/g, " ");

  return [
    "## Summary",
    summary,
    "",
    "## Customer Impact",
    "- Severity: to be triaged",
    "- Affected users: unknown",
    "- Business impact: unknown",
    "",
    "## Reproduction Steps",
    "1. Open the relevant feature/page",
    "2. Perform the customer-reported action",
    "3. Observe the behavior described above",
    "",
    "## Expected vs Actual",
    "- Expected: Feature works as intended with no interruption",
    "- Actual: Behavior reported by customer occurs",
    "",
    "## Evidence",
    "- Feedback source: Omega customer feedback entry",
    `- Original feedback: "${summary}"`,
    "",
    "## Context",
    `- Feedback ID: ${feedback?.id || "unknown"}`,
    `- Team ID: ${feedback?.teamId || "unknown"}`,
    `- Sentiment: ${feedback?.sentiment || "unknown"}`,
    `- Rating: ${feedback?.rate ?? "unknown"}`,
    `- Submitted At: ${created}`,
    `- Customer Name: ${feedback?.customerName || "Anonymous"}`,
    `- Customer Email: ${feedback?.customerEmail || "N/A"}`,
    "",
    "## Environment",
    "- App: Omega",
    "- Browser: unknown",
    "- OS/Device: unknown",
    "- App version/commit: unknown",
    "",
    "## Proposed Fix Direction",
    "- Investigate root cause and identify failure path",
    "- Add regression test for the reproduced scenario",
    "- Prepare rollback/mitigation if release risk is high",
    "",
    "## Acceptance Criteria",
    "- [ ] Root cause identified and documented",
    "- [ ] Fix merged with tests",
    "- [ ] Verified in staging",
    "- [ ] Customer-facing impact resolved",
  ].join("\n");
}

function normalizeLabels(sentiment?: string, labels?: string[]) {
  if (Array.isArray(labels) && labels.length > 0) {
    return labels
      .map((l) => String(l).trim().toLowerCase())
      .filter((l) => l.length > 0);
  }

  const base = ["customer-feedback"];
  if (sentiment) base.push(`sentiment:${String(sentiment).toLowerCase()}`);
  return base;
}

function parseIssueMeta(agentMessage: string) {
  const issueUrl = agentMessage.match(ISSUE_URL_REGEX)?.[0] || null;
  const issueNumber = issueUrl
    ? Number(issueUrl.match(ISSUE_NUMBER_REGEX)?.[1] || "")
    : null;

  return {
    issueUrl,
    issueNumber: Number.isFinite(issueNumber as number) ? issueNumber : null,
  };
}

function parseIssueMetaFromAny(response: any, fallbackMessage: string) {
  const fromMessage = parseIssueMeta(fallbackMessage);
  if (fromMessage.issueUrl) return fromMessage;

  const blob = JSON.stringify(response || {});
  const issueUrl = blob.match(ISSUE_URL_REGEX)?.[0] || null;
  const issueNumber = issueUrl
    ? Number(issueUrl.match(ISSUE_NUMBER_REGEX)?.[1] || "")
    : null;
  return {
    issueUrl,
    issueNumber: Number.isFinite(issueNumber as number) ? issueNumber : null,
  };
}

async function findRecentIssueByTitle(params: {
  owner: string;
  repo: string;
  githubToken: string;
  title: string;
  feedbackId: string;
  createdAfterMs: number;
}) {
  const { owner, repo, githubToken, title, feedbackId, createdAfterMs } = params;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues?state=all&sort=created&direction=desc&per_page=30`,
    {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "omega-workflow-fallback",
      },
    },
  );

  if (!res.ok) {
    return null;
  }

  const issues = (await res.json()) as GitHubIssue[];
  const after = new Date(createdAfterMs).getTime();
  const feedbackMarker = `Feedback ID: ${feedbackId}`;

  const match = issues.find((issue) => {
    if (issue.pull_request) return false;
    const createdAt = new Date(issue.created_at).getTime();
    const recent = Number.isFinite(createdAt) ? createdAt >= after : true;
    const titleMatch = issue.title?.trim() === title.trim();
    const bodyMatch = issue.body?.includes(feedbackMarker) || false;
    return recent && (titleMatch || bodyMatch);
  });

  if (!match) return null;
  return {
    issueUrl: match.html_url,
    issueNumber: match.number,
  };
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const feedbackId = params.id;
  const body = await req.json().catch(() => ({}));
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
    const feedbackResult = await esClient.get({
      index: "feedback",
      id: feedbackId,
    });
    const feedback = { id: feedbackResult._id, ...(feedbackResult._source as any) };

    const team = feedback?.teamId ? await getTeam(feedback.teamId) : null;
    if (team?.issueTracker === "linear") {
      return NextResponse.json(
        {
          success: false,
          message:
            "This team is configured for Linear. Switch to GitHub in Settings first.",
        },
        { status: 400 },
      );
    }

    const title = String(body?.title || makeDefaultTitle(feedback?.description || ""));
    const issueBody = String(body?.body || makeDefaultBody(feedback));
    const labels = normalizeLabels(feedback?.sentiment, body?.labels);

    const prompt = [
      `Use the workflow tool \`${workflowToolId}\` exactly once.`,
      "Do not ask follow-up questions.",
      "Create a GitHub issue with these exact values:",
      `- owner: ${owner}`,
      `- repo: ${repo}`,
      `- title: ${title}`,
      `- body: ${issueBody}`,
      `- labels: ${JSON.stringify(labels)}`,
      ...(githubToken ? [`- github_token: ${githubToken}`] : []),
      "",
      "After creating, respond with:",
      "1) The issue URL",
      "2) The issue number",
    ].join("\n");

    const startedAt = Date.now();
    const response = await invokeAgent({
      agentId,
      message: prompt,
    });

    const agentMessage = String(
      response?.response?.message || response?.message || "",
    );
    const { issueUrl, issueNumber } = parseIssueMetaFromAny(
      response,
      agentMessage,
    );
    let resolvedIssueUrl = issueUrl;
    let resolvedIssueNumber = issueNumber;

    if (!resolvedIssueUrl && githubToken) {
      const fallback = await findRecentIssueByTitle({
        owner,
        repo,
        githubToken,
        title,
        feedbackId,
        createdAfterMs: startedAt - 2 * 60 * 1000,
      });
      if (fallback?.issueUrl) {
        resolvedIssueUrl = fallback.issueUrl;
        resolvedIssueNumber = fallback.issueNumber;
      }
    }

    if (resolvedIssueUrl) {
      await esClient.update({
        index: "feedback",
        id: feedbackId,
        doc: {
          githubIssueUrl: resolvedIssueUrl,
          githubIssueNumber: resolvedIssueNumber,
          githubIssueCreatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        refresh: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: resolvedIssueUrl
        ? "GitHub issue created via workflow tool."
        : "Agent responded, but issue URL could not be parsed.",
      data: {
        issueUrl: resolvedIssueUrl,
        issueNumber: resolvedIssueNumber,
        owner,
        repo,
        agentId,
        workflowToolId,
        agentMessage,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}
