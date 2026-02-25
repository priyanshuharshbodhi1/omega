import { invokeAgent } from "@/lib/agent-builder";
import {
  createActionAuditLog,
  runESQL,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * Omega Knowledge Gap Detection Workflow
 *
 * Flow: Scheduled/manual trigger → ES|QL query unanswered topics →
 *       ES|QL query recent user questions → Agent clusters gaps →
 *       Generate content recommendations → Audit log
 *
 * Mirrors Elastic Workflows pattern: data → insights → action
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teamId = String(body?.teamId || "").trim();
    const lookbackDays = Number(body?.lookbackDays || 7);

    if (!teamId) {
      return NextResponse.json(
        { success: false, message: "Missing teamId." },
        { status: 400 },
      );
    }

    // ── Step 1: Find Unanswered/Escalated Conversations ──────────────
    const unansweredResult = await runESQL(`
FROM support_conversations
| WHERE teamId == "${teamId}"
| WHERE role == "assistant"
| WHERE MATCH(message, "enough information") OR MATCH(message, "support team") OR MATCH(message, "trouble generating")
| KEEP sessionId, message, createdAt
| SORT createdAt DESC
| LIMIT 50
    `);

    const unCols = (unansweredResult as any)?.columns?.map((c: any) => c.name) || [];
    const unansweredMessages = ((unansweredResult as any)?.values || []).map((row: any[]) => {
      const obj: Record<string, any> = {};
      unCols.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj;
    });

    // ── Step 2: Get Recent User Queries ──────────────────────────────
    const startTime = new Date(
      Date.now() - lookbackDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const userQueriesResult = await runESQL(`
FROM support_conversations
| WHERE teamId == "${teamId}"
| WHERE role == "user"
| WHERE createdAt >= "${startTime}"
| KEEP sessionId, message, createdAt
| SORT createdAt DESC
| LIMIT 100
    `);

    const uqCols = (userQueriesResult as any)?.columns?.map((c: any) => c.name) || [];
    const userQueries = ((userQueriesResult as any)?.values || []).map((row: any[]) => {
      const obj: Record<string, any> = {};
      uqCols.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj;
    });

    // Find user queries from sessions that had unanswered responses
    const unansweredSessionIds = new Set(
      unansweredMessages.map((m: any) => m.sessionId),
    );
    const gapQueries = userQueries.filter((q: any) =>
      unansweredSessionIds.has(q.sessionId),
    );

    // ── Step 3: Agent Analysis (Gap Detection + Clustering) ─────────
    const agentId =
      process.env.ELASTIC_KNOWLEDGE_GAP_AGENT_ID ||
      "omega_knowledge_gap_detector";

    const agentPrompt = `TEAM_ID=${teamId}
ANALYSIS_WINDOW=Last ${lookbackDays} days

UNANSWERED/ESCALATED ASSISTANT RESPONSES (${unansweredMessages.length} total):
${unansweredMessages.slice(0, 20).map((m: any, i: number) => `${i + 1}. [Session: ${m.sessionId}] ${m.message?.slice(0, 150)}`).join("\n")}

USER QUERIES FROM UNANSWERED SESSIONS (${gapQueries.length} total):
${gapQueries.slice(0, 30).map((q: any, i: number) => `${i + 1}. [Session: ${q.sessionId}] ${q.message}`).join("\n")}

ALL RECENT USER QUERIES (${userQueries.length} total, for context):
${userQueries.slice(0, 30).map((q: any, i: number) => `${i + 1}. ${q.message}`).join("\n")}

Analyze these conversations to identify knowledge gaps and recommend content to add.`;

    let agentAnalysis: any = null;
    try {
      const agentResponse = await invokeAgent({
        agentId,
        message: agentPrompt,
      });
      const rawMessage =
        (agentResponse as any)?.response?.message ||
        (agentResponse as any)?.message ||
        "";
      try {
        agentAnalysis = JSON.parse(rawMessage);
      } catch {
        agentAnalysis = {
          total_gaps_detected: unansweredSessionIds.size,
          analysis_window: `Last ${lookbackDays} days`,
          gaps: [],
          summary: rawMessage.slice(0, 500),
        };
      }
    } catch {
      // Fallback: basic gap analysis without agent
      const queryTexts = gapQueries.map((q: any) => String(q.message || ""));
      agentAnalysis = {
        total_gaps_detected: unansweredSessionIds.size,
        analysis_window: `Last ${lookbackDays} days`,
        gaps:
          unansweredSessionIds.size > 0
            ? [
                {
                  topic: "General",
                  frequency: unansweredSessionIds.size,
                  sample_queries: queryTexts.slice(0, 5),
                  impact: "MEDIUM",
                  recommended_content: {
                    title: "FAQ - Common Customer Questions",
                    outline: [
                      "Address top unanswered queries",
                      "Step-by-step troubleshooting",
                      "Contact information",
                    ],
                    priority: "next_sprint",
                  },
                },
              ]
            : [],
        summary:
          unansweredSessionIds.size === 0
            ? "Knowledge base is in good shape. No significant gaps detected."
            : `${unansweredSessionIds.size} conversations could not be fully answered in the last ${lookbackDays} days.`,
      };
    }

    // ── Step 4: Notify Slack if Significant Gaps ─────────────────────
    let slackSent = false;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const gapCount = agentAnalysis?.total_gaps_detected || 0;
    const hasHighImpactGaps = (agentAnalysis?.gaps || []).some(
      (g: any) => g.impact === "HIGH",
    );

    if (webhookUrl && (gapCount >= 5 || hasHighImpactGaps)) {
      try {
        const topGaps = (agentAnalysis?.gaps || [])
          .slice(0, 3)
          .map(
            (g: any) =>
              `• *${g.topic}* (${g.frequency} queries, ${g.impact} impact)`,
          )
          .join("\n");

        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Omega Knowledge Gap Report: ${gapCount} gaps detected`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Omega Knowledge Gap Report* :mag:\n*Gaps Detected:* ${gapCount}\n*Analysis Window:* Last ${lookbackDays} days`,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Top Gaps:*\n${topGaps || "See full report for details"}`,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Summary:*\n${agentAnalysis?.summary || "Review recommended"}`,
                },
              },
            ],
          }),
        });
        slackSent = true;
      } catch {
        // Continue even if Slack fails
      }
    }

    // ── Step 5: Audit Log ────────────────────────────────────────────
    await createActionAuditLog({
      teamId,
      action: "knowledge_gap_workflow",
      status: "success",
      detail: JSON.stringify({
        gaps_detected: gapCount,
        unanswered_sessions: unansweredSessionIds.size,
        user_queries_analyzed: userQueries.length,
        gap_queries_found: gapQueries.length,
        lookback_days: lookbackDays,
        slack_notified: slackSent,
        high_impact_gaps: hasHighImpactGaps,
      }),
    });

    return NextResponse.json({
      success: true,
      analysis: agentAnalysis,
      actions_taken: {
        slack_notified: slackSent,
        audit_logged: true,
      },
      stats: {
        unanswered_sessions: unansweredSessionIds.size,
        user_queries_analyzed: userQueries.length,
        gap_queries_found: gapQueries.length,
        lookback_days: lookbackDays,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Knowledge gap workflow failed.",
      },
      { status: 500 },
    );
  }
}
