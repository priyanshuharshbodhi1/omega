import { invokeAgent } from "@/lib/agent-builder";
import {
  createActionAuditLog,
  createSupportTicket,
  runESQL,
} from "@/lib/elasticsearch";
import { NextResponse } from "next/server";

export const maxDuration = 60;

function parseESQLRow(result: any): Record<string, number> {
  const row = (result as any)?.values?.[0] || [];
  const columns = (result as any)?.columns?.map((c: any) => c.name) || [];
  const out: Record<string, number> = {};
  columns.forEach((col: string, i: number) => {
    out[col] = Number(row[i] || 0);
  });
  return out;
}

function parseESQLRows(result: any): Record<string, any>[] {
  const cols = (result as any)?.columns?.map((c: any) => c.name) || [];
  return ((result as any)?.values || []).map((row: any[]) => {
    const obj: Record<string, any> = {};
    cols.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

/**
 * Omega Sentiment Spike Detection Workflow
 *
 * Flow: Alert trigger → ES|QL metric collection → Agent analysis →
 *       Conditional ticket creation → Slack notification → Audit log
 *
 * Mirrors Elastic Workflows pattern: data → insights → action
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teamId = String(body?.teamId || "").trim();

    if (!teamId) {
      return NextResponse.json(
        { success: false, message: "Missing teamId." },
        { status: 400 },
      );
    }

    // ── Step 1: Collect Recent Metrics (last 1 hour) via ES|QL ───────
    const recentResult = await runESQL(`
FROM feedback
| WHERE teamId == "${teamId}"
| WHERE createdAt >= NOW() - 1 hour
| STATS
    recent_total = COUNT(*),
    recent_negative = COUNT(*) WHERE sentiment == "negative",
    recent_avg_rating = AVG(rate)
    `);
    const recent = parseESQLRow(recentResult);

    // ── Step 2: Collect Baseline Metrics (1–24 hours ago) ────────────
    const baselineResult = await runESQL(`
FROM feedback
| WHERE teamId == "${teamId}"
| WHERE createdAt >= NOW() - 24 hours
| WHERE createdAt < NOW() - 1 hour
| STATS
    baseline_total = COUNT(*),
    baseline_negative = COUNT(*) WHERE sentiment == "negative",
    baseline_avg_rating = AVG(rate)
    `);
    const baseline = parseESQLRow(baselineResult);

    // ── Step 3: Calculate Spike ──────────────────────────────────────
    const recentNegRate =
      recent.recent_total > 0
        ? recent.recent_negative / recent.recent_total
        : 0;
    const baselineNegRate =
      baseline.baseline_total > 0
        ? baseline.baseline_negative / baseline.baseline_total
        : 0;
    const ratingDrop =
      (baseline.baseline_avg_rating || 0) - (recent.recent_avg_rating || 0);

    const spikeDetected =
      recentNegRate > baselineNegRate * 1.3 || ratingDrop > 0.5;

    if (!spikeDetected && recent.recent_total > 0) {
      await createActionAuditLog({
        teamId,
        action: "sentiment_spike_check",
        status: "success",
        detail: `No spike. Recent neg: ${(recentNegRate * 100).toFixed(1)}%, Baseline: ${(baselineNegRate * 100).toFixed(1)}%`,
      });

      return NextResponse.json({
        success: true,
        spike_detected: false,
        metrics: {
          recent_negative_rate: recentNegRate,
          baseline_negative_rate: baselineNegRate,
          rating_drop: ratingDrop,
        },
      });
    }

    // ── Step 4: Get Recent Complaints for Root Cause ─────────────────
    const complaintsResult = await runESQL(`
FROM feedback
| WHERE teamId == "${teamId}"
| WHERE sentiment == "negative"
| WHERE createdAt >= NOW() - 1 hour
| KEEP id, description, rate, createdAt
| SORT createdAt DESC
| LIMIT 10
    `);
    const complaints = parseESQLRows(complaintsResult);

    // ── Step 5: Agent Analysis (Business Impact) ─────────────────────
    const agentId =
      process.env.ELASTIC_SENTIMENT_SPIKE_AGENT_ID ||
      "omega_sentiment_spike_analyzer";

    const agentPrompt = `TEAM_ID=${teamId}
SPIKE DETECTED: Negative sentiment has spiked.

METRICS:
- Recent (last 1h): ${recent.recent_total} total feedback, ${recent.recent_negative} negative (${(recentNegRate * 100).toFixed(1)}%)
- Baseline (1-24h ago): ${baseline.baseline_total} total, ${baseline.baseline_negative} negative (${(baselineNegRate * 100).toFixed(1)}%)
- Average rating drop: ${ratingDrop.toFixed(2)} stars
- Recent avg rating: ${(recent.recent_avg_rating || 0).toFixed(1)}
- Baseline avg rating: ${(baseline.baseline_avg_rating || 0).toFixed(1)}

RECENT NEGATIVE FEEDBACK SAMPLES:
${complaints.map((c: any, i: number) => `${i + 1}. [Rating: ${c.rate}] ${c.description}`).join("\n")}

Analyze this spike and provide your assessment.`;

    let agentAnalysis: any = null;
    try {
      const agentResponse = await invokeAgent({ agentId, message: agentPrompt });
      const rawMessage =
        (agentResponse as any)?.response?.message ||
        (agentResponse as any)?.message ||
        "";
      try {
        agentAnalysis = JSON.parse(rawMessage);
      } catch {
        agentAnalysis = { raw_response: rawMessage };
      }
    } catch {
      agentAnalysis = {
        severity: ratingDrop > 1.5 ? "CRITICAL" : ratingDrop > 1.0 ? "HIGH" : "MEDIUM",
        spike_summary: `Negative sentiment spiked from ${(baselineNegRate * 100).toFixed(1)}% to ${(recentNegRate * 100).toFixed(1)}%`,
        root_cause: "Multiple negative feedback entries detected in the last hour",
        business_impact: `Customer satisfaction dropped. Average rating fell by ${ratingDrop.toFixed(1)} stars in the last hour.`,
        recommended_actions: [
          "Review recent negative feedback entries",
          "Check for system outages or service degradation",
          "Prepare customer communication if issue is widespread",
        ],
      };
    }

    const severity = agentAnalysis?.severity || "MEDIUM";

    // ── Step 6: Conditional Actions ──────────────────────────────────
    let ticketId = null;
    let slackSent = false;

    if (severity === "CRITICAL" || severity === "HIGH") {
      const ticket = await createSupportTicket({
        teamId,
        source: "omega_escalation",
        customerName: "Omega Workflow (Auto)",
        customerEmail: "workflow@omega.internal",
        subject: `[${severity}] Sentiment Spike: ${agentAnalysis?.spike_summary || "Negative feedback spike detected"}`,
        description: `Automated ticket from Omega Sentiment Spike Workflow.\n\nRoot Cause: ${agentAnalysis?.root_cause || "See analysis"}\n\nBusiness Impact: ${agentAnalysis?.business_impact || "See analysis"}\n\nRecommended Actions:\n${(agentAnalysis?.recommended_actions || []).map((a: string) => `- ${a}`).join("\n")}`,
      });
      ticketId = ticket.id;
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl && (severity === "CRITICAL" || severity === "HIGH")) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Omega Sentiment Spike Alert [${severity}]: ${agentAnalysis?.spike_summary || "Spike detected"}`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Omega Sentiment Spike Alert*\n*Severity:* ${severity}\n*Summary:* ${agentAnalysis?.spike_summary || "Spike detected"}\n*Rating Drop:* ${ratingDrop.toFixed(1)} stars`,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Business Impact:*\n${agentAnalysis?.business_impact || "See dashboard"}`,
                },
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Recommended Actions:*\n${(agentAnalysis?.recommended_actions || []).map((a: string) => `- ${a}`).join("\n")}`,
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

    // ── Step 7: Audit Log ────────────────────────────────────────────
    await createActionAuditLog({
      teamId,
      action: "sentiment_spike_workflow",
      status: "success",
      detail: JSON.stringify({
        severity,
        recent_negative_rate: recentNegRate,
        baseline_negative_rate: baselineNegRate,
        rating_drop: ratingDrop,
        ticket_created: ticketId,
        slack_notified: slackSent,
        complaints_analyzed: complaints.length,
      }),
    });

    return NextResponse.json({
      success: true,
      spike_detected: true,
      severity,
      analysis: agentAnalysis,
      actions_taken: {
        ticket_created: ticketId,
        slack_notified: slackSent,
        audit_logged: true,
      },
      metrics: {
        recent_negative_rate: recentNegRate,
        baseline_negative_rate: baselineNegRate,
        rating_drop: ratingDrop,
        recent_total: recent.recent_total,
        complaints_analyzed: complaints.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Sentiment spike workflow failed." },
      { status: 500 },
    );
  }
}
